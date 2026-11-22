import crypto from "node:crypto";

export type CaptchaProvider = "turnstile" | "hcaptcha" | "mock" | "none";

export interface AuthSecurityConfig {
  hmacSecret: string;
  deviceCookieSecret: string;
  trustProxy: boolean;
  trustedProxyHeaders: string[];
  minResponseMs: number;
  responseJitterMs: number;
  accountFailThreshold: number;
  accountWindowSeconds: number;
  lockoutStepsSeconds: number[];
  lockoutDecayHours: number;
  ipFailThreshold: number;
  ipWindowSeconds: number;
  pairFailThreshold: number;
  pairWindowSeconds: number;
  attackModeDistinctAccounts: number;
  attackModeMaxIps: number;
  attackModeWindowSeconds: number;
  attackModeDurationSeconds: number;
  captchaProvider: CaptchaProvider;
  captchaSecretKey: string | undefined;
  captchaFailStepBeforeLockout: number;
  hibpEnabled: boolean;
  hibpTimeoutMs: number;
  argon2MemoryKiB: number;
  argon2Passes: number;
  argon2Parallelism: number;
  logRetentionDays: number;
  requireEmailConfirmation: boolean;
}

const DEV_EPHEMERAL_SECRET = crypto
  .createHash("sha256")
  .update("readingflow-dev-only-auth-hmac-secret-v1")
  .digest("hex");

function parseIntEnv(
  name: string,
  fallback: number,
  min: number,
  max: number
): number {
  const raw = process.env[name];
  if (!raw || raw.trim() === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function parseBoolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw || raw.trim() === "") return fallback;
  const norm = raw.trim().toLowerCase();
  if (norm === "1" || norm === "true" || norm === "yes") return true;
  if (norm === "0" || norm === "false" || norm === "no") return false;
  return fallback;
}

function parseStepsEnv(name: string, fallback: number[]): number[] {
  const raw = process.env[name];
  if (!raw || raw.trim() === "") return fallback;
  const parsed = raw
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 10 && n <= 86400);
  return parsed.length > 0 ? parsed : fallback;
}

