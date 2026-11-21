"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEventHandler,
  type KeyboardEventHandler,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import type { BookFormat, ReadingStatus } from "@/lib/domain";
import { extractAuthorSurname, hashCoverSeed } from "@/lib/cover-color";
import { rgbToHsl } from "@/features/catalog/spine-color-rules";
import {
  computeShelfBookGeometry,
  normalizeRealisticBookFormat,
  pickPublisherMark,
  pickSpineTemplate,
  resolveSpinePalette,
  type RealisticBookFormat,
  type SpineTemplateId,
  type SpineTypoStyle,
} from "@/features/shelves/virtual-bookshelf";
import { BookCover } from "@/components/BookCover";

export interface Book3DItem {
  id: string;
  slug: string;
  num: string;
  title: string;
  sub: string;
  width: number;
  height: number;
  color: string;
  textColor: string;
  description?: string;
  coverUrl?: string;
  sampleWorks?: string;
  pages?: number;
  format?: RealisticBookFormat | BookFormat;
  authorSurname?: string;
  publisher?: string;
}

export interface Book3DProps {
  pages?: number | null;
  format?: RealisticBookFormat | BookFormat | null;
  title?: string;
  authorSurname?: string;
  author?: string;
  publisher?: string | null;
  seed?: string;
  status?: string;
  readingStatus?:
    | ReadingStatus
    | "lendo"
    | "em_andamento"
    | "concluido"
    | "lido"
    | "desejo"
    | "quero_ler"
    | "wishlist";
  isWishlist?: boolean;
  progressPercent?: number;
  progressValue?: number | null;
  progressTotal?: number | null;
  genre?: string;
  avoidNeighborHex?: string | null;
  tabIndex?: number;
  onKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
  buttonRef?: (el: HTMLButtonElement | null) => void;
  onActivate?: () => void;
  /** Chamado em hover (ponteiro fino) ou foco para atualizar o painel rápido. */
  onHoverBook?: () => void;
  onFocusBook?: () => void;
  book?: Book3DItem;
  sub?: string;
  num?: string;
  color?: string;
  accentColor?: string;
  spineTemplate?: SpineTemplateId;
  publisherMark?: string | null;
  textColor?: string;
  coverUrl?: string | null;
  sampleWorks?: string;
  variant?: "spine" | "showcase" | "desk";
  /** Quando true (ex.: modo "Ver capas em 3D"), mantém faces laterais/capa montadas em repouso. */
  showCoverFace?: boolean;
  isSelected?: boolean;
  suppressSelectedTooltip?: boolean;
  onSelect?: (book: Book3DItem) => void;
  draggable?: boolean;
  isDragging?: boolean;
  dropPosition?: "before" | "after" | null;
  onDragStart?: DragEventHandler<HTMLElement>;
  onDragOver?: DragEventHandler<HTMLElement>;
  onDrop?: DragEventHandler<HTMLElement>;
  onDragEnd?: DragEventHandler<HTMLElement>;
  as?: "li" | "div";
  className?: string;
}

type BookSlotStyle = CSSProperties & {
  "--pages": string;
  "--spine-jitter": string;
  "--book-h": string;
  "--h-mm": string;
  "--t-mm": string;
  "--w": string;
  "--h": string;
  "--c": string;
  "--accent": string;
  "--accent-txt": string;
  "--txt": string;
  "--depth": string;
  "--title-fs": string;
  "--author-fs": string;
};

/**
 * Paleta editorial variada de encadernação para livros sem capa real
 * (nunca reduz a prateleira a cinza-chumbo monótono).
 */
export const EDITORIAL_SPINE_PALETTE: readonly string[] = [
  "#7B2D3B", // Bordô clássico
  "#2F5C46", // Verde floresta
  "#2F5080", // Azul prussiano
  "#AE8230", // Ocre mostarda
  "#AE542F", // Terracota queimada
  "#5F3E73", // Ameixa editorial
  "#2C6264", // Verde-petróleo
  "#7A4E33", // Nogueira quente
  "#943636", // Carmim impresso
  "#587139", // Verde oliva
  "#D6CEBC", // Marfim papel
  "#425E78", // Azul ardósia
] as const;

/** Detecta tons cinza-chumbo / quase pretos acromáticos usados como placeholder sem capa. */
export function isFlatCharcoalHex(hex?: string | null): boolean {
  if (!hex) return true;
  const clean = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return true;
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  const { s, l } = rgbToHsl(r, g, b);
  return s <= 14 && l <= 28;
}

/**
 * Escolhe cor editorial variada por hash para livros sem capa real,
 * pulando para o próximo tom caso coincida com o vizinho anterior.
 */
