import type { Metadata } from "next";
import Link from "next/link";
import { getReadingsOverview } from "@/features/reading/queries";
import { formatDisplayDatePtBr } from "@/lib/dates";
import { BookCover } from "@/components/BookCover";
import { FormatBadge, ReadingStatusBadge } from "@/components/StatusBadge";
import { ProgressBar } from "@/components/ProgressBar";
import { QuickReadingUpdater } from "@/components/QuickReadingUpdater";
import { StartReadingButtonClient } from "@/components/StartReadingButtonClient";
import { StarRatingDisplay } from "@/components/StarRating";
import { EmptyState } from "@/components/EmptyState";

export const metadata: Metadata = {
  title: "Leitura",
};

export default async function ReadingPage() {
  const overview = await getReadingsOverview();

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="editorial-kicker">
            Módulo J · Estado independente da posse
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-[var(--text-heading)]">
            Acompanhamento de Leitura
          </h1>
        </div>
        <Link
          href="/adicionar"
          className="inline-flex min-h-[44px] items-center rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-4 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
        >
          + Registrar novo livro
        </Link>
      </header>

      {/* Leituras ativas e pausadas */}
      <section aria-labelledby="ativas-heading" className="space-y-4">
        <h2
          id="ativas-heading"
          className="font-serif text-xl font-semibold text-[var(--text-heading)]"
        >
          Em andamento ({overview.active.length + overview.paused.length})
        </h2>

        {overview.active.length === 0 && overview.paused.length === 0 ? (
          <EmptyState
            title="Nenhum livro em andamento"
            description="Escolha um volume não lido abaixo ou cadastre um livro emprestado para acompanhar seu progresso."
            actionLabel="Explorar estantes"
            actionHref="/estantes"
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {[...overview.active, ...overview.paused].map((entry) => (
              <article
                key={entry.reading.id}
                className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5"
              >
                <div className="flex gap-4">
                  <Link href={`/livros/${entry.work.id}`}>
                    <BookCover
                      title={entry.work.title}
                      author={entry.primaryAuthor}
                      coverUrl={entry.edition?.coverUrl}
                      size="md"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <ReadingStatusBadge status={entry.reading.status} />
                      <FormatBadge format={entry.reading.format} />
                      {entry.isReread ? (
                        <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
                          Releitura
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-2 font-serif text-lg font-semibold text-[var(--text-heading)]">
                      <Link
                        href={`/livros/${entry.work.id}`}
                        className="hover:underline"
                      >
                        {entry.work.title}
                      </Link>
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      {entry.primaryAuthor}
                    </p>
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between font-sans text-xs font-medium tabular-nums [font-variant-numeric:lining-nums_tabular-nums]">
                        <span>Concluído</span>
                        <span>{entry.percent}%</span>
                      </div>
                      <ProgressBar
                        value={entry.percent}
                        label={`Progresso de ${entry.work.title}`}
                      />
                    </div>
                  </div>
                </div>

                <QuickReadingUpdater
                  readingId={entry.reading.id}
                  initialUnit={entry.reading.progressUnit}
                  initialValue={entry.reading.progressValue}
                  total={entry.reading.progressTotal}
                />
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Fila de livros adquiridos ainda não lidos */}
      {overview.unreadOwnedWorks.length > 0 ? (
        <section aria-labelledby="fila-heading" className="space-y-3">
          <h2
            id="fila-heading"
            className="font-serif text-xl font-semibold text-[var(--text-heading)]"
          >
            Na sua estante aguardando leitura (
            {overview.unreadOwnedWorks.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {overview.unreadOwnedWorks.map((u) => (
              <div
                key={u.work.id}
                className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <BookCover
                    title={u.work.title}
                    author={u.primaryAuthor}
                    coverUrl={u.edition.coverUrl}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <Link
                      href={`/livros/${u.work.id}`}
                      className="block truncate font-serif text-base font-semibold text-[var(--text-heading)] hover:underline"
                    >
                      {u.work.title}
                    </Link>
                    <p className="truncate text-xs text-[var(--text-muted)]">
                      {u.primaryAuthor}
                    </p>
                  </div>
                </div>
                <StartReadingButtonClient
                  workId={u.work.id}
                  editionId={u.edition.id}
                  itemId={u.itemId}
                  format={u.edition.format}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Histórico de concluídos */}
      <section aria-labelledby="concluidos-heading" className="space-y-3">
        <h2
          id="concluidos-heading"
          className="font-serif text-xl font-semibold text-[var(--text-heading)]"
        >
          Concluídos ({overview.finished.length})
        </h2>
        {overview.finished.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            Nenhuma leitura concluída ainda.
          </p>
        ) : (
          <div className="overflow-hidden rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <ul className="divide-y divide-[var(--border-subtle)]">
              {overview.finished.map((entry) => (
                <li
                  key={entry.reading.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <BookCover
                      title={entry.work.title}
                      author={entry.primaryAuthor}
                      coverUrl={entry.edition?.coverUrl}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <Link
                        href={`/livros/${entry.work.id}`}
                        className="block truncate font-serif text-base font-semibold text-[var(--text-heading)] hover:underline"
                      >
                        {entry.work.title}
                      </Link>
                      <p className="truncate text-xs text-[var(--text-muted)]">
                        {entry.primaryAuthor}
                        {entry.reading.finishedOn
                          ? ` · Concluído em ${formatDisplayDatePtBr(entry.reading.finishedOn)}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {entry.review ? (
                      <StarRatingDisplay rating={entry.review.rating} />
                    ) : null}
                    <StartReadingButtonClient
                      workId={entry.work.id}
                      editionId={entry.edition?.id}
                      format={entry.reading.format}
                      label="Reler"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
