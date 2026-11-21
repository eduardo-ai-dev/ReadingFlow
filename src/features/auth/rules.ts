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

export type PasswordStrengthLevel =
  "empty" | "weak" | "fair" | "good" | "strong";

export interface PasswordCriterionStatus {
  key:
    "minLength" | "hasUppercase" | "hasLowercase" | "hasNumber" | "hasSpecial";
  label: string;
  met: boolean;
}

export interface PasswordStrengthEvaluation {
  criteria: PasswordCriterionStatus[];
  metCount: number;
  isValid: boolean;
  segments: 0 | 1 | 2 | 3 | 4;
  level: PasswordStrengthLevel;
  label: string;
  colorHex: string;
}

export function evaluatePasswordStrength(
  password: string
): PasswordStrengthEvaluation {
  const criteria: PasswordCriterionStatus[] = [
    {
      key: "minLength",
      label: "Mínimo de 8 caracteres",
      met: password.length >= 8,
    },
    {
      key: "hasUppercase",
      label: "Letra maiúscula (A–Z)",
      met: /[A-Z]/.test(password),
    },
    {
      key: "hasLowercase",
      label: "Letra minúscula (a–z)",
      met: /[a-z]/.test(password),
    },
    {
      key: "hasNumber",
      label: "Pelo menos um número (0–9)",
      met: /[0-9]/.test(password),
    },
    {
      key: "hasSpecial",
      label: "Caractere especial (!@#$%&...)*",
      met: /[^A-Za-z0-9\s]/.test(password),
    },
  ];

  const metCount = criteria.filter((c) => c.met).length;

  if (password.length === 0) {
    return {
      criteria,
      metCount: 0,
      isValid: false,
      segments: 0,
      level: "empty",
      label: "Nível da senha",
      colorHex: "#2C221E",
    };
  }

  if (metCount <= 2) {
    return {
      criteria,
      metCount,
      isValid: false,
      segments: 1,
      level: "weak",
      label: metCount <= 1 ? "Muito fraca" : "Fraca",
      colorHex: "#722F3E", // Wine Plum
    };
  }

  if (metCount === 3) {
    return {
      criteria,
      metCount,
      isValid: false,
      segments: 2,
      level: "fair",
      label: "Razoável",
      colorHex: "#C8A46E", // Camel
    };
  }

  if (metCount === 4) {
    return {
      criteria,
      metCount,
      isValid: false,
      segments: 3,
      level: "good",
      label: "Boa",
      colorHex: "#6B7F94", // Slate Grey
    };
  }

  return {
    criteria,
    metCount,
    isValid: true,
    segments: 4,
    level: "strong",
    label: "Forte",
    colorHex: "#3B523E", // Hunter Green
  };
}
