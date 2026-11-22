"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Fragment,
  memo,
  useCallback,
  useEffect,
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
  measureBookRenderLayout,
  packShelfBooksByWidth,
  pickSpineTemplate,
  resolveGroupTiltIndices,
  resolveShelfGroupGapPx,
  resolveSpinePalette,
  SHELF_BOOKEND_WIDTH_PX,
  UNIFORM_COMPARTMENT_ROW_HEIGHT_PX,
  type GenreShelfGroup,
  type NormalizedVirtualBook,
  type RealisticBookFormat,
  type SpineTemplateId,
} from "@/features/shelves/virtual-bookshelf";
import {
  DEFAULT_SHELF_THEME_CONFIG,
  extractPredominantDotColors,
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
  rowBooksWidthPx: number;
  effectiveMaxRowW: number;
  maxBookHeightPx: number;
  groupBreakIndices: number[];
  groupGapPx: number;
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

        {/* Caminho manual direto quando o livro ainda não tem capa real */}
        {!book.coverUrl && !book.isWishlist && book.workId ? (
          <Link
            href={`/livros/${book.workId}?editarCapa=1`}
            data-testid="quick-panel-choose-cover"
            className="mt-2 inline-flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-[var(--rf-radius-md)] border border-[var(--rf-border-default)] bg-[var(--rf-surface-subtle)] px-3 font-sans text-xs font-semibold text-[var(--rf-text-primary)] transition-colors hover:border-[var(--rf-border-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
          >
            <Palette className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Escolher capa (buscar, colar link ou foto)</span>
          </Link>
        ) : null}
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

  const booksLookup = useMemo(() => {
    const byId = new Map<string, NormalizedVirtualBook>();
    let firstBook: NormalizedVirtualBook | null = null;
    let firstReadingBook: NormalizedVirtualBook | null = null;

    for (const shelf of shelves) {
      for (const b of shelf.books) {
        if (!firstBook) firstBook = b;
        if (!firstReadingBook && b.readingStatus === "reading") {
          firstReadingBook = b;
        }
        byId.set(String(b.id), b);
      }
    }

    return {
      byId,
      defaultBook: firstReadingBook ?? firstBook,
    };
  }, [shelves]);

  const quickPanelBook = useMemo<NormalizedVirtualBook | null>(() => {
    if (booksLookup.byId.size === 0) return null;

    if (previewBookId) {
      const matched = booksLookup.byId.get(previewBookId);
      if (matched) return matched;
    }
    if (activeBookId !== null && activeBookId !== undefined) {
      const matched = booksLookup.byId.get(String(activeBookId));
      if (matched) return matched;
    }
    return booksLookup.defaultBook;
  }, [booksLookup, previewBookId, activeBookId]);

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

function focusButtonAt(buttons: HTMLButtonElement[], index: number) {
  buttons[index]?.focus();
}

const EMPTY_DECOR_LIST: ShelfDecorPlacement[] = [];

const sharedViewportListeners = new WeakMap<
  Element,
  (isIntersecting: boolean) => void
>();
let sharedRowIntersectionObserver: IntersectionObserver | null = null;

function observeShelfRowViewport(
  node: Element,
  callback: (isIntersecting: boolean) => void
): () => void {
  if (typeof IntersectionObserver === "undefined") {
    return () => {};
  }
  if (!sharedRowIntersectionObserver) {
    sharedRowIntersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const cb = sharedViewportListeners.get(entry.target);
          cb?.(entry.isIntersecting);
        }
      },
      { rootMargin: "420px 0px", threshold: 0 }
    );
  }
  sharedViewportListeners.set(node, callback);
  sharedRowIntersectionObserver.observe(node);
  return () => {
    sharedViewportListeners.delete(node);
    sharedRowIntersectionObserver?.unobserve(node);
  };
}

