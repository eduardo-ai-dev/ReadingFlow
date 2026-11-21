/**
 * Regras puras de capa (sem I/O): saneamento de URLs do Google Books, candidatas de
 * fallback (Open Library) e limites/validação de upload manual.
 * Usadas no servidor (rota de busca, schema, validação) e no cliente (upload e pipeline).
 */

export const COVER_UPLOAD_ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type CoverMimeType = (typeof COVER_UPLOAD_ACCEPTED_TYPES)[number];

/** Tamanho máximo do arquivo escolhido pelo usuário (antes de redimensionar). */
export const COVER_UPLOAD_MAX_SOURCE_BYTES = 8 * 1024 * 1024;
/** A capa é reduzida no navegador (WebP) antes de ser enviada (D-03: 256/512 px). */
export const COVER_UPLOAD_MAX_WIDTH = 512;
export const COVER_UPLOAD_MAX_HEIGHT = 768;
/** Limite de bytes da imagem já decodificada aceita pelo servidor. */
export const COVER_DATA_URL_MAX_BYTES = 300 * 1024;
/** Limite de caracteres do campo `coverUrl` (data URL base64 ≈ 4/3 dos bytes + cabeçalho). */
export const COVER_INPUT_MAX_LENGTH = 420_000;

const GOOGLE_COVER_HOSTS = new Set([
  "books.google.com",
  "books.googleusercontent.com",
]);

export type GoogleImageLinks = Partial<
  Record<
    | "extraLarge"
    | "large"
    | "medium"
    | "small"
    | "thumbnail"
    | "smallThumbnail",
    string
  >
>;

/** Maior resolução disponível: extraLarge > large > medium > small > thumbnail. */
export function pickGoogleImageLink(
  imageLinks?: GoogleImageLinks | null
): string | undefined {
  if (!imageLinks) return undefined;
  return (
    imageLinks.extraLarge ??
    imageLinks.large ??
    imageLinks.medium ??
    imageLinks.small ??
    imageLinks.thumbnail ??
    imageLinks.smallThumbnail ??
    undefined
  );
}

/**
 * Higieniza a URL de capa do Google Books: força https, remove `edge=curl` (dobra
 * artificial) e só aceita hosts conhecidos (os mesmos permitidos na CSP).
 */
export function sanitizeGoogleCoverUrl(
  raw?: string | null
): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed = new URL(
      raw.replace(/&amp;/g, "&").replace(/^http:\/\//i, "https://")
    );
    if (parsed.protocol !== "https:") return undefined;
    if (!GOOGLE_COVER_HOSTS.has(parsed.hostname.toLowerCase())) {
      return undefined;
    }
    parsed.searchParams.delete("edge");
    return parsed.toString();
  } catch {
    return undefined;
  }
}

/** Variante de alta definição: `zoom=1` → `zoom=2`. Retorna `undefined` se não se aplica. */
export function toHighResGoogleCoverUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.get("zoom") !== "1") return undefined;
    parsed.searchParams.set("zoom", "2");
    return parsed.toString();
  } catch {
    return undefined;
  }
}

/** Sobe `zoom` do Google Books para o nível máximo (`zoom=3`) para capas nítidas. */
export function toMaxResGoogleCoverUrl(
  url: string,
  targetZoom: 2 | 3 = 3
): string | undefined {
  try {
    const parsed = new URL(url);
    if (!GOOGLE_COVER_HOSTS.has(parsed.hostname.toLowerCase())) return undefined;
    const current = parsed.searchParams.get("zoom");
    if (current === String(targetZoom)) return undefined;
    parsed.searchParams.set("zoom", String(targetZoom));
    parsed.searchParams.delete("edge");
    return parsed.toString();
  } catch {
    return undefined;
  }
}

/** `?default=false` faz a Open Library responder 404 (em vez de um pixel 1x1) sem capa. */
export function buildOpenLibraryCoverUrlByIsbn(isbn: string): string {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
}

export function buildOpenLibraryCoverUrlById(
  coverId: number,
  size: "S" | "M" | "L" = "L"
): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg?default=false`;
}

/**
 * Candidatas de capa em ordem de preferência:
 * Google (HD, depois original) → Open Library por id → Open Library por ISBN.
 */
export function buildCoverCandidates(input: {
  googleImageLinks?: GoogleImageLinks | null;
  openLibraryCoverId?: number | null;
  isbn?: string | null;
}): string[] {
  const candidates: string[] = [];
  const push = (url?: string) => {
    if (url && !candidates.includes(url)) candidates.push(url);
  };

  const googleUrl = sanitizeGoogleCoverUrl(
    pickGoogleImageLink(input.googleImageLinks)
  );
  if (googleUrl) {
    push(toHighResGoogleCoverUrl(googleUrl));
    push(googleUrl);
  }
  if (input.openLibraryCoverId && input.openLibraryCoverId > 0) {
    push(buildOpenLibraryCoverUrlById(input.openLibraryCoverId));
  }
  if (input.isbn && /^[0-9]{9}[0-9X]$|^[0-9]{13}$/.test(input.isbn)) {
    push(buildOpenLibraryCoverUrlByIsbn(input.isbn));
  }
  return candidates;
}

/** Identifica o formato real pelos primeiros bytes (não confia em `file.type`). */
export function detectImageMimeFromBytes(
  bytes: Uint8Array
): CoverMimeType | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return "image/webp";
  }
  return null;
}

const COVER_DATA_URL_PATTERN =
  /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

export function parseCoverDataUrl(
  raw: string
): { mime: CoverMimeType; base64: string } | null {
  const match = COVER_DATA_URL_PATTERN.exec(raw);
  if (!match) return null;
  return { mime: match[1] as CoverMimeType, base64: match[2] as string };
}

export function estimateBase64DecodedBytes(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}