export function pickEditorialSpineColor(
  seed: string,
  avoidNeighborHex?: string | null
): string {
  const baseIdx =
    hashCoverSeed(`${seed}:editorial-palette`) % EDITORIAL_SPINE_PALETTE.length;
  const chosen = EDITORIAL_SPINE_PALETTE[baseIdx]!;
  if (
    avoidNeighborHex &&
    chosen.toLowerCase() === avoidNeighborHex.trim().toLowerCase()
  ) {
    return EDITORIAL_SPINE_PALETTE[
      (baseIdx + 1) % EDITORIAL_SPINE_PALETTE.length
    ]!;
  }
  return chosen;
}

/**
 * Resolve cor efetiva da lombada:
 * - Com capa real (`coverUrl`): preserva `spineColor` / `spineAccent` extraídos da capa.
 * - Sem capa real: usa a cor fornecida se já for uma cor editorial viva; caso contrário
 *   (ausente ou cinza-chumbo), escolhe na paleta editorial variada evitando repetir o vizinho.
 */
export function resolveEffectiveSpineColor(params: {
  coverUrl?: string | null;
  rawColor?: string | null;
  seed: string;
  avoidNeighborHex?: string | null;
}): { color: string; isFromCover: boolean } {
  const hasRealCover = Boolean(params.coverUrl?.trim());
  const cleanRaw = params.rawColor?.trim();
  const isValidHex = Boolean(cleanRaw && /^#[0-9a-fA-F]{6}$/.test(cleanRaw));

  if (hasRealCover && isValidHex && cleanRaw) {
    return { color: cleanRaw, isFromCover: true };
  }

  if (isValidHex && cleanRaw && !isFlatCharcoalHex(cleanRaw)) {
    if (
      params.avoidNeighborHex &&
      cleanRaw.toLowerCase() === params.avoidNeighborHex.trim().toLowerCase()
    ) {
      return {
        color: pickEditorialSpineColor(params.seed, params.avoidNeighborHex),
        isFromCover: false,
      };
    }
    return { color: cleanRaw, isFromCover: false };
  }

  return {
    color: pickEditorialSpineColor(params.seed, params.avoidNeighborHex),
    isFromCover: false,
  };
}

const MIN_SPINE_FONT_PX = 8;
const MAX_SPINE_FONT_PX = 15;
const TWO_LINE_MIN_THICKNESS_PX = 26;

const DANGLING_TRAILING_WORDS = new Set([
  "a",
  "as",
  "o",
  "os",
  "e",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "um",
  "uma",
  "uns",
  "umas",
  "com",
  "sem",
  "por",
  "para",
  "que",
  "ao",
  "aos",
  "the",
  "of",
  "and",
  "in",
  "to",
  "for",
  "on",
]);

function splitIntoTwoBalancedLines(text: string): [string, string] | null {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;

  let bestSplit = 1;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let i = 1; i < words.length; i += 1) {
    const l1 = words.slice(0, i).join(" ");
    const l2 = words.slice(i).join(" ");
    const maxLen = Math.max(l1.length, l2.length);
    const diff = Math.abs(l1.length - l2.length);
    // Prefere menor linha mais longa e equilíbrio entre as 2 linhas
    const score = maxLen * 10 + diff + (l2.length > l1.length ? 0.4 : 0);
    if (score < bestScore) {
      bestScore = score;
      bestSplit = i;
    }
  }

  return [
    words.slice(0, bestSplit).join(" "),
    words.slice(bestSplit).join(" "),
  ];
}

function stripSubtitleForSpine(title: string): string | null {
  const match = /^([^:—–]+?)(?:\s*[:—–]\s+|\s+-\s+).+$/.exec(title.trim());
  const main = match?.[1]?.trim();
  if (!main || main.length < 3 || main.length >= title.trim().length) {
    return null;
  }
  return main;
}

function abbreviateByWholeWords(
  title: string,
  maxCharsPerLine: number,
  maxLines: 1 | 2
): string[] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [title.trim()];

  const trimDangling = (list: string[]): string[] => {
    const copy = [...list];
    while (
      copy.length > 1 &&
      DANGLING_TRAILING_WORDS.has(
        copy[copy.length - 1]!.toLowerCase().replace(/[^a-zà-ÿ0-9]/gi, "")
      )
    ) {
      copy.pop();
    }
    return copy;
  };

  if (maxLines === 2) {
    // Tenta encaixar o máximo de palavras inteiras em 2 linhas balanceadas
    for (let count = words.length; count >= 2; count -= 1) {
      const subset = trimDangling(words.slice(0, count));
      if (subset.length < 2) break;
      const candidate = subset.join(" ");
      const split = splitIntoTwoBalancedLines(candidate);
      if (
        split &&
        split[0].length <= maxCharsPerLine &&
        split[1].length <= maxCharsPerLine
      ) {
        return split;
      }
    }
  }

  // Fallback 1 linha por palavras inteiras (jamais corta no meio de uma palavra nem usa reticências)
  const kept: string[] = [];
  for (const word of words) {
    const next = kept.length === 0 ? word : `${kept.join(" ")} ${word}`;
    if (next.length <= maxCharsPerLine) {
      kept.push(word);
    } else {
      break;
    }
  }

  if (kept.length > 0) {
    return [trimDangling(kept).join(" ")];
  }

  // Caso raro: primeira palavra isolada maior que o limite -> mantém a primeira palavra inteira sem reticências
  return [words[0]!];
}

