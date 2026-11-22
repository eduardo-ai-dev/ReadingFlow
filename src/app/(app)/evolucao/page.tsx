import type { Metadata } from "next";
import Link from "next/link";
import { getEvaluatedGoals } from "@/features/goals/queries";
import { getStatisticsView } from "@/features/stats/queries";
import { getDashboardEditorialData } from "@/features/dashboard/queries";
import { getReadingsOverview } from "@/features/reading/queries";
import { computeReadingForecast } from "@/lib/reading-metrics";
import { formatDisplayDatePtBr } from "@/lib/dates";
import { ProgressBar } from "@/components/ProgressBar";
import { GoalPaceBadge } from "@/components/StatusBadge";
import { GoalCardActionsClient } from "@/components/GoalCardActionsClient";
import { MetricFormulaHint } from "@/components/MetricFormulaHint";
import { CountUp } from "@/components/MotionPrimitives";
import { rfButtonClassName } from "@/components/ui/ActionControls";
import {
  TrendingUp,
  Target,
  BookOpen,
  Clock,
  Award,
  ArrowRight,
  Compass,
  Star,
  Timer,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Evolução (Estatísticas & Metas) — ReadingFlow",
};

const RATING_CHART_VARS = [
  "var(--rf-chart-1)",
  "var(--rf-chart-2)",
  "var(--rf-chart-3)",
  "var(--rf-chart-4)",
  "var(--rf-chart-5)",
] as const;

