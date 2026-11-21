import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllEnrichedItems } from "@/features/shelves/queries";
import {
  doesWorkMatchGenreVolume,
  findGenreVolumeBySlug,
  LITERARY_GENRE_VOLUMES,
} from "@/features/shelves/genres";
import { ShelfItemsClient } from "@/components/ShelfItemsClient";
import { VirtualGenreShelf } from "@/components/VirtualGenreShelf";
import { EmptyState } from "@/components/EmptyState";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const genre = findGenreVolumeBySlug(slug);
  return {
    title: genre ? `${genre.title} · Estante Literária` : "Gênero Literário",
  };
}

export default async function GenreBooksPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const genreDef = findGenreVolumeBySlug(slug);
  if (!genreDef) {
    notFound();
  }

  const allItems = await getAllEnrichedItems();

  const countsBySlug: Record<string, number> = {};
  for (const vol of LITERARY_GENRE_VOLUMES) {
    countsBySlug[vol.slug] = allItems.filter((entry) =>
      doesWorkMatchGenreVolume(entry.work.primaryGenre, vol)
    ).length;
  }

  const matchingItems = allItems.filter((entry) =>
    doesWorkMatchGenreVolume(entry.work.primaryGenre, genreDef)
  );

  return (
    <div className="space-y-8">
      <nav
        aria-label="Trilha de navegação"
        className="text-xs text-[var(--text-muted)]"
      >
        <Link
          href="/estantes"
          className="underline hover:text-[var(--text-primary)]"
        >
          Minhas Estantes
        </Link>{" "}
        /{" "}
        <span>
          Ala {genreDef.num} · {genreDef.title}
        </span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="editorial-kicker">
            Ala Literária {genreDef.num} · {genreDef.canonicalGenre}
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-[var(--text-heading)]">
            Livros de {genreDef.title}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {genreDef.headline}
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Link
            href="/estantes"
            className="inline-flex min-h-[44px] items-center rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-4 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
          >
            ← Todas as estantes
          </Link>
          <Link
            href={`/adicionar?genero=${encodeURIComponent(genreDef.canonicalGenre)}`}
            className="inline-flex min-h-[44px] items-center rounded-[8px] bg-[var(--accent-primary)] px-4 text-sm font-semibold text-[var(--on-primary)] hover:bg-[var(--accent-primary-hover)]"
          >
            + Adicionar livro de {genreDef.canonicalGenre}
          </Link>
        </div>
      </header>

      {matchingItems.length === 0 ? (
        <EmptyState
          title={`Nenhum volume em "${genreDef.title}" ainda`}
          description={`Cadastre um livro com o gênero "${genreDef.canonicalGenre}" para que ele apareça automaticamente nesta ala literária.`}
          actionLabel={`Cadastrar livro em ${genreDef.canonicalGenre}`}
          actionHref={`/adicionar?genero=${encodeURIComponent(genreDef.canonicalGenre)}`}
        />
      ) : (
        <ShelfItemsClient items={matchingItems} />
      )}

      {/* Permite alternar diretamente para outra ala literária pela estante 3D */}
      <VirtualGenreShelf countsBySlug={countsBySlug} activeSlug={slug} />
    </div>
  );
}
