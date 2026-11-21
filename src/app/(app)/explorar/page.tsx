import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Plus, ScanLine } from "lucide-react";
import {
  doesWorkMatchGenreVolume,
  LITERARY_GENRE_VOLUMES,
  resolveCanonicalGenre,
} from "@/features/shelves/genres";
import { getAllEnrichedItems } from "@/features/shelves/queries";
import { getWishlistOverview } from "@/features/wishlist/queries";
import { pickWishlistSuggestions } from "@/features/suggestions/rules";
import { requireAuthenticatedWorkspace } from "@/server/store/memory-repository";
import {
  ExplorarSearchAndDiscoveryClient,
  type ExplorarSearchItem,
} from "@/components/ExplorarSearchAndDiscoveryClient";
import { BookSuggestionsClient } from "@/components/BookSuggestionsClient";
import {
  ExplorarWishlistSectionClient,
  type ExplorarWishlistCardItem,
} from "@/components/ExplorarWishlistSectionClient";
import { rfButtonClassName } from "@/components/ui/ActionControls";

export const metadata: Metadata = {
  title: "Explorar / Adicionar Livros — ReadingFlow",
};

const READING_STATUS_PT: Record<string, string> = {
  not_started: "Não iniciado",
  reading: "Em andamento",
  paused: "Pausado",
  finished: "Concluído",
  abandoned: "Abandonado",
};

const GENRE_ACCENT_VARS = [
  "var(--rf-chart-1)",
  "var(--rf-chart-2)",
  "var(--rf-chart-3)",
  "var(--rf-chart-4)",
  "var(--rf-chart-5)",
  "var(--rf-chart-6)",
] as const;

