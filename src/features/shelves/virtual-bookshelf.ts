import type {
  BookCoverSource,
  BookFormat,
  ProgressUnit,
  ReadingStatus,
  ShelfKind,
} from "@/lib/domain";
import type { EnrichedShelfItem } from "@/features/shelves/rules";
import type { EnrichedWishEntry } from "@/features/wishlist/queries";
import { resolveCanonicalGenre } from "@/features/shelves/genres";
import { computeReadingPercent } from "@/features/reading/rules";
import { normalizeSearchText } from "@/features/catalog/rules";
import {
  COVER_TONES,
  extractAuthorSurname,
  hashCoverSeed,
} from "@/lib/cover-color";
import {
  clampPaperHsl,
  deriveSpineAccentHex,
} from "@/features/catalog/spine-color-rules";

export type RealisticBookFormat =
  "capa_dura" | "brochura" | "bolso" | "ebook" | "audio";

export interface VirtualBookItem {
  id: string | number;
  title: string;
  genre?: string | null;
  spineColor?: string;
  spineAccent?: string;
  coverUrl?: string | null;
  coverSource?: BookCoverSource | null;
  pages?: number | null;
  author?: string;
  publisher?: string | null;
  isbn?: string | null;
  seed?: string | null;
  format?: RealisticBookFormat | BookFormat | null;
  status?: string | null;
  href?: string;
  workId?: string;
  editionId?: string;
  libraryItemId?: string;
  readingId?: string | null;
  readingStatus?: ReadingStatus;
  progressUnit?: ProgressUnit;
  progressValue?: number;
  progressTotal?: number | null;
  progressPercent?: number;
  rating?: number | null;
  shelfKind?: ShelfKind;
  shelfPosition?: number;
  isWishlist?: boolean;
  wishlistPriority?: number;
  targetPrice?: number;
}

const VIRTUAL_READING_STATUS_LABELS: Record<ReadingStatus, string> = {
  not_started: "Não iniciado",
  reading: "Em andamento",
  paused: "Pausado",
  finished: "Concluído",
  abandoned: "Abandonado",
};

/** Calcula percentual (0-100) de leitura para exibição nas lombadas e tooltips. */
export function resolveEntryProgressPercent(entry: EnrichedShelfItem): number {
  if (entry.effectiveReadingStatus === "finished") return 100;
  if (!entry.latestReading) return 0;

  const r = entry.latestReading;
  const fallbackTotal =
    r.progressUnit === "pages"
      ? entry.edition.pages
      : r.progressUnit === "seconds"
        ? entry.edition.durationSeconds
        : 100;

  return computeReadingPercent({
    progressUnit: r.progressUnit,
    progressValue: r.progressValue,
    progressTotal: r.progressTotal ?? fallbackTotal,
  });
}

/** Converte um item enriquecido da estante em item normalizável pela prateleira 3D. */
export function mapEnrichedItemToVirtualBook(
  entry: EnrichedShelfItem,
  options?: { spineColor?: string }
): VirtualBookItem {
  const reading = entry.latestReading;
  const progressTotal =
    reading?.progressTotal ??
    (reading?.progressUnit === "seconds"
      ? entry.edition.durationSeconds
      : entry.edition.pages) ??
    null;

  return {
    id: entry.item.id,
    workId: entry.work.id,
    editionId: entry.edition.id,
    libraryItemId: entry.item.id,
    readingId: reading?.id ?? null,
    readingStatus: entry.effectiveReadingStatus,
    title: entry.work.title,
    genre: entry.work.primaryGenre ?? "Acervo Geral",
    spineColor: options?.spineColor ?? entry.edition.coverColor,
    spineAccent: entry.edition.coverAccentColor,
    coverUrl: entry.edition.coverUrl,
    coverSource: entry.edition.coverSource ?? null,
    pages: entry.edition.pages,
    author: entry.primaryAuthor,
    publisher: entry.edition.publisher ?? "ReadingFlow",
    isbn: entry.edition.isbn13,
    seed: entry.edition.isbn13 ?? entry.work.id,
    format: entry.edition.format,
    status: VIRTUAL_READING_STATUS_LABELS[entry.effectiveReadingStatus],
    href: `/livros/${entry.work.id}`,
    progressUnit: reading?.progressUnit ?? "pages",
    progressValue: reading?.progressValue ?? 0,
    progressTotal,
    progressPercent: resolveEntryProgressPercent(entry),
    rating: entry.review?.rating ?? null,
    shelfKind: entry.shelf.kind,
    shelfPosition: entry.item.shelfPosition,
    isWishlist: false,
  };
}

