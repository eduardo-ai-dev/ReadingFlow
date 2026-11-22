import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Plus, BookOpen } from "lucide-react";

import { getAllEnrichedItems } from "@/features/shelves/queries";
import { getWishlistOverview } from "@/features/wishlist/queries";
import { getUserSettings } from "@/features/settings/queries";
import {
  mapEnrichedItemToVirtualBook,
  mapWishlistEntryToVirtualBook,
  type ShelfQuickFilter,
  type VirtualBookItem,
} from "@/features/shelves/virtual-bookshelf";
import { EmptyBookshelfIllustration } from "@/components/EmptyBookshelfIllustration";
import type { BackfillBookTarget } from "@/components/BackfillCoversModal";
import { rfButtonClassName } from "@/components/ui/ActionControls";

const VirtualBookshelf = dynamic(
  () =>
    import("@/components/VirtualBookshelf").then((mod) => mod.VirtualBookshelf),
  {
    loading: () => (
      <div
        aria-hidden="true"
        className="grid gap-6 lg:grid-cols-[minmax(0,640px)_minmax(280px,1fr)]"
      >
        <div className="rf-card h-96 animate-pulse bg-[var(--rf-surface-subtle)]/50" />
        <div className="rf-card hidden h-80 animate-pulse bg-[var(--rf-surface-subtle)]/50 lg:block" />
      </div>
    ),
  }
);

const BackfillCoversModal = dynamic(() =>
  import("@/components/BackfillCoversModal").then(
    (mod) => mod.BackfillCoversModal
  )
);

export const metadata: Metadata = {
  title: "Minha Estante 3D — ReadingFlow",
  description:
    "Explore sua biblioteca pessoal em uma estante tridimensional interativa.",
};

type Estante3DPageProps = {
  searchParams: Promise<{
    tipo?: string;
    seed?: string;
  }>;
};

function buildVirtualBooks(
  allItems: Awaited<ReturnType<typeof getAllEnrichedItems>>
): VirtualBookItem[] {
  return allItems.map((entry) => mapEnrichedItemToVirtualBook(entry));
}

export default async function Estante3DPage({
  searchParams,
}: Estante3DPageProps) {
  const { tipo, seed } = await searchParams;

  const [allItems, wishlistOverview, userSettings] = await Promise.all([
    getAllEnrichedItems(),
    getWishlistOverview(),
    getUserSettings(),
  ]);

  const sortedItems = [...allItems].sort(
    (a, b) => a.item.shelfPosition - b.item.shelfPosition
  );

  const allVirtualBooks = buildVirtualBooks(sortedItems);
  const isDevSeedAllowed =
    process.env.NODE_ENV !== "production" || process.env.RF_DEV_SEED === "1";
  const virtualBooks =
    isDevSeedAllowed && seed === "6"
      ? allVirtualBooks.slice(0, 6)
      : allVirtualBooks;

  const wishlistVirtualBooks = wishlistOverview.wanted.map(
    mapWishlistEntryToVirtualBook
  );

  const initialQuickFilter: ShelfQuickFilter =
    tipo === "physical"
      ? "physical"
      : tipo === "digital" || tipo === "audio"
        ? "digital"
        : "all";

  const totalVolumes = virtualBooks.length;

  // Livros sem cover_url e não travados manualmente (deduplicados por edição) — backfill nunca altera capas travadas
  const seenMissingEditions = new Set<string>();
  const booksWithoutCover: BackfillBookTarget[] = [];
  for (const entry of sortedItems) {
    if (
      entry.edition.coverLocked ||
      entry.edition.coverUrl ||
      seenMissingEditions.has(entry.edition.id)
    ) {
      continue;
    }
    seenMissingEditions.add(entry.edition.id);
    booksWithoutCover.push({
      editionId: entry.edition.id,
      workId: entry.work.id,
      title: entry.work.title,
      author: entry.primaryAuthor,
      isbn: entry.edition.isbn13 ?? entry.edition.isbn10,
      spineColor: entry.edition.coverColor,
      spineAccent: entry.edition.coverAccentColor,
    });
  }

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-4 border-b border-[var(--rf-divider)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rf-section-marker">03 · Estante 3D</span>
            <Link
              href="/estantes"
              className={rfButtonClassName({ variant: "subtle", size: "sm" })}
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Ver modo Lista e Grade 2D
            </Link>
          </div>

          <div>
            <div className="mb-1 flex items-center gap-2">
              <BookOpen
                className="h-4 w-4 text-[var(--rf-text-accent-secondary)]"
                aria-hidden="true"
              />
              <span className="rf-type-label text-[var(--rf-text-secondary)]">
                Acervo pessoal · Arquitetura de Biblioteca
              </span>
            </div>

            <h1 className="rf-title-h1 text-3xl text-[var(--rf-text-heading)] sm:text-4xl">
              Minha Estante 3D
            </h1>

            <p className="mt-1 font-serif text-[13px] italic text-[var(--rf-text-secondary)] sm:text-sm">
              Passe o cursor sobre uma lombada para revelar a capa frontal real.{" "}
              <span className="not-italic tabular-nums">
                {totalVolumes} {totalVolumes === 1 ? "volume" : "volumes"}{" "}
                catalogados.
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <BackfillCoversModal
            booksWithoutCover={booksWithoutCover}
            variant="pill"
          />
          <Link
            href="/adicionar"
            className={rfButtonClassName({
              variant: "primary",
              size: "md",
              pill: true,
            })}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Adicionar Livro
          </Link>
        </div>
      </header>

      <section aria-label="Livros da biblioteca" className="relative">
        {virtualBooks.length > 0 || wishlistVirtualBooks.length > 0 ? (
          <VirtualBookshelf
            key={`${initialQuickFilter}-${virtualBooks.length}`}
            books={virtualBooks}
            wishlistBooks={wishlistVirtualBooks}
            initialShelfLayout={userSettings.shelfLayout}
            enableQuickFilters
            initialQuickFilter={initialQuickFilter}
          />
        ) : (
          <EmptyBookshelfIllustration
            title="Sua estante 3D aguarda o primeiro livro"
            description="Adicione seu primeiro título usando a busca com seletor de edição e capa para começar a preencher suas prateleiras."
            actionHref="/adicionar"
            actionLabel="Adicionar primeiro livro"
            secondaryHref="/explorar"
            secondaryLabel="Explorar gêneros"
          />
        )}
      </section>
    </div>
  );
}
