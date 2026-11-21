"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Fragment,
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type CSSProperties,
  type DragEvent,
  type ReactNode,
} from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Flame,
  Palette,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { BookFormat, ReadingStatus } from "@/lib/domain";
import {
  packShelfBooksByWidth,
  pickSpineTemplate,
  resolveSpinePalette,
  type GenreShelfGroup,
  type NormalizedVirtualBook,
  type RealisticBookFormat,
  type SpineTemplateId,
} from "@/features/shelves/virtual-bookshelf";
import {
  DEFAULT_SHELF_THEME_CONFIG,
  extractPredominantDotColors,
  getShelfDensityGapPx,
  migrateLegacyShelfThemeConfig,
  SHELF_DECOR_OPTIONS,
  type BookDisplayMode,
  type ShelfDecorPlacement,
  type ShelfMaterialStyle,
  type ShelfThemeConfig,
} from "@/features/shelves/arrange-shelves";
import { startReadingAction } from "@/features/reading/actions";
import { useShelfParallax } from "@/lib/useShelfParallax";
import {
  Book3D,
  EDITORIAL_SPINE_PALETTE,
  pickEditorialSpineColor,
  resolveEffectiveSpineColor,
} from "@/components/Book3D";
import { BookCover } from "@/components/BookCover";
import { ShelfDecorObject } from "@/components/ShelfDecorObject";
import { rfButtonClassName } from "@/components/ui/ActionControls";
import styles from "./VirtualBookshelf.module.css";

/** Largura fixa da estante (~640px, igual em todas as prateleiras) e capacidade útil de livros por fileira. */
export const FIXED_SHELF_WIDTH_PX = 640;
export const FIXED_ROW_PACK_WIDTH_PX = 560;

/**
 * Prateleira renderizável:
 * - kind "color": cabeçalho com bolinhas (`colors`)
 * - kind "title": cabeçalho com o título da categoria (`genre`)
 */
export interface ShelfRenderGroup extends GenreShelfGroup {
  kind: "color" | "title";
  colors: readonly string[];
  hasCustomColors?: boolean;
  isCustom?: boolean;
}

export type ShelfViewMode = "view" | "edit";

export interface MoveBookParams {
  bookId: string;
  fromShelfKey: string;
  toShelfKey: string;
  targetBookId?: string;
  position?: "before" | "after";
}

export interface ShelfViewProps {
  /** "view" = estante principal + BookQuickPanel; "edit" = mesma cena + controles de "Arrumar estante" */
  mode?: ShelfViewMode;
  /** Estilo visual / material legado da estante (fallback quando `themeConfig` não é informado) */
  shelfMaterial?: ShelfMaterialStyle;
  /** Configuração completa de personalização (materiais, suportes, nicho, LED 3000K, spots, densidade) */
  themeConfig?: ShelfThemeConfig;
  /** Modo de exibição individual por livro (`lombada`, `capa_frente`, `inclinado`) */
  bookDisplayModes?: Record<string, BookDisplayMode>;
  /** Direção de inclinação por livro quando em modo `inclinado` */
  bookTiltDirections?: Record<string, "left" | "right">;
  /** Objetos decorativos e espaçadores por prateleira (`shelfKey -> lista`) */
  shelfDecorByRow?: Record<string, ShelfDecorPlacement[]>;
  /** Callback de remoção de objeto decorativo no modo edição */
  onRemoveDecor?: (shelfKey: string, decorId: string) => void;
  shelves: readonly ShelfRenderGroup[];
  activeBookId: string | number | null;
  view3dMode?: "spines" | "covers";
  isSparseBookcase?: boolean;
  onSelectBook: (book: NormalizedVirtualBook) => void;
  onReorderWithinShelf: (
    shelf: ShelfRenderGroup,
    nextBooks: NormalizedVirtualBook[],
    movedTitle: string,
    newIndex: number
  ) => void;
  onMoveBookAcrossShelves?: (params: MoveBookParams) => void;
  /* Somente modo "edit" */
  editingShelfKey?: string | null;
  onEditShelf?: (shelfKey: string) => void;
  renderShelfEditor?: (shelf: ShelfRenderGroup) => ReactNode;
  onMoveShelf?: (shelfKey: string, delta: -1 | 1) => void;
  onDeleteShelf?: (shelfKey: string) => void;
  onAddBook?: (shelfKey: string) => void;
  onSortShelfByColor?: (shelfKey: string) => void;
}

interface PackedDisplayRow {
  rowKey: string;
  sourceShelf: ShelfRenderGroup;
  sourceShelfIndex: number;
  chunkIndex: number;
  isFirstChunk: boolean;
  isLastChunk: boolean;
  startBookIndex: number;
  books: NormalizedVirtualBook[];
  visuals: ResolvedSpineVisual[];
  rowBooksWidthPx: number;
  maxBookHeightPx: number;
  colors: readonly string[];
}

export interface ResolvedSpineVisual {
  template: SpineTemplateId;
  spineBg: string;
  spineInk: string;
  spineAccentHex: string;
  avoidNeighborHex: string | null;
}

/**
 * Resolve template + cor de cada livro numa fileira garantindo:
 * - Cores vêm da capa real (`spine_color`, `spine_accent`) quando existir `coverUrl`.
 * - Sem capa, usa paleta editorial variada (não só cinza-chumbo).
 * - Dois vizinhos jamais repetem template + cor (e sem capa, também não repetem a mesma cor).
 */
