"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import type { BookFormat, ProgressUnit, ReadingStatus } from "@/lib/domain";
import { ptBR } from "@/lib/i18n/pt-BR";
import {
  computeReadingForecast,
  type MetricWithBasis,
} from "@/lib/reading-metrics";
import { formatNumberPtBr, formatRelativeTimePtBr } from "@/lib/formatters";
import { BookCover } from "@/components/BookCover";
import { QuickReadingUpdater } from "@/components/QuickReadingUpdater";
import { MetricFormulaHint } from "@/components/MetricFormulaHint";
import { DashboardBlockEmpty } from "@/components/DashboardBlockState";
import { FilterChip } from "@/components/ui/ActionControls";

export interface ActiveReadingSpotlightItem {
  readingId: string;
  workId: string;
  title: string;
  author: string;
  format: BookFormat;
  status: ReadingStatus;
  progressUnit: ProgressUnit;
  progressValue: number;
  progressTotal?: number;
  editionPages?: number;
  percent: number;
  isReread: boolean;
  updatedAt: string;
  coverUrl?: string;
  spineColor?: string;
  spineAccent?: string;
  seed: string;
}

export function ActiveReadingSpotlight({
  entries,
  dailyPace,
  referenceDateIso,
}: {
  entries: ActiveReadingSpotlightItem[];
  dailyPace: MetricWithBasis;
  referenceDateIso: string;
}) {
  // Garante ordenação do mais recente para o mais antigo
  const orderedEntries = useMemo(
    () =>
      [...entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [entries]
  );

  const [selectedId, setSelectedId] = useState<string>(
    orderedEntries[0]?.readingId ?? ""
  );
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const activeIndex = Math.max(
    0,
    orderedEntries.findIndex((item) => item.readingId === selectedId)
  );
  const current = orderedEntries[activeIndex] ?? null;

  if (!current) {
    return (
      <div className="rf-card">
        <DashboardBlockEmpty
          title="Nenhuma leitura aberta na cabeceira"
          description="Escolha um livro da sua fila de leituras ou abra suas estantes para começar a acompanhar seu ritmo."
          actionLabel="Escolher da fila"
          actionHref="/leitura"
          secondaryLabel="Abrir estantes"
          secondaryHref="/estantes"
        />
      </div>
    );
  }

  const effectiveTotal =
    current.progressTotal ??
    (current.progressUnit === "pages" ? current.editionPages : undefined);

  const forecast = computeReadingForecast({
    progressValue: current.progressValue,
    progressTotal: effectiveTotal,
    progressUnit: current.progressUnit,
    dailyPacePages: dailyPace.value,
    referenceDate: new Date(referenceDateIso),
  });

  const relativeRaw = formatRelativeTimePtBr(
    current.updatedAt,
    referenceDateIso
  );
  const updatedLabel = relativeRaw.startsWith("Há ")
    ? `Atualizado ${relativeRaw.charAt(0).toLowerCase()}${relativeRaw.slice(1)}`
    : relativeRaw === "Ontem"
      ? "Atualizado ontem"
      : `Atualizado em ${relativeRaw}`;

  const progressCaption =
    current.progressUnit === "pages" && effectiveTotal
      ? `Página ${formatNumberPtBr(current.progressValue)} de ${formatNumberPtBr(effectiveTotal)}`
      : current.progressUnit === "seconds"
        ? `${formatNumberPtBr(Math.round(current.progressValue / 60))} minutos ouvidos`
        : "Progresso atual";

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
    const count = orderedEntries.length;
    if (count < 2) return;
    let nextIdx: number | null = null;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % count;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + count) % count;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = count - 1;
    if (nextIdx !== null) {
      e.preventDefault();
      const target = orderedEntries[nextIdx];
      if (target) {
        setSelectedId(target.readingId);
        tabRefs.current[nextIdx]?.focus();
      }
    }
  };

  const tabPanelId = `spotlight-panel-${current.readingId}`;
  const activeTabId = `spotlight-tab-${current.readingId}`;

  return (
    <article
      data-rf-dark-block="spotlight"
      className="rf-card-spotlight"
      aria-label={`Leitura em andamento: ${current.title}`}
    >
      {/* Fita marca-página editorial no topo direito */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-6 top-0 h-14 w-6 bg-gradient-to-b from-[var(--rf-accent-secondary-on-dark-hover)] via-[var(--rf-accent-secondary)] to-[var(--rf-accent-secondary-hover)] shadow-[var(--rf-shadow-sm)]"
        style={{
          clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)",
        }}
      >
        <span className="absolute inset-x-1 top-0 bottom-3 border-x border-[var(--rf-border-accent-soft)]" />
      </span>

      {/* Seletor em abas unificado (FilterChip) quando houver 2 ou mais leituras ativas */}
      {orderedEntries.length >= 2 ? (
        <div className="mb-5 border-b border-[var(--rf-border-accent-soft)] pb-3 pr-10">
          <div
            role="tablist"
            aria-label="Alternar entre livros em andamento"
            className="flex flex-wrap gap-2"
          >
            {orderedEntries.map((item, idx) => {
              const isSelected = item.readingId === current.readingId;
              return (
                <FilterChip
                  key={item.readingId}
                  buttonRef={(el) => {
                    tabRefs.current[idx] = el;
                  }}
                  id={`spotlight-tab-${item.readingId}`}
                  role="tab"
                  tone="dark"
                  active={isSelected}
                  ariaControls={`spotlight-panel-${item.readingId}`}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setSelectedId(item.readingId)}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                >
                  <span className="max-w-[180px] truncate">{item.title}</span>
                  <span
                    className={
                      isSelected
                        ? "text-[var(--rf-accent-on-primary-muted)]"
                        : "text-[var(--rf-text-on-contrast-muted)]"
                    }
                  >
                    {item.percent}%
                  </span>
                </FilterChip>
              );
            })}
          </div>
        </div>
      ) : null}

      <div
        id={tabPanelId}
        role={orderedEntries.length >= 2 ? "tabpanel" : undefined}
        aria-labelledby={orderedEntries.length >= 2 ? activeTabId : undefined}
      >
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <Link
            href={`/livros/${current.workId}`}
            className="group mx-auto shrink-0 rounded-[var(--rf-radius-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] md:mx-0"
            aria-label={`Abrir ficha de ${current.title}`}
          >
            <BookCover
              title={current.title}
              author={current.author}
              coverUrl={current.coverUrl}
              spineColor={current.spineColor}
              spineAccent={current.spineAccent}
              seed={current.seed}
              readingStatus={current.status}
              progressPercent={current.percent}
              size="lg"
              priority
              className="transition-transform group-hover:scale-[1.03]"
            />
          </Link>

          <div className="flex min-w-0 flex-1 flex-col justify-between pr-2 sm:pr-8">
            <div>
              {/* Meta superior: formato + releitura + atualizado há… */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="inline-flex items-center rounded-[var(--rf-radius-sm)] border border-[var(--rf-border-accent-soft)] bg-[var(--rf-surface-contrast-elevated)] px-2.5 py-0.5 font-sans text-[13px] font-semibold text-[var(--rf-text-on-contrast-muted)]">
                  {ptBR.formats[current.format]}
                </span>
                {current.isReread ? (
                  <span className="rounded-[var(--rf-radius-full)] border border-[var(--rf-border-accent-soft)] px-2.5 py-0.5 font-sans text-[13px] font-semibold text-[var(--rf-text-on-contrast-muted)]">
                    Releitura
                  </span>
                ) : null}
                <time
                  dateTime={current.updatedAt}
                  className="inline-flex items-center gap-1.5 font-sans text-[13px] font-medium text-[var(--rf-text-on-contrast)] opacity-85"
                >
                  <Clock
                    className="h-3.5 w-3.5 text-[var(--rf-text-on-contrast-muted)]"
                    aria-hidden="true"
                  />
                  <span>{updatedLabel}</span>
                </time>
              </div>

              <h3 className="mt-2.5 font-serif text-2xl font-bold leading-tight text-[var(--rf-text-on-contrast)] sm:text-3xl">
                <Link
                  href={`/livros/${current.workId}`}
                  className="transition-colors hover:text-[var(--rf-text-on-contrast-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
                >
                  {current.title}
                </Link>
              </h3>

              <p className="mt-1 font-sans text-sm font-medium text-[var(--rf-text-on-contrast-muted)]">
                {current.author}
              </p>
            </div>

            {/* Progresso e barra de destaque + previsão */}
            <div className="mt-5 border-t border-[var(--rf-border-accent-soft)] pt-4">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="font-sans text-[13px] font-semibold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-on-contrast)]">
                  {progressCaption}
                </span>
                <span className="font-serif text-xl font-bold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-on-contrast-muted)]">
                  {current.percent}%
                </span>
              </div>

              <div
                role="progressbar"
                aria-valuenow={current.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progresso de leitura em ${current.title}: ${current.percent}%`}
                className="h-2 w-full overflow-hidden rounded-[var(--rf-radius-full)] bg-[var(--rf-surface-contrast-elevated)]"
              >
                <div
                  className="h-full rounded-[var(--rf-radius-full)] bg-gradient-to-r from-[var(--rf-accent-primary)] to-[var(--rf-accent-primary-hover)] transition-all duration-500"
                  style={{ width: `${current.percent}%` }}
                />
              </div>

              <div className="mt-3.5 border-t border-[var(--rf-border-accent-soft)] pt-3">
                <p className="rf-type-label text-[var(--rf-text-on-contrast-muted)]">
                  Previsão de término
                </p>
                {forecast ? (
                  <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="font-serif text-base font-semibold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-on-contrast)]">
                      {forecast.projectedDatePtBr}
                    </p>
                    <MetricFormulaHint
                      basisLabel={forecast.remainingText}
                      formula={forecast.formulaTooltip}
                      tone="dark"
                    />
                  </div>
                ) : (
                  <p className="mt-1 font-sans text-[13px] text-[var(--rf-text-on-contrast)] opacity-85">
                    {current.progressUnit === "pages"
                      ? "Atualize seu progresso para calcular a previsão de término."
                      : "Previsão por páginas disponível em livros paginados."}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Controles únicos de atualização, atalhos rápidos, foco e conclusão */}
        <div className="mt-5 border-t border-[var(--rf-border-accent-soft)]">
          <QuickReadingUpdater
            key={current.readingId}
            variant="inline"
            enableQuickShortcuts
            readingId={current.readingId}
            initialUnit={current.progressUnit}
            initialValue={current.progressValue}
            total={effectiveTotal}
            focusHref={`/leitura/foco?readingId=${current.readingId}`}
          />
        </div>
      </div>
    </article>
  );
}
