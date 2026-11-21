import crypto from "node:crypto";
import { getAuthSecurityConfig } from "@/server/security/auth-config";

export const KNOWN_DEVICE_COOKIE_NAME = "rf_known_device";
const KNOWN_DEVICE_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 dias

const ARGON2_TAG_LENGTH = 32;
const ARGON2_SALT_BYTES = 16;

// Mínimos obrigatórios conforme OWASP Password Storage Cheat Sheet
const OWASP_MIN_MEMORY_KIB = 19456; // 19 MiB
const OWASP_MIN_PASSES = 2;
const OWASP_MIN_PARALLELISM = 1;

type NodeArgon2Options = {
  message: string | Buffer;
  nonce: Buffer;
  memory: number;
  passes: number;
  parallelism: number;
  tagLength: number;
};

type NodeArgon2Fn = (
  algorithm: "argon2id" | "argon2i" | "argon2d",
  parameters: NodeArgon2Options,
  callback: (err: Error | null, derivedKey: Buffer) => void
) => void;

function deriveArgon2idNative(options: NodeArgon2Options): Promise<Buffer> {
  const nativeArgon2 = (crypto as unknown as { argon2?: NodeArgon2Fn }).argon2;
  if (typeof nativeArgon2 !== "function") {
    return Promise.reject(
      new Error(
        "crypto.argon2 nativo indisponível neste runtime Node.js (requer Node >= 24.7)."
      )
    );
  }
  return new Promise<Buffer>((resolve, reject) => {
    nativeArgon2("argon2id", options, (err: Error | null, key: Buffer) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
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
 * Armazenamento de segredos próprios do app (códigos de recuperação, OTP/link mágico,
 * chaves de API) usando Argon2id nativo do Node.js (`node:crypto`), com salt aleatório
 * por item e parâmetros mínimos OWASP (m >= 19 MiB, t >= 2, p >= 1), parametrizáveis via env.
 *
 * Formato PHC: `$argon2id$v=19$m=<KiB>,t=<passes>,p=<parallelism>$<saltB64>$<hashB64>`
 */
export async function hashAppSecretArgon2id(
  plainSecret: string,
  overrideParams?: { memory?: number; passes?: number; parallelism?: number }
): Promise<string> {
  const cfg = getAuthSecurityConfig();
  const memory = Math.max(
    OWASP_MIN_MEMORY_KIB,
    overrideParams?.memory ?? cfg.argon2MemoryKiB
  );
  const passes = Math.max(
    OWASP_MIN_PASSES,
    overrideParams?.passes ?? cfg.argon2Passes
  );
  const parallelism = Math.max(
    OWASP_MIN_PARALLELISM,
    overrideParams?.parallelism ?? cfg.argon2Parallelism
  );
  const nonce = crypto.randomBytes(ARGON2_SALT_BYTES);

  const derived = await deriveArgon2idNative({
    message: plainSecret,
    nonce,
    memory,
    passes,
    parallelism,
    tagLength: ARGON2_TAG_LENGTH,
  });

  return `$argon2id$v=19$m=${memory},t=${passes},p=${parallelism}$${nonce.toString("base64url")}$${derived.toString("base64url")}`;
}

export function isArgon2idHash(stored: string): boolean {
  return stored.startsWith("$argon2id$v=19$");
}

/**
 * Verifica segredo próprio armazenado com Argon2id usando comparação em tempo constante.
 */
export async function verifyAppSecretArgon2id(
  plainSecret: string,
  storedPhc: string
): Promise<boolean> {
  if (!plainSecret || !storedPhc || !isArgon2idHash(storedPhc)) return false;

  const parts = storedPhc.split("$");
  // ['', 'argon2id', 'v=19', 'm=...,t=...,p=...', saltB64, hashB64]
  if (parts.length !== 6) return false;

  const paramPart = parts[3] ?? "";
  const saltB64 = parts[4] ?? "";
  const hashB64 = parts[5] ?? "";

  const mMatch = /m=(\d+)/.exec(paramPart);
  const tMatch = /t=(\d+)/.exec(paramPart);
  const pMatch = /p=(\d+)/.exec(paramPart);
  if (!mMatch || !tMatch || !pMatch) return false;

  const memory = Number.parseInt(mMatch[1]!, 10);
  const passes = Number.parseInt(tMatch[1]!, 10);
  const parallelism = Number.parseInt(pMatch[1]!, 10);

  if (
    memory < OWASP_MIN_MEMORY_KIB ||
    passes < OWASP_MIN_PASSES ||
    parallelism < OWASP_MIN_PARALLELISM
  ) {
    return false;
  }

  try {
    const nonce = Buffer.from(saltB64, "base64url");
    const expected = Buffer.from(hashB64, "base64url");
    if (nonce.length < 8 || expected.length < 16) return false;

    const derived = await deriveArgon2idNative({
      message: plainSecret,
      nonce,
      memory,
      passes,
      parallelism,
      tagLength: expected.length,
    });

    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
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
