import crypto from "node:crypto";

const SCRYPT_PREFIX = "scrypt$";
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_SALT_BYTES = 16;

/**
 * Gera hash criptográfico com sal aleatório por usuário (Node `crypto.scryptSync`).
 * Formato: `scrypt$<saltHex>$<derivedKeyHex>`.
 */
export function hashPassword(plainPassword: string): string {
  const salt = crypto.randomBytes(SCRYPT_SALT_BYTES).toString("hex");
  const derived = crypto
    .scryptSync(plainPassword, salt, SCRYPT_KEY_LENGTH)
    .toString("hex");
  return `${SCRYPT_PREFIX}${salt}$${derived}`;
}

export function isHashedPassword(stored: string): boolean {
  return stored.startsWith(SCRYPT_PREFIX) && stored.split("$").length === 3;
}

/**
 * Verifica senha em tempo constante (`crypto.timingSafeEqual`).
 * Aceita hashes `scrypt$` e mantém compatibilidade segura com registros legados
 * (que são migrados automaticamente no login).
 */
export function verifyPassword(plainPassword: string, stored: string): boolean {
  if (!plainPassword || !stored) return false;

  if (isHashedPassword(stored)) {
    const [, salt, storedHex] = stored.split("$");
    if (!salt || !storedHex) return false;
    try {
      const derived = crypto.scryptSync(plainPassword, salt, SCRYPT_KEY_LENGTH);
      const expected = Buffer.from(storedHex, "hex");
      if (derived.length !== expected.length) return false;
      return crypto.timingSafeEqual(derived, expected);
    } catch {
      return false;
    }
  }

  // Fallback legado em tempo constante para dados antigos antes da migração para scrypt
  const a = crypto.createHash("sha256").update(plainPassword).digest();
  const b = crypto.createHash("sha256").update(stored).digest();
  return crypto.timingSafeEqual(a, b);
}

export function hashResetToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
}

export function generatePasswordResetToken(): {
  rawToken: string;
  tokenHash: string;
} {
  const rawToken = crypto.randomBytes(24).toString("hex");
  return {
    rawToken,
    tokenHash: hashResetToken(rawToken),
  };
}
