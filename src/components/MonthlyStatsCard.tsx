import { formatNumberPtBr } from "@/lib/formatters";
import type { CompletedMonthsComparison } from "@/lib/reading-metrics";
import { MetricFormulaHint } from "@/components/MetricFormulaHint";
import { DashboardBlockEmpty } from "@/components/DashboardBlockState";

export function MonthlyStatsCard({
  monthly,
}: {
  monthly: {
    monthName: string;
    monthNameLower: string;
    pagesRead: number;
    booksFinished: number;
    audioHours: number;
    comparison: CompletedMonthsComparison | null;
  };
}) {
  const isEmpty =
    monthly.pagesRead === 0 &&
    monthly.booksFinished === 0 &&
    monthly.audioHours === 0;

  return (
    <section
      aria-labelledby="mensal-titulo"
      className="rf-card flex h-full flex-col"
    >
      <div className="border-b border-[var(--rf-divider)] pb-3.5">
        <p className="rf-type-label text-[var(--rf-text-accent-secondary)]">
          Consolidado Mensal
        </p>
        <h2 id="mensal-titulo" className="rf-type-section-title mt-0.5">
          {monthly.monthName}
        </h2>
      </div>

      {isEmpty ? (
        <DashboardBlockEmpty
          compact
          title={`Sem registros em ${monthly.monthNameLower}`}
          description="Atualize o progresso de uma leitura ou conclua um livro para consolidar os números deste mês."
          actionLabel="Registrar leitura"
          actionHref="/leitura"
        />
      ) : (
        <div className="mt-4 space-y-4">
          <dl className="rf-monthly-metrics">
            <div className="rf-monthly-cell">
              <dt className="rf-type-label text-[var(--rf-text-secondary)]">
                Páginas viradas
              </dt>
              <dd className="mt-1 font-serif text-2xl font-bold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-primary)]">
                {formatNumberPtBr(monthly.pagesRead)}
              </dd>
              <p className="rf-type-caption mt-0.5">
                lidas em {monthly.monthNameLower}
              </p>
            </div>

            <div className="rf-monthly-cell">
              <dt className="rf-type-label text-[var(--rf-text-secondary)]">
                Horas em áudio
              </dt>
              <dd className="mt-1 font-serif text-2xl font-bold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-primary)]">
                {monthly.audioHours}h
              </dd>
              <p className="rf-type-caption mt-0.5">
                ouvidas em {monthly.monthNameLower}
              </p>
            </div>

            <div className="rf-monthly-cell rf-monthly-cell-pace">
              <dt className="rf-type-label text-[var(--rf-text-secondary)]">
                Obras concluídas
              </dt>
              <dd className="mt-1 font-serif text-2xl font-bold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-primary)]">
                {formatNumberPtBr(monthly.booksFinished)}
              </dd>
              <p className="rf-type-caption mt-0.5">
                finalizadas em {monthly.monthNameLower}
              </p>
            </div>
          </dl>

          {monthly.comparison ? (
            <div className="border-t border-[var(--rf-divider)] pt-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="rf-type-label text-[var(--rf-text-secondary)]">
                  Comparativo de períodos completos
                </span>
                <span className="font-serif text-base font-bold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-primary)]">
                  {monthly.comparison.pagesDeltaPercent >= 0 ? "+" : ""}
                  {monthly.comparison.pagesDeltaPercent}% (
                  {monthly.comparison.pagesDelta >= 0 ? "+" : ""}
                  {formatNumberPtBr(monthly.comparison.pagesDelta)} pág.)
                </span>
              </div>
              <MetricFormulaHint
                basisLabel={monthly.comparison.basisLabel}
                formula={monthly.comparison.formulaTooltip}
                className="mt-0.5"
              />
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
