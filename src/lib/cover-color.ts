/**
 * Utilitário único de cor de capa e lombada — Paleta Bordô Editorial
 *
 * Tokens base:
 * - Onyx: #141514
 * - Carbon Black: #222422
 * - Coffee Bean: #2C221E
 * - Soft Linen: #F4EFE6
 * - Wine Plum: #722F3E
 * - Camel: #C8A46E
 * - Soft Fawn: #DFBE88
 * - Hunter Green: #3B523E
 * - Slate Grey: #6B7F94
 *
 * Todos os 9 tons abaixo são dessaturados, derivados via `color-mix(in srgb, ...)`
 * dos tokens da paleta (sem mostarda ou rosa saturados) e garantem contraste
 * WCAG AA >= 6.8:1 com Soft Linen (#F4EFE6) e >= 5.3:1 com Soft Fawn (#DFBE88).
 */

export interface CoverTone {
  id: string;
  /** Valor Hex equivalente exato da mistura em sRGB para cálculos WCAG e atributos inline */
  hex: string;
  /** Expressão CSS `color-mix(in srgb, ...)` derivada exclusivamente dos tokens da paleta */
  cssMix: string;
  /** Cor primária do texto da capa (Soft Linen #F4EFE6 — contraste >= 6.8:1) */
  textHex: string;
  /** Cor de destaque/acento na capa (Soft Fawn #DFBE88 — contraste >= 5.3:1) */
  accentHex: string;
}

export const COVER_TONES: readonly CoverTone[] = [
  {
    id: "wine-coffee",
    hex: "#632C37",
    cssMix: "color-mix(in srgb, #722F3E 78%, #2C221E 22%)",
    textHex: "#F4EFE6",
    accentHex: "#DFBE88",
  },
  {
    id: "hunter-onyx",
    hex: "#334636",
    cssMix: "color-mix(in srgb, #3B523E 80%, #141514 20%)",
    textHex: "#F4EFE6",
    accentHex: "#DFBE88",
  },
  {
    id: "coffee-onyx",
    hex: "#28201C",
    cssMix: "color-mix(in srgb, #2C221E 85%, #141514 15%)",
    textHex: "#F4EFE6",
    accentHex: "#DFBE88",
  },
  {
    id: "slate-onyx",
    hex: "#3B444E",
    cssMix: "color-mix(in srgb, #6B7F94 45%, #141514 55%)",
    textHex: "#F4EFE6",
    accentHex: "#DFBE88",
  },
  {
    id: "camel-coffee",
    hex: "#4E3E2F",
    cssMix: "color-mix(in srgb, #C8A46E 22%, #2C221E 78%)",
    textHex: "#F4EFE6",
    accentHex: "#DFBE88",
  },
  {
    id: "carbon-coffee",
    hex: "#252321",
    cssMix: "color-mix(in srgb, #222422 70%, #2C221E 30%)",
    textHex: "#F4EFE6",
    accentHex: "#DFBE88",
  },
  {
    id: "wine-onyx",
    hex: "#51262F",
    cssMix: "color-mix(in srgb, #722F3E 65%, #141514 35%)",
    textHex: "#F4EFE6",
    accentHex: "#DFBE88",
  },
  {
    id: "hunter-coffee",
    hex: "#364133",
    cssMix: "color-mix(in srgb, #3B523E 65%, #2C221E 35%)",
    textHex: "#F4EFE6",
    accentHex: "#DFBE88",
  },
  {
    id: "slate-coffee",
    hex: "#443F42",
    cssMix: "color-mix(in srgb, #6B7F94 38%, #2C221E 62%)",
    textHex: "#F4EFE6",
    accentHex: "#DFBE88",
  },
] as const;

export function hashCoverSeed(seed: string): number {
  const normalized = (seed || "readingflow")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    h ^= normalized.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function coverTone(
  seed: string,
  avoidNeighborHex?: string | null
): CoverTone {
  const baseIdx = hashCoverSeed(seed) % COVER_TONES.length;
  let chosen = COVER_TONES[baseIdx] ?? COVER_TONES[0]!;

  if (
    avoidNeighborHex &&
    chosen.hex.toLowerCase() === avoidNeighborHex.trim().toLowerCase()
  ) {
    const step = ( (hashCoverSeed(`${seed}:alt`) % (COVER_TONES.length - 1)) + 1 );
    chosen = COVER_TONES[(baseIdx + step) % COVER_TONES.length] ?? chosen;
  }

  return chosen;
}

/**
 * Retorna a cor Hex determinística derivada da paleta via `color-mix`,
 * evitando repetir a mesma cor do livro vizinho quando `avoidNeighborHex` é informado.
 */
export function coverColor(
  seed: string,
  avoidNeighborHex?: string | null
): string {
  return coverTone(seed, avoidNeighborHex).hex;
}

/**
 * Extrai apenas o sobrenome principal do autor para exibição limpa em capas e lombadas.
 */
export function extractAuthorSurname(author?: string | null): string {
  if (!author) return "";
  const cleaned = author.trim();
  if (!cleaned) return "";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";

  const suffixes = new Set(["junior", "júnior", "jr", "jr.", "filho", "neto", "sobrinho"]);
  const last = parts[parts.length - 1]!;
  const normLast = last
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (suffixes.has(normLast) && parts.length >= 2) {
    return parts[parts.length - 2]!;
  }
  return last;
}

/**
 * Gera um monograma editorial de 2 letras a partir de um título ou editora.
 */
export function buildEditorialMonogram(text?: string | null, fallback = "RF"): string {
  if (!text) return fallback;
  const stopWords = new Set(["de", "da", "do", "das", "dos", "e", "o", "a", "os", "as", "um", "uma"]);
  const words = text
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const significant = words.filter((w) => !stopWords.has(w.toLowerCase()));
  const pool = significant.length > 0 ? significant : words;

  if (pool.length >= 2) {
    return `${pool[0]![0] ?? ""}${pool[1]![0] ?? ""}`.toUpperCase();
  }
  if (pool.length === 1 && pool[0]!.length >= 2) {
    return pool[0]!.slice(0, 2).toUpperCase();
  }
  if (pool.length === 1 && pool[0]!.length === 1) {
    return pool[0]!.toUpperCase();
  }
  return fallback;
}
