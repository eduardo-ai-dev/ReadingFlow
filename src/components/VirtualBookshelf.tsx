"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";
import {
  filterVirtualBooksByQuickFilter,
  groupBooksByGenre,
  type NormalizedVirtualBook,
  type RealisticBookFormat,
  type ShelfQuickFilter,
  type VirtualBookItem,
} from "@/features/shelves/virtual-bookshelf";
import {
  EMPTY_PERSISTED_SHELF_LAYOUT,
  extractPredominantDotColors,
  type PersistedShelfLayout,
} from "@/features/shelves/arrange-shelves";
import { saveShelfCustomizationAction } from "@/features/settings/actions";
import { ShelfView, type ShelfRenderGroup } from "@/components/ShelfView";
import {
  BookSlideOverDrawer,
  type BookDrawerData,
} from "@/components/BookSlideOverDrawer";
import { FilterChip, rfButtonClassName } from "@/components/ui/ActionControls";
import styles from "./VirtualBookshelf.module.css";

const QUICK_FILTER_OPTIONS: ReadonlyArray<{
  key: ShelfQuickFilter;
  label: string;
}> = [
  { key: "all", label: "Todos" },
  { key: "physical", label: "Só Físicos" },
  { key: "digital", label: "Só Digitais" },
  { key: "reading", label: "Em Andamento" },
  { key: "finished", label: "Concluídos" },
  { key: "wishlist", label: "Desejos" },
];

const FORMAT_LABELS_PT: Record<RealisticBookFormat, string> = {
  capa_dura: "Capa dura",
  brochura: "Brochura",
  bolso: "Bolso",
  ebook: "E-book",
  audio: "Audiolivro",
};

export interface VirtualBookshelfProps {
  books: readonly VirtualBookItem[];
  wishlistBooks?: readonly VirtualBookItem[];
  initialShelfLayout?: PersistedShelfLayout;
  enableQuickFilters?: boolean;
  initialQuickFilter?: ShelfQuickFilter;
  onBookSelect?: (book: VirtualBookItem) => void;
}

