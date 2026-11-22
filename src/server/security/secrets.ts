import crypto from "node:crypto";
import { getAuthSecurityConfig } from "@/server/security/auth-config";
import { constantTimeEqualBytes } from "@/server/security/password";

export const KNOWN_DEVICE_COOKIE_NAME = "rf_known_device";
const KNOWN_DEVICE_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 dias

const SECRET_PBKDF2_ITERATIONS = 100_000;
const SECRET_PBKDF2_TAG_BYTES = 32;
const SECRET_PBKDF2_SALT_BYTES = 16;
const SECRET_PBKDF2_PREFIX = "$pbkdf2-sha256$";

const textEncoder = new TextEncoder();

async function deriveSecretPbkdf2(
  plainSecret: string,
  salt: Uint8Array,
  iterations: number,
  tagBytes: number
): Promise<Uint8Array> {
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    textEncoder.encode(plainSecret),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const saltCopy = new Uint8Array(salt.byteLength);
  saltCopy.set(salt);
  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltCopy,
      iterations,
    },
    keyMaterial,
    tagBytes * 8
  );
  return new Uint8Array(bits);
}

/**
 * Normaliza e-mail conforme especificação anti-enumeração:
 * trim + minúsculas + normalização Unicode NFKC.
 */
export function normalizeEmailForIdentity(rawEmail: string): string {
  return rawEmail.normalize("NFKC").trim().toLowerCase();
}

/**
 * Gera identificador HMAC-SHA256 do e-mail normalizado usando o segredo do servidor.
 * A tabela de tentativas NUNCA armazena e-mail em claro.
 */
export function computeAccountHmac(rawEmail: string): string {
  const cfg = getAuthSecurityConfig();
  const normalized = normalizeEmailForIdentity(rawEmail);
  return crypto
    .createHmac("sha256", cfg.hmacSecret)
    .update(`account:${normalized}`)
    .digest("hex");
}

/**
 * Normaliza IP do cliente, agrupando endereços IPv6 pelo prefixo /64
 * (impede evasão rotacionando o sufixo de interface do mesmo bloco /64).
 */
export function normalizeClientIp(rawIp: string | null | undefined): string {
  if (!rawIp) return "unknown";
  let candidate = rawIp.trim();
  if (!candidate) return "unknown";

  // Remove porta em IPv4:port ou [IPv6]:port
  if (candidate.startsWith("[")) {
    const closeIdx = candidate.indexOf("]");
    if (closeIdx > 1) {
      candidate = candidate.slice(1, closeIdx);
    }
  } else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(candidate)) {
    candidate = candidate.split(":")[0] ?? candidate;
  }

  // Mapeamento IPv4-in-IPv6 (::ffff:192.0.2.1)
  if (candidate.toLowerCase().startsWith("::ffff:")) {
    const v4 = candidate.slice(7);
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v4)) {
      return v4;
    }
  }

  // IPv4 padrão
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(candidate)) {
    return candidate;
  }

  // IPv6 → expande para 8 hextetos e agrupa por /64 (primeiros 4 hextetos)
  if (candidate.includes(":")) {
    const expanded = expandIpv6(candidate);
    if (expanded) {
      return `${expanded.slice(0, 4).join(":")}::/64`;
    }
  }

  return "unknown";
}

/**
 * Trunca o endereço IP para logs estruturados (LGPD / minimização de dados):
 * - IPv4 → máscara `/24` (ex.: `198.51.100.42` → `198.51.100.0/24`)
 * - IPv6 → prefixo `/64` (ex.: `2001:0db8:abcd:0012::/64`)
 * - Ausente ou inválido → `null`
 */
export function truncateIpForLog(
  rawIp: string | null | undefined
): string | null {
  if (!rawIp) return null;
  const normalized = normalizeClientIp(rawIp);
  if (normalized === "unknown") return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(normalized)) {
    const parts = normalized.split(".");
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  if (normalized.endsWith("::/64")) {
    return normalized;
  }
  return null;
}