export function resolveRowSpineVisuals(
  books: readonly Pick<
    NormalizedVirtualBook,
    "resolvedSeed" | "coverUrl" | "spineBg" | "spineAccentHex"
  >[]
): ResolvedSpineVisual[] {
  let prevTemplate: SpineTemplateId | null = null;
  let prevColor: string | null = null;

  return books.map((book) => {
    const template = pickSpineTemplate(book.resolvedSeed, prevTemplate);
    const colorInfo = resolveEffectiveSpineColor({
      coverUrl: book.coverUrl,
      rawColor: book.spineBg,
      seed: book.resolvedSeed,
      avoidNeighborHex: prevColor,
    });

    let palette = resolveSpinePalette(
      colorInfo.color,
      book.resolvedSeed,
      prevColor,
      colorInfo.isFromCover ? book.spineAccentHex : undefined
    );

    // Se sem capa o clamp/ajuste caiu no mesmo hex do vizinho anterior, escolhe o próximo da paleta editorial
    if (
      !colorInfo.isFromCover &&
      prevColor &&
      palette.spineBg.toLowerCase() === prevColor.toLowerCase()
    ) {
      const altHex = pickEditorialSpineColor(
        `${book.resolvedSeed}:alt-neighbor`,
        prevColor
      );
      const safeAlt =
        altHex.toLowerCase() === prevColor.toLowerCase()
          ? (EDITORIAL_SPINE_PALETTE.find(
              (hex) => hex.toLowerCase() !== prevColor!.toLowerCase()
            ) ?? altHex)
          : altHex;
      palette = resolveSpinePalette(safeAlt, book.resolvedSeed, prevColor);
    }

    const visual: ResolvedSpineVisual = {
      template,
      spineBg: palette.spineBg,
      spineInk: palette.spineInk,
      spineAccentHex: palette.spineAccentHex,
      avoidNeighborHex: prevColor,
    };

    prevTemplate = template;
    prevColor = palette.spineBg;
    return visual;
  });
}

const STATUS_LABELS_PT: Record<ReadingStatus, string> = {
  not_started: "Não iniciado",
  reading: "Em andamento",
  paused: "Pausado",
  finished: "Concluído",
  abandoned: "Abandonado",
};

const FORMAT_LABELS_PT: Record<RealisticBookFormat, string> = {
  capa_dura: "Capa dura",
  brochura: "Brochura",
  bolso: "Bolso",
  ebook: "E-book",
  audio: "Audiolivro",
};

function resolveCanonicalFormat(
  format?: RealisticBookFormat | BookFormat | null
): BookFormat | undefined {
  if (!format) return undefined;
  if (format === "capa_dura") return "hardcover";
  if (format === "brochura") return "paperback";
  if (format === "bolso") return "pocket";
  if (format === "audio") return "audiobook";
  return format;
}

function resolveBookProgressInfo(book: NormalizedVirtualBook): {
  statusLabel: string;
  progressLabel: string;
  percent: number;
  isReading: boolean;
  isFinished: boolean;
} {
  const isFinished = book.readingStatus === "finished";
  const isReading = book.readingStatus === "reading";
  const safePercent = Math.max(
    0,
    Math.min(100, Math.round(isFinished ? 100 : (book.progressPercent ?? 0)))
  );
  const statusLabel = book.isWishlist
    ? "Lista de desejos"
    : book.readingStatus
      ? STATUS_LABELS_PT[book.readingStatus]
      : book.statusLabel || "Não iniciado";
  const progressLabel =
    isFinished || safePercent >= 100
      ? "Concluído"
      : safePercent <= 0
        ? "Não iniciado"
        : `${safePercent}% lido`;

  return {
    statusLabel,
    progressLabel,
    percent: safePercent,
    isReading,
    isFinished,
  };
}

/**
 * Painel de ficha rápida da Estante 3D:
 * - Em telas >= 1024px: coluna direita sticky ao lado da estante de 640px.
 * - Abaixo de 1024px: barra fixa inferior compacta acima da navegação móvel.
 * Exibe capa grande (`BookCover`), título, autor, status, progresso com barra dourada
 * e botões "Abrir ficha" e "Iniciar foco".
 */