export default async function EvolucaoPage() {
  const [goalsData, statsView, editorialData, readings] = await Promise.all([
    getEvaluatedGoals(),
    getStatisticsView({ preset: "current_year" }),
    getDashboardEditorialData(),
    getReadingsOverview(),
  ]);

  const { stats } = statsView;
  const dailyPace = editorialData.metrics.dailyPace.value;
  const weeklyMonthMetric = editorialData.metrics.weeklyMonthAverage;
  const dailyPaceMetric = editorialData.metrics.dailyPace;
  const referenceDate = new Date(editorialData.referenceDateIso);
  const activePaginatedReadings = readings.active.filter(
    (entry) =>
      entry.reading.progressUnit === "pages" &&
      (entry.reading.progressTotal ?? entry.edition?.pages ?? 0) >
        entry.reading.progressValue
  );

  return (
    <div className="space-y-8 pb-10 sm:space-y-10">
      {/* Cabeçalho com marcador de seção e divisória fina */}
      <header className="flex flex-col gap-4 border-b border-[var(--rf-divider)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="rf-section-marker">
            01 · Evolução &amp; Métricas
          </span>
          <h1 className="rf-title-h1 mt-1.5 text-3xl text-[var(--rf-text-heading)] sm:text-4xl">
            Evolução (Estatísticas &amp; Metas)
          </h1>
          <p className="mt-1 font-sans text-xs text-[var(--rf-text-secondary)] sm:text-sm">
            Acompanhe seu avanço literário anual de forma serena e fundamentada.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/metas"
            className={rfButtonClassName({
              variant: "secondary",
              secondaryStyle: "outline",
              size: "sm",
              pill: true,
            })}
          >
            Configurar Metas
          </Link>
          <Link
            href="/estatisticas"
            className={rfButtonClassName({
              variant: "primary",
              size: "sm",
              pill: true,
            })}
          >
            Ver Ranking Completo
          </Link>
        </div>
      </header>

      {/* Estado vazio acolhedor para contas sem livros ou leituras registradas */}
      {stats.uniqueOwnedWorks === 0 &&
      stats.finishedReadingsCount === 0 &&
      stats.pagesRead === 0 ? (
        <section
          aria-labelledby="evolucao-vazia-titulo"
          data-testid="evolucao-empty-state"
          className="rf-panel flex flex-col items-start justify-between gap-5 border border-[var(--rf-border-accent-soft)] p-6 sm:p-8"
        >
          <div className="space-y-1.5">
            <span className="rf-section-marker">Comece no seu ritmo</span>
            <h2
              id="evolucao-vazia-titulo"
              className="font-serif text-2xl font-semibold text-[var(--rf-text-heading)]"
            >
              Sua evolução aparece aqui assim que você registrar suas leituras
            </h2>
            <p className="max-w-2xl font-sans text-xs leading-relaxed text-[var(--rf-text-secondary)] sm:text-sm">
              Nenhum dado de demonstração é misturado à sua conta. Adicione seu
              primeiro livro, registre páginas ou sessões no Canto de Foco e, se
              quiser, defina uma meta anual leve para acompanhar sua viabilidade
              real.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/adicionar"
              className={rfButtonClassName({
                variant: "primary",
                size: "md",
                pill: true,
              })}
            >
              Adicionar primeiro livro
            </Link>
            <Link
              href="/metas"
              className={rfButtonClassName({
                variant: "secondary",
                secondaryStyle: "outline",
                size: "md",
                pill: true,
              })}
            >
              Definir meta anual
            </Link>
            <Link
              href="/leitura/foco"
              className={rfButtonClassName({
                variant: "subtle",
                size: "md",
                pill: true,
              })}
            >
              Conhecer Canto de Foco
            </Link>
          </div>
        </section>
      ) : null}

      {/* Cartões de Indicadores Gerais do Ano */}
      <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
        <div className="rf-panel p-5 text-center">
          <div className="mb-2 inline-flex rounded-[var(--rf-radius-md)] bg-[var(--rf-accent-primary-subtle)] p-2.5 text-[var(--rf-text-accent-secondary)]">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="font-sans text-xs font-semibold text-[var(--rf-text-secondary)]">
            Leituras Concluídas
          </p>
          <p className="mt-1 font-serif text-3xl font-bold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-heading)] sm:text-4xl">
            <CountUp to={stats.finishedReadingsCount} />
          </p>
        </div>

        <div className="rf-panel p-5 text-center">
          <div className="mb-2 inline-flex rounded-[var(--rf-radius-md)] bg-[var(--rf-accent-secondary-subtle)] p-2.5 text-[var(--rf-text-accent-secondary)]">
            <TrendingUp className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="font-sans text-xs font-semibold text-[var(--rf-text-secondary)]">
            Páginas Lidas
          </p>
          <p className="mt-1 font-serif text-3xl font-bold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-heading)] sm:text-4xl">
            <CountUp to={stats.pagesRead} />
          </p>
        </div>

        <div className="rf-panel p-5 text-center">
          <div className="mb-2 inline-flex rounded-[var(--rf-radius-md)] bg-[var(--rf-status-success-bg)] p-2.5 text-[var(--rf-status-success)]">
            <Clock className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="font-sans text-xs font-semibold text-[var(--rf-text-secondary)]">
            Horas Ouvidas
          </p>
          <p className="mt-1 font-serif text-3xl font-bold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-heading)] sm:text-4xl">
            <CountUp to={stats.hoursListened} /> h
          </p>
        </div>

        <div className="rf-panel p-5 text-center">
          <div className="mb-2 inline-flex rounded-[var(--rf-radius-md)] bg-[var(--rf-status-info-bg)] p-2.5 text-[var(--rf-status-info)]">
            <Award className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="font-sans text-xs font-semibold text-[var(--rf-text-secondary)]">
            Obras no Acervo
          </p>
          <p className="mt-1 font-serif text-3xl font-bold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-heading)] sm:text-4xl">
            <CountUp to={stats.uniqueOwnedWorks} />
          </p>
        </div>
      </div>

      {/* Metas Ativas com Ritmo */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[var(--rf-divider)] pb-3">
          <div>
            <span className="rf-section-marker">02 · Metas Ativas</span>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-[var(--rf-text-heading)]">
              Metas de Leitura Ativas
            </h2>
          </div>
          <Link
            href="/metas"
            className="inline-flex min-h-[44px] items-center gap-1 rounded-[var(--rf-radius-xs)] px-1 font-sans text-xs font-semibold text-[var(--rf-text-accent-secondary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] lg:min-h-0"
          >
            Gerenciar metas{" "}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        {goalsData.entries.length === 0 ? (
          <div className="rf-panel p-8 text-center">
            <Target
              className="mx-auto mb-2 h-8 w-8 text-[var(--rf-text-accent-secondary)]"
              aria-hidden="true"
            />
            <p className="font-serif text-sm text-[var(--rf-text-primary)]">
              Nenhuma meta cadastrada no momento.
            </p>
            <Link
              href="/metas"
              className="mt-3 inline-flex min-h-[44px] items-center font-sans text-xs font-semibold text-[var(--rf-text-accent-secondary)] hover:underline lg:min-h-0"
            >
              Criar sua primeira meta anual ➔
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
            {goalsData.entries.map(({ goal, evaluation }) => (
              <div
                key={goal.id}
                className="rf-panel flex flex-col justify-between p-6"
              >
                <div>
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                    <h3 className="font-serif text-xl font-semibold text-[var(--rf-text-heading)]">
                      {goal.title}
                    </h3>
                    <GoalPaceBadge status={evaluation.paceStatus} />
                  </div>
                  <p className="mb-4 font-sans text-xs tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-secondary)]">
                    Período: {formatDisplayDatePtBr(goal.startsOn)} a{" "}
                    {formatDisplayDatePtBr(goal.endsOn)}
                  </p>
                  {/* Progresso em primeiro lugar */}
                  <p className="mb-2 font-serif text-2xl font-semibold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-heading)]">
                    {evaluation.progressHeadlinePtBr}
                  </p>
                  <ProgressBar
                    value={evaluation.progressPercent}
                    label={goal.title}
                  />

                  <p className="mt-3 inline-flex w-full items-start gap-2 rounded-[var(--rf-radius-md)] border border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)] px-3.5 py-2.5 font-sans text-xs font-medium tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-primary)]">
                    <Compass
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--rf-text-accent-secondary)]"
                      aria-hidden="true"
                    />
                    <span>{evaluation.concreteActionPtBr}</span>
                  </p>

                  {evaluation.hasEnoughData &&
                  evaluation.paceStatus !== "completed" &&
                  evaluation.paceStatus !== "paused" ? (
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 font-sans text-xs tabular-nums [font-variant-numeric:lining-nums_tabular-nums]">
                      <span className="font-semibold text-[var(--rf-text-accent-secondary)]">
                        Necessário: {evaluation.requiredPerDayFormatted}
                      </span>
                      <MetricFormulaHint
                        basisLabel="ver fórmula"
                        formula={evaluation.requiredFormulaTooltip}
                      />
                    </div>
                  ) : null}

                  {evaluation.realisticAlternativePtBr ? (
                    <p className="mt-2.5 rounded-[var(--rf-radius-sm)] border border-[var(--rf-border-secondary)] bg-[var(--rf-accent-secondary-subtle)] px-3 py-2 font-sans text-xs font-medium text-[var(--rf-text-accent-secondary)]">
                      {evaluation.realisticAlternativePtBr}
                    </p>
                  ) : null}

                  <GoalCardActionsClient
                    goalId={goal.id}
                    goalTitle={goal.title}
                    goalKind={goal.kind}
                    targetValue={goal.targetValue}
                    startsOn={goal.startsOn}
                    endsOn={goal.endsOn}
                    paused={goal.paused}
                    paceStatus={evaluation.paceStatus}
                    suggestedTargetValue={evaluation.suggestedTargetValue}
                    realisticAlternativePtBr={
                      evaluation.realisticAlternativePtBr
                    }
                    howToReachStepsPtBr={evaluation.howToReachStepsPtBr}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Projeção de Término & Ritmo Atual Construtivo */}
      <section aria-labelledby="projecao-titulo" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[var(--rf-divider)] pb-3">
          <div>
            <span className="rf-section-marker">
              03 · Ritmo &amp; Projeções
            </span>
            <h2
              id="projecao-titulo"
              className="mt-1 font-serif text-2xl font-semibold text-[var(--rf-text-heading)]"
            >
              Ritmo &amp; Projeção de Término
            </h2>
          </div>
          <p className="font-sans text-xs font-semibold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-accent-secondary)]">
            Ritmo atual: {weeklyMonthMetric.formatted} (
            {weeklyMonthMetric.basisLabel}) · {dailyPaceMetric.formatted} (
            {dailyPaceMetric.basisLabel} em{" "}
            {editorialData.monthly.activeDaysInMonth}{" "}
            {editorialData.monthly.activeDaysInMonth === 1
              ? "dia ativo"
              : "dias ativos"}
            )
          </p>
        </div>

        {activePaginatedReadings.length > 0 && dailyPace > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {activePaginatedReadings.map((entry) => {
              const total =
                entry.reading.progressTotal ?? entry.edition?.pages ?? 0;
              const forecast = computeReadingForecast({
                progressValue: entry.reading.progressValue,
                progressTotal: total,
                progressUnit: entry.reading.progressUnit,
                dailyPacePages: dailyPace,
                referenceDate,
                timeZone: editorialData.timezone,
              });
              if (!forecast) return null;
              return (
                <div key={entry.reading.id} className="rf-panel p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-serif text-lg font-semibold text-[var(--rf-text-heading)]">
                        {entry.work.title}
                      </h3>
                      <p className="font-sans text-xs text-[var(--rf-text-secondary)]">
                        {entry.primaryAuthor} · {entry.reading.progressValue} de{" "}
                        {total} páginas ({entry.percent}%)
                      </p>
                    </div>
                    <Link
                      href={`/leitura/foco?readingId=${entry.reading.id}`}
                      className={rfButtonClassName({
                        variant: "secondary",
                        secondaryStyle: "outline",
                        size: "sm",
                        pill: true,
                      })}
                    >
                      <Timer className="h-3.5 w-3.5" aria-hidden="true" />
                      Foco
                    </Link>
                  </div>
                  <p className="mt-3 rounded-[var(--rf-radius-md)] border border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)] px-3.5 py-2.5 font-sans text-xs font-medium tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-primary)]">
                    Previsão: {forecast.projectedDatePtBr} ·{" "}
                    {forecast.remainingText} ({forecast.basisLabel}).
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-start justify-between gap-4 rounded-[var(--rf-card-radius)] border border-[var(--rf-border-subtle)] bg-[var(--rf-surface-subtle)] p-5 sm:flex-row sm:items-center">
            <p className="font-sans text-sm text-[var(--rf-text-primary)]">
              Inicie uma sessão rápida no Canto de Foco para calcular seu ritmo
              semanal e a projeção de término dos seus livros atuais.
            </p>
            <Link
              href="/leitura/foco"
              className={rfButtonClassName({
                variant: "primary",
                size: "sm",
                pill: true,
              })}
            >
              <Timer className="h-3.5 w-3.5" aria-hidden="true" />
              Abrir Canto de Foco
            </Link>
          </div>
        )}
      </section>

      {/* Destaques Positivos & Resumo Geral da Coleção */}
      <section className="space-y-5">
        {stats.averageRating ? (
          <div className="rounded-[var(--rf-card-radius)] border border-[var(--rf-border-accent-soft)] bg-[var(--rf-surface-contrast)] p-6 text-[var(--rf-text-on-contrast)] shadow-[var(--rf-shadow-spotlight)] sm:p-8">
            <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
              <div className="space-y-2.5 lg:col-span-6">
                <p className="rf-type-label text-[var(--rf-text-on-contrast-muted)]">
                  Nota Média do Acervo
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 font-serif text-4xl font-bold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-on-contrast-muted)] sm:text-5xl">
                    <span>Nota média {stats.averageRating.toFixed(1)}</span>
                  </span>
                  <span
                    className="inline-flex items-center gap-0.5"
                    aria-label={`${stats.averageRating.toFixed(1)} de 5 estrelas`}
                  >
                    {[1, 2, 3, 4, 5].map((starIndex) => {
                      const filled = stats.averageRating! >= starIndex - 0.3;
                      return (
                        <Star
                          key={starIndex}
                          className={`h-5 w-5 ${
                            filled
                              ? "fill-[var(--rf-accent-primary)] text-[var(--rf-accent-primary)]"
                              : "text-[var(--rf-text-on-contrast-muted)] opacity-35"
                          }`}
                          aria-hidden="true"
                        />
                      );
                    })}
                  </span>
                  <span className="rounded-[var(--rf-radius-full)] border border-[var(--rf-border-accent-soft)] bg-[var(--rf-surface-contrast-elevated)] px-3 py-1 font-sans text-xs font-semibold tabular-nums text-[var(--rf-text-on-contrast)]">
                    {stats.ratedWorksCount}{" "}
                    {stats.ratedWorksCount === 1
                      ? "obra avaliada"
                      : "obras avaliadas"}
                  </span>
                </div>
                <p className="font-sans text-xs text-[var(--rf-text-on-contrast)] opacity-85 sm:text-sm">
                  Sua curadoria mantém alto índice de satisfação entre as obras
                  avaliadas do acervo.
                </p>
              </div>

              {/* Distribuição visual das avaliações usando paleta categórica CVD-safe */}
              <div className="space-y-2 rounded-[var(--rf-radius-lg)] border border-[var(--rf-border-accent-soft)] bg-[var(--rf-surface-contrast-elevated)] p-4 lg:col-span-4">
                <p className="rf-type-label text-[var(--rf-text-on-contrast-muted)]">
                  Distribuição das Notas
                </p>
                <div className="space-y-1.5">
                  {stats.ratingDistribution.map((bucket, idx) => (
                    <div
                      key={bucket.label}
                      className="flex items-center gap-2.5 font-sans text-xs tabular-nums"
                    >
                      <span className="w-12 shrink-0 text-[var(--rf-text-on-contrast)] opacity-90">
                        {bucket.label}
                      </span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-[var(--rf-radius-full)] bg-[var(--rf-surface-contrast)]">
                        <div
                          className="h-full rounded-[var(--rf-radius-full)]"
                          style={{
                            width: `${bucket.percent}%`,
                            backgroundColor:
                              RATING_CHART_VARS[idx % RATING_CHART_VARS.length],
                          }}
                        />
                      </div>
                      <span className="w-6 text-right font-semibold text-[var(--rf-text-on-contrast-muted)]">
                        {bucket.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-1">
                <div className="rounded-[var(--rf-radius-lg)] border border-[var(--rf-border-accent-soft)] bg-[var(--rf-surface-contrast-elevated)] px-4 py-3 text-center">
                  <p className="font-sans text-[11px] font-medium text-[var(--rf-text-on-contrast)] opacity-85">
                    Obras concluídas
                  </p>
                  <p className="mt-0.5 font-serif text-2xl font-bold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-on-contrast-muted)]">
                    {stats.finishedReadingsCount}
                  </p>
                </div>
                <div className="rounded-[var(--rf-radius-lg)] border border-[var(--rf-border-accent-soft)] bg-[var(--rf-surface-contrast-elevated)] px-4 py-3 text-center">
                  <p className="font-sans text-[11px] font-medium text-[var(--rf-text-on-contrast)] opacity-85">
                    Páginas somadas
                  </p>
                  <p className="mt-0.5 font-serif text-2xl font-bold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-on-contrast-muted)]">
                    {stats.pagesRead}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="rf-panel p-6 sm:p-8">
          <div className="mb-4 border-b border-[var(--rf-divider)] pb-3">
            <span className="rf-section-marker">04 · Resumo da Coleção</span>
            <h2 className="mt-1 font-serif text-xl font-semibold text-[var(--rf-text-heading)]">
              Resumo Geral da Coleção
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
            <div className="rounded-[var(--rf-radius-lg)] border border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)] p-4">
              <p className="font-sans text-xs font-semibold text-[var(--rf-text-secondary)]">
                Volumes Físicos e Digitais
              </p>
              <p className="mt-1 font-serif text-2xl font-bold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-heading)]">
                {stats.totalOwnedItems} itens
              </p>
            </div>
            <div className="rounded-[var(--rf-radius-lg)] border border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)] p-4">
              <p className="font-sans text-xs font-semibold text-[var(--rf-text-secondary)]">
                Ainda Não Lidos
              </p>
              <p className="mt-1 font-serif text-2xl font-bold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-heading)]">
                {stats.unreadOwnedItems} volumes
              </p>
            </div>
            <div className="rounded-[var(--rf-radius-lg)] border border-[var(--rf-border-accent-soft)] bg-[var(--rf-surface-contrast)] p-4 text-[var(--rf-text-on-contrast)] shadow-[var(--rf-shadow-xs)]">
              <p className="font-sans text-xs font-semibold text-[var(--rf-text-on-contrast)] opacity-90">
                Nota Média das Obras
              </p>
              <p className="mt-1 font-serif text-2xl font-bold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-on-contrast-muted)]">
                {stats.averageRating
                  ? `${stats.averageRating.toFixed(1)}★`
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
