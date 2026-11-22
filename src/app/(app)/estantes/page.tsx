import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  getAllEnrichedItems,
  getShelvesOverview,
} from "@/features/shelves/queries";
import { getUserSettings } from "@/features/settings/queries";
import {
  filterAndSortShelfItems,
  type EnrichedShelfItem,
} from "@/features/shelves/rules";
import {
  doesWorkMatchGenreVolume,
  LITERARY_GENRE_VOLUMES,
} from "@/features/shelves/genres";
import {
  mapEnrichedItemToVirtualBook,
  type VirtualBookItem,
} from "@/features/shelves/virtual-bookshelf";
import type { ReadingStatus, Shelf, ShelfKind } from "@/lib/domain";
import { ptBR } from "@/lib/i18n/pt-BR";
import { ShelfItemsClient } from "@/components/ShelfItemsClient";
import type { BackfillBookTarget } from "@/components/BackfillCoversModal";
import { rfButtonClassName } from "@/components/ui/ActionControls";

const VirtualBookshelf = dynamic(
  () =>
    import("@/components/VirtualBookshelf").then((mod) => mod.VirtualBookshelf),
  {
    loading: () => (
      <div
        aria-hidden="true"
        className="rf-card h-64 w-full animate-pulse bg-[var(--rf-surface-subtle)]/50"
      />
    ),
  }
);

const VirtualGenreShelf = dynamic(
  () =>
    import("@/components/VirtualGenreShelf").then(
      (mod) => mod.VirtualGenreShelf
    ),
  {
    loading: () => (
      <div
        aria-hidden="true"
        className="rf-card h-44 w-full animate-pulse bg-[var(--rf-surface-subtle)]/50"
      />
    ),
  }
);

const BackfillCoversModal = dynamic(() =>
  import("@/components/BackfillCoversModal").then(
    (mod) => mod.BackfillCoversModal
  )
);

export const metadata: Metadata = {
  title: "Estantes",
};

export default async function ShelvesPage({
  searchParams,
}: {
  searchParams: Promise<{
    tipo?: string;
    q?: string;
    estado?: string;
    genero?: string;
    ordem?: string;
  }>;
}) {
  const sp = await searchParams;
  const activeKind: ShelfKind =
    sp.tipo === "digital" || sp.tipo === "audio" ? sp.tipo : "physical";

  const readingStatus = (sp.estado ?? "all") as ReadingStatus | "all";
  const genre = sp.genero ?? "all";
  const sortMode = (sp.ordem ?? undefined) as Shelf["sortMode"] | undefined;
  const query = sp.q ?? "";

  const [overview, allItems, userSettings] = await Promise.all([
    getShelvesOverview(activeKind, {
      query,
      readingStatus,
      genre,
      sortMode,
    }),
    getAllEnrichedItems(),
    getUserSettings(),
  ]);

  const countsBySlug: Record<string, number> = {};
  for (const vol of LITERARY_GENRE_VOLUMES) {
    countsBySlug[vol.slug] = allItems.filter((entry) =>
      doesWorkMatchGenreVolume(entry.work.primaryGenre, vol)
    ).length;
  }

  const virtualBooks: VirtualBookItem[] = allItems.map((entry) =>
    mapEnrichedItemToVirtualBook(entry)
  );

  const effectiveSort = sortMode ?? overview.activeShelf.sortMode;
  // Remove o array histórico dailyLogs do payload serializado para o cliente (ShelfItemsClient usa apenas progressValue/progressTotal/finishedOn)
  const slimForClient = (entries: EnrichedShelfItem[]): EnrichedShelfItem[] =>
    entries.map((entry) =>
      entry.latestReading?.dailyLogs
        ? {
            ...entry,
            latestReading: {
              ...entry.latestReading,
              dailyLogs: undefined,
            },
          }
        : entry
    );

  const itemsByKind: Record<ShelfKind, EnrichedShelfItem[]> = {
    physical: slimForClient(
      filterAndSortShelfItems(
        allItems.filter((e) => e.shelf.kind === "physical"),
        { query, readingStatus, genre, sortMode: effectiveSort }
      )
    ),
    digital: slimForClient(
      filterAndSortShelfItems(
        allItems.filter((e) => e.shelf.kind === "digital"),
        { query, readingStatus, genre, sortMode: effectiveSort }
      )
    ),
    audio: slimForClient(
      filterAndSortShelfItems(
        allItems.filter((e) => e.shelf.kind === "audio"),
        { query, readingStatus, genre, sortMode: effectiveSort }
      )
    ),
  };

  const tabs: Array<{ kind: ShelfKind; label: string; count: number }> = [
    {
      kind: "physical",
      label: ptBR.shelves.physical,
      count: overview.countsByKind.physical,
    },
    {
      kind: "digital",
      label: ptBR.shelves.digital,
      count: overview.countsByKind.digital,
    },
    {
      kind: "audio",
      label: ptBR.shelves.audio,
      count: overview.countsByKind.audio,
    },
  ];

  const seenMissingEditions = new Set<string>();
  const booksWithoutCover: BackfillBookTarget[] = [];
  for (const entry of allItems) {
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
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="editorial-kicker">Acervo pessoal</p>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-[var(--text-heading)]">
            Minha Estante
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <BackfillCoversModal
            booksWithoutCover={booksWithoutCover}
            variant="button"
          />
          <Link
            href="/adicionar"
            className={rfButtonClassName({ variant: "primary", size: "lg" })}
          >
            + Adicionar livro
          </Link>
        </div>
      </header>

      {/* Móvel único com prateleiras horizontais em largura total por gênero */}
      <VirtualBookshelf
        books={virtualBooks}
        initialShelfLayout={userSettings.shelfLayout}
      />

      {/* Índice rápido de Alas Literárias em 3D */}
      <VirtualGenreShelf countsBySlug={countsBySlug} />

      {/* Abas sem reset de scroll, busca/filtros e contêiner com min-height */}
      <ShelfItemsClient
        items={itemsByKind[activeKind]}
        shelfTabs={tabs}
        initialKind={activeKind}
        itemsByKind={itemsByKind}
        filterState={{
          query,
          readingStatus,
          sortMode: effectiveSort,
        }}
      />
    </div>
  );
}