export function BookQuickPanel({
  book,
}: {
  book: NormalizedVirtualBook | null;
}) {
  const router = useRouter();
  const [isStartingFocus, startFocusTransition] = useTransition();
  const [focusError, setFocusError] = useState<string | null>(null);

  if (!book) return null;

  const { statusLabel, progressLabel, percent, isReading, isFinished } =
    resolveBookProgressInfo(book);
  const resolvedPanelColor = resolveEffectiveSpineColor({
    coverUrl: book.coverUrl,
    rawColor: book.spineBg,
    seed: book.resolvedSeed,
  });
  const panelSpineColor = resolvedPanelColor.color;
  const panelSpineAccent = resolvedPanelColor.isFromCover
    ? book.spineAccentHex
    : undefined;
  const authorLabel = book.author || book.authorSurname || "Autor do acervo";
  const fichaHref =
    book.href ?? (book.workId ? `/livros/${book.workId}` : "/estantes");
  const hasActiveReading = Boolean(
    book.readingId &&
    (book.readingStatus === "reading" || book.readingStatus === "paused")
  );
  const directFocusHref = hasActiveReading
    ? `/leitura/foco?readingId=${encodeURIComponent(book.readingId!)}`
    : null;

  const handleStartFocus = () => {
    setFocusError(null);
    if (directFocusHref) {
      router.push(directFocusHref);
      return;
    }
    if (book.isWishlist || !book.workId) {
      router.push("/leitura/foco");
      return;
    }
    startFocusTransition(async () => {
      const res = await startReadingAction({
        workId: book.workId!,
        editionId: book.editionId,
        libraryItemId: book.libraryItemId,
        format: resolveCanonicalFormat(book.format ?? book.realisticFormat),
        countsForGoals: true,
      });
      if (!res.ok) {
        setFocusError(res.error);
        return;
      }
      router.push(
        `/leitura/foco?readingId=${encodeURIComponent(res.readingId)}`
      );
    });
  };

  const pageDetail =
    book.progressUnit === "pages" &&
    book.progressTotal &&
    book.progressTotal > 0
      ? `Pág. ${Math.min(book.progressValue ?? 0, book.progressTotal)} de ${book.progressTotal}`
      : book.pages
        ? `${book.pages} páginas`
        : null;

  return (
    <aside
      aria-label="Ficha rápida do livro"
      aria-live="polite"
      data-book-quick-panel="true"
      className={styles.quickPanel}
    >
      {/* Layout desktop (>= 1024px): painel editorial sticky completo */}
      <div className={styles.quickPanelDesktop}>
        <div className={styles.quickPanelTopMeta}>
          <span className={styles.quickPanelKicker}>Ficha rápida</span>
          <span
            className={`${styles.quickPanelStatusBadge} ${
              isReading
                ? styles.quickPanelStatusReading
                : isFinished
                  ? styles.quickPanelStatusFinished
                  : ""
            }`}
          >
            {statusLabel}
          </span>
        </div>

        <div className={styles.quickPanelCoverWrap}>
          <BookCover
            title={book.title}
            author={authorLabel}
            coverUrl={book.coverUrl}
            spineColor={panelSpineColor}
            spineAccent={panelSpineAccent}
            seed={book.resolvedSeed}
            readingStatus={book.readingStatus}
            isWishlist={book.isWishlist}
            progressPercent={percent}
            size="xl"
            className="shadow-[var(--rf-shadow-lg)]"
          />
        </div>

        <div className={styles.quickPanelIdentity}>
          <h3 className={styles.quickPanelTitle}>{book.title}</h3>
          <p className={styles.quickPanelAuthor}>{authorLabel}</p>
          <p className={styles.quickPanelSubmeta}>
            <span>{book.displayGenre}</span>
            <span aria-hidden="true">·</span>
            <span>{FORMAT_LABELS_PT[book.realisticFormat]}</span>
            {pageDetail ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{pageDetail}</span>
              </>
            ) : null}
          </p>
        </div>

        {/* Progresso com barra dourada */}
        <div className={styles.quickPanelProgressBox}>
          <div className={styles.quickPanelProgressHeader}>
            <span className={styles.quickPanelProgressLabel}>Progresso</span>
            <span className={styles.quickPanelProgressValue}>
              {progressLabel}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progresso de leitura de ${book.title}: ${progressLabel}`}
            className={styles.quickPanelGoldTrack}
          >
            <div
              className={styles.quickPanelGoldFill}
              style={{
                width: `${percent > 0 ? Math.max(4, percent) : 0}%`,
              }}
            />
          </div>
        </div>

        {focusError ? (
          <p role="alert" className={styles.quickPanelError}>
            {focusError}
          </p>
        ) : null}

        <div className={styles.quickPanelActions}>
          <Link
            href={fichaHref}
            className={rfButtonClassName({
              variant: "primary",
              size: "md",
              className: "w-full",
            })}
          >
            <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Abrir ficha</span>
          </Link>

          {directFocusHref ? (
            <Link
              href={directFocusHref}
              className={rfButtonClassName({
                variant: "secondary",
                size: "md",
                className: "w-full",
              })}
            >
              <Flame className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Iniciar foco</span>
            </Link>
          ) : (
            <button
              type="button"
              disabled={isStartingFocus}
              onClick={handleStartFocus}
              className={rfButtonClassName({
                variant: "secondary",
                size: "md",
                className: "w-full",
              })}
            >
              <Flame className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{isStartingFocus ? "Abrindo..." : "Iniciar foco"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Layout mobile / tablet (< 1024px): barra fixa inferior compacta */}
      <div className={styles.quickPanelMobile}>
        <BookCover
          title={book.title}
          author={authorLabel}
          coverUrl={book.coverUrl}
          spineColor={panelSpineColor}
          spineAccent={panelSpineAccent}
          seed={book.resolvedSeed}
          readingStatus={book.readingStatus}
          isWishlist={book.isWishlist}
          progressPercent={percent}
          size="xs"
        />

        <div className={styles.quickPanelMobileInfo}>
          <p className={styles.quickPanelMobileTitle}>{book.title}</p>
          <p className={styles.quickPanelMobileMeta}>
            <span>{authorLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{progressLabel}</span>
          </p>
          <div className={styles.quickPanelGoldTrack}>
            <div
              className={styles.quickPanelGoldFill}
              style={{
                width: `${percent > 0 ? Math.max(4, percent) : 0}%`,
              }}
            />
          </div>
        </div>

        <div className={styles.quickPanelMobileActions}>
          <Link
            href={fichaHref}
            className={rfButtonClassName({
              variant: "primary",
              size: "sm",
            })}
          >
            Abrir ficha
          </Link>
          {directFocusHref ? (
            <Link
              href={directFocusHref}
              className={rfButtonClassName({
                variant: "secondary",
                size: "sm",
              })}
            >
              Iniciar foco
            </Link>
          ) : (
            <button
              type="button"
              disabled={isStartingFocus}
              onClick={handleStartFocus}
              className={rfButtonClassName({
                variant: "secondary",
                size: "sm",
              })}
            >
              {isStartingFocus ? "..." : "Iniciar foco"}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

const MemoBookQuickPanel = memo(BookQuickPanel);

interface PreviewStore {
  getId: () => string | null;
  setId: (id: string | null) => void;
  subscribe: (listener: () => void) => () => void;
}

function createPreviewStore(): PreviewStore {
  let currentId: string | null = null;
  const listeners = new Set<() => void>();
  return {
    getId: () => currentId,
    setId: (id: string | null) => {
      if (currentId === id) return;
      currentId = id;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Isola as atualizações de hover/foco do painel lateral para que passar o mouse
 * sobre os livros na estante jamais re-renderize `ShelfView` ou as 150 lombadas.
 */
const ConnectedBookQuickPanel = memo(function ConnectedBookQuickPanel({
  store,
  shelves,
  activeBookId,
}: {
  store: PreviewStore;
  shelves: readonly ShelfRenderGroup[];
  activeBookId: string | number | null;
}) {
  const previewBookId = useSyncExternalStore(
    store.subscribe,
    store.getId,
    () => null
  );

  const quickPanelBook = useMemo<NormalizedVirtualBook | null>(() => {
    const allBooks: NormalizedVirtualBook[] = [];
    for (const shelf of shelves) {
      for (const b of shelf.books) allBooks.push(b);
    }
    if (allBooks.length === 0) return null;

    if (previewBookId) {
      const matched = allBooks.find((b) => String(b.id) === previewBookId);
      if (matched) return matched;
    }
    if (activeBookId !== null && activeBookId !== undefined) {
      const matched = allBooks.find(
        (b) => String(b.id) === String(activeBookId)
      );
      if (matched) return matched;
    }
    const readingBook = allBooks.find((b) => b.readingStatus === "reading");
    return readingBook ?? allBooks[0] ?? null;
  }, [shelves, previewBookId, activeBookId]);

  return <MemoBookQuickPanel book={quickPanelBook} />;
});

function reorderBookListByMove(
  items: readonly NormalizedVirtualBook[],
  dragBookId: string,
  targetBookId: string,
  position: "before" | "after"
): NormalizedVirtualBook[] {
  const fromIdx = items.findIndex((b) => String(b.id) === dragBookId);
  const toIdx = items.findIndex((b) => String(b.id) === targetBookId);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return [...items];

  const copy = [...items];
  const [moved] = copy.splice(fromIdx, 1);
  if (!moved) return [...items];

  const adjustedTargetIdx = copy.findIndex(
    (b) => String(b.id) === targetBookId
  );
  if (adjustedTargetIdx < 0) return [...items];

  const insertIdx =
    position === "after" ? adjustedTargetIdx + 1 : adjustedTargetIdx;
  copy.splice(insertIdx, 0, moved);
  return copy;
}

function getShelfButtons(from: Element | null): HTMLButtonElement[] {
  const list = from?.closest("ul");
  return Array.from(
    list?.querySelectorAll<HTMLButtonElement>("button.rf-book-prism") ?? []
  );
}

export function ShelfView({
  mode = "view",
  shelfMaterial = "classic-wood",
  themeConfig,
  bookDisplayModes = {},
  bookTiltDirections = {},
  shelfDecorByRow = {},
  onRemoveDecor,
  shelves,
  activeBookId,
  view3dMode = "spines",
  onSelectBook,
  onReorderWithinShelf,
  onMoveBookAcrossShelves,
  editingShelfKey = null,
  onEditShelf,
  renderShelfEditor,
  onMoveShelf,
  onDeleteShelf,
  onAddBook,
  onSortShelfByColor,
}: ShelfViewProps) {
  const isEdit = mode === "edit";
  const resolvedThemeConfig: ShelfThemeConfig =
    themeConfig ??
    (shelfMaterial !== "classic-wood"
      ? migrateLegacyShelfThemeConfig({ shelfMaterial })
      : DEFAULT_SHELF_THEME_CONFIG);
  const densityGapPx = getShelfDensityGapPx(resolvedThemeConfig.density);

  const [draggingBook, setDraggingBook] = useState<{
    shelfKey: string;
    bookId: string;
  } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{
    shelfKey: string;
    bookId: string;
    position: "before" | "after";
  } | null>(null);
  const [dragOverShelfKey, setDragOverShelfKey] = useState<string | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [focusedIndexByRow, setFocusedIndexByRow] = useState<
    Record<string, number>
  >({});
  const [previewStore] = useState<PreviewStore>(() => createPreviewStore());
  const setPreviewBookId = useCallback(
    (id: string | null) => {
      previewStore.setId(id);
    },
    [previewStore]
  );

  const draggingBookRef = useRef<{ shelfKey: string; bookId: string } | null>(
    null
  );
  const dragOverTargetRef = useRef<{
    shelfKey: string;
    bookId: string;
    position: "before" | "after";
  } | null>(null);

  const totalBooksCount = useMemo(
    () => shelves.reduce((sum, s) => sum + s.books.length, 0),
    [shelves]
  );

  const {
    containerRef: bookcaseRef,
    handleMouseEnter,
    handleMouseMove,
    handleMouseLeave,
  } = useShelfParallax<HTMLDivElement>({
    disabled: totalBooksCount > 40,
  });

  // Empacota cada grupo de prateleira para largura fixa ~640px (excedente vai para a prateleira seguinte)
  const packedRows = useMemo<PackedDisplayRow[]>(() => {
    const out: PackedDisplayRow[] = [];
    const maxRowW = FIXED_ROW_PACK_WIDTH_PX;

    shelves.forEach((shelf, shelfIdx) => {
      if (shelf.books.length === 0 && !isEdit && !shelf.isCustom) {
        return;
      }

      const decorList = shelfDecorByRow[shelf.genreKey] ?? [];
      const decorReservedPx = decorList.reduce((acc, d) => {
        const w =
          SHELF_DECOR_OPTIONS.find((opt) => opt.id === d.decorType)?.widthPx ??
          38;
        return acc + w + 6 + densityGapPx;
      }, 0);
      const editPlusReservedPx = isEdit && onAddBook ? 46 : 0;
      const effectiveMaxRowW = Math.max(
        260,
        maxRowW - decorReservedPx - editPlusReservedPx
      );

      // Ajusta largura estimada para capas frontais e livros inclinados para jamais vazar da tábua
      const originalById = new Map(shelf.books.map((b) => [String(b.id), b]));
      const booksForPacking = shelf.books.map((b) => {
        const modeForBook = bookDisplayModes[String(b.id)] ?? "lombada";
        if (modeForBook === "capa_frente") {
          const showcaseH = Math.max(
            132,
            Math.min(168, Math.round(b.bookHeightPx * 0.9))
          );
          const showcaseW = Math.round(showcaseH * 0.66) + 10;
          return { ...b, spineWidthPx: showcaseW };
        }
        if (modeForBook === "inclinado") {
          return { ...b, spineWidthPx: b.spineWidthPx + 24 };
        }
        return b;
      });

      const chunks = packShelfBooksByWidth(booksForPacking, {
        maxRowWidthPx: effectiveMaxRowW,
        gapPx: densityGapPx,
      });

      let offset = 0;
      chunks.forEach((chunk, chunkIdx) => {
        const restoredBooks = chunk.books.map(
          (b) => originalById.get(String(b.id)) ?? b
        );
        const visuals = resolveRowSpineVisuals(restoredBooks);
        const rowColors =
          shelf.hasCustomColors && shelf.colors.length > 0
            ? shelf.colors
            : restoredBooks.length > 0
              ? extractPredominantDotColors(visuals, (v) => v.spineBg, 4)
              : shelf.colors;

        out.push({
          rowKey:
            chunkIdx === 0
              ? shelf.genreKey
              : `${shelf.genreKey}__cont_${chunkIdx}`,
          sourceShelf: shelf,
          sourceShelfIndex: shelfIdx,
          chunkIndex: chunkIdx,
          isFirstChunk: chunkIdx === 0,
          isLastChunk: chunkIdx === chunks.length - 1,
          startBookIndex: offset,
          books: restoredBooks,
          visuals,
          rowBooksWidthPx: chunk.rowBooksWidthPx,
          maxBookHeightPx: chunk.maxBookHeightPx,
          colors: rowColors,
        });
        offset += restoredBooks.length;
      });
    });

    return out;
  }, [
    shelves,
    isEdit,
    densityGapPx,
    bookDisplayModes,
    shelfDecorByRow,
    onAddBook,
  ]);

  const bookcaseWidthPx = FIXED_SHELF_WIDTH_PX;

  const clearDrag = () => {
    draggingBookRef.current = null;
    dragOverTargetRef.current = null;
    setDraggingBook(null);
    setDragOverTarget(null);
    setDragOverShelfKey(null);
  };

  const handleBookDragStart = (
    e: DragEvent<HTMLElement>,
    shelfKey: string,
    bookId: string | number
  ) => {
    const idStr = String(bookId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", idStr);
    const payload = { shelfKey, bookId: idStr };
    draggingBookRef.current = payload;
    setDraggingBook(payload);
  };

  const handleBookDragOver = (
    e: DragEvent<HTMLElement>,
    shelfKey: string,
    targetId: string | number
  ) => {
    const currentDrag = draggingBookRef.current;
    if (!currentDrag) return;
    const isCrossShelf = currentDrag.shelfKey !== shelfKey;
    if (isCrossShelf && !onMoveBookAcrossShelves) return;

    const targetStr = String(targetId);
    if (!isCrossShelf && currentDrag.bookId === targetStr) return;

    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDragOverShelfKey(shelfKey);

    const rect = e.currentTarget.getBoundingClientRect();
    const pos: "before" | "after" =
      e.clientX >= rect.left + rect.width / 2 ? "after" : "before";

    const nextTarget = { shelfKey, bookId: targetStr, position: pos };
    dragOverTargetRef.current = nextTarget;
    setDragOverTarget((prev) =>
      prev &&
      prev.shelfKey === shelfKey &&
      prev.bookId === targetStr &&
      prev.position === pos
        ? prev
        : nextTarget
    );
  };

  const handleBookDrop = (
    e: DragEvent<HTMLElement>,
    shelf: ShelfRenderGroup,
    targetId: string | number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const currentDrag = draggingBookRef.current;
    if (!currentDrag) {
      clearDrag();
      return;
    }

    const targetStr = String(targetId);
    const currentTarget = dragOverTargetRef.current;
    const pos =
      currentTarget &&
      currentTarget.shelfKey === shelf.genreKey &&
      currentTarget.bookId === targetStr
        ? currentTarget.position
        : "before";

    if (currentDrag.shelfKey !== shelf.genreKey) {
      onMoveBookAcrossShelves?.({
        bookId: currentDrag.bookId,
        fromShelfKey: currentDrag.shelfKey,
        toShelfKey: shelf.genreKey,
        targetBookId: targetStr,
        position: pos,
      });
    } else {
      const reordered = reorderBookListByMove(
        shelf.books,
        currentDrag.bookId,
        targetStr,
        pos
      );
      const newIndex = reordered.findIndex(
        (b) => String(b.id) === currentDrag.bookId
      );
      const movedBook = reordered[newIndex];
      if (movedBook && newIndex >= 0) {
        onReorderWithinShelf(shelf, reordered, movedBook.title, newIndex);
      }
    }
    clearDrag();
  };

  const handleShelfContainerDragOver = (
    e: DragEvent<HTMLElement>,
    shelfKey: string
  ) => {
    const currentDrag = draggingBookRef.current;
    if (!currentDrag || !onMoveBookAcrossShelves) return;
    if (currentDrag.shelfKey === shelfKey) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverShelfKey !== shelfKey) setDragOverShelfKey(shelfKey);
  };

  const handleShelfContainerDrop = (
    e: DragEvent<HTMLElement>,
    shelf: ShelfRenderGroup
  ) => {
    const currentDrag = draggingBookRef.current;
    if (!currentDrag || !onMoveBookAcrossShelves) return;
    if (currentDrag.shelfKey === shelf.genreKey) return;
    e.preventDefault();
    onMoveBookAcrossShelves({
      bookId: currentDrag.bookId,
      fromShelfKey: currentDrag.shelfKey,
      toShelfKey: shelf.genreKey,
    });
    clearDrag();
  };

  const focusButtonAt = (buttons: HTMLButtonElement[], index: number) => {
    buttons[index]?.focus();
  };

  const bookcaseElement = (
    <div
      ref={bookcaseRef}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      data-shelf-mode={mode}
      data-shelf-material={shelfMaterial}
      data-shelf-material-v2={resolvedThemeConfig.material}
      data-shelf-brackets={resolvedThemeConfig.bracketStyle}
      data-shelf-backdrop={resolvedThemeConfig.nicheBackdrop}
      data-shelf-led={resolvedThemeConfig.ledWarm3000K ? "on" : "off"}
      data-shelf-spotlights={resolvedThemeConfig.topSpotlights ? "on" : "off"}
      data-shelf-density={resolvedThemeConfig.density}
      className={styles.bookcase}
      style={
        {
          "--bookcase-w": `${bookcaseWidthPx}px`,
        } as CSSProperties
      }
    >
      <div className={styles.topSpotlightsLayer} aria-hidden="true" />
      <div className={styles.topSpotFixtures} aria-hidden="true">
        <span className={styles.topSpotDot} />
        <span className={styles.topSpotDot} />
      </div>
      <div className={styles.shelvesColumn}>
        {packedRows.map((row) => {
          const { sourceShelf: shelf, sourceShelfIndex: shelfIdx } = row;
          const currentFocusIdx = focusedIndexByRow[row.rowKey] ?? 0;
          const isDropTargetShelf =
            dragOverShelfKey === shelf.genreKey &&
            draggingBook?.shelfKey !== shelf.genreKey;
          const isDeleting = confirmDeleteKey === shelf.genreKey;
          const isEditing =
            row.isFirstChunk && editingShelfKey === shelf.genreKey;
          const rowHeightPx = row.maxBookHeightPx + 14;
          const rowVisuals = row.visuals;

          const pencil =
            isEdit && row.isFirstChunk && onEditShelf ? (
              <button
                type="button"
                onClick={() => onEditShelf(shelf.genreKey)}
                aria-expanded={isEditing}
                aria-label={`Editar nome e cores de ${shelf.genre}`}
                className={styles.categoryEditBtn}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null;

          return (
            <div
              key={row.rowKey}
              data-genre-shelf={shelf.genreKey}
              data-shelf-row={row.rowKey}
              data-arrange-shelf={
                isEdit && row.isFirstChunk ? shelf.genreKey : undefined
              }
              onDragOver={(e) =>
                handleShelfContainerDragOver(e, shelf.genreKey)
              }
              onDrop={(e) => handleShelfContainerDrop(e, shelf)}
              className={`rf-shelf-row ${styles.shelfSection} ${
                isDropTargetShelf ? styles.shelfSectionDropActive : ""
              }`}
            >
              {/* 1. Pill de cabeçalho acima de cada prateleira */}
              <div className={`rf-shelf-header ${styles.shelfHeaderRail}`}>
                <div className={styles.shelfHeaderBadges}>
                  {shelf.kind === "color" ? (
                    <div
                      data-shelf-pill="true"
                      className={styles.colorDotsPill}
                      role="group"
                      aria-label={`Cores da prateleira ${shelf.genre}`}
                    >
                      {isEdit && row.isFirstChunk && onSortShelfByColor ? (
                        <button
                          type="button"
                          onClick={() => onSortShelfByColor(shelf.genreKey)}
                          title="Ordenar livros desta prateleira por cor"
                          aria-label={`Ordenar livros de ${shelf.genre} por cor`}
                          className={styles.dotsSortBtn}
                        >
                          {row.colors.map((hex, i) => (
                            <span
                              key={`${row.rowKey}-dot-${i}`}
                              className={styles.colorDotItem}
                              style={{ backgroundColor: hex }}
                              aria-hidden="true"
                            />
                          ))}
                        </button>
                      ) : (
                        row.colors.map((hex, i) => (
                          <span
                            key={`${row.rowKey}-dot-${i}`}
                            className={styles.colorDotItem}
                            style={{ backgroundColor: hex }}
                            aria-hidden="true"
                          />
                        ))
                      )}
                      {pencil}
                    </div>
                  ) : (
                    <div data-shelf-pill="true" className={styles.categoryPill}>
                      <span>{shelf.genre}</span>
                      {pencil}
                    </div>
                  )}
                </div>

                {isEdit && row.isFirstChunk ? (
                  <div className={styles.headerActionsPill}>
                    {shelf.kind === "title" && onSortShelfByColor ? (
                      <button
                        type="button"
                        onClick={() => onSortShelfByColor(shelf.genreKey)}
                        title="Ordenar por cor"
                        aria-label={`Ordenar livros de ${shelf.genre} por cor`}
                        className={styles.headerIconBtn}
                      >
                        <Palette className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={shelfIdx === 0}
                      onClick={() => onMoveShelf?.(shelf.genreKey, -1)}
                      aria-label={`Subir prateleira ${shelf.genre}`}
                      className={styles.headerIconBtn}
                    >
                      <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={shelfIdx === shelves.length - 1}
                      onClick={() => onMoveShelf?.(shelf.genreKey, 1)}
                      aria-label={`Descer prateleira ${shelf.genre}`}
                      className={styles.headerIconBtn}
                    >
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {shelves.length > 1 && onDeleteShelf ? (
                      isDeleting ? (
                        <span className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteShelf(shelf.genreKey);
                              setConfirmDeleteKey(null);
                            }}
                            className={styles.confirmDeleteBtn}
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteKey(null)}
                            className={styles.cancelDeleteBtn}
                          >
                            Cancelar
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteKey(shelf.genreKey)}
                          aria-label={`Excluir prateleira ${shelf.genre}`}
                          className={styles.headerIconBtn}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )
                    ) : null}
                  </div>
                ) : null}
              </div>

              {isEditing && renderShelfEditor ? renderShelfEditor(shelf) : null}

              {/* 2. Fileira de livros (altura = livro mais alto + 14px) -> 3. Tábua de madeira quente */}
              <div className={styles.shelfTier}>
                <div
                  className={styles.shelfScroller}
                  tabIndex={0}
                  role="region"
                  aria-label={`Prateleira ${shelf.genre}`}
                >
                  <div className={styles.shelfTrack}>
                    <ul
                      aria-label={`Prateleira de ${shelf.genre}`}
                      className={`${styles.booksRow} ${
                        view3dMode === "covers" ? "rf-covers-mode" : ""
                      }`}
                      style={
                        {
                          "--row-h": `${rowHeightPx}px`,
                        } as CSSProperties
                      }
                    >
                      {/* Objetos decorativos posicionados no início da prateleira */}
                      {row.isFirstChunk
                        ? (shelfDecorByRow[shelf.genreKey] ?? [])
                            .filter((d) => d.afterBookIndex < 0)
                            .map((decor) => (
                              <ShelfDecorObject
                                key={decor.id}
                                id={decor.id}
                                decorType={decor.decorType}
                                mode={mode}
                                onRemove={
                                  onRemoveDecor
                                    ? (id) => onRemoveDecor(shelf.genreKey, id)
                                    : undefined
                                }
                              />
                            ))
                        : null}

                      {row.books.map((book, idx) => {
                        const visual = rowVisuals[idx]!;
                        const bookIdStr = String(book.id);
                        const globalIdx = row.startBookIndex + idx;
                        const displayMode =
                          bookDisplayModes[bookIdStr] ?? "lombada";
                        const tiltDir =
                          bookTiltDirections[bookIdStr] ?? "right";
                        const inlineDecors = (
                          shelfDecorByRow[shelf.genreKey] ?? []
                        ).filter((d) => d.afterBookIndex === globalIdx);
                        const isBookDragging =
                          draggingBook?.shelfKey === shelf.genreKey &&
                          draggingBook.bookId === bookIdStr;
                        const dropPos =
                          dragOverTarget?.shelfKey === shelf.genreKey &&
                          dragOverTarget.bookId === bookIdStr
                            ? dragOverTarget.position
                            : null;
                        const canDrag =
                          !book.isWishlist &&
                          (isEdit ||
                            shelf.books.length >= 2 ||
                            Boolean(onMoveBookAcrossShelves));

                        const handleBookKeyDown = (
                          e: React.KeyboardEvent<HTMLElement>
                        ) => {
                          const total = row.books.length;
                          if (total === 0) return;
                          const buttons = getShelfButtons(e.currentTarget);

                          if (
                            e.altKey &&
                            (e.key === "ArrowLeft" || e.key === "ArrowRight") &&
                            !book.isWishlist &&
                            shelf.books.length >= 2
                          ) {
                            e.preventDefault();
                            const fullIdx = shelf.books.findIndex(
                              (b) => b.id === book.id
                            );
                            const targetIdx =
                              fullIdx + (e.key === "ArrowRight" ? 1 : -1);
                            if (
                              fullIdx < 0 ||
                              targetIdx < 0 ||
                              targetIdx >= shelf.books.length
                            ) {
                              return;
                            }
                            const copy = [...shelf.books];
                            const [moved] = copy.splice(fullIdx, 1);
                            if (!moved) return;
                            copy.splice(targetIdx, 0, moved);
                            onReorderWithinShelf(
                              shelf,
                              copy,
                              moved.title,
                              targetIdx
                            );
                            return;
                          }

                          let nextIdx: number | null = null;
                          if (e.key === "ArrowRight")
                            nextIdx = (idx + 1) % total;
                          else if (e.key === "ArrowLeft")
                            nextIdx = (idx - 1 + total) % total;
                          else if (e.key === "Home") nextIdx = 0;
                          else if (e.key === "End") nextIdx = total - 1;
                          if (nextIdx === null) return;

                          e.preventDefault();
                          setFocusedIndexByRow((prev) => ({
                            ...prev,
                            [row.rowKey]: nextIdx,
                          }));
                          focusButtonAt(buttons, nextIdx);
                        };

                        const coverShowcaseHeight = Math.max(
                          132,
                          Math.min(168, Math.round(book.bookHeightPx * 0.9))
                        );
                        const coverShowcaseWidth = Math.round(
                          coverShowcaseHeight * 0.66
                        );

                        return (
                          <Fragment key={book.id}>
                            {displayMode === "capa_frente" ? (
                              <li
                                data-book-display="capa_frente"
                                draggable={canDrag}
                                onDragStart={(e) =>
                                  handleBookDragStart(
                                    e,
                                    shelf.genreKey,
                                    book.id
                                  )
                                }
                                onDragOver={(e) =>
                                  handleBookDragOver(e, shelf.genreKey, book.id)
                                }
                                onDrop={(e) =>
                                  handleBookDrop(e, shelf, book.id)
                                }
                                onDragEnd={clearDrag}
                                className={`${styles.bookFrontSlot} ${
                                  activeBookId === book.id
                                    ? styles.bookFrontSelected
                                    : ""
                                } ${
                                  dropPos === "before"
                                    ? styles.bookFrontDropBefore
                                    : dropPos === "after"
                                      ? styles.bookFrontDropAfter
                                      : ""
                                }`}
                              >
                                <button
                                  type="button"
                                  className={`rf-book-prism ${styles.bookFrontButton}`}
                                  aria-label={`${book.title}${book.author ? `, ${book.author}` : ""} — capa em destaque`}
                                  aria-pressed={activeBookId === book.id}
                                  tabIndex={currentFocusIdx === idx ? 0 : -1}
                                  onMouseEnter={() =>
                                    setPreviewBookId(bookIdStr)
                                  }
                                  onFocus={() => setPreviewBookId(bookIdStr)}
                                  onKeyDown={handleBookKeyDown}
                                  onClick={() => {
                                    setPreviewBookId(bookIdStr);
                                    onSelectBook(book);
                                  }}
                                >
                                  <span
                                    className={styles.bookFrontCoverFrame}
                                    style={{
                                      width: `${coverShowcaseWidth}px`,
                                      height: `${coverShowcaseHeight}px`,
                                    }}
                                  >
                                    <BookCover
                                      fillContainer
                                      title={book.title}
                                      author={book.author}
                                      coverUrl={book.coverUrl}
                                      spineColor={visual.spineBg}
                                      spineAccent={visual.spineAccentHex}
                                      seed={book.resolvedSeed}
                                      readingStatus={book.readingStatus}
                                      isWishlist={book.isWishlist}
                                      progressPercent={
                                        book.progressPercent ?? 0
                                      }
                                      sizes="112px"
                                      className="rounded-none border-0 shadow-none"
                                    />
                                  </span>
                                </button>
                              </li>
                            ) : (
                              <Book3D
                                className={
                                  displayMode === "inclinado"
                                    ? `${styles.bookTiltedWrap} ${
                                        tiltDir === "left"
                                          ? styles.bookTiltedLeft
                                          : styles.bookTiltedRight
                                      }`
                                    : undefined
                                }
                                pages={book.pages}
                                format={book.realisticFormat}
                                title={book.title}
                                author={book.author}
                                authorSurname={book.authorSurname}
                                publisher={book.publisher}
                                seed={book.resolvedSeed}
                                color={visual.spineBg}
                                accentColor={visual.spineAccentHex}
                                avoidNeighborHex={visual.avoidNeighborHex}
                                spineTemplate={visual.template}
                                publisherMark={book.publisherMark}
                                textColor={visual.spineInk}
                                coverUrl={book.coverUrl}
                                readingStatus={book.readingStatus}
                                isWishlist={book.isWishlist}
                                progressPercent={book.progressPercent ?? 0}
                                showCoverFace={view3dMode === "covers"}
                                draggable={canDrag}
                                isDragging={isBookDragging}
                                dropPosition={dropPos}
                                onDragStart={(e) =>
                                  handleBookDragStart(
                                    e,
                                    shelf.genreKey,
                                    book.id
                                  )
                                }
                                onDragOver={(e) =>
                                  handleBookDragOver(e, shelf.genreKey, book.id)
                                }
                                onDrop={(e) =>
                                  handleBookDrop(e, shelf, book.id)
                                }
                                onDragEnd={clearDrag}
                                onHoverBook={() => setPreviewBookId(bookIdStr)}
                                onFocusBook={() => setPreviewBookId(bookIdStr)}
                                tabIndex={currentFocusIdx === idx ? 0 : -1}
                                onKeyDown={handleBookKeyDown}
                                isSelected={activeBookId === book.id}
                                suppressSelectedTooltip={isEdit}
                                onActivate={() => {
                                  setPreviewBookId(bookIdStr);
                                  onSelectBook(book);
                                }}
                              />
                            )}

                            {inlineDecors.map((decor) => (
                              <ShelfDecorObject
                                key={decor.id}
                                id={decor.id}
                                decorType={decor.decorType}
                                mode={mode}
                                onRemove={
                                  onRemoveDecor
                                    ? (id) => onRemoveDecor(shelf.genreKey, id)
                                    : undefined
                                }
                              />
                            ))}
                          </Fragment>
                        );
                      })}

                      {/* Objetos decorativos posicionados ao final da prateleira */}
                      {row.isLastChunk
                        ? (shelfDecorByRow[shelf.genreKey] ?? [])
                            .filter(
                              (d) => d.afterBookIndex >= shelf.books.length
                            )
                            .map((decor) => (
                              <ShelfDecorObject
                                key={decor.id}
                                id={decor.id}
                                decorType={decor.decorType}
                                mode={mode}
                                onRemove={
                                  onRemoveDecor
                                    ? (id) => onRemoveDecor(shelf.genreKey, id)
                                    : undefined
                                }
                              />
                            ))
                        : null}

                      {/* Aparador de livros em L (CSS puro) quando sobra espaço confortável na tábua e não há decor custom */}
                      {!isEdit &&
                      row.books.length > 0 &&
                      (shelfDecorByRow[shelf.genreKey]?.length ?? 0) === 0 &&
                      row.rowBooksWidthPx < FIXED_ROW_PACK_WIDTH_PX * 0.84 ? (
                        <li
                          className={styles.bookendSlot}
                          data-bookend="true"
                          aria-hidden="true"
                        >
                          <span className={styles.bookendUpright}>
                            <span className={styles.bookendBrassTrim} />
                          </span>
                          <span className={styles.bookendFoot} />
                          <span className={styles.bookendShadow} />
                        </li>
                      ) : null}

                      {/* Modo edição: "+" no vão ao final da prateleira */}
                      {isEdit && row.isLastChunk && onAddBook ? (
                        <li className={styles.addRoundSlot}>
                          <button
                            type="button"
                            onClick={() => onAddBook(shelf.genreKey)}
                            aria-label={`Adicionar livro à prateleira ${shelf.genre}`}
                            className={styles.addRoundBtn}
                          >
                            <Plus className="h-5 w-5" aria-hidden="true" />
                          </button>
                        </li>
                      ) : null}
                    </ul>

                    <div
                      className={`rf-shelf-plank ${styles.shelfPlank}`}
                      aria-hidden="true"
                    >
                      <span className={styles.shelfLedStrip} />
                      <span
                        className={`rf-shelf-bracket ${styles.shelfBracket} ${styles.shelfBracketLeft}`}
                      />
                      <span
                        className={`rf-shelf-bracket ${styles.shelfBracket} ${styles.shelfBracketRight}`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (isEdit) {
    return bookcaseElement;
  }

  return (
    <div className={styles.shelfLayoutWithPanel}>
      {bookcaseElement}
      <ConnectedBookQuickPanel
        store={previewStore}
        shelves={shelves}
        activeBookId={activeBookId}
      />
    </div>
  );
}
