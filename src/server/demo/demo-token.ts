import "server-only";
import crypto from "node:crypto";
import { DEMO_SESSION_TTL_SECONDS, isDemoEnabled } from "@/lib/auth-demo";
import { getAuthSecurityConfig } from "@/server/security/auth-config";
import { constantTimeEqualBytes } from "@/server/security/password";

const DEMO_PAYLOAD_PREFIX = "demo=1";
const DEMO_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DEMO_RATE_LIMIT_MAX_REQUESTS = 20;

const globalDemoRateState = globalThis as unknown as {
  __rfDemoIpBuckets?: Map<string, number[]>;
};

function getDemoIpBuckets(): Map<string, number[]> {
  if (!globalDemoRateState.__rfDemoIpBuckets) {
    globalDemoRateState.__rfDemoIpBuckets = new Map();
  }
  return globalDemoRateState.__rfDemoIpBuckets;
}

function computeDemoSignatureHex(payload: string): string {
  const secret = getAuthSecurityConfig().hmacSecret;
  return crypto
    .createHmac("sha256", secret)
    .update(`rf-demo-readonly:${payload}`)
    .digest("hex");
}

/**
 * Emite um token stateless assinado com HMAC-SHA256 para a demonstração somente leitura.
 * Contém apenas o marcador `demo=1` e a expiração (epoch em segundos) — zero PII, zero DB, zero KDF.
 */
export function signDemoSessionToken(
  nowMs = Date.now(),
  ttlSeconds = DEMO_SESSION_TTL_SECONDS
): { token: string; expiresAtMs: number; maxAgeSeconds: number } {
  const safeTtl = Math.max(60, Math.min(24 * 60 * 60, Math.floor(ttlSeconds)));
  const expSec = Math.floor(nowMs / 1000) + safeTtl;
  const payload = `${DEMO_PAYLOAD_PREFIX}.${expSec}`;
  const sig = computeDemoSignatureHex(payload);
  return {
    token: `${payload}.${sig}`,
    expiresAtMs: expSec * 1000,
    maxAgeSeconds: safeTtl,
  };
}

/**
 * Valida o cookie assinado da demonstração em tempo constante.
 * Rejeita valores não assinados (como `"true"`), adulterados, expirados ou quando `DEMO_ENABLED` estiver desligado.
 */
export function verifyDemoSessionToken(
  rawCookieValue: string | undefined | null,
  nowMs = Date.now(),
  env: NodeJS.ProcessEnv = process.env
): { valid: true; expiresAtMs: number } | { valid: false } {
  if (!isDemoEnabled(env)) return { valid: false };
  if (!rawCookieValue || typeof rawCookieValue !== "string") {
    return { valid: false };
  }

  const parts = rawCookieValue.split(".");
  if (parts.length !== 3) return { valid: false };

  const [marker, expRaw, providedSig] = parts;
  if (marker !== DEMO_PAYLOAD_PREFIX) return { valid: false };
  if (!expRaw || !/^\d{9,12}$/.test(expRaw)) return { valid: false };
  if (!providedSig || !/^[0-9a-f]{64}$/i.test(providedSig)) {
    return { valid: false };
  }

  const expSec = Number.parseInt(expRaw, 10);
  const expiresAtMs = expSec * 1000;
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
    return { valid: false };
  }

  try {
    const expectedSig = computeDemoSignatureHex(`${marker}.${expRaw}`);
    const a = Buffer.from(providedSig.toLowerCase(), "hex");
    const b = Buffer.from(expectedSig, "hex");
    if (!constantTimeEqualBytes(a, b)) {
      return { valid: false };
    }
    return { valid: true, expiresAtMs };
  } catch {
    return { valid: false };
  }
}

/**
 * Limite de taxa por IP para criação do cookie de demonstração (protege cota do plano gratuito).
 * 100% em memória local do isolate (zero leituras/escritas no D1).
 */
export function checkDemoCreationRateLimit(
  clientIp: string,
  nowMs = Date.now()
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const key = (clientIp || "unknown").slice(0, 64);
  const buckets = getDemoIpBuckets();
  const cutoff = nowMs - DEMO_RATE_LIMIT_WINDOW_MS;

  // Limpeza oportuna para evitar crescimento ilimitado do mapa em memória
  if (buckets.size > 1000) {
    for (const [k, list] of buckets.entries()) {
      const kept = list.filter((ts) => ts > cutoff);
      if (kept.length === 0) buckets.delete(k);
      else buckets.set(k, kept);
    }
  }

  const timestamps = (buckets.get(key) ?? []).filter((ts) => ts > cutoff);
  if (timestamps.length >= DEMO_RATE_LIMIT_MAX_REQUESTS) {
    const oldest = timestamps[0] ?? nowMs;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + DEMO_RATE_LIMIT_WINDOW_MS - nowMs) / 1000)
    );
    buckets.set(key, timestamps);
    return { allowed: false, retryAfterSeconds };
  }

  timestamps.push(nowMs);
  buckets.set(key, timestamps);
  return { allowed: true };
}

export function resetDemoRateLimitForTests(): void {
  getDemoIpBuckets().clear();
}
