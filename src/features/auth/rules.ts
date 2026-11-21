const AUTH_LOOP_PREFIXES = ["/entrar", "/criar-conta", "/recuperar-senha"];

/**
 * Valida o parâmetro `?next=` contra Open Redirect e loops de autenticação.
 * Aceita apenas caminhos internos relativos (`/estante-3d`, `/livros/123?tab=notas`).
 */
export function resolveSafeRedirectTarget(
  rawNext: string | null | undefined,
  fallback = "/painel"
): string {
  if (!rawNext) return fallback;
  const trimmed = rawNext.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    /[\r\n\0\\]/.test(trimmed)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(trimmed, "https://readingflow.local");
    if (parsed.origin !== "https://readingflow.local") {
      return fallback;
    }
    const isAuthLoop = AUTH_LOOP_PREFIXES.some(
      (prefix) =>
        parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`)
    );
    if (isAuthLoop) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export const CURRENT_TERMS_VERSION = "1.0";

export function hasAcceptedCurrentTerms(acceptedVersion?: string): boolean {
  return acceptedVersion === CURRENT_TERMS_VERSION;
}

export function isValidIanaTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_BCRYPT_PASSWORD_BYTES = 72;

const COMMON_PASSWORDS = new Set([
  "123456789012",
  "1234567890123",
  "12345678901234",
  "1234567890123456",
  "password1234",
  "password12345",
  "password123456",
  "qwertyuiopas",
  "qwerty123456",
  "admin1234567",
  "administrator",
  "letmein12345",
  "welcome12345",
  "iloveyou1234",
  "senhaforte12",
  "senhaforte123",
  "minhasenha12",
  "minhasenha123",
  "mudarsenha12",
  "readingflow1",
  "readingflow12",
  "readingflow123",
  "biblioteca12",
  "biblioteca123",
  "brasil123456",
  "abcdefghijkl",
  "aaaaaaaaaaaa",
  "000000000000",
  "111111111111",
  "correct horse battery staple",
]);

/**
 * Calcula o tamanho exato em bytes UTF-8 de uma senha (compatível com Browser e Node).
 * Necessário pelo limite de 72 bytes do bcrypt (caracteres Unicode multibyte contam 2–4 bytes).
 */
export function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/**
 * Verifica se a senha pertence à lista de senhas comuns ou padrões triviais
 * (repetição de 1 caractere ou sequência linear óbvia).
 */
export function isCommonOrTrivialPassword(password: string): boolean {
  const normalized = password.normalize("NFKC").trim().toLowerCase();
  if (!normalized) return true;
  if (COMMON_PASSWORDS.has(normalized)) return true;

  // Bloqueia senhas compostas por repetição do mesmo caractere (ex.: "aaaaaaaaaaaa")
  if (/^(.)\1+$/.test(normalized)) return true;

  // Bloqueia sequências numéricas triviais longas (ex.: "123456789012" ou "987654321098")
  if (
    "01234567890123456789".includes(normalized) ||
    "98765432109876543210".includes(normalized)
  ) {
    return true;
  }

  return false;
}

export type PasswordStrengthLevel =
  "empty" | "weak" | "fair" | "good" | "strong";

export interface PasswordCriterionStatus {
  key: "minLength" | "maxBytes" | "notCommon" | "passphraseRecommended";
  label: string;
  met: boolean;
}

export interface PasswordStrengthEvaluation {
  criteria: PasswordCriterionStatus[];
  metCount: number;
  isValid: boolean;
  utf8Bytes: number;
  segments: 0 | 1 | 2 | 3 | 4;
  level: PasswordStrengthLevel;
  label: string;
  colorHex: string;
}

/**
 * Política de senha NIST SP 800-63B / OWASP:
 * - Mínimo de 12 caracteres, sem regras artificiais de composição.
 * - Aceita espaços e caracteres Unicode até o teto de 72 bytes UTF-8 (limite do bcrypt).
 * - Bloqueia senhas comuns/triviais (e senhas vazadas são verificadas no servidor via HIBP k-anonymity).
 */
export function evaluatePasswordStrength(
  password: string
): PasswordStrengthEvaluation {
  const utf8Bytes = getUtf8ByteLength(password);
  const meetsMinLength = password.length >= MIN_PASSWORD_LENGTH;
  const meetsMaxBytes =
    password.length > 0 && utf8Bytes <= MAX_BCRYPT_PASSWORD_BYTES;
  const meetsNotCommon =
    password.length > 0 && !isCommonOrTrivialPassword(password);
  const isLongPassphrase = password.length >= 16 && meetsMaxBytes;

  const criteria: PasswordCriterionStatus[] = [
    {
      key: "minLength",
      label: `Mínimo de ${MIN_PASSWORD_LENGTH} caracteres`,
      met: meetsMinLength,
    },
    {
      key: "maxBytes",
      label: `Até ${MAX_BCRYPT_PASSWORD_BYTES} bytes UTF-8 (aceita espaços/Unicode)`,
      met: meetsMaxBytes,
    },
    {
      key: "notCommon",
      label: "Não é uma senha comum",
      met: meetsNotCommon,
    },
    {
      key: "passphraseRecommended",
      label: "16+ caracteres (recomendado)",
      met: isLongPassphrase,
    },
  ];

  const metCount = criteria.filter((c) => c.met).length;

  if (password.length === 0) {
    return {
      criteria,
      metCount: 0,
      isValid: false,
      utf8Bytes: 0,
      segments: 0,
      level: "empty",
      label: "Nível da senha",
      colorHex: "#2C221E",
    };
  }

  if (!meetsMaxBytes || !meetsNotCommon || password.length < 8) {
    return {
      criteria,
      metCount,
      isValid: false,
      utf8Bytes,
      segments: 1,
      level: "weak",
      label: !meetsMaxBytes ? "Longa demais" : "Fraca",
      colorHex: "#722F3E",
    };
  }

  if (!meetsMinLength) {
    return {
      criteria,
      metCount,
      isValid: false,
      utf8Bytes,
      segments: 2,
      level: "fair",
      label: "Curta",
      colorHex: "#C8A46E",
    };
  }

  if (!isLongPassphrase) {
    return {
      criteria,
      metCount,
      isValid: true,
      utf8Bytes,
      segments: 3,
      level: "good",
      label: "Boa",
      colorHex: "#6B7F94",
    };
  }

  return {
    criteria,
    metCount,
    isValid: true,
    utf8Bytes,
    segments: 4,
    level: "strong",
    label: "Forte",
    colorHex: "#3B523E",
  };
}
