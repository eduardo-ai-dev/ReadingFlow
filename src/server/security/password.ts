import crypto from "node:crypto";

const PBKDF2_PREFIX = "pbkdf2$sha256$";
export const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_LENGTH = 32; // 256 bits
const PBKDF2_SALT_BYTES = 16;

const textEncoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += (bytes[i] ?? 0).toString(16).padStart(2, "0");
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    return null;
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Comparação em tempo constante (compatível com Web Crypto / workerd e Node.js). */
export function constantTimeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

async function derivePbkdf2WebCrypto(
  plainPassword: string,
  salt: Uint8Array,
  iterations: number,
  keyLengthBytes: number
): Promise<Uint8Array> {
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    textEncoder.encode(plainPassword),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const saltCopy = new Uint8Array(salt.byteLength);
  saltCopy.set(salt);
  const derivedBits = await globalThis.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltCopy,
      iterations,
    },
    keyMaterial,
    keyLengthBytes * 8
  );
  return new Uint8Array(derivedBits);
}

/**
 * Gera hash criptográfico PBKDF2-SHA256 (100.000 iterações) com sal aleatório de 128 bits.
 * Formato: `pbkdf2$sha256$<iterations>$<saltHex>$<derivedKeyHex>`.
 */
export function hashPassword(plainPassword: string): string {
  const salt = new Uint8Array(PBKDF2_SALT_BYTES);
  globalThis.crypto.getRandomValues(salt);
  const derived = crypto.pbkdf2Sync(
    plainPassword,
    salt,
    PBKDF2_ITERATIONS,
    PBKDF2_KEY_LENGTH,
    "sha256"
  );
  return `${PBKDF2_PREFIX}${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(derived)}`;
}

/**
 * Versão assíncrona via Web Crypto API (`crypto.subtle` PBKDF2 / SHA-256, 100.000 iterações),
 * 100% compatível com Cloudflare Workers (`workerd`) e sem bloquear o event loop.
 */
export async function hashPasswordAsync(
  plainPassword: string
): Promise<string> {
  const salt = new Uint8Array(PBKDF2_SALT_BYTES);
  globalThis.crypto.getRandomValues(salt);
  const derived = await derivePbkdf2WebCrypto(
    plainPassword,
    salt,
    PBKDF2_ITERATIONS,
    PBKDF2_KEY_LENGTH
  );
  return `${PBKDF2_PREFIX}${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(derived)}`;
}

export function isHashedPassword(stored: string): boolean {
  if (!stored.startsWith(PBKDF2_PREFIX)) return false;
  const parts = stored.split("$");
  return parts.length === 5;
}

function parsePbkdf2Stored(stored: string): {
  iterations: number;
  salt: Uint8Array;
  expected: Uint8Array;
} | null {
  if (!isHashedPassword(stored)) return null;
  const parts = stored.split("$");
  const iterations = Number.parseInt(parts[2] ?? "", 10);
  const salt = hexToBytes(parts[3] ?? "");
  const expected = hexToBytes(parts[4] ?? "");
  if (
    !Number.isFinite(iterations) ||
    iterations < 10_000 ||
    iterations > 1_000_000 ||
    !salt ||
    salt.length < 8 ||
    !expected ||
    expected.length < 16
  ) {
    return null;
  }
  return { iterations, salt, expected };
}

/**
 * Verifica senha em tempo constante (`constantTimeEqualBytes`).
 * Aceita hashes `pbkdf2$sha256$` e mantém fallback legado em tempo constante.
 */
export function verifyPassword(plainPassword: string, stored: string): boolean {
  if (!plainPassword || !stored) return false;

  const parsed = parsePbkdf2Stored(stored);
  if (parsed) {
    try {
      const derived = crypto.pbkdf2Sync(
        plainPassword,
        parsed.salt,
        parsed.iterations,
        parsed.expected.length,
        "sha256"
      );
      return constantTimeEqualBytes(derived, parsed.expected);
    } catch {
      return false;
    }
  }

  // Fallback legado em tempo constante para registros antigos antes da migração
  const a = crypto.createHash("sha256").update(plainPassword).digest();
  const b = crypto.createHash("sha256").update(stored).digest();
  return constantTimeEqualBytes(a, b);
}

/**
 * Verificação assíncrona via Web Crypto API (`crypto.subtle` PBKDF2-SHA256)
 * em tempo constante — nativa no `workerd` (Cloudflare Workers) e não bloqueante.
 */
export async function verifyPasswordAsync(
  plainPassword: string,
  stored: string
): Promise<boolean> {
  if (!plainPassword || !stored) return false;

  const parsed = parsePbkdf2Stored(stored);
  if (parsed) {
    try {
      const derived = await derivePbkdf2WebCrypto(
        plainPassword,
        parsed.salt,
        parsed.iterations,
        parsed.expected.length
      );
      return constantTimeEqualBytes(derived, parsed.expected);
    } catch {
      return false;
    }
  }

  const [aBuf, bBuf] = await Promise.all([
    globalThis.crypto.subtle.digest(
      "SHA-256",
      textEncoder.encode(plainPassword)
    ),
    globalThis.crypto.subtle.digest("SHA-256", textEncoder.encode(stored)),
  ]);
  return constantTimeEqualBytes(new Uint8Array(aBuf), new Uint8Array(bBuf));
}

export function hashResetToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
}

export function generatePasswordResetToken(): {
  rawToken: string;
  tokenHash: string;
} {
  const rawBytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(rawBytes);
  const rawToken = bytesToHex(rawBytes);
  return {
    rawToken,
    tokenHash: hashResetToken(rawToken),
  };
}
