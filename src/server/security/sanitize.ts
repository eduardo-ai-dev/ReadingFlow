import {
  COVER_DATA_URL_MAX_BYTES,
  detectImageMimeFromBytes,
  estimateBase64DecodedBytes,
  parseCoverDataUrl,
} from "@/features/catalog/cover-rules";

const ALLOWED_COVER_HOSTS = new Set([
  "covers.openlibrary.org",
  "archive.org",
  "books.google.com",
  "books.googleusercontent.com",
  "brasilapi.com.br",
  "api.mercadoeditorial.org",
  "mercadoeditorial.org",
  "m.media-amazon.com",
  "images-na.ssl-images-amazon.com",
  "http2.mlstatic.com",
  "assets.hardcover.app",
  "img.hardcover.app",
  "hardcover.app",
  "storage.googleapis.com",
]);

const ALLOWED_COVER_HOST_SUFFIXES = [
  ".archive.org",
  ".hardcover.app",
  ".mzstatic.com",
] as const;

function isAllowedCoverHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (ALLOWED_COVER_HOSTS.has(lower)) return true;
  return ALLOWED_COVER_HOST_SUFFIXES.some(
    (suffix) => lower.endsWith(suffix) && lower.length > suffix.length
  );
}

export function sanitizePlainText(input: string, maxLength = 2000): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, maxLength);
}

export function validateExternalCoverUrl(
  rawUrl?: string | null
): string | undefined {
  if (!rawUrl) return undefined;
  try {
    const trimmed = rawUrl.trim();
    if (
      process.env.LOADTEST_ALLOW === "1" &&
      process.env.MOCK_CATALOG_BASE_URL
    ) {
      const mockOrigin = new URL(process.env.MOCK_CATALOG_BASE_URL).origin;
      const candidate = new URL(trimmed);
      if (candidate.origin === mockOrigin) {
        return candidate.toString();
      }
    }
    const parsed = new URL(trimmed.replace(/^http:\/\//i, "https://"));
    if (parsed.protocol !== "https:") return undefined;
    if (!isAllowedCoverHost(parsed.hostname)) {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

/**
 * Valida uma capa enviada pelo usuário (data URL já reduzida no navegador): só
 * JPEG/PNG/WebP em base64 estrito, até COVER_DATA_URL_MAX_BYTES, e cujos
 * primeiros bytes confirmem o mesmo formato declarado (nunca SVG nem HTML).
 */
export function validateCoverDataUrl(
  rawUrl?: string | null
): string | undefined {
  if (!rawUrl) return undefined;
  const parsed = parseCoverDataUrl(rawUrl);
  if (!parsed) return undefined;
  if (estimateBase64DecodedBytes(parsed.base64) > COVER_DATA_URL_MAX_BYTES) {
    return undefined;
  }
  const bytes = Buffer.from(parsed.base64, "base64");
  if (bytes.length === 0 || bytes.length > COVER_DATA_URL_MAX_BYTES) {
    return undefined;
  }
  if (detectImageMimeFromBytes(bytes) !== parsed.mime) return undefined;
  return rawUrl;
}

/** Aceita capa por upload (data URL validada) ou URL externa de host permitido. */
export function sanitizeCoverInput(rawUrl?: string | null): string | undefined {
  if (!rawUrl) return undefined;
  const trimmed = rawUrl.trim();
  if (
    /^\/api\/covers\/file\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(
      trimmed
    )
  ) {
    return trimmed;
  }
  return trimmed.startsWith("data:")
    ? validateCoverDataUrl(trimmed)
    : validateExternalCoverUrl(trimmed);
}
const buckets = new Map<string, number[]>();

export function checkSlidingRateLimit(
  key: string,
  maxRequestsPerMinute: number,
  nowMs = Date.now()
): { allowed: boolean; retryAfterSeconds: number } {
  const windowStart = nowMs - 60_000;
  const existing = (buckets.get(key) ?? []).filter((ts) => ts > windowStart);

  if (existing.length >= maxRequestsPerMinute) {
    const oldest = existing[0] ?? nowMs;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + 60_000 - nowMs) / 1000)
    );
    buckets.set(key, existing);
    return { allowed: false, retryAfterSeconds };
  }

  existing.push(nowMs);
  buckets.set(key, existing);
  return { allowed: true, retryAfterSeconds: 0 };
}