export interface FittedSpineLayout {
  lines: string[];
  titleFontPx: number;
  authorFontPx: number;
  showAuthor: boolean;
  isThinSpine: boolean;
  isWideSpine: boolean;
  wasWordAbbreviated: boolean;
}

/**
 * Auto-fit tipográfico determinístico para lombada vertical:
 * - Fonte de 15px até 8px conforme comprimento do título e altura disponível da lombada.
 * - Permite 2 linhas balanceadas quando a espessura >= 26px.
 * - Proibido reticências por caracteres: só se ainda não couber a 8px, abrevia por palavra inteira.
 */
export function computeFittedSpineTypography(params: {
  title: string;
  authorSurname: string;
  heightPx: number;
  spineWidthPx: number;
  template?: SpineTemplateId;
  hasPublisherMark?: boolean;
  typoStyle?: SpineTypoStyle;
}): FittedSpineLayout {
  const cleanTitle = params.title.trim() || "Título";
  const { authorSurname, heightPx, spineWidthPx } = params;
  const template = params.template ?? "A";
  const hasPublisherMark = Boolean(params.hasPublisherMark);

  const isThinSpine = spineWidthPx < 19;
  const isWideSpine = spineWidthPx >= 42;
  const canUseTwoLines = spineWidthPx >= TWO_LINE_MIN_THICKNESS_PX;

  // Fator médio de avanço por caractere no eixo vertical (writing-mode: vertical-rl)
  // Inclui folga para letras maiúsculas e acentuadas para nunca cortar um caractere nas pontas.
  const effectiveStyle: SpineTypoStyle =
    template === "C"
      ? "serif-bold"
      : template === "D"
        ? "sans-light"
        : (params.typoStyle ?? "serif-bold");
  const charAdvanceFactor =
    effectiveStyle === "sans-condensed"
      ? 0.78
      : effectiveStyle === "sans-light"
        ? 0.64
        : 0.67;

  // Desconta faixa superior (templates B/D), vincos, marca de editora e filete ornamental
  const topBandPx =
    template === "D" ? heightPx * 0.27 : template === "B" ? heightPx * 0.23 : 0;
  const verticalPaddingPx = template === "B" || template === "D" ? 26 : 34;
  const imprintPx = hasPublisherMark ? 13 : 0;
  const ornamentPx = template === "C" ? 8 : 0;

  const usableWithoutAuthorPx = Math.max(
    48,
    heightPx - topBandPx - verticalPaddingPx - imprintPx - ornamentPx
  );
  const authorReservePx =
    !isThinSpine && authorSurname
      ? Math.min(46, authorSurname.length * 4.7 + 10)
      : 0;
  const usableWithAuthorPx = Math.max(
    40,
    usableWithoutAuthorPx - authorReservePx
  );

  // Limite horizontal pela espessura da lombada (mantendo faixa 8px..15px)
  const maxFs1Line = Math.min(
    MAX_SPINE_FONT_PX,
    Math.max(MIN_SPINE_FONT_PX, (spineWidthPx - 4) / 1.12)
  );
  const maxFs2Lines = canUseTwoLines
    ? Math.min(
        MAX_SPINE_FONT_PX,
        Math.max(MIN_SPINE_FONT_PX, (spineWidthPx - 6) / 2.22)
      )
    : 0;

  const tryFit = (
    text: string,
    availableHeightPx: number
  ): { lines: string[]; fontPx: number } | null => {
    const len = Math.max(1, text.length);
    const fs1Raw = availableHeightPx / (len * charAdvanceFactor);
    const fs1 = Math.min(maxFs1Line, fs1Raw);

    let bestTwo: { lines: [string, string]; fontPx: number } | null = null;
    if (canUseTwoLines) {
      const split = splitIntoTwoBalancedLines(text);
      if (split) {
        const longest = Math.max(split[0].length, split[1].length);
        const fs2Raw = availableHeightPx / (longest * charAdvanceFactor);
        const fs2 = Math.min(maxFs2Lines, fs2Raw);
        if (fs2 >= MIN_SPINE_FONT_PX) {
          bestTwo = { lines: split, fontPx: fs2 };
        }
      }
    }

    // Se 1 linha não cabe a >= 8px, usa 2 linhas quando disponível
    if (fs1 < MIN_SPINE_FONT_PX) {
      return bestTwo;
    }

    // Se 2 linhas oferece tipografia sensivelmente mais legível para títulos longos em lombadas >= 26px
    if (bestTwo && text.length >= 16 && bestTwo.fontPx > fs1 + 1.1) {
      return bestTwo;
    }

    return { lines: [text], fontPx: fs1 };
  };

  const makeResult = (
    lines: string[],
    rawFontPx: number,
    showAuthor: boolean,
    wasWordAbbreviated: boolean
  ): FittedSpineLayout => {
    const titleFontPx = Number(
      Math.max(
        MIN_SPINE_FONT_PX,
        Math.min(MAX_SPINE_FONT_PX, rawFontPx)
      ).toFixed(2)
    );
    const authorFontPx = Number(
      Math.max(6.5, Math.min(9.5, titleFontPx * 0.72)).toFixed(2)
    );
    return {
      lines,
      titleFontPx,
      authorFontPx,
      showAuthor: showAuthor && !isThinSpine && Boolean(authorSurname),
      isThinSpine,
      isWideSpine,
      wasWordAbbreviated,
    };
  };

  // 1) Título completo com autor visível
  const fitFullWithAuthor = tryFit(cleanTitle, usableWithAuthorPx);
  if (fitFullWithAuthor) {
    return makeResult(
      fitFullWithAuthor.lines,
      fitFullWithAuthor.fontPx,
      true,
      false
    );
  }

  // 2) Título completo ocultando autor para priorizar o título integral sem abreviar
  if (authorReservePx > 0) {
    const fitFullNoAuthor = tryFit(cleanTitle, usableWithoutAuthorPx);
    if (fitFullNoAuthor) {
      return makeResult(
        fitFullNoAuthor.lines,
        fitFullNoAuthor.fontPx,
        false,
        false
      );
    }
  }

  // 3) Ainda não coube a 8px: tenta primeiro sem subtítulo (após :, — ou -)
  const mainTitleOnly = stripSubtitleForSpine(cleanTitle);
  if (mainTitleOnly) {
    const fitMainWithAuthor = tryFit(mainTitleOnly, usableWithAuthorPx);
    if (fitMainWithAuthor) {
      return makeResult(
        fitMainWithAuthor.lines,
        fitMainWithAuthor.fontPx,
        true,
        true
      );
    }
    const fitMainNoAuthor = tryFit(mainTitleOnly, usableWithoutAuthorPx);
    if (fitMainNoAuthor) {
      return makeResult(
        fitMainNoAuthor.lines,
        fitMainNoAuthor.fontPx,
        false,
        true
      );
    }
  }

  // 4) Último recurso: abreviação limpa por palavra inteira a 8px (zero reticências)
  const maxCharsPerLine = Math.max(
    6,
    Math.floor(usableWithoutAuthorPx / (MIN_SPINE_FONT_PX * charAdvanceFactor))
  );
  const abbreviatedLines = abbreviateByWholeWords(
    mainTitleOnly ?? cleanTitle,
    maxCharsPerLine,
    canUseTwoLines ? 2 : 1
  );

  return makeResult(abbreviatedLines, MIN_SPINE_FONT_PX, false, true);
}