/** Converte um item da Lista de Desejos em volume renderizável na Estante 3D. */
export function mapWishlistEntryToVirtualBook(
  entry: EnrichedWishEntry
): VirtualBookItem {
  return {
    id: `wish-${entry.wish.id}`,
    workId: entry.work.id,
    editionId: entry.edition?.id,
    title: entry.work.title,
    genre: entry.work.primaryGenre ?? "Acervo Geral",
    spineColor: entry.edition?.coverColor,
    spineAccent: entry.edition?.coverAccentColor,
    coverUrl: entry.edition?.coverUrl,
    coverSource: entry.edition?.coverSource ?? null,
    pages: entry.edition?.pages ?? 220,
    author: entry.primaryAuthor,
    publisher: entry.edition?.publisher ?? "Lista de Desejos",
    isbn: entry.edition?.isbn13,
    seed: entry.edition?.isbn13 ?? entry.work.id,
    format: entry.edition?.format ?? "paperback",
    status: "Na lista de desejos",
    href: "/desejos",
    progressUnit: "pages",
    progressValue: 0,
    progressTotal: entry.edition?.pages ?? null,
    progressPercent: 0,
    rating: null,
    shelfKind:
      entry.edition?.format === "ebook"
        ? "digital"
        : entry.edition?.format === "audiobook"
          ? "audio"
          : "physical",
    isWishlist: true,
    wishlistPriority: entry.wish.priority,
    targetPrice: entry.wish.targetPrice,
  };
}

export type ShelfQuickFilter =
  "all" | "physical" | "digital" | "reading" | "finished" | "wishlist";

/** Filtra volumes por categoria rápida da Estante 3D. */
export function filterVirtualBooksByQuickFilter(
  books: readonly VirtualBookItem[],
  wishlistBooks: readonly VirtualBookItem[],
  filter: ShelfQuickFilter
): VirtualBookItem[] {
  switch (filter) {
    case "wishlist":
      return [...wishlistBooks];
    case "physical":
      return books.filter((b) => {
        if (b.shelfKind) return b.shelfKind === "physical";
        const fmt = normalizeRealisticBookFormat(b.format);
        return fmt === "capa_dura" || fmt === "brochura" || fmt === "bolso";
      });
    case "digital":
      return books.filter((b) => {
        if (b.shelfKind)
          return b.shelfKind === "digital" || b.shelfKind === "audio";
        const fmt = normalizeRealisticBookFormat(b.format);
        return fmt === "ebook" || fmt === "audio";
      });
    case "reading":
      return books.filter((b) => b.readingStatus === "reading");
    case "finished":
      return books.filter((b) => b.readingStatus === "finished");
    case "all":
    default:
      return [...books];
  }
}

export type SpineTemplateId = "A" | "B" | "C" | "D";

export interface NormalizedVirtualBook extends VirtualBookItem {
  canonicalGenreKey: string;
  displayGenre: string;
  spineBg: string;
  spineInk: string;
  spineAccentHex: string;
  spineAccentInk: string;
  spineTemplate: SpineTemplateId;
  publisherMark: string | null;
  spineWidthPx: number;
  bookHeightPx: number;
  realisticFormat: RealisticBookFormat;
  authorSurname: string;
  resolvedSeed: string;
  statusLabel: string;
}

export interface GenreShelfGroup {
  genreKey: string;
  genre: string;
  books: NormalizedVirtualBook[];
}

const LIGHT_INK = "#F4EFE6";
const DARK_INK = "#141514";

export function normalizeRealisticBookFormat(
  raw?: RealisticBookFormat | BookFormat | string | null
): RealisticBookFormat {
  switch (raw) {
    case "capa_dura":
    case "hardcover":
    case "box":
      return "capa_dura";
    case "bolso":
    case "pocket":
      return "bolso";
    case "ebook":
      return "ebook";
    case "audio":
    case "audiobook":
      return "audio";
    case "brochura":
    case "paperback":
    case "other":
    default:
      return "brochura";
  }
}