function expandIpv6(raw: string): string[] | null {
  const clean = raw.split("%")[0]?.toLowerCase() ?? "";
  const halves = clean.split("::");
  if (halves.length > 2) return null;

  const left = halves[0] ? halves[0].split(":").filter(Boolean) : [];
  const right = halves[1] ? halves[1].split(":").filter(Boolean) : [];
  const missing = 8 - (left.length + right.length);
  if (halves.length === 1 && missing !== 0) return null;
  if (halves.length === 2 && missing < 0) return null;

  const full = [
    ...left,
    ...Array.from({ length: Math.max(0, missing) }, () => "0"),
    ...right,
  ];
  if (full.length !== 8) return null;

  for (const part of full) {
    if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
  }
  return full.map((p) => p.padStart(4, "0"));
}

/**
 * Extrai o IP do cliente SOMENTE de headers de proxy confiável quando
 * `AUTH_TRUST_PROXY=1`. Nunca confia em headers controláveis diretamente pelo cliente
 * fora de um proxy reverso confiável.
 */
export function extractTrustedClientIp(
  headersLike?:
    | { get(name: string): string | null | undefined }
    | Record<string, string | undefined>
    | null
): string {
  const cfg = getAuthSecurityConfig();
  if (!cfg.trustProxy || !headersLike) {
    return "127.0.0.1";
  }

  const readHeader = (name: string): string | null => {
    if (typeof (headersLike as { get?: unknown }).get === "function") {
      return (
        (headersLike as { get(n: string): string | null | undefined }).get(
          name
        ) ?? null
      );
    }
    const rec = headersLike as Record<string, string | undefined>;
    return rec[name] ?? rec[name.toLowerCase()] ?? null;
  };

  for (const headerName of cfg.trustedProxyHeaders) {
    const raw = readHeader(headerName);
    if (!raw) continue;
    // Em X-Forwarded-For, o proxy confiável anexa o IP real no início ou na ponta confiável;
    // usamos o primeiro endereço válido sanitizado quando sob proxy gerenciado (Cloudflare/Vercel).
    const firstHop = raw.split(",")[0]?.trim();
    const normalized = normalizeClientIp(firstHop);
    if (normalized !== "unknown") {
      return normalized;
    }
  }

  return "127.0.0.1";
}

/**
 * Armazenamento de segredos próprios do app (códigos de recuperação, OTP/link mágico)
 * usando Web Crypto API (`crypto.subtle` PBKDF2 / SHA-256, 100.000 iterações) com
 * salt aleatório de 128 bits por item — 100% compatível com Cloudflare Workers (`workerd`).
 *
 * Formato PHC: `$pbkdf2-sha256$i=100000$<saltB64Url>$<hashB64Url>`
 */
export async function hashAppSecretArgon2id(
  plainSecret: string,
  overrideParams?: { iterations?: number }
): Promise<string> {
  const iterations = Math.max(
    10_000,
    Math.min(100_000, overrideParams?.iterations ?? SECRET_PBKDF2_ITERATIONS)
  );
  const nonce = new Uint8Array(SECRET_PBKDF2_SALT_BYTES);
  globalThis.crypto.getRandomValues(nonce);

  const derived = await deriveSecretPbkdf2(
    plainSecret,
    nonce,
    iterations,
    SECRET_PBKDF2_TAG_BYTES
  );

  const saltB64 = Buffer.from(nonce).toString("base64url");
  const hashB64 = Buffer.from(derived).toString("base64url");
  return `${SECRET_PBKDF2_PREFIX}i=${iterations}$${saltB64}$${hashB64}`;
}

export function isArgon2idHash(stored: string): boolean {
  return stored.startsWith(SECRET_PBKDF2_PREFIX);
}

/**
 * Verifica segredo próprio armazenado via PBKDF2-SHA256 (Web Crypto) em tempo constante.
 */