interface PackedShelfRowProps {
  row: PackedDisplayRow;
  rowIndex: number;
  shelvesCount: number;
  shouldVirtualize: boolean;
  mode: ShelfViewMode;
  isEdit: boolean;
  view3dMode: "spines" | "covers";
  bookDisplayModes: Record<string, BookDisplayMode>;
  bookTiltDirections: Record<string, "left" | "right">;
  shelfDecor: ShelfDecorPlacement[];
  rowActiveBookId: string | number | null;
  draggingBookIdInRow: string | null;
  dragOverBookTarget: {
    bookId: string;
    position: "before" | "after";
  } | null;
  isDropTargetShelf: boolean;
  isDeleting: boolean;
  isEditing: boolean;
  onRemoveDecor?: (shelfKey: string, decorId: string) => void;
  onSelectBook: (book: NormalizedVirtualBook) => void;
  setPreviewBookId: (id: string | null) => void;
  onReorderWithinShelf: (
    shelf: ShelfRenderGroup,
    nextBooks: NormalizedVirtualBook[],
    movedTitle: string,
    newIndex: number
  ) => void;
  onMoveBookAcrossShelves?: (params: MoveBookParams) => void;
  onEditShelf?: (shelfKey: string) => void;
  renderShelfEditor?: (shelf: ShelfRenderGroup) => ReactNode;
  onMoveShelf?: (shelfKey: string, delta: -1 | 1) => void;
  onDeleteShelf?: (shelfKey: string) => void;
  onAddBook?: (shelfKey: string) => void;
  onSortShelfByColor?: (shelfKey: string) => void;
  setConfirmDeleteKey: (key: string | null) => void;
  onBookDragStart: (
    e: DragEvent<HTMLElement>,
    shelfKey: string,
    bookId: string | number
  ) => void;
  onBookDragOver: (
    e: DragEvent<HTMLElement>,
    shelfKey: string,
    targetId: string | number
  ) => void;
  onBookDrop: (
    e: DragEvent<HTMLElement>,
    shelf: ShelfRenderGroup,
    targetId: string | number
  ) => void;
  onClearDrag: () => void;
  onShelfContainerDragOver: (
    e: DragEvent<HTMLElement>,
    shelfKey: string
  ) => void;
  onShelfContainerDrop: (
    e: DragEvent<HTMLElement>,
    shelf: ShelfRenderGroup
  ) => void;
}