export default async function ExplorarPage() {
  const [ws, allItems, wishlistOverview] = await Promise.all([
    requireAuthenticatedWorkspace(),
    getAllEnrichedItems(),
    getWishlistOverview(),
  ]);

  const wantedWishes = wishlistOverview.wanted;
  const ownedWorkIds = new Set(allItems.map((entry) => entry.work.id));
  const initialWishlistSuggestions = pickWishlistSuggestions(
    wantedWishes.map((entry) => ({
      wishId: entry.wish.id,
      workId: entry.work.id,
      status: entry.wish.status,
      title: entry.work.title,
      author: entry.primaryAuthor,
      genre: entry.work.primaryGenre,
      priority: entry.wish.priority,
      targetPrice: entry.wish.targetPrice,
      coverUrl: entry.edition?.coverUrl,
      spineColor: entry.edition?.coverColor,
      spineAccent: entry.edition?.coverAccentColor,
      seed: entry.edition?.isbn13 ?? entry.work.id,
      createdAt: entry.wish.createdAt,
    })),
    {
      ownedWorkIds,
      readings: ws.readings,
    }
  );

  const searchItems: ExplorarSearchItem[] = [
    ...allItems.map((entry) => ({
      id: entry.item.id,
      workId: entry.work.id,
      title: entry.work.title,
      author: entry.primaryAuthor,
      searchAuthors: entry.work.contributors.map((c) => c.name).join(" "),
      isbn13: entry.edition.isbn13,
      isbn10: entry.edition.isbn10,
      canonicalGenre: resolveCanonicalGenre(entry.work.primaryGenre).label,
      statusLabel:
        READING_STATUS_PT[entry.effectiveReadingStatus] ?? "Na estante",
      coverUrl: entry.edition.coverUrl,
      spineColor: entry.edition.coverColor,
      spineAccent: entry.edition.coverAccentColor,
      seed: entry.edition.isbn13 ?? entry.work.id,
      href: `/livros/${entry.work.id}`,
      isWishlist: false,
    })),
    ...wantedWishes.map((entry) => ({
      id: `wish-${entry.wish.id}`,
      workId: entry.work.id,
      title: entry.work.title,
      author: entry.primaryAuthor,
      searchAuthors: entry.work.contributors.map((c) => c.name).join(" "),
      isbn13: entry.edition?.isbn13,
      isbn10: entry.edition?.isbn10,
      canonicalGenre: resolveCanonicalGenre(entry.work.primaryGenre).label,
      statusLabel: "Lista de Desejos",
      coverUrl: entry.edition?.coverUrl,
      spineColor: entry.edition?.coverColor,
      spineAccent: entry.edition?.coverAccentColor,
      seed: entry.edition?.isbn13 ?? entry.work.id,
      href: "/desejos",
      isWishlist: true,
    })),
  ];

  const genreCounts = new Map<string, number>();
  for (const vol of LITERARY_GENRE_VOLUMES) {
    const count = allItems.filter((entry) =>
      doesWorkMatchGenreVolume(entry.work.primaryGenre, vol)
    ).length;
    genreCounts.set(vol.slug, count);
  }

  const wishlistCardItems: ExplorarWishlistCardItem[] = wantedWishes.map(
    (entry) => ({
      wishId: entry.wish.id,
      workId: entry.work.id,
      title: entry.work.title,
      author: entry.primaryAuthor,
      priority: entry.wish.priority,
      targetPrice: entry.wish.targetPrice,
      coverUrl: entry.edition?.coverUrl,
      spineColor: entry.edition?.coverColor,
      spineAccent: entry.edition?.coverAccentColor,
      seed: entry.edition?.isbn13 ?? entry.work.id,
    })
  );

  return (
    <div className="space-y-8 pb-10 sm:space-y-10">
      {/* Cabeçalho com marcador tipográfico e divisória fina */}
      <header className="flex flex-col gap-4 border-b border-[var(--rf-divider)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="rf-section-marker">
            01 · Explorar &amp; Descoberta
          </span>
          <h1 className="rf-title-h1 mt-1.5 text-3xl text-[var(--rf-text-heading)] sm:text-4xl">
            Explorar &amp; Adicionar Livros
          </h1>
          <p className="mt-1 text-xs text-[var(--rf-text-secondary)] sm:text-sm">
            Pesquise todo o seu acervo instantaneamente, gerencie desejos ou
            navegue pelos gêneros unificados.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/adicionar"
            className={rfButtonClassName({
              variant: "primary",
              size: "lg",
              pill: true,
            })}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Cadastrar Manualmente
          </Link>
        </div>
      </header>

      {/* Busca Global Proeminente */}
      <ExplorarSearchAndDiscoveryClient items={searchItems} />

      {/* Sugestões Interativas de Leitura: Lista de Desejos vs. Novos Livros */}
      <BookSuggestionsClient
        initialWishlistItems={initialWishlistSuggestions}
      />

      {/* Destaque Visual — Secção Lista de Desejos */}
      <div className="space-y-3">
        <div className="border-b border-[var(--rf-divider)] pb-2">
          <span className="rf-section-marker">02 · Lista de Desejos</span>
        </div>
        <ExplorarWishlistSectionClient items={wishlistCardItems} />
      </div>

      {/* Cartões Rápidos de Ação em painéis translúcidos */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
        <Link
          href="/adicionar"
          className="rf-panel group p-6 transition-all hover:border-[var(--rf-border-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
        >
          <div className="mb-4 inline-flex rounded-[var(--rf-radius-md)] bg-[var(--rf-accent-secondary-subtle)] p-3 text-[var(--rf-text-accent-secondary)] transition-transform group-hover:scale-105">
            <ScanLine className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="mb-2 font-serif text-xl font-semibold text-[var(--rf-text-heading)]">
            Scanner de Código de Barras
          </h2>
          <p className="text-xs text-[var(--rf-text-secondary)] sm:text-sm">
            Use a câmera do seu dispositivo para ler o código ISBN do livro
            físico e preencher dados automaticamente.
          </p>
        </Link>

        <Link
          href="/estante-3d"
          className="rf-panel group p-6 transition-all hover:border-[var(--rf-border-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
        >
          <div className="mb-4 inline-flex rounded-[var(--rf-radius-md)] bg-[var(--rf-accent-primary-subtle)] p-3 text-[var(--rf-text-accent-secondary)] transition-transform group-hover:scale-105">
            <BookOpen className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="mb-2 font-serif text-xl font-semibold text-[var(--rf-text-heading)]">
            Estante 3D &amp; Coleções
          </h2>
          <p className="text-xs text-[var(--rf-text-secondary)] sm:text-sm">
            Navegue pelos seus {allItems.length} volumes catalogados com filtros
            rápidos, lombadas 3D e reordenação livre.
          </p>
        </Link>
      </div>

      {/* Exploração por Gênero Literário (Taxonomia Unificada) */}
      <section className="space-y-5">
        <div className="border-b border-[var(--rf-divider)] pb-3">
          <span className="rf-section-marker">03 · Gêneros Literários</span>
          <h2 className="mt-1 font-serif text-2xl font-semibold text-[var(--rf-text-heading)]">
            Navegar por Gêneros Literários
          </h2>
          <p className="mt-1 text-xs text-[var(--rf-text-secondary)] sm:text-sm">
            Taxonomia unificada entre sua Estante 3D e as alas literárias para
            explorar ou adicionar obras.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
          {LITERARY_GENRE_VOLUMES.map((vol, idx) => {
            const count = genreCounts.get(vol.slug) ?? 0;
            return (
              <Link
                key={vol.slug}
                href={`/generos/${vol.slug}`}
                className="rf-panel flex flex-col justify-between p-4 transition-all hover:-translate-y-1 hover:border-[var(--rf-border-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
                style={{
                  borderLeftColor:
                    GENRE_ACCENT_VARS[idx % GENRE_ACCENT_VARS.length],
                  borderLeftWidth: "4px",
                }}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-[var(--rf-text-secondary)]">
                      Vol. {vol.num}
                    </span>
                    <span className="rounded-[var(--rf-radius-full)] bg-[var(--rf-accent-primary-subtle)] px-2 py-0.5 font-sans text-[10px] font-bold tabular-nums text-[var(--rf-text-heading)]">
                      {count}
                    </span>
                  </div>
                  <h3 className="mt-1.5 font-serif text-sm font-semibold text-[var(--rf-text-primary)]">
                    {vol.title}
                  </h3>
                  <p className="mt-0.5 font-sans text-[10px] text-[var(--rf-text-secondary)]">
                    {vol.canonicalGenre}
                  </p>
                </div>
                <p className="mt-3 text-[11px] italic text-[var(--rf-text-secondary)]">
                  {vol.sub}
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