export function computeRealisticBookSpecs(params: {
  pages?: number | null;
  format?: RealisticBookFormat | BookFormat | string | null;
  seed: string;
  mmScalePx?: number;
}): {
  format: RealisticBookFormat;
  heightMm: number;
  thicknessMm: number;
  heightPx: number;
  widthPx: number;
} {
  const mm = params.mmScalePx ?? 1.35;
  const format = normalizeRealisticBookFormat(params.format);

  const baseHeightByFormat: Record<RealisticBookFormat, number> = {
    capa_dura: 230,
    brochura: 210,
    bolso: 180,
    ebook: 210,
    audio: 210,
  };

  const baseH = baseHeightByFormat[format];
  // Variação determinística de ±1.5% pelo seed
  const hHash = hashCoverSeed(`${params.seed}:height-mm`);
  const variationRatio = ((hHash % 301) - 150) / 10000; // [-0.015, +0.015]
  const heightMm = Number((baseH * (1 + variationRatio)).toFixed(2));

  // Espessura: clamp(pages × 0.06 + (capa_dura ? 5 : 1.5), 6, 55) mm; ebook/audio: 12mm fixos
  let thicknessMm: number;
  if (format === "ebook" || format === "audio") {
    thicknessMm = 12;
  } else {
    const safePages =
      typeof params.pages === "number" &&
      Number.isFinite(params.pages) &&
      params.pages > 0
        ? params.pages
        : 220;
    const rawThickness = safePages * 0.06 + (format === "capa_dura" ? 5 : 1.5);
    thicknessMm = Number(Math.min(55, Math.max(6, rawThickness)).toFixed(2));
  }

  return {
    format,
    heightMm,
    thicknessMm,
    heightPx: Math.round(heightMm * mm),
    widthPx: Math.max(16, Math.round(thicknessMm * mm)),
  };
}

