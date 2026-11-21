import crypto from "node:crypto";
import { getAuthSecurityConfig } from "@/server/security/auth-config";

export type AuthAuditEventType =
  | "login_failed"
  | "login_success"
  | "lockout_started"
  | "lockout_blocked"
  | "captcha_required"
  | "captcha_failed"
  | "attack_mode_triggered"
  | "signup_requested"
  | "password_reset_requested"
  | "password_reset_completed"
  | "password_changed"
  | "magic_link_requested"
  | "confirmation_resent"
  | "lockout_alert_dispatched"
  | "account_unlocked";

export interface AuthAuditLogEntry {
  timestamp: string;
  level: "info" | "warn";
  service: "readingflow-auth";
  event: AuthAuditEventType;
  request_id: string;
  account_hash: string | null;
  ip_hash: string | null;
  ua_summary: string;
  internal_reason?: string;
  retention_days: number;
  meta?: Record<string, string | number | boolean | null>;
}

const SENSITIVE_KEY_PATTERN =
  /password|passwd|pwd|secret|token|authorization|cookie|apikey|api_key|passphrase|credential|email|body|raw_body|form_data/i;

const EMAIL_VALUE_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BEARER_VALUE_PATTERN = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;

function sanitizeLogString(val: string): string {
  return val
    .replace(EMAIL_VALUE_PATTERN, "[REDACTED_EMAIL]")
    .replace(BEARER_VALUE_PATTERN, "Bearer [REDACTED]")
    .slice(0, 240);
}

/**
 * Redação automática recursiva de campos sensíveis para garantir que senhas,
 * tokens, cookies, headers Authorization, corpos de formulário e e-mails em claro
 * nunca cheguem aos logs.
 */
export function redactSensitiveData(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[TRUNCATED]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return sanitizeLogString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value
      .slice(0, 20)
      .map((item) => redactSensitiveData(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactSensitiveData(v, depth + 1);
      }
    }
    return out;
  }
  return "[UNSERIALIZABLE]";
}

export function summarizeUserAgent(rawUa?: string | null): string {
  if (!rawUa) return "unknown";
  const ua = rawUa.toLowerCase();
  const browser = ua.includes("edg/")
    ? "Edge"
    : ua.includes("chrome/")
      ? "Chrome"
      : ua.includes("firefox/")
        ? "Firefox"
        : ua.includes("safari/") && !ua.includes("chrome/")
          ? "Safari"
          : ua.includes("curl") || ua.includes("k6")
            ? "CLI"
            : "Other";
  const os = ua.includes("windows")
    ? "Windows"
    : ua.includes("android")
      ? "Android"
      : ua.includes("iphone") || ua.includes("ipad")
        ? "iOS"
        : ua.includes("mac os")
          ? "macOS"
          : ua.includes("linux")
            ? "Linux"
            : "Unknown";
  return `${browser}/${os}`;
}

export function hashIpForLog(
  normalizedIp: string | null | undefined
): string | null {
  if (!normalizedIp) return null;
  const cfg = getAuthSecurityConfig();
  return crypto
    .createHmac("sha256", cfg.hmacSecret)
    .update(`ip-log:${normalizedIp}`)
    .digest("hex")
    .slice(0, 16);
}

type LogSink = (serializedJson: string, entry: AuthAuditLogEntry) => void;

const globalLogState = globalThis as unknown as {
  __rfAuthLogSinks?: Set<LogSink>;
  __rfAuthFailureTimestamps?: number[];
};

function getSinks(): Set<LogSink> {
  if (!globalLogState.__rfAuthLogSinks) {
    globalLogState.__rfAuthLogSinks = new Set<LogSink>();
  }
  return globalLogState.__rfAuthLogSinks;
}

function getFailureTimestamps(): number[] {
  if (!globalLogState.__rfAuthFailureTimestamps) {
    globalLogState.__rfAuthFailureTimestamps = [];
  }
  return globalLogState.__rfAuthFailureTimestamps;
}

export function subscribeAuthLogSink(sink: LogSink): () => void {
  const sinks = getSinks();
  sinks.add(sink);
  return () => {
    sinks.delete(sink);
  };
}

/**
 * Métrica de alerta operacional: contagem de falhas de autenticação nos últimos 60s.
 */
export function getAuthFailuresPerMinute(nowMs = Date.now()): number {
  const cutoff = nowMs - 60_000;
  const list = getFailureTimestamps();
  while (list.length > 0 && (list[0] ?? 0) < cutoff) {
    list.shift();
  }
  return list.length;
}

export function resetAuthFailureMetricForTests(): void {
  getFailureTimestamps().length = 0;
}

export function logAuthEvent(params: {
  event: AuthAuditEventType;
  requestId?: string;
  accountHmac?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  internalReason?: string;
  meta?: Record<string, string | number | boolean | null>;
}): AuthAuditLogEntry {
  const cfg = getAuthSecurityConfig();
  const now = Date.now();

  if (
    params.event === "login_failed" ||
    params.event === "lockout_blocked" ||
    params.event === "captcha_failed"
  ) {
    const list = getFailureTimestamps();
    list.push(now);
    const cutoff = now - 60_000;
    while (list.length > 0 && (list[0] ?? 0) < cutoff) {
      list.shift();
    }
  }

  const sanitizedMeta = params.meta
    ? (redactSensitiveData(params.meta) as Record<
        string,
        string | number | boolean | null
      >)
    : undefined;

  const entry: AuthAuditLogEntry = {
    timestamp: new Date(now).toISOString(),
    level:
      params.event === "lockout_started" ||
      params.event === "lockout_blocked" ||
      params.event === "attack_mode_triggered" ||
      params.event === "captcha_failed"
        ? "warn"
        : "info",
    service: "readingflow-auth",
    event: params.event,
    request_id: params.requestId || crypto.randomUUID(),
    account_hash: params.accountHmac ? params.accountHmac.slice(0, 16) : null,
    ip_hash: hashIpForLog(params.clientIp),
    ua_summary: summarizeUserAgent(params.userAgent),
    ...(params.internalReason
      ? { internal_reason: sanitizeLogString(params.internalReason) }
      : {}),
    retention_days: cfg.logRetentionDays,
    ...(sanitizedMeta && Object.keys(sanitizedMeta).length > 0
      ? { meta: sanitizedMeta }
      : {}),
  };

  const serialized = JSON.stringify(entry);
  const sinks = getSinks();
  for (const sink of sinks) {
    try {
      sink(serialized, entry);
    } catch {
      // Isola erros de sinks de teste/telemetria
    }
  }

  // Em produção/dev (fora de Vitest silencioso, ou se AUTH_LOG_STDOUT=1) escreve JSON estruturado no stdout
  if (
    process.env.AUTH_LOG_STDOUT === "1" ||
    (process.env.NODE_ENV !== "test" && !process.env.VITEST)
  ) {
    process.stdout.write(`${serialized}\n`);
  }

  return entry;
}
