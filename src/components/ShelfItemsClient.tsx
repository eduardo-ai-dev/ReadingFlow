"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { EnrichedShelfItem } from "@/features/shelves/rules";
import type { ShelfKind } from "@/lib/domain";
import { ptBR } from "@/lib/i18n/pt-BR";
import { BookCover } from "@/components/BookCover";
import { EmptyState } from "@/components/EmptyState";
import { FormatBadge, ReadingStatusBadge } from "@/components/StatusBadge";
import { StarRatingDisplay } from "@/components/StarRating";
import { coverColor } from "@/lib/cover-color";
import { FilterChip, rfButtonClassName } from "@/components/ui/ActionControls";

const PAGE_WINDOW_SIZE = 60;

export interface ShelfTabItem {
  kind: ShelfKind;
  label: string;
  count: number;
}

export function ShelfItemsClient({
  items,
  initialView = "grid",
  shelfTabs,
  initialKind = "physical",
  itemsByKind,
  filterState,
}: {
  items: EnrichedShelfItem[];
  initialView?: "grid" | "list";
  shelfTabs?: readonly ShelfTabItem[];
  initialKind?: ShelfKind;
  itemsByKind?: Record<ShelfKind, EnrichedShelfItem[]>;
  filterState?: {
    query: string;
    readingStatus: string;
    sortMode: string;
  };
}) {
  const [activeKind, setActiveKind] = useState<ShelfKind>(initialKind);
  const [prevInitialKind, setPrevInitialKind] =
    useState<ShelfKind>(initialKind);
  if (prevInitialKind !== initialKind) {
    setPrevInitialKind(initialKind);
    setActiveKind(initialKind);
  }
  const [view, setView] = useState<"grid" | "list">(initialView);
  const [visibleLimit, setVisibleLimit] = useState(PAGE_WINDOW_SIZE);

  const currentItems = itemsByKind ? itemsByKind[activeKind] : items;
  const windowedItems = currentItems.slice(0, visibleLimit);
  const hasMore = currentItems.length > visibleLimit;

  const neighborColors = useMemo(() => {
    const prevColors: Array<string | null> = [];
    let lastHex: string | null = null;
    for (const entry of windowedItems) {
      const seed = entry.edition.isbn13 ?? entry.work.id;
      prevColors.push(lastHex);
      lastHex = coverColor(seed, lastHex);
    }
    return prevColors;
  }, [windowedItems]);

  const handleTabSwitch = (
    e: React.MouseEvent<HTMLAnchorElement>,
    nextKind: ShelfKind
  ) => {
    e.preventDefault();
    setActiveKind(nextKind);
    setVisibleLimit(PAGE_WINDOW_SIZE);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("tipo", nextKind);
      const nextUrl = `/estantes?${params.toString()}`;
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  };

  return (
    <div className="space-y-6">
      {shelfTabs ? (
        <>
          {/* Abas das 3 estantes iniciais usando o FilterChip unificado */}
          <nav aria-label="Tipo de estante" className="flex flex-wrap gap-2">
            {shelfTabs.map((tab) => {
              const active = tab.kind === activeKind;
              return (
                <FilterChip
                  key={tab.kind}
                  href={`/estantes?tipo=${tab.kind}`}
                  scroll={false}
                  replace
                  onClick={(e) =>
                    handleTabSwitch(
                      e as React.MouseEvent<HTMLAnchorElement>,
                      tab.kind
                    )
                  }
                  ariaCurrent={active ? "page" : undefined}
                  active={active}
                  label={tab.label}
                  count={tab.count}
                />
              );
            })}
          </nav>

          {/* Barra de busca tolerante a acentos/erros e filtros */}
          {filterState ? (
            <form
              key={`${filterState.query}:${filterState.readingStatus}:${filterState.sortMode}`}
              method="get"
              action="/estantes"
              className="grid gap-3 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:grid-cols-12"
            >
              <input type="hidden" name="tipo" value={activeKind} />

              <div className="sm:col-span-4">
                <label
                  htmlFor="shelf-search"
                  className="block text-[13px] font-semibold text-[var(--text-primary)]"
                >
                  Buscar por título, autor, editora ou ISBN
                </label>
                <input
                  id="shelf-search"
                  name="q"
                  type="search"
                  defaultValue={filterState.query}
                  placeholder="Ex.: Guimaraes, Torto Arado, 97885..."
                  className="mt-1 min-h-[42px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
                />
              </div>

              <div className="sm:col-span-3">
                <label
                  htmlFor="shelf-status"
                  className="block text-[13px] font-semibold text-[var(--text-primary)]"
                >
                  Estado de leitura
                </label>
                <select
                  id="shelf-status"
                  name="estado"
                  defaultValue={filterState.readingStatus}
                  className="mt-1 min-h-[42px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-2.5 text-sm text-[var(--text-primary)]"
                >
                  <option value="all">Todos os estados</option>
                  <option value="not_started">Não iniciado</option>
                  <option value="reading">Lendo agora</option>
                  <option value="paused">Pausado</option>
                  <option value="finished">Concluído</option>
                  <option value="abandoned">Abandonado</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label
                  htmlFor="shelf-sort"
                  className="block text-[13px] font-semibold text-[var(--text-primary)]"
                >
                  Ordenar por
                </label>
                <select
                  id="shelf-sort"
                  name="ordem"
                  defaultValue={filterState.sortMode}
                  className="mt-1 min-h-[42px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-2.5 text-sm text-[var(--text-primary)]"
                >
                  <option value="manual">Ordem da estante</option>
                  <option value="title">Título (A–Z)</option>
                  <option value="author">Autor (A–Z)</option>
                  <option value="acquired">Aquisição recente</option>
                  <option value="finished">Conclusão recente</option>
                </select>
              </div>

              <div className="flex items-end gap-2 sm:col-span-2">
                <button
                  type="submit"
                  className={rfButtonClassName({
                    variant: "secondary",
                    size: "md",
                    className: "w-full !min-h-[42px]",
                  })}
                >
                  Filtrar
                </button>
              </div>
            </form>
          ) : null}
        </>
      ) : null}

      {/* Contêiner do acervo com min-height preservado durante a troca de abas */}
      <div className="min-h-[360px] space-y-4">
        {currentItems.length === 0 ? (
          <EmptyState
            title={
              filterState &&
              (filterState.query || filterState.readingStatus !== "all")
                ? "Nenhum volume corresponde aos filtros aplicados"
                : ptBR.shelves.emptyTitle
            }
            description={
              filterState &&
              (filterState.query || filterState.readingStatus !== "all")
                ? "Experimente limpar a busca ou trocar de estante."
                : ptBR.shelves.emptyDescription
            }
            actionLabel="Adicionar livro a esta estante"
            actionHref="/adicionar"
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-medium tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--text-muted)]">
                Exibindo {windowedItems.length} de {currentItems.length}{" "}
                {currentItems.length === 1 ? "exemplar" : "exemplares"}
              </p>

              <div
                role="group"
                aria-label="Modo de visualização da estante"
                className="flex items-center gap-1.5"
              >
                <FilterChip
                  label="Grade 2D"
                  active={view === "grid"}
                  onClick={() => setView("grid")}
                />
                <FilterChip
                  label="Lista"
                  active={view === "list"}
                  onClick={() => setView("list")}
                />
              </div>
            </div>

            {view === "grid" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {windowedItems.map((entry, idx) => (
                  <Link
                    key={entry.item.id}
                    href={`/livros/${entry.work.id}`}
                    className="interactive-card flex gap-4 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
                  >
                    <BookCover
                      title={entry.work.title}
                      author={entry.primaryAuthor}
                      coverUrl={entry.edition.coverUrl}
                      spineColor={entry.edition.coverColor}
                      spineAccent={entry.edition.coverAccentColor}
                      seed={entry.edition.isbn13 ?? entry.work.id}
                      avoidNeighborHex={neighborColors[idx]}
                      readingStatus={entry.effectiveReadingStatus}
                      currentPage={entry.latestReading?.progressValue}
                      totalPages={
                        entry.latestReading?.progressTotal ??
                        entry.edition.pages
                      }
                      size="md"
                    />
                    <div className="flex min-w-0 flex-1 flex-col justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <FormatBadge format={entry.edition.format} />
                          <ReadingStatusBadge
                            status={entry.effectiveReadingStatus}
                          />
                        </div>
                        <h2 className="mt-2 line-clamp-2 font-serif text-base font-semibold text-[var(--text-heading)]">
                          {entry.work.title}
                        </h2>
                        <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                          {entry.primaryAuthor}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--text-muted)]">
                        <span>
                          {entry.edition.pages
                            ? `${entry.edition.pages} pág.`
                            : entry.edition.durationSeconds
                              ? `${Math.round(entry.edition.durationSeconds / 3600)} h`
                              : (entry.edition.publisher ?? "Acervo")}
                        </span>
                        {entry.review ? (
                          <StarRatingDisplay rating={entry.review.rating} />
                        ) : null}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="overflow-hidden rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {windowedItems.map((entry, idx) => (
                    <li key={entry.item.id}>
                      <Link
                        href={`/livros/${entry.work.id}`}
                        className="flex flex-wrap items-center justify-between gap-4 p-4 transition-colors hover:bg-[var(--bg-elevated)]"
                      >
                        <div className="flex min-w-0 items-center gap-3.5">
                          <BookCover
                            title={entry.work.title}
                            author={entry.primaryAuthor}
                            coverUrl={entry.edition.coverUrl}
                            spineColor={entry.edition.coverColor}
                            spineAccent={entry.edition.coverAccentColor}
                            seed={entry.edition.isbn13 ?? entry.work.id}
                            avoidNeighborHex={neighborColors[idx]}
                            readingStatus={entry.effectiveReadingStatus}
                            currentPage={entry.latestReading?.progressValue}
                            totalPages={
                              entry.latestReading?.progressTotal ??
                              entry.edition.pages
                            }
                            size="sm"
                          />
                          <div className="min-w-0">
                            <h2 className="truncate font-serif text-base font-semibold text-[var(--text-heading)]">
                              {entry.work.title}
                            </h2>
                            <p className="truncate text-xs tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--text-muted)]">
                              {entry.primaryAuthor}
                              {entry.edition.publisher
                                ? ` · ${entry.edition.publisher}`
                                : ""}
                              {entry.edition.isbn13
                                ? ` · ISBN ${entry.edition.isbn13}`
                                : ""}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <FormatBadge format={entry.edition.format} />
                          <ReadingStatusBadge
                            status={entry.effectiveReadingStatus}
                          />
                          {entry.review ? (
                            <StarRatingDisplay rating={entry.review.rating} />
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {hasMore ? (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() =>
                    setVisibleLimit((prev) => prev + PAGE_WINDOW_SIZE)
                  }
                  className={rfButtonClassName({
                    variant: "secondary",
                    secondaryStyle: "outline",
                    size: "lg",
                  })}
                >
                  Carregar mais volumes ({currentItems.length - visibleLimit}{" "}
                  restantes)
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