export async function verifyAppSecretArgon2id(
  plainSecret: string,
  storedPhc: string
): Promise<boolean> {
  if (!plainSecret || !storedPhc || !isArgon2idHash(storedPhc)) return false;

  const parts = storedPhc.split("$");
  // ['', 'pbkdf2-sha256', 'i=100000', saltB64, hashB64]
  if (parts.length !== 5) return false;

  const iterMatch = /^i=(\d+)$/.exec(parts[2] ?? "");
  const saltB64 = parts[3] ?? "";
  const hashB64 = parts[4] ?? "";
  if (!iterMatch) return false;

  const iterations = Number.parseInt(iterMatch[1]!, 10);
  if (
    !Number.isFinite(iterations) ||
    iterations < 10_000 ||
    iterations > 1_000_000
  ) {
    return false;
  }

  try {
    const nonce = new Uint8Array(Buffer.from(saltB64, "base64url"));
    const expected = new Uint8Array(Buffer.from(hashB64, "base64url"));
    if (nonce.length < 8 || expected.length < 16) return false;

    const derived = await deriveSecretPbkdf2(
      plainSecret,
      nonce,
      iterations,
      expected.length
    );

    return constantTimeEqualBytes(derived, expected);
  } catch {
    return false;
  }
}

/**
 * Cookie assinado de dispositivo conhecido (`rf_known_device`):
 * Permite isolar contadores de dispositivo legítimo contra bloqueio malicioso (DoS)
 * promovido por atacantes de outros IPs/dispositivos.
 */
export function signKnownDeviceCookie(
  deviceId = crypto.randomBytes(16).toString("hex"),
  nowMs = Date.now()
): string {
  const cfg = getAuthSecurityConfig();
  const payload = `${deviceId}.${nowMs}`;
  const sig = crypto
    .createHmac("sha256", cfg.deviceCookieSecret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyKnownDeviceCookie(
  rawCookie: string | null | undefined,
  nowMs = Date.now()
): string | null {
  if (!rawCookie) return null;
  const parts = rawCookie.split(".");
  if (parts.length !== 3) return null;
  const [deviceId, issuedStr, sig] = parts;
  if (!deviceId || !issuedStr || !sig) return null;
  if (!/^[a-f0-9]{16,64}$/i.test(deviceId)) return null;

  const issuedAtMs = Number.parseInt(issuedStr, 10);
  if (!Number.isFinite(issuedAtMs)) return null;
  if (nowMs - issuedAtMs > KNOWN_DEVICE_TTL_MS || issuedAtMs > nowMs + 60_000) {
    return null;
  }

  const cfg = getAuthSecurityConfig();
  const expectedSig = crypto
    .createHmac("sha256", cfg.deviceCookieSecret)
    .update(`${deviceId}.${issuedStr}`)
    .digest("base64url");

  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length) return null;
  return crypto.timingSafeEqual(a, b) ? deviceId : null;
}

/**
 * Equaliza o tempo de resposta de operações de autenticação para mitigar timing oracles
 * entre contas existentes e inexistentes (mínimo configurável >= 600ms + jitter).
 */
export async function equalizeAuthResponseTime(
  startedAtMs: number,
  override?: { minMs?: number; jitterMs?: number }
): Promise<void> {
  const cfg = getAuthSecurityConfig();
  const minMs = override?.minMs ?? cfg.minResponseMs;
  const jitterMs = override?.jitterMs ?? cfg.responseJitterMs;
  if (minMs <= 0 && jitterMs <= 0) return;

  const jitter =
    jitterMs > 0 ? crypto.randomInt(0, Math.max(1, jitterMs + 1)) : 0;
  const targetMs = minMs + jitter;
  const elapsedMs = performance.now() - startedAtMs;
  const remainingMs = Math.ceil(targetMs - elapsedMs);
  if (remainingMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, remainingMs));
  }
}
