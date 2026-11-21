"use client";

import { memo, useMemo, useState } from "react";
import Link from "next/link";
import { BookCover } from "@/components/BookCover";
import { coverColor, extractAuthorSurname } from "@/lib/cover-color";
import type { CollectionSummaryItem } from "@/features/dashboard/queries";
import { DashboardBlockEmpty } from "@/components/DashboardBlockState";
import { FilterChip, rfButtonClassName } from "@/components/ui/ActionControls";

type CollectionFilterId =
  "all" | "reading" | "finished" | "wishlist" | "abandoned";

const EMPTY_TAB_COPY: Record<
  CollectionFilterId,
  {
    title: string;
    description: string;
    actionLabel: string;
    actionHref: string;
  }
> = {
  all: {
    title: "Seu acervo ainda está vazio",
    description:
      "Adicione seu primeiro livro por ISBN, busca ou cadastro manual para montar suas estantes.",
    actionLabel: "Adicionar livro",
    actionHref: "/adicionar",
  },
  reading: {
    title: "Nenhuma obra em andamento",
    description:
      "Inicie uma leitura a partir das suas estantes para acompanhá-la por aqui.",
    actionLabel: "Escolher na estante",
    actionHref: "/estantes",
  },
  finished: {
    title: "Nenhuma obra concluída ainda",
    description:
      "Ao finalizar uma leitura, ela passa a compor seu histórico de livros concluídos.",
    actionLabel: "Ver leituras",
    actionHref: "/leitura",
  },
  wishlist: {
    title: "Lista de desejos vazia",
    description:
      "Salve livros que pretende adquirir para acompanhar preços e próximas leituras.",
    actionLabel: "Abrir desejos",
    actionHref: "/desejos",
  },
  abandoned: {
    title: "Nenhuma leitura abandonada",
    description:
      "Livros interrompidos aparecem aqui quando você opta por pausar definitivamente uma leitura.",
    actionLabel: "Abrir estantes",
    actionHref: "/estantes",
  },
};

export const CollectionStatusOverview = memo(function CollectionStatusOverview({
  counts,
  books,
  wishlistBooks = [],
}: {
  counts: {
    ownedWorks?: number;
    favorites: number;
    reading: number;
    finished: number;
    wishlist: number;
    abandoned: number;
  };
  books: CollectionSummaryItem[];
  wishlistBooks?: CollectionSummaryItem[];
}) {
  const [filter, setFilter] = useState<CollectionFilterId>("all");

  const ownedCount = counts.ownedWorks ?? books.length;

  const filterTabs = [
    { id: "all", label: "Todos", count: ownedCount },
    { id: "reading", label: "Em andamento", count: counts.reading },
    { id: "finished", label: "Concluídos", count: counts.finished },
    { id: "wishlist", label: "Desejados", count: counts.wishlist },
    { id: "abandoned", label: "Abandonados", count: counts.abandoned },
  ] as const;

  const filteredBooks = useMemo(() => {
    if (filter === "wishlist") return wishlistBooks;
    return books.filter((b) => {
      if (filter === "all") return true;
      if (filter === "reading") return b.statusLabel === "Em andamento";
      if (filter === "finished") return b.statusLabel === "Concluído";
      if (filter === "abandoned") return b.statusLabel === "Abandonado";
      return true;
    });
  }, [books, wishlistBooks, filter]);

  const displayedBooks = useMemo(
    () => filteredBooks.slice(0, 12),
    [filteredBooks]
  );

  const neighborColors = useMemo(() => {
    const prevColors: Array<string | null> = [];
    let lastHex: string | null = null;
    for (const item of displayedBooks) {
      const seed = item.edition?.isbn13 ?? item.work.id;
      prevColors.push(lastHex);
      lastHex = coverColor(seed, lastHex);
    }
    return prevColors;
  }, [displayedBooks]);

  const emptyMeta = EMPTY_TAB_COPY[filter];

  return (
    <section aria-labelledby="colecao-titulo" className="rf-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--rf-divider)] pb-3.5">
        <div>
          <p className="rf-type-label text-[var(--rf-text-accent-secondary)]">
            Visão Geral do Acervo
          </p>
          <h2 id="colecao-titulo" className="rf-type-section-title mt-0.5">
            Coleção &amp; Prateleiras
          </h2>
        </div>

        <Link
          href="/estantes"
          className={rfButtonClassName({
            variant: "subtle",
            size: "sm",
            className: "-mr-2",
          })}
        >
          <span>Abrir estantes completas</span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>

      {/* FilterChip unificado */}
      <div
        role="tablist"
        aria-label="Filtrar acervo por situação"
        className="mt-4 flex flex-wrap gap-2"
      >
        {filterTabs.map((tab) => (
          <FilterChip
            key={tab.id}
            role="tab"
            label={tab.label}
            count={tab.count}
            active={filter === tab.id}
            onClick={() => setFilter(tab.id)}
          />
        ))}
      </div>

      {/* Grade de capas 2D sem sub-cards aninhados */}
      {displayedBooks.length === 0 ? (
        <div className="mt-4 border-t border-[var(--rf-divider)] pt-2">
          <DashboardBlockEmpty
            title={emptyMeta.title}
            description={emptyMeta.description}
            actionLabel={emptyMeta.actionLabel}
            actionHref={emptyMeta.actionHref}
          />
        </div>
      ) : (
        <div className="rf-collection-grid mt-5">
          {displayedBooks.map((item, idx) => (
            <Link
              key={item.work.id}
              href={`/livros/${item.work.id}`}
              className="group flex min-w-0 flex-col items-center rounded-[var(--rf-radius-md)] p-1.5 text-center transition-colors hover:bg-[var(--rf-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
            >
              <BookCover
                title={item.work.title}
                author={item.author}
                coverUrl={item.edition?.coverUrl}
                spineColor={item.edition?.coverColor}
                spineAccent={item.edition?.coverAccentColor}
                seed={item.edition?.isbn13 ?? item.work.id}
                avoidNeighborHex={neighborColors[idx]}
                size="sm"
                className="transition-transform group-hover:-translate-y-0.5"
              />
              <p className="mt-2 line-clamp-2 w-full font-serif text-[13px] font-semibold leading-snug text-[var(--rf-text-primary)] group-hover:text-[var(--rf-text-accent-secondary)]">
                {item.work.title}
              </p>
              <p className="rf-type-caption mt-0.5 line-clamp-1 w-full">
                {extractAuthorSurname(item.author)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
});
