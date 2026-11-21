import { notFound } from "next/navigation";
import Link from "next/link";
import { getBookDetailById } from "@/features/catalog/queries";
import {
  computeReadingPercent,
  formatDurationPtBr,
} from "@/features/reading/rules";
import { formatDisplayDatePtBr } from "@/lib/dates";
import { BookCover } from "@/components/BookCover";
import { FormatBadge, ReadingStatusBadge } from "@/components/StatusBadge";
import { ProgressBar } from "@/components/ProgressBar";
import { QuickReadingUpdater } from "@/components/QuickReadingUpdater";
import { BookDetailActionsClient } from "@/components/BookDetailActionsClient";

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getBookDetailById(id);
  if (!detail) {
    notFound();
  }

  const { work, primaryEdition, items, readings, review } = detail;
  const primaryAuthor =
    work.contributors.find((c) => c.role === "author")?.name ??
    "Autor desconhecido";
  const activeReading = readings.find(
    (r) => r.status === "reading" || r.status === "paused"
  );
  const hasFinishedBefore = readings.some((r) => r.status === "finished");

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <nav
        aria-label="Trilha de navegação"
        className="text-xs text-[var(--text-muted)]"
      >
        <Link
          href="/estantes"
          className="underline hover:text-[var(--text-primary)]"
        >
          Estantes
        </Link>{" "}
        / <span>{work.title}</span>
      </nav>

      {/* Cabeçalho bibliográfico */}
      <section className="flex flex-col gap-6 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:flex-row sm:p-6">
        <BookCover
          title={work.title}
          author={primaryAuthor}
          coverUrl={primaryEdition.coverUrl}
          spineColor={primaryEdition.coverColor}
          spineAccent={primaryEdition.coverAccentColor}
          seed={primaryEdition.isbn13 ?? work.id}
          readingStatus={
            activeReading?.status ??
            (hasFinishedBefore ? "finished" : undefined)
          }
          progressPercent={
            activeReading
              ? computeReadingPercent({
                  progressUnit: activeReading.progressUnit,
                  progressValue: activeReading.progressValue,
                  progressTotal:
                    activeReading.progressTotal ?? primaryEdition.pages,
                })
              : undefined
          }
          size="lg"
        />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <FormatBadge format={primaryEdition.format} />
            {work.primaryGenre ? (
              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-0.5 text-xs text-[var(--text-muted)]">
                {work.primaryGenre}
              </span>
            ) : null}
            {activeReading ? (
              <ReadingStatusBadge status={activeReading.status} />
            ) : hasFinishedBefore ? (
              <ReadingStatusBadge status="finished" />
            ) : (
              <ReadingStatusBadge status="not_started" />
            )}
          </div>

          <h1 className="font-serif text-2xl font-semibold text-[var(--text-heading)] sm:text-3xl">
            {work.title}
          </h1>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {work.contributors
              .map((c) =>
                c.role === "author"
                  ? c.name
                  : `${c.name} (${c.role === "narrator" ? "Narração" : "Tradução"})`
              )
              .join(" · ")}
          </p>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-[var(--text-muted)]">Editora</dt>
              <dd className="font-medium text-[var(--text-primary)]">
                {primaryEdition.publisher ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">ISBN-13</dt>
              <dd className="font-mono font-medium text-[var(--text-primary)]">
                {primaryEdition.isbn13 ?? "Sem ISBN"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Extensão</dt>
              <dd className="font-medium text-[var(--text-primary)]">
                {primaryEdition.pages
                  ? `${primaryEdition.pages} páginas`
                  : primaryEdition.durationSeconds
                    ? formatDurationPtBr(primaryEdition.durationSeconds)
                    : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">
                Exemplares na estante
              </dt>
              <dd className="font-medium text-[var(--text-primary)]">
                {items.length > 0
                  ? `${items.length} (${items.map((i) => i.shelf?.name ?? "Estante").join(", ")})`
                  : "Somente leitura / desejos"}
              </dd>
            </div>
          </dl>

          {work.description ? (
            <p className="prose-reading pt-2 text-[var(--text-muted)]">
              {work.description}
            </p>
          ) : null}

          {items[0]?.notes ? (
            <div className="mt-3 rounded-[8px] border-l-2 border-[var(--accent-brass-decorative)] bg-[var(--bg-elevated)] px-4 py-2.5">
              <p className="editorial-kicker">Notas do exemplar</p>
              <p className="prose-reading mt-1">{items[0].notes}</p>
            </div>
          ) : null}
        </div>
      </section>

      {/* Progresso ativo se estiver lendo */}
      {activeReading ? (
        <section className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <h2 className="font-serif text-lg font-semibold text-[var(--text-heading)]">
            Progresso da leitura atual
          </h2>
          <div className="mt-2">
            <ProgressBar
              value={computeReadingPercent({
                progressUnit: activeReading.progressUnit,
                progressValue: activeReading.progressValue,
                progressTotal:
                  activeReading.progressTotal ?? primaryEdition.pages,
              })}
              label={`Progresso em ${work.title}`}
            />
          </div>
          <QuickReadingUpdater
            readingId={activeReading.id}
            initialUnit={activeReading.progressUnit}
            initialValue={activeReading.progressValue}
            total={activeReading.progressTotal ?? primaryEdition.pages}
          />
        </section>
      ) : null}

      {/* Ações, metadados e avaliação */}
      <BookDetailActionsClient
        work={work}
        edition={primaryEdition}
        firstItem={items[0]}
        activeReadingId={activeReading?.id}
        activeReadingStatus={
          activeReading?.status === "paused" ? "paused" : "reading"
        }
        hasFinishedBefore={hasFinishedBefore}
        existingReview={review}
      />

      {/* Histórico de leituras e releituras */}
      <section className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
        <h2 className="font-serif text-lg font-semibold text-[var(--text-heading)]">
          Histórico de leituras desta obra ({readings.length})
        </h2>
        {readings.length === 0 ? (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Nenhum ciclo de leitura iniciado para esta obra ainda.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border-subtle)] text-xs">
            {readings.map((r, idx) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <ReadingStatusBadge status={r.status} />
                  <span className="font-medium text-[var(--text-primary)]">
                    Ciclo #{readings.length - idx}
                  </span>
                  {r.abandonReason ? (
                    <span className="text-[var(--text-muted)]">
                      — Motivo: {r.abandonReason}
                    </span>
                  ) : null}
                </div>
                <span className="text-[var(--text-muted)]">
                  {r.startedOn
                    ? `Início: ${formatDisplayDatePtBr(r.startedOn)}`
                    : ""}
                  {r.finishedOn
                    ? ` · Conclusão: ${formatDisplayDatePtBr(r.finishedOn)}`
                    : ""}
                </span>
                {r.notes ? (
                  <p className="mt-1.5 w-full whitespace-pre-wrap rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs leading-relaxed text-[var(--text-primary)]">
                    {r.notes}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