interface TooltipCoords {
  x: number;
  y: number;
  arrowOffset: number;
  placement: "top" | "bottom";
}

function Book3DBase({
  pages,
  format,
  title,
  authorSurname,
  author,
  publisher,
  seed,
  readingStatus,
  isWishlist = false,
  progressPercent = 0,
  avoidNeighborHex,
  tabIndex = 0,
  onKeyDown,
  buttonRef,
  onActivate,
  onHoverBook,
  onFocusBook,
  book,
  sub,
  color,
  accentColor,
  spineTemplate,
  publisherMark,
  textColor,
  coverUrl,
  sampleWorks,
  variant = "spine",
  showCoverFace = false,
  isSelected = false,
  suppressSelectedTooltip = false,
  onSelect,
  draggable = false,
  isDragging = false,
  dropPosition = null,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  as = "li",
  className = "",
}: Book3DProps) {
  const itemTitle = book?.title ?? title ?? "Título";
  const itemSub = book?.sub ?? sub ?? "";
  const resolvedAuthorFull =
    author ?? authorSurname ?? book?.authorSurname ?? itemSub;
  const resolvedSurname =
    authorSurname ??
    book?.authorSurname ??
    extractAuthorSurname(author ?? itemSub);
  void publisher;
  const resolvedSeed = String(seed ?? book?.id ?? itemTitle);
  const resolvedFormat = normalizeRealisticBookFormat(
    format ?? book?.format ?? (book ? "capa_dura" : "brochura")
  );
  const resolvedPages =
    pages ??
    book?.pages ??
    (book?.width ? Math.round((book.width - 28) / 0.052) : 240);

  const itemCoverUrl = book?.coverUrl ?? coverUrl ?? undefined;
  const effectiveColorInfo = useMemo(
    () =>
      resolveEffectiveSpineColor({
        coverUrl: itemCoverUrl,
        rawColor: color ?? book?.color,
        seed: resolvedSeed,
        avoidNeighborHex,
      }),
    [itemCoverUrl, color, book?.color, resolvedSeed, avoidNeighborHex]
  );
  const itemColor = effectiveColorInfo.color;
  const itemTextColor = textColor ?? book?.textColor ?? "#F4EFE6";
  void sampleWorks;

  // Paleta de papel (HSL S <= 70%, L 18%–82%) + cor de acento + contraste AA garantido
  const spinePalette = useMemo(
    () =>
      resolveSpinePalette(
        itemColor,
        resolvedSeed,
        avoidNeighborHex,
        effectiveColorInfo.isFromCover ? accentColor : undefined
      ),
    [
      itemColor,
      resolvedSeed,
      avoidNeighborHex,
      effectiveColorInfo.isFromCover,
      accentColor,
    ]
  );

  const resolvedTemplate = useMemo(
    () => spineTemplate ?? pickSpineTemplate(resolvedSeed),
    [spineTemplate, resolvedSeed]
  );

  const resolvedPublisherMark = useMemo(
    () =>
      publisherMark !== undefined
        ? publisherMark
        : pickPublisherMark(resolvedSeed),
    [publisherMark, resolvedSeed]
  );

  // Handlers sempre atualizados sem invalidar o React.memo
  const latest = useRef({
    onActivate,
    onHoverBook,
    onFocusBook,
    onSelect,
    book,
    onKeyDown,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    buttonRef,
  });
  useEffect(() => {
    latest.current = {
      onActivate,
      onHoverBook,
      onFocusBook,
      onSelect,
      book,
      onKeyDown,
      onDragStart,
      onDragOver,
      onDrop,
      onDragEnd,
      buttonRef,
    };
  });
  const stableKeyDown = useCallback<KeyboardEventHandler<HTMLButtonElement>>(
    (e) => latest.current.onKeyDown?.(e),
    []
  );
  const stableDragStart = useCallback<DragEventHandler<HTMLElement>>(
    (e) => latest.current.onDragStart?.(e),
    []
  );
  const stableDragOver = useCallback<DragEventHandler<HTMLElement>>(
    (e) => latest.current.onDragOver?.(e),
    []
  );
  const stableDrop = useCallback<DragEventHandler<HTMLElement>>(
    (e) => latest.current.onDrop?.(e),
    []
  );
  const stableDragEnd = useCallback<DragEventHandler<HTMLElement>>(
    (e) => latest.current.onDragEnd?.(e),
    []
  );
  const stableButtonRef = useCallback((el: HTMLButtonElement | null) => {
    latest.current.buttonRef?.(el);
  }, []);

  // Tooltip em portal: centralizada acima do livro, com seta, clamp na viewport,
  // garantindo que nunca cubra o pill do cabeçalho nem o livro elevado em hover.
  const slotRef = useRef<HTMLElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [tipCoords, setTipCoords] = useState<TooltipCoords | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const measureTip = useCallback(() => {
    const el = slotRef.current;
    if (!el || typeof window === "undefined") return;
    const rect = el.getBoundingClientRect();
    const tipEl = tipRef.current;
    const tipW = tipEl?.offsetWidth || 216;
    const tipH = tipEl?.offsetHeight || 88;
    const marginX = 10;
    const safeTop = 74; // Limpa o cabeçalho fixo (64px) + respiro

    const bookCenterX = rect.left + rect.width / 2;
    const minCenterX = tipW / 2 + marginX;
    const maxCenterX = Math.max(
      minCenterX,
      window.innerWidth - tipW / 2 - marginX
    );
    const x = Math.min(Math.max(bookCenterX, minCenterX), maxCenterX);
    const maxArrowShift = Math.max(0, tipW / 2 - 18);
    const arrowOffset = Math.max(
      -maxArrowShift,
      Math.min(maxArrowShift, bookCenterX - x)
    );

    // Folga acima do topo real do livro em hover (translateY(-10px) + scale(1.1) + tilt 3D)
    const liftedBookTop = rect.top - (14 + rect.height * 0.13);
    let anchorY = liftedBookTop - 10;

    // Nunca cobrir o pill do cabeçalho da prateleira
    const shelfRow = el.closest(".rf-shelf-row");
    const pillEl =
      shelfRow?.querySelector<HTMLElement>('[data-shelf-pill="true"]') ??
      shelfRow?.querySelector<HTMLElement>(".rf-shelf-header > :first-child");
    if (pillEl) {
      const pillRect = pillEl.getBoundingClientRect();
      const tipLeft = x - tipW / 2;
      const tipRight = x + tipW / 2;
      const horizOverlap =
        tipLeft < pillRect.right + 8 && tipRight > pillRect.left - 8;
      const vertOverlap =
        anchorY > pillRect.top - 8 && anchorY - tipH < pillRect.bottom + 8;
      if (horizOverlap && vertOverlap) {
        anchorY = Math.min(anchorY, pillRect.top - 12);
      }
    }

    let placement: "top" | "bottom" = "top";
    let y = anchorY;

    // Se não couber acima do pill/livro sem encostar no topo da viewport, posiciona abaixo da tábua
    if (anchorY - tipH < safeTop) {
      placement = "bottom";
      const plankEl = shelfRow?.querySelector<HTMLElement>(".rf-shelf-plank");
      const belowBase = plankEl
        ? plankEl.getBoundingClientRect().bottom
        : rect.bottom + 18;
      y = Math.min(belowBase + 12, window.innerHeight - tipH - 12);
    }

    setTipCoords((prev) =>
      prev &&
      prev.placement === placement &&
      Math.abs(prev.x - x) < 0.5 &&
      Math.abs(prev.y - y) < 0.5 &&
      Math.abs(prev.arrowOffset - arrowOffset) < 0.5
        ? prev
        : { x, y, arrowOffset, placement }
    );
  }, []);

  void suppressSelectedTooltip;
  const tipVisible = Boolean(tipCoords) && !isDragging && (hovered || focused);

  // Refina a medição após o portal montar (para usar a altura/largura exatas da tooltip)
  useLayoutEffect(() => {
    if (!tipVisible) return;
    measureTip();
  }, [tipVisible, measureTip]);

  useEffect(() => {
    if (!tipVisible) return;
    const reposition = () => measureTip();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [tipVisible, measureTip]);

  // 1. MODO SHOWCASE
  if (variant === "showcase") {
    return (
      <div
        className={`rf-showcase-stage ${className}`}
        style={
          {
            "--c": itemColor,
            "--txt": itemTextColor,
            "--bw": "168px",
            "--bh": "244px",
            "--depth": "44px",
          } as CSSProperties
        }
        aria-hidden="true"
      >
        <div className="rf-showcase-book">
          <div className="rf-face-front-full">
            <BookCover
              fillContainer
              title={itemTitle}
              author={resolvedAuthorFull || resolvedSurname}
              coverUrl={itemCoverUrl}
              spineColor={spinePalette.spineBg}
              spineAccent={spinePalette.spineAccentHex}
              seed={resolvedSeed}
              sizes="168px"
              className="rounded-none border-0 shadow-none"
            />
          </div>
          <div className="rf-face-back-full" />
          <div className="rf-face-spine-full">
            <span className="rf-spine-full-text">{itemTitle}</span>
          </div>
          <div className="rf-face-right-pages-full" />
          <div className="rf-face-top-pages-full" />
          <div className="rf-face-bottom-pages-full" />
        </div>
        <div className="rf-showcase-shadow" />
      </div>
    );
  }

  // 2. MODO DESK
  if (variant === "desk") {
    return (
      <div
        className={`rf-showcase-stage rf-desk-stage ${className}`}
        style={
          {
            "--c": itemColor,
            "--txt": itemTextColor,
            "--bw": "124px",
            "--bh": "182px",
            "--depth": "34px",
          } as CSSProperties
        }
        aria-hidden="true"
      >
        <div className="rf-showcase-book rf-desk-book">
          <div className="rf-face-front-full">
            <BookCover
              fillContainer
              title={itemTitle}
              author={resolvedAuthorFull || resolvedSurname}
              coverUrl={itemCoverUrl}
              spineColor={spinePalette.spineBg}
              spineAccent={spinePalette.spineAccentHex}
              seed={resolvedSeed}
              sizes="124px"
              className="rounded-none border-0 shadow-none"
            />
          </div>
          <div className="rf-face-back-full" />
          <div className="rf-face-spine-full">
            <span className="rf-spine-full-text">{itemTitle}</span>
          </div>
          <div className="rf-face-right-pages-full" />
          <div className="rf-face-top-pages-full" />
          <div className="rf-face-bottom-pages-full" />
        </div>
        <div className="rf-showcase-shadow" />
      </div>
    );
  }

  // 3. MODO SPINE REALISTA (CSS 3D com alturas orgânicas e auto-fit 15px..8px sem reticências)
  const geometry = useMemo(
    () =>
      computeShelfBookGeometry({
        pages: resolvedPages,
        format: resolvedFormat,
        seed: resolvedSeed,
      }),
    [resolvedPages, resolvedFormat, resolvedSeed]
  );

  const typography = useMemo(
    () =>
      computeFittedSpineTypography({
        title: itemTitle,
        authorSurname: resolvedSurname,
        heightPx: geometry.heightPx,
        spineWidthPx: geometry.spineWidthPx,
        template: resolvedTemplate,
        hasPublisherMark: Boolean(resolvedPublisherMark),
        typoStyle: geometry.typoStyle,
      }),
    [
      itemTitle,
      resolvedSurname,
      geometry.heightPx,
      geometry.spineWidthPx,
      resolvedTemplate,
      resolvedPublisherMark,
      geometry.typoStyle,
    ]
  );

  // Faces 3D auxiliares + <BookCover> lateral são montadas sob demanda (hover/foco/seleção/modo capas),
  // reduzindo drasticamente o número de nós DOM em estantes grandes (150+ livros).
  const mount3DFaces = hovered || focused || isSelected || showCoverFace;

  const authorPt = resolvedAuthorFull || resolvedSurname || "Autor do acervo";
  const normalizedStatus = String(readingStatus ?? "").toLowerCase();
  const isReading =
    normalizedStatus === "reading" ||
    normalizedStatus === "lendo" ||
    normalizedStatus === "em_andamento";
  const isFinished =
    normalizedStatus === "finished" ||
    normalizedStatus === "concluido" ||
    normalizedStatus === "lido";
  const effectiveWishlist =
    isWishlist ||
    normalizedStatus === "wishlist" ||
    normalizedStatus === "desejo" ||
    normalizedStatus === "quero_ler";
  const safeProgress = Math.max(0, Math.min(100, Math.round(progressPercent)));
  const effectiveBarPercent = isFinished ? 100 : safeProgress;
  // "74% lido" | "Não iniciado" (0) | "Concluído" (100)
  const progressLabel =
    isFinished || safeProgress >= 100
      ? "Concluído"
      : safeProgress <= 0
        ? "Não iniciado"
        : `${safeProgress}% lido`;

  // aria-label: "Título, Autor, 74% lido"
  const accessibleLabel = `${itemTitle}, ${authorPt}, ${progressLabel}`;
  const inkIsDark = spinePalette.spineInk !== "#F4EFE6";
  const effectivePages =
    typeof resolvedPages === "number" &&
    Number.isFinite(resolvedPages) &&
    resolvedPages > 0
      ? resolvedPages
      : 240;

  const slotStyle: BookSlotStyle = {
    "--pages": String(effectivePages),
    "--spine-jitter": `${geometry.jitterPx}px`,
    "--book-h": `${geometry.heightPx}px`,
    "--h-mm": String(geometry.heightPx),
    "--t-mm": String(geometry.spineWidthPx),
    "--w": "var(--spine-width)",
    "--h": `clamp(150px, var(--book-h, 178px), 215px)`,
    "--c": spinePalette.spineBg,
    "--accent": spinePalette.spineAccentHex,
    "--accent-txt":
      spinePalette.spineAccentInk !== "#F4EFE6"
        ? "var(--rf-onyx)"
        : "var(--rf-linen)",
    "--txt": inkIsDark ? "var(--rf-onyx)" : "var(--rf-linen)",
    "--depth": `calc(${geometry.depthPx}px * var(--rf-shelf-scale, 1))`,
    "--title-fs": `${typography.titleFontPx}px`,
    "--author-fs": `${typography.authorFontPx}px`,
  };

  const SlotTag = as;

  return (
    <SlotTag
      ref={(node: HTMLElement | null) => {
        slotRef.current = node;
      }}
      data-spine-template={resolvedTemplate}
      data-spine-color={spinePalette.spineBg}
      draggable={draggable}
      onDragStart={stableDragStart}
      onDragOver={stableDragOver}
      onDrop={stableDrop}
      onDragEnd={stableDragEnd}
      onPointerEnter={(e: ReactPointerEvent<HTMLElement>) => {
        if (e.pointerType !== "mouse") return;
        measureTip();
        setHovered(true);
        latest.current.onHoverBook?.();
      }}
      onPointerLeave={(e: ReactPointerEvent<HTMLElement>) => {
        if (e.pointerType !== "mouse") return;
        setHovered(false);
      }}
      className={`rf-book-slot rf-format-${geometry.format} rf-typo-${geometry.typoStyle} rf-tpl-${resolvedTemplate} ${
        typography.isThinSpine ? "rf-thin-spine" : ""
      } ${typography.isWideSpine ? "rf-wide-spine" : ""} ${
        typography.lines.length >= 2 ? "rf-two-line-spine" : ""
      } ${inkIsDark ? "is-ink-dark" : ""} ${isReading ? "is-reading" : ""} ${
        isFinished ? "is-finished" : ""
      } ${effectiveWishlist ? "is-wishlist" : ""} ${
        isSelected ? "is-selected" : ""
      } ${focused ? "is-focused" : ""} ${isDragging ? "is-dragging" : ""} ${
        dropPosition === "before"
          ? "is-drop-before"
          : dropPosition === "after"
            ? "is-drop-after"
            : ""
      } ${className}`}
      style={slotStyle}
    >
      {/* Tooltip em portal: centralizada acima do livro, com seta, clamp na viewport e barra dourada */}
      {tipVisible && tipCoords && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={tipRef}
              className="rf-book-tooltip"
              data-placement={tipCoords.placement}
              aria-hidden="true"
              style={
                {
                  "--tip-x": `${tipCoords.x}px`,
                  "--tip-y": `${tipCoords.y}px`,
                  "--tip-arrow-offset": `${tipCoords.arrowOffset}px`,
                } as CSSProperties
              }
            >
              <span className="rf-book-tooltip-title">{itemTitle}</span>
              <span className="rf-book-tooltip-author">{authorPt}</span>
              <span className="rf-book-tooltip-meta">
                <span className="rf-book-tooltip-pct">{progressLabel}</span>
              </span>
              <span className="rf-book-tooltip-bar">
                <span
                  className="rf-book-tooltip-bar-fill"
                  style={{
                    width: `${effectiveBarPercent > 0 ? Math.max(4, effectiveBarPercent) : 0}%`,
                  }}
                />
              </span>
              <span className="rf-book-tooltip-arrow" />
            </div>,
            document.body
          )
        : null}

      <button
        ref={stableButtonRef}
        type="button"
        tabIndex={tabIndex}
        aria-pressed={isSelected}
        aria-label={accessibleLabel}
        onKeyDown={stableKeyDown}
        onFocus={(e) => {
          latest.current.onFocusBook?.();
          if (e.currentTarget.matches(":focus-visible")) {
            measureTip();
            setFocused(true);
          }
        }}
        onBlur={() => setFocused(false)}
        onClick={() => {
          measureTip();
          latest.current.onActivate?.();
          const currentBook = latest.current.book;
          if (currentBook && latest.current.onSelect) {
            latest.current.onSelect(currentBook);
          }
        }}
        className="rf-book-prism"
      >
        {/* 1. LOMBADA FRONTAL: 4 templates gráficos (A/B/C/D) + acabamento de papel + auto-fit sem reticências */}
        <span className="rf-face-spine" aria-hidden="true">
          {resolvedTemplate === "B" || resolvedTemplate === "D" ? (
            <span className="rf-spine-top-band" />
          ) : null}

          <span className="rf-spine-titles">
            <span
              className="rf-spine-title"
              data-spine-lines={typography.lines.length}
            >
              {typography.lines.map((line, lineIdx) => (
                <span
                  key={`${resolvedSeed}-l${lineIdx}`}
                  className="rf-spine-title-line"
                >
                  {line}
                </span>
              ))}
            </span>
            {resolvedTemplate === "C" ? (
              <span className="rf-spine-ornament-rule" />
            ) : null}
            {typography.showAuthor ? (
              <span className="rf-spine-author">{resolvedSurname}</span>
            ) : null}
          </span>

          {resolvedPublisherMark ? (
            <span className="rf-spine-imprint">{resolvedPublisherMark}</span>
          ) : null}
        </span>

        {/* Faces 3D auxiliares + capa lateral montadas apenas quando visíveis (hover/foco/seleção/modo capas) */}
        {mount3DFaces ? (
          <>
            <span className="rf-face-top-pages" aria-hidden="true" />
            <span className="rf-face-back-cover" aria-hidden="true" />
            <span className="rf-face-fore-edge-pages" aria-hidden="true" />
            <span className="rf-face-side-cover" aria-hidden="true">
              <BookCover
                fillContainer
                title={itemTitle}
                author={authorPt}
                coverUrl={itemCoverUrl}
                spineColor={spinePalette.spineBg}
                spineAccent={spinePalette.spineAccentHex}
                seed={resolvedSeed}
                sizes="(max-width: 480px) 130px, 176px"
                readingStatus={readingStatus}
                isWishlist={effectiveWishlist}
                progressPercent={effectiveBarPercent}
                className="rounded-none border-0 shadow-none"
              />
              <span className="rf-side-cover-progress-badge">
                {progressLabel}
              </span>
            </span>
          </>
        ) : null}
      </button>
    </SlotTag>
  );
}

/**
 * Compara apenas dados: funções (handlers/refs) são lidas via `latest` dentro do
 * componente, então mudar uma closure inline no pai não re-renderiza 100 livros.
 */
function areBook3DPropsEqual(prev: Book3DProps, next: Book3DProps): boolean {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]) as Set<
    keyof Book3DProps
  >;
  for (const key of keys) {
    const a = prev[key];
    const b = next[key];
    if (typeof a === "function" && typeof b === "function") continue;
    if (!Object.is(a, b)) return false;
  }
  return true;
}

export const Book3D = memo(Book3DBase, areBook3DPropsEqual);
