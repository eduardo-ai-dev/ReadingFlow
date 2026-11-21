"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { BookOpen, CheckCircle2, RotateCcw, TrendingUp } from "lucide-react";
import { BookCover } from "@/components/BookCover";
import {
  LANDING_PREVIEW_METRICS,
  LANDING_PREVIEW_SHELVES,
  type LandingPreviewTab,
} from "@/lib/landing.examples";

export function LandingProductPreview() {
  const [tab, setTab] = useState<LandingPreviewTab>("physical");
  const [addedPages, setAddedPages] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);
  const progressInView = useInView(progressRef, { once: true, amount: 0.35 });

  const books = LANDING_PREVIEW_SHELVES[tab];

  const {
    baseCurrentPage,
    totalBookPages,
    completedPrintedPages,
    digitalPages,
    audioHours,
    completedBooksInitial,
    goalBooksTarget,
    dailyPaceLabel,
  } = LANDING_PREVIEW_METRICS;

  const liveCurrentPage = Math.min(
    totalBookPages,
    baseCurrentPage + addedPages
  );
  const liveBookPercent = Math.round((liveCurrentPage / totalBookPages) * 100);
  const isCurrentBookFinished = liveCurrentPage >= totalBookPages;
  const remainingPagesInCurrentBook = Math.max(
    0,
    totalBookPages - liveCurrentPage
  );

  const completedBooksCount = isCurrentBookFinished
    ? completedBooksInitial + 1
    : completedBooksInitial;
  const remainingBooksCount = Math.max(
    0,
    goalBooksTarget - completedBooksCount
  );
  const liveGoalPercent = Math.round(
    ((completedBooksInitial +
      (liveCurrentPage - baseCurrentPage) /
        (totalBookPages - baseCurrentPage)) /
      goalBooksTarget) *
      100
  );
  const totalPrintedPages = completedPrintedPages + liveCurrentPage;

  function handleRegisterReading() {
    if (tab !== "physical") {
      setTab("physical");
    }
    setAddedPages((prev) =>
      Math.min(totalBookPages - baseCurrentPage, prev + 15)
    );
  }

  function handleResetDemo() {
    setAddedPages(0);
  }

  return (
    <div
      role="region"
      aria-label="Demonstração interativa da estante"
      data-landing-preview="true"
      className="overflow-hidden rounded-[var(--rf-radius-lg)] border border-[var(--rf-border-default)] bg-[var(--rf-surface-elevated)] text-[var(--rf-text-primary)] shadow-[var(--rf-shadow-lg)] transition-all duration-300 hover:border-[var(--rf-border-accent)]"
    >
      {/* Barra superior da prévia: apenas selo de exemplo + abas de formato (sem título duplicado) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[var(--rf-border-subtle)] bg-[var(--rf-surface-subtle)] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full bg-[var(--rf-progress-fill)]"
            aria-hidden="true"
          />
          <span
            data-badge="demo"
            className="badge rounded-[var(--rf-radius-full)] border border-[var(--rf-border-default)] bg-[var(--rf-surface-card-solid)] px-2.5 py-0.5 font-sans text-xs font-semibold text-[var(--rf-text-heading)]"
          >
            Exemplo · dados fictícios
          </span>
        </div>

        <div
          role="tablist"
          aria-label="Demonstração de estantes por formato"
          className="flex gap-1 rounded-[var(--rf-radius-md)] border border-[var(--rf-border-subtle)] bg-[var(--rf-surface-desk)] p-1"
        >
          {(
            [
              [
                "physical",
                `Física (${LANDING_PREVIEW_SHELVES.physical.length})`,
              ],
              [
                "digital",
                `Digital (${LANDING_PREVIEW_SHELVES.digital.length})`,
              ],
              ["audio", `Áudio (${LANDING_PREVIEW_SHELVES.audio.length})`],
            ] as const
          ).map(([key, label]) => {
            const active = tab === key;
            return (
              <button
                key={key}
                id={`preview-tab-${key}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`preview-panel-${key}`}
                aria-label={`Alternar para estante ${label}`}
                onClick={() => setTab(key)}
                className={`relative min-h-[34px] cursor-pointer rounded-[var(--rf-radius-sm)] px-3 font-sans text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${
                  active
                    ? "text-[var(--rf-tab-active-text)]"
                    : "text-[var(--rf-text-heading)] hover:text-[var(--rf-text-accent-secondary)]"
                }`}
              >
                {active ? (
                  <motion.span
                    layoutId="preview-shelf-tab"
                    aria-hidden="true"
                    className="absolute inset-0 rounded-[var(--rf-radius-sm)] bg-[var(--rf-tab-active-bg)] shadow-[var(--rf-shadow-xs)]"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                ) : null}
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Corpo vivo da estante e ritmo de leitura */}
      <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 lg:grid-cols-12">
        <div
          id={`preview-panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`preview-tab-${tab}`}
          className="min-w-0 lg:col-span-8"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: 10, y: 4 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: -10, y: -2 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-3"
            >
              {books.map((book) => {
                const isReadingNow = book.status === "Lendo agora";
                const displayedDetail =
                  isReadingNow && book.totalPages
                    ? `Pág. ${liveCurrentPage} de ${book.totalPages} (${liveBookPercent}%)`
                    : book.detail;

                return (
                  <div
                    key={book.id}
                    className={`group flex items-center gap-3.5 rounded-[var(--rf-radius-md)] border p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--rf-border-accent)] hover:shadow-[var(--rf-shadow-md)] ${
                      isReadingNow
                        ? "border-[var(--rf-border-accent)] border-l-[4px] border-l-[var(--rf-accent-primary)] bg-[var(--rf-surface-card-solid)] shadow-[var(--rf-shadow-sm)]"
                        : "border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)]"
                    }`}
                  >
                    <BookCover
                      size="sm"
                      title={book.title}
                      author={book.author}
                      coverUrl={book.coverUrl}
                      imageWidth={book.coverWidth}
                      imageHeight={book.coverHeight}
                      spineColor={book.spineColor}
                      seed={book.seed}
                      readingStatus={
                        isReadingNow
                          ? isCurrentBookFinished
                            ? "finished"
                            : "reading"
                          : "finished"
                      }
                      progressPercent={isReadingNow ? liveBookPercent : 100}
                      disableDevDiagnostics
                      sizes="64px"
                      className="group-hover:-translate-y-0.5"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                        <p className="min-w-0 font-serif text-[15px] font-semibold leading-snug text-[var(--rf-text-heading)] sm:truncate">
                          {book.title}
                        </p>

                        {isReadingNow ? (
                          <span
                            data-badge="status"
                            className="badge inline-flex items-center gap-1.5 rounded-[var(--rf-radius-full)] border border-[var(--rf-status-success)]/45 bg-[var(--rf-status-success-bg)] px-2.5 py-0.5 font-sans text-xs font-semibold tracking-wide text-[var(--rf-status-success)]"
                          >
                            <BookOpen
                              className="h-3 w-3 shrink-0"
                              aria-hidden="true"
                            />
                            {isCurrentBookFinished
                              ? "Concluído hoje"
                              : book.status}
                          </span>
                        ) : (
                          <span
                            data-badge="status"
                            className="badge inline-flex items-center gap-1 rounded-[var(--rf-radius-full)] border border-[var(--rf-border-subtle)] bg-[var(--rf-surface-subtle)] px-2.5 py-0.5 font-sans text-xs font-semibold text-[var(--rf-text-heading)]"
                          >
                            <CheckCircle2
                              className="h-3 w-3 shrink-0 text-[var(--rf-status-success)]"
                              aria-hidden="true"
                            />
                            {book.status}
                          </span>
                        )}
                      </div>

                      <p className="mt-0.5 truncate font-sans text-[13px] font-medium text-[var(--rf-text-secondary)]">
                        {book.author}
                      </p>

                      <p
                        data-metric="book-progress"
                        className="rf-metric mt-1.5 font-sans text-[13px] font-medium tabular-nums text-[var(--rf-text-primary)]"
                      >
                        {book.format} ·{" "}
                        <span className="font-semibold text-[var(--rf-text-accent-secondary)]">
                          {displayedDetail}
                        </span>
                      </p>

                      {isReadingNow ? (
                        <div className="mt-2">
                          <div
                            role="progressbar"
                            aria-label={`Progresso de leitura de ${book.title}`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={liveBookPercent}
                            className="h-2 w-full overflow-hidden rounded-[var(--rf-radius-full)] border border-[var(--rf-border-default)] bg-[var(--rf-progress-track)]"
                          >
                            <motion.div
                              initial={{ width: `${liveBookPercent}%` }}
                              animate={{ width: `${liveBookPercent}%` }}
                              transition={{
                                duration: 0.45,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                              className="h-full rounded-[var(--rf-radius-full)] bg-[var(--rf-progress-fill)]"
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Coluna direita: Meta Anual 2026 interativa */}
        <div
          ref={progressRef}
          className="min-w-0 flex flex-col justify-between gap-3.5 rounded-[var(--rf-radius-md)] border border-[var(--rf-border-subtle)] bg-[var(--rf-surface-subtle)] p-4 transition-all duration-300 hover:border-[var(--rf-border-accent)] lg:col-span-4"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="editorial-kicker font-sans text-[var(--rf-text-accent-secondary)] tabular-nums">
                Meta anual 2026
              </p>
              <span
                data-counter="goal-percent"
                className="rf-counter badge rounded-[var(--rf-radius-full)] border border-[var(--rf-border-default)] bg-[var(--rf-surface-card-solid)] px-2.5 py-0.5 font-sans text-xs font-semibold tabular-nums text-[var(--rf-text-heading)]"
              >
                {liveGoalPercent}%
              </span>
            </div>

            <p
              data-counter="goal-books"
              className="rf-counter mt-1 font-serif text-2xl font-semibold tabular-nums text-[var(--rf-text-heading)]"
            >
              {completedBooksCount} de {goalBooksTarget} livros
            </p>

            <div className="mt-2.5">
              <div
                role="progressbar"
                aria-label="Progresso de demonstração da meta anual"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={liveGoalPercent}
                className="h-3 w-full overflow-hidden rounded-[var(--rf-radius-full)] border border-[var(--rf-border-default)] bg-[var(--rf-progress-track)] shadow-inner"
              >
                <motion.div
                  initial={{ width: "67%" }}
                  animate={{
                    width: progressInView ? `${liveGoalPercent}%` : "67%",
                  }}
                  transition={{
                    duration: addedPages > 0 ? 0.45 : 0.9,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="h-full rounded-[var(--rf-radius-full)] bg-[var(--rf-progress-fill)]"
                />
              </div>
            </div>

            <p className="mt-2 font-sans text-[13px] font-medium leading-relaxed tabular-nums text-[var(--rf-text-primary)]">
              No ritmo esperado;{" "}
              {remainingBooksCount === 1
                ? "falta 1 livro para concluir a meta."
                : `faltam ${remainingBooksCount} livros para concluir a meta.`}
            </p>
          </div>

          {/* Bloco central: Ritmo factual + Ação interativa */}
          <div className="space-y-2.5 rounded-[var(--rf-radius-md)] border border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)] p-3">
            <div className="space-y-1.5 font-sans text-[13px] tabular-nums text-[var(--rf-text-primary)]">
              <div className="flex items-center gap-2">
                <TrendingUp
                  className="h-3.5 w-3.5 shrink-0 text-[var(--rf-status-success)]"
                  aria-hidden="true"
                />
                <span
                  data-metric="daily-pace"
                  className="rf-metric font-medium"
                >
                  Ritmo atual: {dailyPaceLabel}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen
                  className="h-3.5 w-3.5 shrink-0 text-[var(--rf-text-accent-secondary)]"
                  aria-hidden="true"
                />
                <span
                  data-metric="remaining-pages"
                  className="rf-metric font-medium"
                >
                  {remainingPagesInCurrentBook > 0
                    ? `Volume atual: faltam ${remainingPagesInCurrentBook} págs de ${totalBookPages}`
                    : `Volume atual concluído (${totalBookPages} págs)`}
                </span>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="button"
                aria-label="Registrar leitura de hoje adicionando 15 páginas na demonstração"
                onClick={handleRegisterReading}
                disabled={isCurrentBookFinished}
                className="inline-flex min-h-[38px] w-full cursor-pointer items-center justify-center rounded-[var(--rf-radius-md)] border border-[var(--rf-tab-active-bg)] bg-[var(--rf-tab-active-bg)] px-3 py-2 font-sans text-[13px] font-semibold tabular-nums text-[var(--rf-tab-active-text)] shadow-[var(--rf-shadow-xs)] transition-all duration-200 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>+ Registrar leitura de hoje (+15 págs)</span>
              </button>

              {addedPages > 0 ? (
                <div className="mt-1.5 flex items-center justify-between font-sans text-xs tabular-nums text-[var(--rf-status-success)]">
                  <span className="font-semibold">
                    +{addedPages} págs adicionadas
                  </span>
                  <button
                    type="button"
                    aria-label="Restaurar demonstração da estante ao estado inicial"
                    onClick={handleResetDemo}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-[var(--rf-radius-xs)] px-1 font-sans font-semibold text-[var(--rf-text-accent-secondary)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    Restaurar
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="border-t border-[var(--rf-divider)] pt-2.5 font-sans text-[13px] text-[var(--rf-text-primary)]">
            <p className="font-semibold text-[var(--rf-text-heading)]">
              Contagens separadas
            </p>
            <p
              data-metric="separate-counts"
              className="rf-metric mt-0.5 font-medium tabular-nums text-[var(--rf-text-secondary)]"
            >
              {totalPrintedPages} páginas impressas · {digitalPages} digitais ·{" "}
              {audioHours} em áudio
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
