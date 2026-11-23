import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  GOOGLE_BOOKS_API_KEY: z.string().optional(),
  HARDCOVER_API_TOKEN: z.string().optional(),
  /** Feature flag para Apple Books / iTunes Search (desligado por padrão). */
  ENABLE_APPLE_BOOKS_COVERS: z.boolean().default(false),
  OPEN_LIBRARY_USER_AGENT: z
    .string()
    .min(5)
    .default("ReadingFlow/0.1 (contato@readingflow.app)"),
  CATALOG_LOOKUP_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(10000)
    .default(4000),
  RATE_LIMIT_MAX_PER_MINUTE: z.coerce
    .number()
    .int()
    .min(5)
    .max(600)
    .default(60),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function parseBooleanFlag(raw: string | undefined): boolean {
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "true" || normalized === "1";
}

function isValidNormalizedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (!lower || /\s/.test(lower)) return false;
  if (lower === "localhost" || lower === "127.0.0.1" || lower === "[::1]") {
    return true;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(lower)) {
    return lower
      .split(".")
      .every((part) => Number(part) >= 0 && Number(part) <= 255);
  }
  if (lower.startsWith("[") && lower.endsWith("]")) {
    return true;
  }
  // Domínios públicos precisam ter pelo menos um ponto separando rótulos válidos
  return (
    lower.includes(".") &&
    !lower.startsWith(".") &&
    !lower.endsWith(".") &&
    !lower.includes("..") &&
    /^[a-z0-9.-]+$/.test(lower)
  );
}

/**
 * Normaliza `NEXT_PUBLIC_APP_URL` antes da validação Zod para nunca lançar `Invalid URL`:
 * - Faz `trim()` e trata `undefined`, `""`, `"undefined"` e `"null"` como ausentes (`undefined`).
 * - Prefixa valores sem protocolo com `http://` (para `localhost`/`127.0.0.1`) ou `https://`.
 * - Se continuar malformado após normalização, registra `console.warn` discreto e retorna `undefined`.
 */
export function normalizeAppUrl(raw: string | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const lower = trimmed.toLowerCase();
  if (lower === "undefined" || lower === "null") {
    return undefined;
  }

  if (/\s/.test(trimmed)) {
    console.warn(
      "[env] NEXT_PUBLIC_APP_URL inválido (contém espaços); aplicando fallback seguro."
    );
    return undefined;
  }

  let candidate = trimmed;
  const hasExplicitScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(candidate);
  if (!hasExplicitScheme) {
    // Rejeita esquemas sem `://` (ex.: `javascript:alert(1)`, `data:...`) ou prefixo quebrado (`://...`)
    const looksLikeNonHostScheme =
      candidate.startsWith("://") ||
      (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(candidate) &&
        !/^(localhost|127\.0\.0\.1|[a-zA-Z0-9.-]+):\d+(\/|$|\?|#)/.test(
          candidate
        ));
    if (looksLikeNonHostScheme) {
      console.warn(
        "[env] NEXT_PUBLIC_APP_URL inválido; aplicando fallback seguro."
      );
      return undefined;
    }

    const isLocalHost =
      /^localhost(?::\d+)?(?:\/|\?|#|$)/i.test(candidate) ||
      /^127\.0\.0\.1(?::\d+)?(?:\/|\?|#|$)/.test(candidate);
    candidate = `${isLocalHost ? "http://" : "https://"}${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      !isValidNormalizedHostname(parsed.hostname)
    ) {
      console.warn(
        "[env] NEXT_PUBLIC_APP_URL inválido; aplicando fallback seguro."
      );
      return undefined;
    }

    if (
      parsed.pathname === "/" &&
      !parsed.search &&
      !parsed.hash &&
      !candidate.endsWith("/")
    ) {
      return parsed.origin;
    }
    return parsed.toString();
  } catch {
    console.warn(
      "[env] NEXT_PUBLIC_APP_URL malformado; aplicando fallback seguro."
    );
    return undefined;
  }
}

export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse({
    NODE_ENV: process.env.NODE_ENV || undefined,
    NEXT_PUBLIC_APP_URL: normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL),
    GOOGLE_BOOKS_API_KEY: process.env.GOOGLE_BOOKS_API_KEY?.trim() || undefined,
    HARDCOVER_API_TOKEN: process.env.HARDCOVER_API_TOKEN?.trim() || undefined,
    ENABLE_APPLE_BOOKS_COVERS: parseBooleanFlag(
      process.env.ENABLE_APPLE_BOOKS_COVERS
    ),
    OPEN_LIBRARY_USER_AGENT:
      process.env.OPEN_LIBRARY_USER_AGENT?.trim() || undefined,
    CATALOG_LOOKUP_TIMEOUT_MS:
      process.env.CATALOG_LOOKUP_TIMEOUT_MS?.trim() || undefined,
    RATE_LIMIT_MAX_PER_MINUTE:
      process.env.RATE_LIMIT_MAX_PER_MINUTE?.trim() || undefined,
  });
}