export function VirtualBookshelf({
  books,
  wishlistBooks = [],
  initialShelfLayout,
  enableQuickFilters = false,
  initialQuickFilter = "all",
  onBookSelect,
}: VirtualBookshelfProps) {
  const [, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | number | null>(null);
  const [view3dMode, setView3dMode] = useState<"spines" | "covers">("spines");
  const [activeFilter, setActiveFilter] =
    useState<ShelfQuickFilter>(initialQuickFilter);
  const [layout, setLayout] = useState<PersistedShelfLayout>(
    () => initialShelfLayout ?? EMPTY_PERSISTED_SHELF_LAYOUT
  );
  const [reorderAnnouncement, setReorderAnnouncement] = useState("");

  // Metadados (coverUrl, spineColor, spineAccent) vêm persistidos do cadastro; nada é buscado a cada render.
  // Aplica apenas overrides manuais de cor salvos no modo "Arrumar estante".
  const hydratedLibraryBooks = useMemo(() => {
    const overrides = layout.bookColorOverrides;
    if (!overrides || Object.keys(overrides).length === 0) return [...books];
    return books.map((b) => {
      const customColor = overrides[String(b.id)];
      return customColor
        ? { ...b, spineColor: customColor, spineAccent: undefined }
        : b;
    });
  }, [books, layout.bookColorOverrides]);

  const hydratedWishlistBooks = useMemo(
    () => [...wishlistBooks],
    [wishlistBooks]
  );

  const filterCounts = useMemo<Record<ShelfQuickFilter, number>>(
    () => ({
      all: filterVirtualBooksByQuickFilter(
        hydratedLibraryBooks,
        hydratedWishlistBooks,
        "all"
      ).length,
      physical: filterVirtualBooksByQuickFilter(
        hydratedLibraryBooks,
        hydratedWishlistBooks,
        "physical"
      ).length,
      digital: filterVirtualBooksByQuickFilter(
        hydratedLibraryBooks,
        hydratedWishlistBooks,
        "digital"
      ).length,
      reading: filterVirtualBooksByQuickFilter(
        hydratedLibraryBooks,
        hydratedWishlistBooks,
        "reading"
      ).length,
      finished: filterVirtualBooksByQuickFilter(
        hydratedLibraryBooks,
        hydratedWishlistBooks,
        "finished"
      ).length,
      wishlist: filterVirtualBooksByQuickFilter(
        hydratedLibraryBooks,
        hydratedWishlistBooks,
        "wishlist"
      ).length,
    }),
    [hydratedLibraryBooks, hydratedWishlistBooks]
  );

  const filteredBooks = useMemo(
    () =>
      filterVirtualBooksByQuickFilter(
        hydratedLibraryBooks,
        hydratedWishlistBooks,
        activeFilter
      ),
    [hydratedLibraryBooks, hydratedWishlistBooks, activeFilter]
  );

  const shelves = useMemo<ShelfRenderGroup[]>(() => {
    const baseGroups = groupBooksByGenre(filteredBooks, {
      unifyTaxonomy: true,
      compactSmallThreshold: 2,
      miscLabel: "Miscelânea",
    });

    // Mapa auxiliar de cada livro para reconstruir prateleiras após movimentação entre estantes
    const shelfByKey = new Map<
      string,
      {
        genreKey: string;
        genre: string;
        books: NormalizedVirtualBook[];
        isCustom?: boolean;
      }
    >();

    for (const group of baseGroups) {
      const existing = shelfByKey.get(group.genreKey);
      if (existing) {
        existing.genre = existing.genre || group.genre;
      } else {
        shelfByKey.set(group.genreKey, {
          genreKey: group.genreKey,
          genre: group.genre,
          books: [],
        });
      }
    }

    for (const customShelf of layout.customShelves) {
      const existing = shelfByKey.get(customShelf.key);
      if (existing) {
        existing.isCustom = true;
        if (!existing.genre) existing.genre = customShelf.title;
      } else {
        shelfByKey.set(customShelf.key, {
          genreKey: customShelf.key,
          genre: customShelf.title,
          books: [],
          isCustom: true,
        });
      }
    }

    for (const group of baseGroups) {
      for (const book of group.books) {
        const overrideShelfKey = layout.bookShelfMap[String(book.id)];
        const destKey =
          overrideShelfKey && shelfByKey.has(overrideShelfKey)
            ? overrideShelfKey
            : group.genreKey;
        shelfByKey.get(destKey)?.books.push(book);
      }
    }

    const combined = Array.from(shelfByKey.values()).filter(
      (group) => group.books.length > 0
    );

    if (layout.shelfOrder.length > 0) {
      const orderRank = new Map(
        layout.shelfOrder.map((key, index) => [key, index])
      );
      combined.sort((a, b) => {
        const ra = orderRank.get(a.genreKey);
        const rb = orderRank.get(b.genreKey);
        if (ra !== undefined && rb !== undefined) return ra - rb;
        if (ra !== undefined) return -1;
        if (rb !== undefined) return 1;
        return 0;
      });
    }

    return combined.map((group) => {
      const meta = layout.shelfMeta[group.genreKey];
      const displayTitle = meta?.title?.trim() || group.genre;
      const customIds = layout.customOrderByShelf[group.genreKey];

      let orderedBooks = group.books;
      if (customIds && customIds.length > 0) {
        const rank = new Map(customIds.map((id, pos) => [id, pos]));
        orderedBooks = [...group.books].sort((a, b) => {
          const ra = rank.get(String(a.id));
          const rb = rank.get(String(b.id));
          if (ra !== undefined && rb !== undefined) return ra - rb;
          if (ra !== undefined) return -1;
          if (rb !== undefined) return 1;
          return 0;
        });
      }

      const defaultByOrgMode: ShelfRenderGroup["kind"] =
        layout.organizationMode === "genre" ||
        layout.organizationMode === "custom"
          ? "title"
          : "color";
      const kind: ShelfRenderGroup["kind"] =
        meta?.displayAsTitle !== undefined
          ? meta.displayAsTitle
            ? "title"
            : "color"
          : defaultByOrgMode;
      const colors =
        meta?.customDots && meta.customDots.length > 0
          ? meta.customDots
          : extractPredominantDotColors(orderedBooks, (b) => b.spineBg, 4);

      return {
        genreKey: group.genreKey,
        genre: displayTitle,
        books: orderedBooks,
        isCustom: group.isCustom,
        kind,
        colors,
        hasCustomColors: Boolean(
          meta?.customDots && meta.customDots.length > 0
        ),
      };
    });
  }, [filteredBooks, layout]);

  const isSparseBookcase =
    shelves.length > 0 && shelves.every((s) => s.books.length <= 2);

  const activeBook = useMemo(() => {
    if (activeId === null) return null;
    for (const shelf of shelves) {
      const found = shelf.books.find((b) => String(b.id) === String(activeId));
      if (found) return found;
    }
    return null;
  }, [shelves, activeId]);

  const drawerBook = useMemo<BookDrawerData | null>(
    () =>
      activeBook
        ? {
            id: String(activeBook.id),
            workId: activeBook.workId,
            editionId: activeBook.editionId,
            libraryItemId: activeBook.libraryItemId,
            readingId: activeBook.readingId,
            title: activeBook.title,
            author:
              activeBook.author ??
              activeBook.authorSurname ??
              "Autor do acervo",
            genre: activeBook.displayGenre,
            publisher: activeBook.publisher,
            pages: activeBook.pages,
            coverUrl: activeBook.coverUrl,
            spineColor: activeBook.spineBg,
            spineAccent: activeBook.spineAccentHex,
            seed: activeBook.resolvedSeed,
            format: activeBook.format ?? activeBook.realisticFormat,
            readingStatus: activeBook.readingStatus,
            statusLabel: activeBook.statusLabel,
            progressUnit: activeBook.progressUnit,
            progressValue: activeBook.progressValue,
            progressTotal: activeBook.progressTotal,
            progressPercent: activeBook.progressPercent ?? 0,
            rating: activeBook.rating,
            href: activeBook.href,
            isWishlist: activeBook.isWishlist,
            wishlistPriority: activeBook.wishlistPriority,
            targetPrice: activeBook.targetPrice,
          }
        : null,
    [activeBook]
  );

  const handleCloseDrawer = useCallback(() => {
    setActiveId(null);
  }, []);

  const handleReorderWithinShelf = (
    shelf: ShelfRenderGroup,
    nextBooks: NormalizedVirtualBook[],
    movedTitle: string,
    newIndex: number
  ) => {
    const nextIds = nextBooks.map((b) => String(b.id));
    const prevLayout = layout;
    const nextLayout: PersistedShelfLayout = {
      ...layout,
      customOrderByShelf: {
        ...layout.customOrderByShelf,
        [shelf.genreKey]: nextIds,
      },
    };
    setLayout(nextLayout);
    setReorderAnnouncement(
      `${movedTitle} movido para a posição ${newIndex + 1} de ${nextBooks.length} na prateleira ${shelf.genre}.`
    );

    const libraryItemIds = nextBooks
      .map((b) => b.libraryItemId)
      .filter((id): id is string => Boolean(id));

    startTransition(async () => {
      try {
        const res = await saveShelfCustomizationAction({
          layout: nextLayout,
          orderedItemIds:
            libraryItemIds.length >= 2 ? libraryItemIds : undefined,
        });
        if (!res.ok) {
          setLayout(prevLayout);
          setReorderAnnouncement(
            `Não foi possível salvar a nova ordem de ${movedTitle}: ${res.error}`
          );
          return;
        }
        setLayout(res.layout);
      } catch {
        setLayout(prevLayout);
        setReorderAnnouncement(
          `Falha ao salvar a nova ordem de ${movedTitle}. Ordem restaurada.`
        );
      }
    });
  };

  const handleMoveBookAcrossShelves = ({
    bookId,
    fromShelfKey,
    toShelfKey,
    targetBookId,
    position,
  }: {
    bookId: string;
    fromShelfKey: string;
    toShelfKey: string;
    targetBookId?: string;
    position?: "before" | "after";
  }) => {
    if (fromShelfKey === toShelfKey) return;

    const sourceShelf = shelves.find((s) => s.genreKey === fromShelfKey);
    const destShelf = shelves.find((s) => s.genreKey === toShelfKey);
    const movedBook = sourceShelf?.books.find(
      (b) => String(b.id) === String(bookId)
    );
    if (!destShelf || !movedBook) return;

    const nextFromOrder = (sourceShelf?.books ?? [])
      .filter((b) => String(b.id) !== bookId)
      .map((b) => String(b.id));

    const baseDestIds = destShelf.books
      .filter((b) => String(b.id) !== bookId)
      .map((b) => String(b.id));

    if (targetBookId) {
      const targetIdx = baseDestIds.indexOf(targetBookId);
      if (targetIdx >= 0) {
        const insertIdx = position === "after" ? targetIdx + 1 : targetIdx;
        baseDestIds.splice(insertIdx, 0, bookId);
      } else {
        baseDestIds.push(bookId);
      }
    } else {
      baseDestIds.push(bookId);
    }

    const prevLayout = layout;
    const nextLayout: PersistedShelfLayout = {
      ...layout,
      bookShelfMap: {
        ...layout.bookShelfMap,
        [bookId]: toShelfKey,
      },
      customOrderByShelf: {
        ...layout.customOrderByShelf,
        [fromShelfKey]: nextFromOrder,
        [toShelfKey]: baseDestIds,
      },
    };
    setLayout(nextLayout);
    setReorderAnnouncement(
      `${movedBook.title} movido para a prateleira ${destShelf.genre}.`
    );

    startTransition(async () => {
      try {
        const res = await saveShelfCustomizationAction({
          layout: nextLayout,
        });
        if (!res.ok) {
          setLayout(prevLayout);
          setReorderAnnouncement(
            `Não foi possível salvar a mudança de prateleira: ${res.error}`
          );
          return;
        }
        setLayout(res.layout);
      } catch {
        setLayout(prevLayout);
        setReorderAnnouncement(
          `Falha ao salvar a mudança de prateleira para ${movedBook.title}. Posição restaurada.`
        );
      }
    });
  };

  const handleSelectBook = useCallback(
    (book: NormalizedVirtualBook) => {
      onBookSelect?.(book);
      setActiveId((curr) => (curr === book.id ? null : book.id));
    },
    [onBookSelect]
  );

  if (books.length === 0 && wishlistBooks.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="minha-estante-3d-heading"
      className={styles.wrapper}
    >
      <div className={styles.toolbar}>
        <div>
          <p className={styles.kicker}>Prateleiras dinâmicas por gênero</p>
          <h2 id="minha-estante-3d-heading" className={styles.heading}>
            Estante 3D por Gênero Literário
          </h2>
          <p className={styles.subtitle}>
            Passe o cursor sobre uma lombada para revelar a capa frontal real em
            3D, arraste para organizar ou clique para abrir a ficha rápida.
          </p>
        </div>

        <div className={styles.toolbarActions}>
          <Link
            href="/estante-3d/arrumar"
            className={rfButtonClassName({
              variant: "secondary",
              secondaryStyle: "outline",
              size: "sm",
              pill: true,
            })}
          >
            Arrumar Estante
          </Link>

          <FilterChip
            active={view3dMode === "covers"}
            label={view3dMode === "covers" ? "Ver Lombadas" : "Ver Capas em 3D"}
            onClick={() =>
              setView3dMode((m) => (m === "spines" ? "covers" : "spines"))
            }
          />

          <div className={styles.summaryPill} aria-label="Resumo da estante">
            <span className={styles.summaryHighlight}>
              {shelves.length}{" "}
              {shelves.length === 1 ? "prateleira" : "prateleiras"}
            </span>
            <span className={styles.summaryDivider} aria-hidden="true" />
            <span className={styles.summaryMuted}>
              {filteredBooks.length}{" "}
              {filteredBooks.length === 1 ? "volume" : "volumes"}
            </span>
          </div>
        </div>
      </div>

      {enableQuickFilters ? (
        <div
          role="group"
          aria-label="Filtros rápidos da estante"
          className={`${styles.filterBar} overflow-x-auto pb-1`}
        >
          {QUICK_FILTER_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.key}
              active={activeFilter === opt.key}
              label={opt.label}
              count={filterCounts[opt.key]}
              onClick={() => {
                setActiveId(null);
                setActiveFilter(opt.key);
              }}
            />
          ))}
        </div>
      ) : null}

      {shelves.length === 0 ? (
        <div className={styles.filterEmptyState} role="status">
          <p className={styles.filterEmptyText}>
            Nenhum volume encontrado para o filtro selecionado.
          </p>
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={rfButtonClassName({ variant: "secondary", size: "sm" })}
          >
            Mostrar todos os volumes
          </button>
        </div>
      ) : (
        <ShelfView
          mode="view"
          shelfMaterial={layout.shelfMaterial ?? "classic-wood"}
          themeConfig={layout.themeConfig}
          bookDisplayModes={layout.bookDisplayModes}
          bookTiltDirections={layout.bookTiltDirections}
          shelfDecorByRow={layout.shelfDecorByRow}
          shelves={shelves}
          activeBookId={activeId}
          view3dMode={view3dMode}
          isSparseBookcase={isSparseBookcase}
          onSelectBook={handleSelectBook}
          onReorderWithinShelf={handleReorderWithinShelf}
          onMoveBookAcrossShelves={handleMoveBookAcrossShelves}
        />
      )}

      <div className="sr-only" aria-live="polite">
        {reorderAnnouncement}
      </div>

      {/* Barra viva de inspeção / acesso rápido ao livro selecionado */}
      {activeBook ? (
        <div role="region" aria-live="polite" className={styles.inspectorBar}>
          <div className="min-w-0">
            <p className={styles.inspectorGenre}>
              Prateleira · {activeBook.displayGenre}
            </p>
            <p className={styles.inspectorTitle}>{activeBook.title}</p>
            <p className={styles.inspectorMeta}>
              {activeBook.author ? `${activeBook.author} · ` : ""}
              {FORMAT_LABELS_PT[activeBook.realisticFormat]}
              {activeBook.pages ? ` · ${activeBook.pages} páginas` : ""}
            </p>
          </div>

          <div className={styles.inspectorActions}>
            {activeBook.href ? (
              <Link
                href={activeBook.href}
                className={rfButtonClassName({
                  variant: "primary",
                  size: "sm",
                })}
              >
                Abrir ficha do livro →
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setActiveId(null)}
              className={rfButtonClassName({
                variant: "subtle",
                size: "sm",
              })}
            >
              Guardar na prateleira
            </button>
          </div>
        </div>
      ) : null}

      <BookSlideOverDrawer book={drawerBook} onClose={handleCloseDrawer} />
    </section>
  );
}