function parseHexToRgb(hex: string): [number, number, number] | null {
  const cleaned = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const r = Number.parseInt(cleaned[0]! + cleaned[0]!, 16);
    const g = Number.parseInt(cleaned[1]! + cleaned[1]!, 16);
    const b = Number.parseInt(cleaned[2]! + cleaned[2]!, 16);
    return [r, g, b];
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    const r = Number.parseInt(cleaned.slice(0, 2), 16);
    const g = Number.parseInt(cleaned.slice(2, 4), 16);
    const b = Number.parseInt(cleaned.slice(4, 6), 16);
    return [r, g, b];
  }
  return null;
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const clampByte = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${clampByte(r)}${clampByte(g)}${clampByte(b)}`;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const toLinear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function computeContrastRatioHex(hexA: string, hexB: string): number {
  const rgbA = parseHexToRgb(hexA) ?? [44, 34, 30];
  const rgbB = parseHexToRgb(hexB) ?? [244, 239, 230];
  const l1 = relativeLuminance(rgbA);
  const l2 = relativeLuminance(rgbB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const VARIED_SPINE_FALLBACK_HEXES: readonly string[] = [
  "#2B2D2B", // Grafite papel
  "#9B3A3A", // Carmim editorial
  "#C4A13B", // Ocre mostarda
  "#BD6633", // Terracota queimado
  "#385B94", // Azul cobalto fosco
  "#D8D2C6", // Marfim papel
  "#3A6652", // Verde floresta fosco
  "#6B8A3C", // Verde oliva
  "#5E4287", // Ameixa fosco
  "#78523A", // Nogueira
];

function pickVariedFallbackHex(
  seed: string,
  avoidNeighborHex?: string | null
): string {
  const idx =
    hashCoverSeed(`${seed}:varied-spine`) % VARIED_SPINE_FALLBACK_HEXES.length;
  const candidate = VARIED_SPINE_FALLBACK_HEXES[idx]!;
  if (
    avoidNeighborHex &&
    candidate.toLowerCase() === avoidNeighborHex.trim().toLowerCase()
  ) {
    return VARIED_SPINE_FALLBACK_HEXES[
      (idx + 1) % VARIED_SPINE_FALLBACK_HEXES.length
    ]!;
  }
  return candidate;
}

/**
 * Resolve a cor principal da lombada (`spineBg`), cor de acento (`spineAccentHex`)
 * e respectivas tintas de contraste AA (>= 4,5:1), aplicando acabamento de papel
 * impresso (HSL S <= 70%, L entre 18% e 82%).
 */
export function resolveSpinePalette(
  rawSpineColor: string | undefined,
  fallbackSeed: string,
  avoidNeighborHex?: string | null,
  rawSpineAccent?: string | undefined
): {
  spineBg: string;
  spineInk: string;
  spineAccentHex: string;
  spineAccentInk: string;
} {
  const fallbackHex = pickVariedFallbackHex(fallbackSeed, avoidNeighborHex);
  const rawClamped =
    rawSpineColor && parseHexToRgb(rawSpineColor)
      ? clampPaperHsl(rawSpineColor)
      : null;
  let hex = rawClamped ?? clampPaperHsl(fallbackHex);

  if (
    !rawClamped &&
    avoidNeighborHex &&
    hex.toLowerCase() === avoidNeighborHex.trim().toLowerCase()
  ) {
    hex = clampPaperHsl(
      pickVariedFallbackHex(`${fallbackSeed}:neighbor`, avoidNeighborHex)
    );
  }

  let rgb = parseHexToRgb(hex) ?? parseHexToRgb(COVER_TONES[0]!.hex)!;
  let lightRatio = computeContrastRatioHex(hex, LIGHT_INK);
  let darkRatio = computeContrastRatioHex(hex, DARK_INK);

  let safety = 0;
  while (Math.max(lightRatio, darkRatio) < 4.55 && safety < 12) {
    if (darkRatio > lightRatio) {
      rgb = [
        rgb[0] + (255 - rgb[0]) * 0.14,
        rgb[1] + (255 - rgb[1]) * 0.14,
        rgb[2] + (255 - rgb[2]) * 0.14,
      ];
    } else {
      rgb = [rgb[0] * 0.88, rgb[1] * 0.88, rgb[2] * 0.88];
    }
    hex = rgbToHex(rgb);
    lightRatio = computeContrastRatioHex(hex, LIGHT_INK);
    darkRatio = computeContrastRatioHex(hex, DARK_INK);
    safety += 1;
  }

  // Reaplica teto de papel apenas se mantiver contraste AA
  const reClamped = clampPaperHsl(hex);
  const reLight = computeContrastRatioHex(reClamped, LIGHT_INK);
  const reDark = computeContrastRatioHex(reClamped, DARK_INK);
  if (Math.max(reLight, reDark) >= 4.55) {
    hex = reClamped;
    lightRatio = reLight;
    darkRatio = reDark;
  }

  const spineAccentHex =
    rawSpineAccent && parseHexToRgb(rawSpineAccent)
      ? clampPaperHsl(rawSpineAccent)
      : deriveSpineAccentHex(hex, fallbackSeed);

  const accLight = computeContrastRatioHex(spineAccentHex, LIGHT_INK);
  const accDark = computeContrastRatioHex(spineAccentHex, DARK_INK);

  return {
    spineBg: hex,
    spineInk: lightRatio >= darkRatio ? LIGHT_INK : DARK_INK,
    spineAccentHex,
    spineAccentInk: accLight >= accDark ? LIGHT_INK : DARK_INK,
  };
}

/**
 * Calcula largura da lombada proporcional às páginas e altura realista por formato e seed.
 */
export function resolveBookDimensions(book: {
  id: string | number;
  title: string;
  pages?: number | null;
  format?: RealisticBookFormat | BookFormat | null;
  seed?: string | null;
  isbn?: string | null;
}): { spineWidthPx: number; bookHeightPx: number } {
  const safePages =
    typeof book.pages === "number" &&
    Number.isFinite(book.pages) &&
    book.pages > 0
      ? book.pages
      : 220;
  const spineWidthPx = Math.max(
    30,
    Math.min(58, Math.round(28 + safePages * 0.052))
  );

  const seed = String(book.seed ?? book.isbn ?? book.id ?? book.title);
  const specs = computeRealisticBookSpecs({
    pages: safePages,
    format: book.format,
    seed,
  });

  return { spineWidthPx, bookHeightPx: specs.heightPx };
}

export interface ShelfColorPreset {
  id: "classic-dark" | "editorial-tricolor" | "parchment-wood" | "crimson-gold";
  label: string;
  dots: readonly [string, ...string[]];
}

export const SHELF_COLOR_PRESETS: readonly ShelfColorPreset[] = [
  {
    id: "classic-dark",
    label: "Ébano & Verde Musgo",
    dots: ["#141514", "#3B523E"],
  },
  {
    id: "editorial-tricolor",
    label: "Bordô, Ouro & Ardósia",
    dots: ["#722F3E", "#C8A46E", "#6B7F94"],
  },
  {
    id: "parchment-wood",
    label: "Marfim & Nogueira",
    dots: ["#F4EFE6", "#7A4B2A"],
  },
  {
    id: "crimson-gold",
    label: "Carmim & Latão",
    dots: ["#9E2A2B", "#DFBE88"],
  },
];

export const SHELF_CATEGORY_SUGGESTIONS: readonly string[] = [
  "Lista de Leitura",
  "Clássicos",
  "Não-Ficção",
  "Ficção Contemporânea",
  "Favoritos do Acervo",
  "Miscelânea",
];

export type SpineTypoStyle = "serif-bold" | "sans-condensed" | "sans-light";

const SPINE_TYPO_STYLES: readonly SpineTypoStyle[] = [
  "serif-bold",
  "sans-condensed",
  "sans-light",
];

const SPINE_TEMPLATES: readonly SpineTemplateId[] = ["A", "B", "C", "D"];

/**
 * Escolhe um dos 4 templates gráficos de lombada (A, B, C, D) por hash do id,
 * garantindo que dois livros vizinhos nunca usem o mesmo template.
 */
export function pickSpineTemplate(
  seed: string,
  prevTemplate?: SpineTemplateId | null
): SpineTemplateId {
  const idx = hashCoverSeed(`${seed}:spine-template`) % SPINE_TEMPLATES.length;
  const candidate = SPINE_TEMPLATES[idx]!;
  if (prevTemplate && candidate === prevTemplate) {
    return SPINE_TEMPLATES[(idx + 1) % SPINE_TEMPLATES.length]!;
  }
  return candidate;
}

export const PUBLISHER_MARKS = ["◆", "✦", "○", "❧", "▪", "◈"] as const;

/**
 * Marca discreta de editora na base (~50% dos livros, 6 glifos simples por hash).
 */
export function pickPublisherMark(seed: string): string | null {
  const h = hashCoverSeed(`${seed}:imprint-mark`);
  if (h % 2 !== 0) return null;
  return PUBLISHER_MARKS[(h >>> 1) % PUBLISHER_MARKS.length]!;
}

/**
 * Calcula geometria orgânica para prateleira 3D:
 * - Espessura: clamp(12px, pages * 0.07px, 56px) + variação de ±2px por hash do id
 * - Altura: 150 a 215px (hash + 12px se pages > 500, alinhada pela base)
 * - Estilo tipográfico determinístico (serif-bold | sans-condensed | sans-light)
 */
export function computeShelfBookGeometry(params: {
  pages?: number | null;
  format?: RealisticBookFormat | BookFormat | string | null;
  seed: string;
}): {
  format: RealisticBookFormat;
  heightPx: number;
  spineWidthPx: number;
  jitterPx: number;
  depthPx: number;
  typoStyle: SpineTypoStyle;
} {
  const format = normalizeRealisticBookFormat(params.format);

  const safePages =
    typeof params.pages === "number" &&
    Number.isFinite(params.pages) &&
    params.pages > 0
      ? params.pages
      : 240;

  const hUnit = (hashCoverSeed(`${params.seed}:shelf-height`) % 1000) / 999;
  const pageBonus = safePages > 500 ? 12 : 0;
  const heightPx = Math.max(
    150,
    Math.min(215, Math.round(150 + hUnit * 53 + pageBonus))
  );

  const baseWidth = Math.max(12, Math.min(56, safePages * 0.07));
  const jitterPx = (hashCoverSeed(`${params.seed}:w-jitter`) % 5) - 2; // [-2..+2]px
  const spineWidthPx = Number(
    Math.max(12, Math.min(56, baseWidth + jitterPx)).toFixed(2)
  );
  const depthPx = Math.round(heightPx * 0.67);
  const typoStyle =
    SPINE_TYPO_STYLES[
      hashCoverSeed(`${params.seed}:typo-style`) % SPINE_TYPO_STYLES.length
    ]!;

  return {
    format,
    heightPx,
    spineWidthPx,
    jitterPx,
    depthPx,
    typoStyle,
  };
}

export interface GroupBooksOptions {
  unifyTaxonomy?: boolean;
  compactSmallThreshold?: number;
  miscLabel?: string;
}

/**
 * Normaliza um livro isolado para a cena 3D: cor/tinta da lombada com contraste AA
 * (cor persistida da capa ou, na falta, derivada de forma determinística do seed),
 * formato realista e metadados de exibição.
 */
export function normalizeVirtualBook(
  book: VirtualBookItem,
  genreKey: string,
  genreLabel: string,
  avoidNeighborHex?: string | null,
  avoidNeighborTemplate?: SpineTemplateId | null
): NormalizedVirtualBook {
  const resolvedSeed = String(book.seed ?? book.isbn ?? book.id ?? book.title);
  const { spineBg, spineInk, spineAccentHex, spineAccentInk } =
    resolveSpinePalette(
      book.spineColor,
      resolvedSeed,
      avoidNeighborHex,
      book.spineAccent
    );
  const geom = computeShelfBookGeometry({
    pages: book.pages,
    format: book.format,
    seed: resolvedSeed,
  });
  const spineTemplate = pickSpineTemplate(resolvedSeed, avoidNeighborTemplate);
  const publisherMark = pickPublisherMark(resolvedSeed);

  return {
    ...book,
    canonicalGenreKey: genreKey,
    displayGenre:
      book.genre?.trim() && genreKey === "miscelanea"
        ? book.genre.trim()
        : genreLabel,
    spineBg,
    spineInk,
    spineAccentHex,
    spineAccentInk,
    spineTemplate,
    publisherMark,
    spineWidthPx: geom.spineWidthPx,
    bookHeightPx: geom.heightPx,
    realisticFormat: geom.format,
    authorSurname: extractAuthorSurname(book.author),
    resolvedSeed,
    statusLabel: book.status ?? "Na estante",
  };
}

/**
 * Agrupa dinamicamente os livros em prateleiras horizontais exclusivas por gênero,
 * omitindo gêneros com 0 livros, opcionalmente unificando taxonomias/agrupando
 * prateleiras esparsas em "Miscelânea", e garantindo contraste entre vizinhos.
 */
export function groupBooksByGenre(
  books: readonly VirtualBookItem[],
  options: GroupBooksOptions = {}
): GenreShelfGroup[] {
  const {
    unifyTaxonomy = false,
    compactSmallThreshold = 0,
    miscLabel = "Miscelânea",
  } = options;

  const labelByKey = new Map<string, string>();
  const buckets = new Map<string, VirtualBookItem[]>();

  for (const book of books) {
    const trimmedGenre = book.genre?.trim() ?? "";
    let canonicalKey: string;
    let rawLabel: string;

    if (unifyTaxonomy) {
      const unified = resolveCanonicalGenre(trimmedGenre);
      canonicalKey = unified.key;
      rawLabel = unified.label;
    } else {
      rawLabel = trimmedGenre.length > 0 ? trimmedGenre : "Acervo Geral";
      canonicalKey = normalizeSearchText(rawLabel) || "acervo-geral";
    }

    if (!labelByKey.has(canonicalKey)) {
      labelByKey.set(canonicalKey, rawLabel);
    }
    const list = buckets.get(canonicalKey) ?? [];
    list.push(book);
    buckets.set(canonicalKey, list);
  }

  // Se vários gêneros tiverem apenas 1 ou N livros, agrupa-os automaticamente em "Miscelânea"
  if (compactSmallThreshold > 0) {
    const smallKeys = [...buckets.entries()]
      .filter(
        ([key, list]) =>
          key !== "miscelanea" &&
          list.length > 0 &&
          list.length <= compactSmallThreshold
      )
      .map(([key]) => key);

    if (smallKeys.length >= 2) {
      const originalIndex = new Map(books.map((book, idx) => [book, idx]));
      const miscBucket = buckets.get("miscelanea") ?? [];
      for (const smallKey of smallKeys) {
        const moved = buckets.get(smallKey) ?? [];
        miscBucket.push(...moved);
        buckets.delete(smallKey);
        labelByKey.delete(smallKey);
      }
      // Mantém a ordem manual do usuário ao reunir gêneros esparsos em "Miscelânea"
      miscBucket.sort(
        (a, b) => (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0)
      );
      buckets.set("miscelanea", miscBucket);
      labelByKey.set("miscelanea", miscLabel);
    }
  }

  const orderedGroups: GenreShelfGroup[] = [];

  for (const [genreKey, genreLabel] of labelByKey.entries()) {
    const rawShelfBooks = buckets.get(genreKey);
    if (!rawShelfBooks || rawShelfBooks.length === 0) continue;

    let prevSpineBg: string | null = null;
    let prevTemplate: SpineTemplateId | null = null;
    const normalizedShelfBooks: NormalizedVirtualBook[] = rawShelfBooks.map(
      (book) => {
        const normalized = normalizeVirtualBook(
          book,
          genreKey,
          genreLabel,
          prevSpineBg,
          prevTemplate
        );
        prevSpineBg = normalized.spineBg;
        prevTemplate = normalized.spineTemplate;
        return normalized;
      }
    );

    orderedGroups.push({
      genreKey,
      genre: genreLabel,
      books: normalizedShelfBooks,
    });
  }

  return orderedGroups;
}

export const MIN_SHELF_WIDTH_PX = 480;
export const MAX_SHELF_WIDTH_PX = 960;
export const PLANK_OVERHANG_PX = 12;
export const MAX_PACKED_ROW_BOOKS_WIDTH_PX = 880; // Capacidade útil na tábua de até 960px antes de quebrar para continuação
export const SHELF_BOOKEND_WIDTH_PX = 38;
export const SHELF_COVERS_MODE_EXTRA_PX = 54;
export const SHELF_TILTED_EXTRA_PX = 26;
export const SHELF_FRONT_COVER_MARGIN_INLINE_PX = 6;
export const DEFAULT_GROUP_GAP_PX = 12;

export type ShelfBookLayoutDisplayMode =
  "lombada" | "capa_frente" | "inclinado";

export interface BookRenderLayoutMetrics {
  /** Largura total ocupada pelo slot do livro na fileira (base + inclinação + modo capas 3D). */
  widthPx: number;
  /** Altura renderizada do livro na fileira. */
  heightPx: number;
  /** Largura da capa frontal quando displayMode === "capa_frente". */
  coverShowcaseWidthPx: number;
  /** Altura da capa frontal quando displayMode === "capa_frente". */
  coverShowcaseHeightPx: number;
}

/**
 * Função ÚNICA de cálculo de dimensões renderizadas de um livro na estante.
 * Usada tanto pelo empacotador de fileiras (`packShelfBooksByWidth`) quanto pela
 * renderização (`ShelfView`), garantindo paridade exata entre quebra e layout final.
 */
export function measureBookRenderLayout(
  book: {
    id: string | number;
    pages?: number | null;
    format?: string | null;
    realisticFormat?: string | null;
    seed?: string | null;
    resolvedSeed?: string | null;
  },
  options: {
    displayMode?: ShelfBookLayoutDisplayMode;
    view3dMode?: "spines" | "covers";
    shelfScale?: number;
  } = {}
): BookRenderLayoutMetrics {
  const displayMode = options.displayMode ?? "lombada";
  const view3dMode = options.view3dMode ?? "spines";
  const shelfScale = options.shelfScale ?? 1;

  const geom = computeShelfBookGeometry({
    pages: book.pages,
    format: book.realisticFormat ?? book.format,
    seed: book.resolvedSeed ?? book.seed ?? String(book.id),
  });

  const coverShowcaseHeightPx = Math.max(
    132,
    Math.min(168, Math.round(geom.heightPx * 0.9))
  );
  const coverShowcaseWidthPx = Math.round(coverShowcaseHeightPx * 0.66);

  if (displayMode === "capa_frente") {
    return {
      widthPx: Number(
        (coverShowcaseWidthPx + SHELF_FRONT_COVER_MARGIN_INLINE_PX).toFixed(2)
      ),
      heightPx: coverShowcaseHeightPx,
      coverShowcaseWidthPx,
      coverShowcaseHeightPx,
    };
  }

  const baseSpine = geom.spineWidthPx * shelfScale;
  const tiltExtra = displayMode === "inclinado" ? SHELF_TILTED_EXTRA_PX : 0;
  const coversExtra = view3dMode === "covers" ? SHELF_COVERS_MODE_EXTRA_PX : 0;

  return {
    widthPx: Number((baseSpine + tiltExtra + coversExtra).toFixed(2)),
    heightPx: Number((geom.heightPx * shelfScale).toFixed(2)),
    coverShowcaseWidthPx,
    coverShowcaseHeightPx,
  };
}

/**
 * Converte a configuração de densidade da estante no vão horizontal aplicado
 * SOMENTE entre grupos de 3–7 livros (nunca entre cada livro individualmente).
 */
export function resolveShelfGroupGapPx(
  density:
    | "compact"
    | "normal"
    | "spacious"
    | "compacta"
    | "padrao"
    | "vitrine" = "padrao"
): number {
  switch (density) {
    case "compact":
    case "compacta":
      return 8;
    case "spacious":
    case "vitrine":
      return 16;
    case "normal":
    case "padrao":
    default:
      return DEFAULT_GROUP_GAP_PX;
  }
}

/**
 * Calcula os índices 0-based dentro de uma fileira onde inicia um novo grupo.
 * Regra determinística e SSR-safe:
 * - Fileiras com <= 7 livros formam 1 único grupo coeso (0 vãos internos).
 * - Fileiras com >= 8 livros são particionadas em grupos de 3 a 7 livros cada,
 *   garantindo vãos APENAS entre grupos e nunca entre livros individuais.
 */
export function computeRowGroupBreakIndices(
  bookCount: number,
  rowSeed: string
): number[] {
  if (bookCount <= 7) return [];

  const breaks: number[] = [];
  let cursor = 0;
  let groupIndex = 0;

  while (bookCount - cursor > 7) {
    const remaining = bookCount - cursor;
    const maxAllowed = Math.min(7, remaining - 3);
    const minAllowed = 3;
    // Prefere grupos naturais de 4–6 quando há folga; respeita rigorosamente [3, 7]
    const preferredMin = remaining >= 11 ? 4 : minAllowed;
    const preferredMax = remaining >= 11 ? Math.min(6, maxAllowed) : maxAllowed;
    const span = Math.max(1, preferredMax - preferredMin + 1);
    const pick =
      preferredMin + (hashCoverSeed(`${rowSeed}:grp:${groupIndex}`) % span);
    const size = Math.max(minAllowed, Math.min(maxAllowed, pick));
    cursor += size;
    breaks.push(cursor);
    groupIndex += 1;
  }

  return breaks;
}

export interface PackedShelfRowChunk<T = NormalizedVirtualBook> {
  books: T[];
  rowBooksWidthPx: number;
  maxBookHeightPx: number;
  startIndex: number;
  /** Índices 0-based (dentro da fileira) que iniciam um novo grupo de 3–7 livros. */
  groupBreakIndices: number[];
  /** Vão horizontal aplicado apenas nos índices em `groupBreakIndices`. */
  groupGapPx: number;
}

/**
 * Empacotamento determinístico e SSR-safe pela função única `measureBookRenderLayout`:
 * considera modo de exibição (`lombada`, `capa_frente`, `inclinado`), modo `"covers"`
 * (+54px) e vãos apenas entre grupos de 3–7 livros. Jamais ultrapassa `maxRowWidthPx`
 * em fileiras com mais de 1 livro.
 */
export function packShelfBooksByWidth<
  T extends {
    id: string | number;
    pages?: number | null;
    format?: string | null;
    realisticFormat?: string | null;
    seed?: string | null;
    resolvedSeed?: string | null;
  } = NormalizedVirtualBook,
>(
  books: readonly T[],
  options: {
    maxRowWidthPx?: number;
    /** Vão entre grupos de 3–7 livros. */
    groupGapPx?: number;
    /** @deprecated Mantido apenas por compatibilidade; mapeado quando `groupGapPx` não é passado. */
    gapPx?: number;
    rowSeedPrefix?: string;
    bookDisplayModes?: Record<string, ShelfBookLayoutDisplayMode>;
    view3dMode?: "spines" | "covers";
    shelfScale?: number;
  } = {}
): PackedShelfRowChunk<T>[] {
  const maxRowWidthPx = options.maxRowWidthPx ?? MAX_PACKED_ROW_BOOKS_WIDTH_PX;
  const groupGapPx =
    options.groupGapPx ??
    (options.gapPx !== undefined
      ? Math.max(0, options.gapPx)
      : DEFAULT_GROUP_GAP_PX);
  const rowSeedPrefix = options.rowSeedPrefix ?? "shelf";
  const bookDisplayModes = options.bookDisplayModes;
  const view3dMode = options.view3dMode ?? "spines";
  const shelfScale = options.shelfScale ?? 1;

  if (books.length === 0) {
    return [
      {
        books: [],
        rowBooksWidthPx: 0,
        maxBookHeightPx: 178,
        startIndex: 0,
        groupBreakIndices: [],
        groupGapPx,
      },
    ];
  }

  const rows: PackedShelfRowChunk<T>[] = [];
  let currentBooks: T[] = [];
  let currentBooksSumWidth = 0;
  let currentMaxHeight = 150;
  let currentStartIdx = 0;

  const finalizeCurrentRow = () => {
    const rowSeed = `${rowSeedPrefix}:row:${rows.length}`;
    const breaks =
      groupGapPx > 0
        ? computeRowGroupBreakIndices(currentBooks.length, rowSeed)
        : [];
    const totalWidth = Number(
      (currentBooksSumWidth + breaks.length * groupGapPx).toFixed(2)
    );
    rows.push({
      books: currentBooks,
      rowBooksWidthPx: totalWidth,
      maxBookHeightPx: currentMaxHeight,
      startIndex: currentStartIdx,
      groupBreakIndices: breaks,
      groupGapPx,
    });
  };

  books.forEach((book, idx) => {
    const displayMode = bookDisplayModes?.[String(book.id)] ?? "lombada";
    const metrics = measureBookRenderLayout(book, {
      displayMode,
      view3dMode,
      shelfScale,
    });
    const w = metrics.widthPx;
    const h = metrics.heightPx;

    const candidateCount = currentBooks.length + 1;
    const candidateSeed = `${rowSeedPrefix}:row:${rows.length}`;
    const candidateBreaks =
      groupGapPx > 0
        ? computeRowGroupBreakIndices(candidateCount, candidateSeed)
        : [];
    const candidateTotalWidth =
      currentBooksSumWidth + w + candidateBreaks.length * groupGapPx;

    if (currentBooks.length > 0 && candidateTotalWidth > maxRowWidthPx) {
      finalizeCurrentRow();
      currentBooks = [book];
      currentBooksSumWidth = w;
      currentMaxHeight = h;
      currentStartIdx = idx;
    } else {
      currentBooks.push(book);
      currentBooksSumWidth += w;
      if (h > currentMaxHeight) currentMaxHeight = h;
    }
  });

  if (currentBooks.length > 0) {
    finalizeCurrentRow();
  }

  return rows;
}