const PackedShelfRow = memo(function PackedShelfRow({
  row,
  rowIndex,
  shelvesCount,
  shouldVirtualize,
  mode,
  isEdit,
  view3dMode,
  bookDisplayModes,
  bookTiltDirections,
  shelfDecor,
  rowActiveBookId,
  draggingBookIdInRow,
  dragOverBookTarget,
  isDropTargetShelf,
  isDeleting,
  isEditing,
  onRemoveDecor,
  onSelectBook,
  setPreviewBookId,
  onReorderWithinShelf,
  onMoveBookAcrossShelves,
  onEditShelf,
  renderShelfEditor,
  onMoveShelf,
  onDeleteShelf,
  onAddBook,
  onSortShelfByColor,
  setConfirmDeleteKey,
  onBookDragStart,
  onBookDragOver,
  onBookDrop,
  onClearDrag,
  onShelfContainerDragOver,
  onShelfContainerDrop,
}: PackedShelfRowProps) {
  const { sourceShelf: shelf, sourceShelfIndex: shelfIdx } = row;
  const [focusedIdx, setFocusedIdx] = useState(0);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const eagerMount = !shouldVirtualize || rowIndex < 4;
  const [isNearViewport, setIsNearViewport] = useState(eagerMount);

  useEffect(() => {
    if (!shouldVirtualize || eagerMount) return;
    const node = rowRef.current;
    if (!node) return;
    return observeShelfRowViewport(node, setIsNearViewport);
  }, [shouldVirtualize, eagerMount]);

  const showRowBooks =
    eagerMount || isNearViewport || rowActiveBookId !== null || isEditing;
  const currentFocusIdx = Math.min(
    focusedIdx,
    Math.max(0, row.books.length - 1)
  );
  const rowHeightPx = Math.max(
    UNIFORM_COMPARTMENT_ROW_HEIGHT_PX,
    row.maxBookHeightPx + 14
  );
  const autoTiltIndices = useMemo(
    () =>
      !isEdit && view3dMode === "spines"
        ? resolveGroupTiltIndices(
            row.books.length,
            row.groupBreakIndices,
            row.groupGapPx
          )
        : new Set<number>(),
    [
      isEdit,
      view3dMode,
      row.books.length,
      row.groupBreakIndices,
      row.groupGapPx,
    ]
  );
  const rowVisuals = useMemo(
    () => (showRowBooks ? resolveRowSpineVisuals(row.books) : []),
    [showRowBooks, row.books]
  );
  const rowColors = useMemo(() => {
    if (!showRowBooks || shelf.kind !== "color") return shelf.colors;
    if (shelf.hasCustomColors && shelf.colors.length > 0) return shelf.colors;
    return rowVisuals.length > 0
      ? extractPredominantDotColors(rowVisuals, (v) => v.spineBg, 4)
      : shelf.colors;
  }, [
    showRowBooks,
    shelf.kind,
    shelf.hasCustomColors,
    shelf.colors,
    rowVisuals,
  ]);

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
      ref={rowRef}
      data-genre-shelf={shelf.genreKey}
      data-shelf-row={row.rowKey}
      data-shelf-virtualized={shouldVirtualize ? "true" : undefined}
      data-shelf-row-mounted={showRowBooks ? "true" : "false"}
      data-arrange-shelf={
        isEdit && row.isFirstChunk ? shelf.genreKey : undefined
      }
      onDragOver={(e) => onShelfContainerDragOver(e, shelf.genreKey)}
      onDrop={(e) => onShelfContainerDrop(e, shelf)}
      className={`rf-shelf-row ${styles.shelfSection} ${
        isDropTargetShelf ? styles.shelfSectionDropActive : ""
      }`}
    >
      {!showRowBooks ? (
        <div
          aria-hidden="true"
          style={{
            height: `${rowHeightPx + 58}px`,
            width: "100%",
          }}
        />
      ) : (
        <>
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
                      {rowColors.map((hex, i) => (
                        <span
                          key={`${row.rowKey}-dot-${i}`}
                          className={styles.colorDotItem}
                          style={{ backgroundColor: hex }}
                          aria-hidden="true"
                        />
                      ))}
                    </button>
                  ) : (
                    rowColors.map((hex, i) => (
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
                  disabled={shelfIdx === shelvesCount - 1}
                  onClick={() => onMoveShelf?.(shelf.genreKey, 1)}
                  aria-label={`Descer prateleira ${shelf.genre}`}
                  className={styles.headerIconBtn}
                >
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </button>
                {shelvesCount > 1 && onDeleteShelf ? (
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
                  {showRowBooks ? (
                    <>
                      {/* Objetos decorativos posicionados no início da prateleira */}
                      {row.isFirstChunk
                        ? shelfDecor
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
                        const inlineDecors = shelfDecor.filter(
                          (d) => d.afterBookIndex === globalIdx
                        );
                        const isBookDragging =
                          draggingBookIdInRow === bookIdStr;
                        const dropPos =
                          dragOverBookTarget &&
                          dragOverBookTarget.bookId === bookIdStr
                            ? dragOverBookTarget.position
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
                          setFocusedIdx(nextIdx);
                          focusButtonAt(buttons, nextIdx);
                        };

                        const bookLayout = measureBookRenderLayout(book, {
                          displayMode,
                          view3dMode,
                        });
                        const coverShowcaseHeight =
                          bookLayout.coverShowcaseHeightPx;
                        const coverShowcaseWidth =
                          bookLayout.coverShowcaseWidthPx;
                        const bookGroupGapPx = row.groupBreakIndices.includes(
                          idx
                        )
                          ? row.groupGapPx
                          : 0;

                        return (
                          <Fragment key={book.id}>
                            {displayMode === "capa_frente" ? (
                              <li
                                data-book-display="capa_frente"
                                data-book-drop-id={bookIdStr}
                                data-book-drop-shelf={shelf.genreKey}
                                data-group-start={
                                  bookGroupGapPx > 0 ? "true" : undefined
                                }
                                style={
                                  bookGroupGapPx > 0
                                    ? ({
                                        "--rf-group-gap": `${bookGroupGapPx}px`,
                                      } as CSSProperties)
                                    : undefined
                                }
                                draggable={canDrag}
                                onDragStart={(e) =>
                                  onBookDragStart(e, shelf.genreKey, book.id)
                                }
                                onDragOver={(e) =>
                                  onBookDragOver(e, shelf.genreKey, book.id)
                                }
                                onDrop={(e) => onBookDrop(e, shelf, book.id)}
                                onDragEnd={onClearDrag}
                                className={`${styles.bookFrontSlot} ${
                                  rowActiveBookId === book.id
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
                                  aria-pressed={rowActiveBookId === book.id}
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
                                groupGapPx={bookGroupGapPx}
                                autoTilted={
                                  displayMode === "lombada" &&
                                  autoTiltIndices.has(idx)
                                }
                                className={
                                  displayMode === "inclinado"
                                    ? `${styles.bookTiltedWrap} ${
                                        tiltDir === "left"
                                          ? styles.bookTiltedLeft
                                          : styles.bookTiltedRight
                                      }`
                                    : displayMode === "lombada" &&
                                        autoTiltIndices.has(idx)
                                      ? styles.bookAutoTilted
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
                                bookDropId={bookIdStr}
                                bookDropShelf={shelf.genreKey}
                                onDragStart={(e) =>
                                  onBookDragStart(e, shelf.genreKey, book.id)
                                }
                                onDragOver={(e) =>
                                  onBookDragOver(e, shelf.genreKey, book.id)
                                }
                                onDrop={(e) => onBookDrop(e, shelf, book.id)}
                                onDragEnd={onClearDrag}
                                onHoverBook={() => setPreviewBookId(bookIdStr)}
                                onFocusBook={() => setPreviewBookId(bookIdStr)}
                                tabIndex={currentFocusIdx === idx ? 0 : -1}
                                onKeyDown={handleBookKeyDown}
                                isSelected={rowActiveBookId === book.id}
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
                        ? shelfDecor
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
                      shelfDecor.length === 0 &&
                      row.rowBooksWidthPx + SHELF_BOOKEND_WIDTH_PX + 6 <=
                        row.effectiveMaxRowW ? (
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
                    </>
                  ) : (
                    <li
                      aria-hidden="true"
                      style={{
                        width: `${Math.max(120, row.rowBooksWidthPx)}px`,
                        height: `${row.maxBookHeightPx}px`,
                      }}
                    />
                  )}
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
        </>
      )}
    </div>
  );
});

export const ShelfView = memo(function ShelfView({
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
  const groupGapPx = resolveShelfGroupGapPx(resolvedThemeConfig.density);

  // Largura útil real da tábua medida via ResizeObserver com debounce (SSR-safe default = FIXED_ROW_PACK_WIDTH_PX)
  const [measuredRowWidthPx, setMeasuredRowWidthPx] = useState<number>(
    FIXED_ROW_PACK_WIDTH_PX
  );

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

  useEffect(() => {
    const el = bookcaseRef.current;
    if (!el || typeof window === "undefined") return;

    const computeUsableRowWidth = () => {
      const cs = window.getComputedStyle(el);
      const padLeft = Number.parseFloat(cs.paddingLeft) || 0;
      const padRight = Number.parseFloat(cs.paddingRight) || 0;
      const innerWidth = el.clientWidth - padLeft - padRight;
      // 24px = padding-inline (12px × 2) da .booksRow; 4px = margem de segurança subpixel
      const nextUsable = Math.max(240, Math.floor(innerWidth - 28));
      setMeasuredRowWidthPx((prev) =>
        Math.abs(prev - nextUsable) >= 2 ? nextUsable : prev
      );
    };

    computeUsableRowWidth();

    if (typeof ResizeObserver === "undefined") return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(computeUsableRowWidth, 100);
    });
    observer.observe(el);

    return () => {
      if (timer) clearTimeout(timer);
      observer.disconnect();
    };
  }, [bookcaseRef]);

  // Empacota cada grupo de prateleira usando a mesma função única de medida da renderização
  const packedRows = useMemo<PackedDisplayRow[]>(() => {
    const out: PackedDisplayRow[] = [];
    const maxRowW = measuredRowWidthPx;

    shelves.forEach((shelf, shelfIdx) => {
      if (shelf.books.length === 0 && !isEdit && !shelf.isCustom) {
        return;
      }

      const decorList = shelfDecorByRow[shelf.genreKey] ?? [];
      const decorReservedPx = decorList.reduce((acc, d) => {
        const w =
          SHELF_DECOR_OPTIONS.find((opt) => opt.id === d.decorType)?.widthPx ??
          38;
        return acc + w + 6;
      }, 0);
      const editPlusReservedPx = isEdit && onAddBook ? 46 : 0;
      const effectiveMaxRowW = Math.max(
        220,
        maxRowW - decorReservedPx - editPlusReservedPx
      );

      const chunks = packShelfBooksByWidth(shelf.books, {
        maxRowWidthPx: effectiveMaxRowW,
        groupGapPx,
        rowSeedPrefix: shelf.genreKey,
        bookDisplayModes,
        view3dMode,
      });

      let offset = 0;
      chunks.forEach((chunk, chunkIdx) => {
        const rowBooks = chunk.books;

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
          books: rowBooks,
          rowBooksWidthPx: chunk.rowBooksWidthPx,
          effectiveMaxRowW,
          maxBookHeightPx: chunk.maxBookHeightPx,
          groupBreakIndices: chunk.groupBreakIndices,
          groupGapPx: chunk.groupGapPx,
        });
        offset += rowBooks.length;
      });
    });

    return out;
  }, [
    shelves,
    isEdit,
    measuredRowWidthPx,
    groupGapPx,
    bookDisplayModes,
    view3dMode,
    shelfDecorByRow,
    onAddBook,
  ]);

  const bookcaseWidthPx = FIXED_SHELF_WIDTH_PX;
  const shouldVirtualizeRows = totalBooksCount > 60 && packedRows.length > 5;

  const clearDrag = useCallback(() => {
    draggingBookRef.current = null;
    dragOverTargetRef.current = null;
    setDraggingBook(null);
    setDragOverTarget(null);
    setDragOverShelfKey(null);
  }, []);

  const handleBookDragStart = useCallback(
    (e: DragEvent<HTMLElement>, shelfKey: string, bookId: string | number) => {
      const idStr = String(bookId);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", idStr);
      const payload = { shelfKey, bookId: idStr };
      draggingBookRef.current = payload;
      setDraggingBook(payload);
    },
    []
  );

  const handleBookDragOver = useCallback(
    (
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
    },
    [onMoveBookAcrossShelves]
  );

  const handleBookDrop = useCallback(
    (
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
    },
    [clearDrag, onMoveBookAcrossShelves, onReorderWithinShelf]
  );

  const handleShelfContainerDragOver = useCallback(
    (e: DragEvent<HTMLElement>, shelfKey: string) => {
      const currentDrag = draggingBookRef.current;
      if (!currentDrag || !onMoveBookAcrossShelves) return;
      if (currentDrag.shelfKey === shelfKey) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverShelfKey((prev) => (prev === shelfKey ? prev : shelfKey));
    },
    [onMoveBookAcrossShelves]
  );

  const handleShelfContainerDrop = useCallback(
    (e: DragEvent<HTMLElement>, shelf: ShelfRenderGroup) => {
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
    },
    [clearDrag, onMoveBookAcrossShelves]
  );

  // Suporte nativo a toque em /estante-3d/arrumar: long-press (300 ms) inicia arraste por Pointer Events sem bloquear rolagem normal
  const suppressTouchClickUntilRef = useRef(0);
  const touchCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      touchCleanupRef.current?.();
    };
  }, []);

  const handleBookcasePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isEdit || e.pointerType === "mouse") return;
      const targetEl = e.target as Element | null;
      const slotEl = targetEl?.closest<HTMLElement>("[data-book-drop-id]");
      if (!slotEl) return;
      const bookId = slotEl.dataset.bookDropId;
      const shelfKey = slotEl.dataset.bookDropShelf;
      if (!bookId || !shelfKey) return;

      touchCleanupRef.current?.();

      const pointerId = e.pointerId;
      const startX = e.clientX;
      const startY = e.clientY;
      let lastClientY = e.clientY;
      let dragActivated = false;
      let autoScrollRaf = 0;

      const stopAutoScroll = () => {
        if (autoScrollRaf) {
          window.cancelAnimationFrame(autoScrollRaf);
          autoScrollRaf = 0;
        }
      };

      const stepAutoScroll = () => {
        if (!dragActivated) {
          autoScrollRaf = 0;
          return;
        }
        const topZone = 76;
        const bottomZone = 92;
        const vh = window.innerHeight;
        if (lastClientY < topZone) {
          const speed = Math.min(14, Math.ceil((topZone - lastClientY) / 6));
          window.scrollBy(0, -speed);
        } else if (lastClientY > vh - bottomZone) {
          const speed = Math.min(
            14,
            Math.ceil((lastClientY - (vh - bottomZone)) / 6)
          );
          window.scrollBy(0, speed);
        }
        autoScrollRaf = window.requestAnimationFrame(stepAutoScroll);
      };

      const blockTouchMoveScroll = (ev: TouchEvent) => {
        if (dragActivated) {
          ev.preventDefault();
        }
      };

      const finish = (ev?: PointerEvent) => {
        window.clearTimeout(holdTimer);
        stopAutoScroll();
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerCancel);
        window.removeEventListener("touchmove", blockTouchMoveScroll);
        touchCleanupRef.current = null;

        if (!dragActivated) return;
        suppressTouchClickUntilRef.current = Date.now() + 450;

        if (ev) {
          const hitEls = document.elementsFromPoint(ev.clientX, ev.clientY);
          let dropBookEl: HTMLElement | null = null;
          let dropShelfEl: HTMLElement | null = null;
          for (const node of hitEls) {
            if (
              !dropBookEl &&
              node instanceof HTMLElement &&
              node.dataset.bookDropId
            ) {
              dropBookEl = node;
            }
            if (
              !dropShelfEl &&
              node instanceof HTMLElement &&
              node.dataset.genreShelf
            ) {
              dropShelfEl = node;
            }
          }

          const currentTarget = dragOverTargetRef.current;
          const destShelfKey =
            currentTarget?.shelfKey ??
            dropBookEl?.dataset.bookDropShelf ??
            dropShelfEl?.dataset.genreShelf ??
            null;
          const destBookId =
            currentTarget?.bookId ?? dropBookEl?.dataset.bookDropId;

          if (destShelfKey) {
            const destShelf = shelves.find((s) => s.genreKey === destShelfKey);
            if (destShelf && destShelfKey !== shelfKey) {
              onMoveBookAcrossShelves?.({
                bookId,
                fromShelfKey: shelfKey,
                toShelfKey: destShelfKey,
                targetBookId: destBookId,
                position: currentTarget?.position ?? "before",
              });
            } else if (
              destShelf &&
              destShelfKey === shelfKey &&
              destBookId &&
              destBookId !== bookId
            ) {
              const reordered = reorderBookListByMove(
                destShelf.books,
                bookId,
                destBookId,
                currentTarget?.position ?? "before"
              );
              const newIndex = reordered.findIndex(
                (b) => String(b.id) === bookId
              );
              const movedBook = reordered[newIndex];
              if (movedBook && newIndex >= 0) {
                onReorderWithinShelf(
                  destShelf,
                  reordered,
                  movedBook.title,
                  newIndex
                );
              }
            }
          }
        }

        clearDrag();
      };

      const onPointerMove = (mv: PointerEvent) => {
        if (mv.pointerId !== pointerId) return;
        lastClientY = mv.clientY;
        if (!dragActivated) {
          if (Math.hypot(mv.clientX - startX, mv.clientY - startY) > 8) {
            finish();
          }
          return;
        }

        const hitEls = document.elementsFromPoint(mv.clientX, mv.clientY);
        let hitBook: HTMLElement | null = null;
        let hitShelf: HTMLElement | null = null;
        for (const node of hitEls) {
          if (
            !hitBook &&
            node instanceof HTMLElement &&
            node.dataset.bookDropId
          ) {
            hitBook = node;
          }
          if (
            !hitShelf &&
            node instanceof HTMLElement &&
            node.dataset.genreShelf
          ) {
            hitShelf = node;
          }
        }

        const hoverShelfKey =
          hitBook?.dataset.bookDropShelf ??
          hitShelf?.dataset.genreShelf ??
          null;
        if (hoverShelfKey) {
          setDragOverShelfKey((prev) =>
            prev === hoverShelfKey ? prev : hoverShelfKey
          );
        }

        const hoverBookId = hitBook?.dataset.bookDropId;
        if (
          hitBook &&
          hoverShelfKey &&
          hoverBookId &&
          (hoverShelfKey !== shelfKey || hoverBookId !== bookId)
        ) {
          const rect = hitBook.getBoundingClientRect();
          const pos: "before" | "after" =
            mv.clientX >= rect.left + rect.width / 2 ? "after" : "before";
          const nextTarget = {
            shelfKey: hoverShelfKey,
            bookId: hoverBookId,
            position: pos,
          };
          dragOverTargetRef.current = nextTarget;
          setDragOverTarget((prev) =>
            prev &&
            prev.shelfKey === hoverShelfKey &&
            prev.bookId === hoverBookId &&
            prev.position === pos
              ? prev
              : nextTarget
          );
        } else {
          dragOverTargetRef.current = null;
          setDragOverTarget(null);
        }
      };

      const onPointerUp = (up: PointerEvent) => {
        if (up.pointerId !== pointerId) return;
        finish(up);
      };

      const onPointerCancel = (cancel: PointerEvent) => {
        if (cancel.pointerId !== pointerId) return;
        finish();
      };

      const holdTimer = window.setTimeout(() => {
        dragActivated = true;
        const payload = { shelfKey, bookId };
        draggingBookRef.current = payload;
        setDraggingBook(payload);
        autoScrollRaf = window.requestAnimationFrame(stepAutoScroll);
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate(14);
          } catch {
            // Ignora ambientes sem suporte a vibração
          }
        }
      }, 300);

      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerup", onPointerUp, { passive: true });
      window.addEventListener("pointercancel", onPointerCancel, {
        passive: true,
      });
      window.addEventListener("touchmove", blockTouchMoveScroll, {
        passive: false,
      });

      touchCleanupRef.current = () => {
        window.clearTimeout(holdTimer);
        stopAutoScroll();
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerCancel);
        window.removeEventListener("touchmove", blockTouchMoveScroll);
      };
    },
    [clearDrag, isEdit, onMoveBookAcrossShelves, onReorderWithinShelf, shelves]
  );

  const handleBookcaseClickCapture = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (Date.now() < suppressTouchClickUntilRef.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    []
  );

  const readingArchBook = useMemo<NormalizedVirtualBook | null>(() => {
    if (isEdit) return null;
    for (const shelf of shelves) {
      const found = shelf.books.find((b) => b.readingStatus === "reading");
      if (found) return found;
    }
    return null;
  }, [isEdit, shelves]);

  const bookcaseElement = (
    <div
      ref={bookcaseRef}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onPointerDown={handleBookcasePointerDown}
      onClickCapture={handleBookcaseClickCapture}
      data-shelf-mode={mode}
      data-shelf-material={shelfMaterial}
      data-shelf-material-v2={resolvedThemeConfig.material}
      data-shelf-brackets={resolvedThemeConfig.bracketStyle}
      data-shelf-backdrop={resolvedThemeConfig.nicheBackdrop}
      data-shelf-led={resolvedThemeConfig.ledWarm3000K ? "on" : "off"}
      data-shelf-spotlights={resolvedThemeConfig.topSpotlights ? "on" : "off"}
      data-shelf-density={resolvedThemeConfig.density}
      data-total-books={totalBooksCount}
      className={styles.bookcase}
      style={
        {
          "--bookcase-w": `${bookcaseWidthPx}px`,
        } as CSSProperties
      }
    >
      {/* Cornija superior do móvel de biblioteca */}
      <div
        className={styles.cornice}
        data-cabinet-cornice="true"
        aria-hidden="true"
      />
      <div className={styles.topSpotlightsLayer} aria-hidden="true" />
      <div className={styles.topSpotFixtures} aria-hidden="true">
        <span className={styles.topSpotDot} />
        <span className={styles.topSpotDot} />
      </div>

      {/* Nicho em arco com o livro em andamento exposto de frente (capa real ou fallback) */}
      {readingArchBook ? (
        <div className={styles.archNicheSection} data-reading-arch-niche="true">
          <div className={styles.archNicheFrame}>
            <span className={styles.archNicheBadge}>Lendo agora</span>
            <button
              type="button"
              onClick={() => {
                setPreviewBookId(String(readingArchBook.id));
                onSelectBook(readingArchBook);
              }}
              onMouseEnter={() => setPreviewBookId(String(readingArchBook.id))}
              onFocus={() => setPreviewBookId(String(readingArchBook.id))}
              aria-label={`Livro em andamento no nicho: ${readingArchBook.title}`}
              className={styles.archNicheBookBtn}
            >
              <BookCover
                title={readingArchBook.title}
                author={readingArchBook.author}
                coverUrl={readingArchBook.coverUrl}
                spineColor={readingArchBook.spineBg}
                spineAccent={readingArchBook.spineAccentHex}
                seed={readingArchBook.resolvedSeed}
                readingStatus="reading"
                progressPercent={readingArchBook.progressPercent ?? 0}
                size="sm"
              />
            </button>
            <div className={styles.archNicheMeta}>
              <p className={styles.archNicheTitle}>{readingArchBook.title}</p>
              <p className={styles.archNicheAuthor}>
                {readingArchBook.author}
                {typeof readingArchBook.progressPercent === "number"
                  ? ` · ${Math.round(readingArchBook.progressPercent)}% lido`
                  : ""}
              </p>
            </div>
          </div>
          <div
            className={`rf-shelf-plank ${styles.shelfPlank}`}
            aria-hidden="true"
          />
        </div>
      ) : null}

      <div className={styles.shelvesColumn}>
        {packedRows.map((row, rowIndex) => {
          const { sourceShelf: shelf } = row;
          const rowHasActive =
            activeBookId !== null &&
            activeBookId !== undefined &&
            row.books.some((b) => String(b.id) === String(activeBookId));
          const rowActiveBookId = rowHasActive ? activeBookId : null;
          const draggingInRow =
            draggingBook?.shelfKey === shelf.genreKey &&
            row.books.some((b) => String(b.id) === draggingBook.bookId)
              ? draggingBook.bookId
              : null;
          const rowDropTarget =
            dragOverTarget?.shelfKey === shelf.genreKey &&
            row.books.some((b) => String(b.id) === dragOverTarget.bookId)
              ? {
                  bookId: dragOverTarget.bookId,
                  position: dragOverTarget.position,
                }
              : null;

          return (
            <PackedShelfRow
              key={row.rowKey}
              row={row}
              rowIndex={rowIndex}
              shelvesCount={shelves.length}
              shouldVirtualize={shouldVirtualizeRows}
              mode={mode}
              isEdit={isEdit}
              view3dMode={view3dMode}
              bookDisplayModes={bookDisplayModes}
              bookTiltDirections={bookTiltDirections}
              shelfDecor={shelfDecorByRow[shelf.genreKey] ?? EMPTY_DECOR_LIST}
              rowActiveBookId={rowActiveBookId}
              draggingBookIdInRow={draggingInRow}
              dragOverBookTarget={rowDropTarget}
              isDropTargetShelf={
                dragOverShelfKey === shelf.genreKey &&
                draggingBook?.shelfKey !== shelf.genreKey
              }
              isDeleting={confirmDeleteKey === shelf.genreKey}
              isEditing={row.isFirstChunk && editingShelfKey === shelf.genreKey}
              onRemoveDecor={onRemoveDecor}
              onSelectBook={onSelectBook}
              setPreviewBookId={setPreviewBookId}
              onReorderWithinShelf={onReorderWithinShelf}
              onMoveBookAcrossShelves={onMoveBookAcrossShelves}
              onEditShelf={onEditShelf}
              renderShelfEditor={renderShelfEditor}
              onMoveShelf={onMoveShelf}
              onDeleteShelf={onDeleteShelf}
              onAddBook={onAddBook}
              onSortShelfByColor={onSortShelfByColor}
              setConfirmDeleteKey={setConfirmDeleteKey}
              onBookDragStart={handleBookDragStart}
              onBookDragOver={handleBookDragOver}
              onBookDrop={handleBookDrop}
              onClearDrag={clearDrag}
              onShelfContainerDragOver={handleShelfContainerDragOver}
              onShelfContainerDrop={handleShelfContainerDrop}
            />
          );
        })}
      </div>
      {/* Rodapé / plinto estrutural do móvel */}
      <div
        className={styles.baseboard}
        data-cabinet-baseboard="true"
        aria-hidden="true"
      />
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
});