export function getAuthSecurityConfig(): AuthSecurityConfig {
  const isProd = process.env.NODE_ENV === "production";
  const isTest = process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);

  const rawHmacSecret = process.env.AUTH_HMAC_SECRET?.trim();
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
  if (
    isProd &&
    !isTest &&
    !isBuildPhase &&
    (!rawHmacSecret || rawHmacSecret.length < 32)
  ) {
    // Proíbe fallback silencioso para DEV_EPHEMERAL_SECRET em qualquer runtime de produção (Cloudflare, Vercel, Node)
    throw new Error(
      "AUTH_HMAC_SECRET deve ser configurado em produção com pelo menos 32 caracteres."
    );
  }
  const hmacSecret = rawHmacSecret || DEV_EPHEMERAL_SECRET;
  const deviceCookieSecret =
    process.env.AUTH_DEVICE_COOKIE_SECRET?.trim() ||
    crypto
      .createHmac("sha256", hmacSecret)
      .update("readingflow:known-device-cookie:v1")
      .digest("hex");

  const rawProvider = (
    process.env.AUTH_CAPTCHA_PROVIDER || (isTest ? "none" : "none")
  )
    .trim()
    .toLowerCase();
  const captchaProvider: CaptchaProvider =
    rawProvider === "turnstile" ||
    rawProvider === "hcaptcha" ||
    rawProvider === "mock"
      ? rawProvider
      : "none";

  const trustedProxyHeaders = (
    process.env.AUTH_TRUSTED_PROXY_HEADERS ||
    "cf-connecting-ip,x-real-ip,x-forwarded-for"
  )
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

  // OWASP Password Storage Cheat Sheet: mínimo m=19 MiB (19456 KiB), t=2, p=1.
  // Calibrado no servidor para ~225–250ms com m=64 MiB (65536 KiB), t=6, p=1 em produção.
  const defaultArgonMemory = isTest ? 19456 : 65536;
  const defaultArgonPasses = isTest ? 2 : 6;

  // Tempo mínimo equalizado: >= 600ms + jitter (0..80ms) em dev/prod; configurável em testes unitários
  const defaultMinResponseMs = isTest ? 0 : 600;
  const defaultJitterMs = isTest ? 0 : 80;

  return {
    hmacSecret,
    deviceCookieSecret,
    trustProxy: parseBoolEnv("AUTH_TRUST_PROXY", false),
    trustedProxyHeaders,
    minResponseMs: parseIntEnv(
      "AUTH_MIN_RESPONSE_MS",
      defaultMinResponseMs,
      0,
      5000
    ),
    responseJitterMs: parseIntEnv(
      "AUTH_RESPONSE_JITTER_MS",
      defaultJitterMs,
      0,
      1000
    ),
    accountFailThreshold: parseIntEnv("AUTH_ACCOUNT_FAIL_THRESHOLD", 3, 1, 20),
    accountWindowSeconds: parseIntEnv(
      "AUTH_ACCOUNT_WINDOW_SEC",
      900,
      60,
      86400
    ),
    lockoutStepsSeconds: parseStepsEnv(
      "AUTH_LOCKOUT_STEPS_SEC",
      [60, 300, 900, 3600]
    ),
    lockoutDecayHours: parseIntEnv("AUTH_LOCKOUT_DECAY_HOURS", 24, 1, 168),
    ipFailThreshold: parseIntEnv("AUTH_IP_FAIL_THRESHOLD", 10, 2, 100),
    ipWindowSeconds: parseIntEnv("AUTH_IP_WINDOW_SEC", 300, 30, 3600),
    pairFailThreshold: parseIntEnv("AUTH_PAIR_FAIL_THRESHOLD", 3, 1, 20),
    pairWindowSeconds: parseIntEnv("AUTH_PAIR_WINDOW_SEC", 900, 60, 86400),
    attackModeDistinctAccounts: parseIntEnv(
      "AUTH_ATTACK_MODE_DISTINCT_ACCOUNTS",
      8,
      2,
      200
    ),
    attackModeMaxIps: parseIntEnv("AUTH_ATTACK_MODE_MAX_IPS", 5, 1, 100),
    attackModeWindowSeconds: parseIntEnv(
      "AUTH_ATTACK_MODE_WINDOW_SEC",
      300,
      30,
      3600
    ),
    attackModeDurationSeconds: parseIntEnv(
      "AUTH_ATTACK_MODE_DURATION_SEC",
      600,
      60,
      7200
    ),
    captchaProvider,
    captchaSecretKey: process.env.AUTH_CAPTCHA_SECRET_KEY?.trim() || undefined,
    captchaFailStepBeforeLockout: parseIntEnv(
      "AUTH_CAPTCHA_STEP_BEFORE_LOCKOUT",
      2,
      1,
      10
    ),
    hibpEnabled: parseBoolEnv("AUTH_HIBP_CHECK_ENABLED", !isTest),
    hibpTimeoutMs: parseIntEnv("AUTH_HIBP_TIMEOUT_MS", 2500, 300, 10000),
    argon2MemoryKiB: parseIntEnv(
      "AUTH_ARGON2_MEMORY_KIB",
      defaultArgonMemory,
      19456,
      524288
    ),
    argon2Passes: parseIntEnv("AUTH_ARGON2_PASSES", defaultArgonPasses, 2, 20),
    argon2Parallelism: parseIntEnv("AUTH_ARGON2_PARALLELISM", 1, 1, 4),
    logRetentionDays: parseIntEnv("AUTH_LOG_RETENTION_DAYS", 90, 7, 365),
    requireEmailConfirmation: parseBoolEnv(
      "AUTH_REQUIRE_EMAIL_CONFIRMATION",
      false
    ),
  };
}
