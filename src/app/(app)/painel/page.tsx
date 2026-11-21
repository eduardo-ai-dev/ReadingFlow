import type { Metadata } from "next";
import Link from "next/link";
import { BookMarked, Flame } from "lucide-react";
import { requireAuthenticatedWorkspace } from "@/server/store/memory-repository";
import { getReadingsOverview } from "@/features/reading/queries";
import { getEvaluatedGoals } from "@/features/goals/queries";
import { getStatisticsView } from "@/features/stats/queries";
import { getAutomaticRankingView } from "@/features/ratings/queries";
import { getDashboardEditorialData } from "@/features/dashboard/queries";
import { formatFullDatePtBr, formatNumberPtBr } from "@/lib/formatters";
import { BookCover } from "@/components/BookCover";
import { GoalPaceBadge } from "@/components/StatusBadge";
import { StarRatingDisplay } from "@/components/StarRating";
import {
  ActiveReadingSpotlight,
  type ActiveReadingSpotlightItem,
} from "@/components/ActiveReadingSpotlight";
import { ReadingStreakCard } from "@/components/ReadingStreakCard";
import { RecentActivityFeed } from "@/components/RecentActivityFeed";
import { MonthlyStatsCard } from "@/components/MonthlyStatsCard";
import { CollectionStatusOverview } from "@/components/CollectionStatusOverview";
import { MetricFormulaHint } from "@/components/MetricFormulaHint";
import {
  DashboardBlockEmpty,
  DashboardBlockError,
} from "@/components/DashboardBlockState";
import { rfButtonClassName } from "@/components/ui/ActionControls";

export const metadata: Metadata = {
  title: "Painel · Mesa de Leitura",
};

export default async function DashboardPage() {
  await requireAuthenticatedWorkspace();

  const [
    readingsResult,
    goalsResult,
    statsResult,
    rankingResult,
    editorialResult,
  ] = await Promise.allSettled([
    getReadingsOverview(),
    getEvaluatedGoals(),
    getStatisticsView({ preset: "current_year" }),
    getAutomaticRankingView(),
    getDashboardEditorialData(),
  ]);

  const readings =
    readingsResult.status === "fulfilled" ? readingsResult.value : null;
  const goalsData =
    goalsResult.status === "fulfilled" ? goalsResult.value : null;
  const statsData =
    statsResult.status === "fulfilled" ? statsResult.value : null;
  const ranking =
    rankingResult.status === "fulfilled" ? rankingResult.value : null;
  const editorialData =
    editorialResult.status === "fulfilled" ? editorialResult.value : null;

  const stats = statsData?.stats ?? null;
  const statsYear = statsData?.periodStartYmd.slice(0, 4) ?? "2026";
  const todayFormatted = formatFullDatePtBr(new Date());

  const activeSpotlightEntries: ActiveReadingSpotlightItem[] = readings
    ? readings.active.map((entry) => ({
      readingId: entry.reading.id,
      workId: entry.work.id,
      title: entry.work.title,
      author: entry.primaryAuthor,
      format: entry.reading.format,
      status: entry.reading.status,
      progressUnit: entry.reading.progressUnit,
      progressValue: entry.reading.progressValue,
      progressTotal: entry.reading.progressTotal,
      editionPages: entry.edition?.pages,
      percent: entry.percent,
      isReread: entry.isReread,
      updatedAt: entry.reading.updatedAt,
      coverUrl: entry.edition?.coverUrl,
      spineColor: entry.edition?.coverColor,
      spineAccent: entry.edition?.coverAccentColor,
      seed: entry.edition?.isbn13 ?? entry.work.id,
    }))
    : [];

  const nextUpBook = (() => {
    if (readings?.paused[0]) {
      const p = readings.paused[0];
      return {
        workId: p.work.id,
        title: p.work.title,
        author: p.primaryAuthor,
        contextLabel: `Leitura pausada · ${p.percent}%`,
        coverUrl: p.edition?.coverUrl,
        spineColor: p.edition?.coverColor,
        spineAccent: p.edition?.coverAccentColor,
        seed: p.edition?.isbn13 ?? p.work.id,
      };
    }

    if (readings?.unreadOwnedWorks[0]) {
      const u = readings.unreadOwnedWorks[0];
      return {
        workId: u.work.id,
        title: u.work.title,
        author: u.primaryAuthor,
        contextLabel: "Na estante aguardando leitura",
        coverUrl: u.edition.coverUrl,
        spineColor: u.edition.coverColor,
        spineAccent: u.edition.coverAccentColor,
        seed: u.edition.isbn13 ?? u.work.id,
      };
    }

    const activeWorkIds = new Set(
      (readings?.active ?? []).map((entry) => entry.work.id)
    );
    const fallbackWish = editorialData?.collectionOverview.wishlistBooks.find(
      (item) => !activeWorkIds.has(item.work.id)
    );
    if (fallbackWish) {
      return {
        workId: fallbackWish.work.id,
        title: fallbackWish.work.title,
        author: fallbackWish.author,
        contextLabel: "Lista de desejos",
        coverUrl: fallbackWish.edition?.coverUrl,
        spineColor: fallbackWish.edition?.coverColor,
        spineAccent: fallbackWish.edition?.coverAccentColor,
        seed: fallbackWish.edition?.isbn13 ?? fallbackWish.work.id,
      };
    }

    return null;
  })();

  return (
    <div className="rf-dashboard-shell">
      {/* ====================================================================
          01 · CABEÇALHO EDITORIAL + FAIXA DE INDICADORES (KPIs)
          ==================================================================== */}
      <section aria-labelledby="mesa-leitura-titulo">
        <header className="border-y border-[var(--rf-divider)] py-4 sm:py-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rf-section-marker">01 · Mesa de Leitura</span>
            <p className="rf-type-label text-[var(--rf-text-secondary)]">
              {todayFormatted}
            </p>
          </div>

          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
            <h1 id="mesa-leitura-titulo" className="rf-type-page-title">
              Caderno de Leitura
            </h1>

            {stats && readings ? (
              <p className="font-serif text-sm italic tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-secondary)]">
                Acervo pessoal atualizado ·{" "}
                <strong className="font-semibold text-[var(--rf-text-accent-secondary)]">
                  {readings.active.length}{" "}
                  {readings.active.length === 1
                    ? "leitura em andamento"
                    : "leituras em andamento"}
                </strong>
              </p>
            ) : null}
          </div>
        </header>

        {!stats ? (
          <div className="mt-6">
            <DashboardBlockError
              eyebrow="Indicadores do Acervo"
              title="Resumo numérico indisponível"
            />
          </div>
        ) : (
          <dl
            aria-label="Indicadores principais do acervo"
            className="grid grid-cols-2 divide-y divide-[var(--rf-divider)] border-b border-[var(--rf-divider)] py-3 md:grid-cols-4 md:divide-y-0"
          >
            <div className="py-3 pr-3 md:border-r md:border-[var(--rf-divider)] md:pr-5">
              <dt className="rf-type-label text-[var(--rf-text-accent-secondary)]">
                Obras no Acervo
              </dt>
              <dd className="rf-type-kpi mt-1.5">
                {formatNumberPtBr(stats.uniqueOwnedWorks)}
              </dd>
              <p className="rf-type-caption mt-1">Volumes únicos catalogados</p>
            </div>

            <div className="py-3 pl-3 md:border-r md:border-[var(--rf-divider)] md:px-5">
              <dt className="rf-type-label text-[var(--rf-text-secondary)]">
                Lidos no Ano
              </dt>
              <dd className="rf-type-kpi mt-1.5">
                {formatNumberPtBr(stats.finishedReadingsCount)}
              </dd>
              <p className="rf-type-caption mt-1">Concluídos em {statsYear}</p>
            </div>

            <div className="py-3 pr-3 md:border-r md:border-[var(--rf-divider)] md:px-5">
              <dt className="rf-type-label text-[var(--rf-text-secondary)]">
                Páginas Viradas
              </dt>
              <dd className="rf-type-kpi mt-1.5">
                {formatNumberPtBr(stats.pagesRead)}
              </dd>
              <MetricFormulaHint
                basisLabel={`total em ${statsYear}`}
                formula={`Soma das páginas lidas em obras concluídas e em andamento no ano de ${statsYear} (físico e digital).`}
                className="mt-1"
              />
            </div>

            <div className="py-3 pl-3 md:pl-5">
              <dt className="rf-type-label text-[var(--rf-text-secondary)]">
                Em Audiolivros
              </dt>
              <dd className="rf-type-kpi mt-1.5">
                {stats.hoursListened}
                <span className="ml-0.5 text-2xl font-normal not-italic">
                  h
                </span>
              </dd>
              <p className="rf-type-caption mt-1">Tempo ouvido em {statsYear}</p>
            </div>
          </dl>
        )}
      </section>

      {/* ====================================================================
          02 · NA CABECEIRA (8/12) + RITMO & SESSÃO + PRÓXIMO NA FILA (4/12)
          ==================================================================== */}
      <section aria-labelledby="na-cabeceira-titulo" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <span className="rf-section-marker">02 · Na Cabeceira</span>
            <h2
              id="na-cabeceira-titulo"
              className="rf-type-section-title mt-1"
            >
              Leitura em Andamento ({activeSpotlightEntries.length})
            </h2>
          </div>

          <Link
            href="/leitura"
            className={rfButtonClassName({
              variant: "subtle",
              size: "sm",
              className: "-mr-2",
            })}
          >
            <span>Ver todas as leituras</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="rf-dashboard-band">
          {/* Coluna principal (8/12): único bloco escuro + único CTA "Iniciar Foco" */}
          <div className="rf-dashboard-main">
            <div data-rf-block="spotlight">
              {!readings || !editorialData ? (
                <DashboardBlockError
                  eyebrow="Na Cabeceira"
                  title="Leitura em Andamento"
                />
              ) : (
                <ActiveReadingSpotlight
                  entries={activeSpotlightEntries}
                  dailyPace={editorialData.metrics.dailyPace}
                  referenceDateIso={editorialData.referenceDateIso}
                />
              )}
            </div>
          </div>

          {/* Coluna lateral (4/12 em >= 1200px; 2 colunas abaixo em 768–1199px) */}
          <div className="rf-dashboard-aside">
            {/* Ritmo & Sessão: ÚNICO lugar com ritmo médio e média semanal (sem repetir Metas nem Iniciar Foco) */}
            {!editorialData ? (
              <div data-rf-block="pace">
                <DashboardBlockError
                  eyebrow="Companheiro de Leitura"
                  title="Ritmo & Sessão"
                  className="h-full"
                />
              </div>
            ) : (
              <section
                data-rf-block="pace"
                aria-labelledby="ritmo-sessao-titulo"
                className="rf-card flex h-full flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 border-b border-[var(--rf-divider)] pb-3.5">
                    <div>
                      <p className="rf-type-label text-[var(--rf-text-accent-secondary)]">
                        Companheiro de Leitura
                      </p>
                      <h2
                        id="ritmo-sessao-titulo"
                        className="rf-type-section-title mt-0.5"
                      >
                        Ritmo &amp; Sessão
                      </h2>
                    </div>
                    <Flame
                      className="h-4 w-4 shrink-0 text-[var(--rf-text-accent-secondary)]"
                      aria-hidden="true"
                    />
                  </div>

                  {editorialData.metrics.activeDaysInMonth === 0 ? (
                    <DashboardBlockEmpty
                      compact
                      title="Sem ritmo calculado no mês"
                      description="Registre o avanço de uma leitura para acompanhar sua média diária, semanal e frequência."
                      actionLabel="Ir para Leituras"
                      actionHref="/leitura"
                    />
                  ) : (
                    <dl className="mt-1.5 divide-y divide-[var(--rf-divider)]">
                      {/* Ritmo diário nos dias ativos (única ocorrência na tela) */}
                      <div className="py-2.5 first:pt-1.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <dt className="rf-type-label text-[var(--rf-text-secondary)]">
                            Ritmo diário
                          </dt>
                          <dd className="font-serif text-xl font-bold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-accent-secondary)]">
                            {editorialData.metrics.dailyPace.formatted}
                          </dd>
                        </div>
                        <MetricFormulaHint
                          basisLabel={editorialData.metrics.dailyPace.basisLabel}
                          formula={
                            editorialData.metrics.dailyPace.formulaTooltip
                          }
                          className="mt-0.5"
                        />
                      </div>

                      {/* Média semanal do mês */}
                      <div className="py-2.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <dt className="rf-type-label text-[var(--rf-text-secondary)]">
                            Média semanal
                          </dt>
                          <dd className="font-serif text-lg font-bold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-primary)]">
                            {editorialData.metrics.weeklyMonthAverage.formatted}
                          </dd>
                        </div>
                        <MetricFormulaHint
                          basisLabel={
                            editorialData.metrics.weeklyMonthAverage.basisLabel
                          }
                          formula={
                            editorialData.metrics.weeklyMonthAverage
                              .formulaTooltip
                          }
                          className="mt-0.5"
                        />
                      </div>

                      {/* Frequência semanal de leitura no mês */}
                      <div className="py-2.5 last:pb-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <dt className="rf-type-label text-[var(--rf-text-secondary)]">
                            Frequência
                          </dt>
                          <dd className="font-serif text-lg font-bold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-primary)]">
                            {editorialData.metrics.readingFrequency.formatted}
                          </dd>
                        </div>
                        <MetricFormulaHint
                          basisLabel={
                            editorialData.metrics.readingFrequency.basisLabel
                          }
                          formula={
                            editorialData.metrics.readingFrequency
                              .formulaTooltip
                          }
                          className="mt-0.5"
                        />
                      </div>
                    </dl>
                  )}
                </div>
              </section>
            )}

            {/* Próximo na fila (card próprio, sem aninhamento) */}
            {!readings && !editorialData ? (
              <div data-rf-block="next-up">
                <DashboardBlockError
                  eyebrow="Fila de Leitura"
                  title="Próximo na fila"
                  className="h-full"
                />
              </div>
            ) : (
              <section
                data-rf-block="next-up"
                aria-labelledby="proximo-fila-titulo"
                className="rf-card flex h-full flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 border-b border-[var(--rf-divider)] pb-3.5">
                    <div>
                      <p className="rf-type-label inline-flex items-center gap-1.5 text-[var(--rf-text-accent-secondary)]">
                        <BookMarked className="h-3 w-3" aria-hidden="true" />
                        <span>Fila de Leitura</span>
                      </p>
                      <h2
                        id="proximo-fila-titulo"
                        className="rf-type-section-title mt-0.5"
                      >
                        Próximo na fila
                      </h2>
                    </div>

                    <Link
                      href="/leitura"
                      className={rfButtonClassName({
                        variant: "subtle",
                        size: "sm",
                        className: "-mr-2",
                      })}
                    >
                      <span>Ver fila</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>

                  {nextUpBook ? (
                    <Link
                      href={`/livros/${nextUpBook.workId}`}
                      className="group -mx-1.5 mt-3 flex items-center gap-3 rounded-[var(--rf-radius-md)] p-1.5 transition-colors hover:bg-[var(--rf-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
                    >
                      <BookCover
                        title={nextUpBook.title}
                        author={nextUpBook.author}
                        coverUrl={nextUpBook.coverUrl}
                        spineColor={nextUpBook.spineColor}
                        spineAccent={nextUpBook.spineAccent}
                        seed={nextUpBook.seed}
                        size="xs"
                        className="shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 font-serif text-base font-bold leading-snug text-[var(--rf-text-primary)] transition-colors group-hover:text-[var(--rf-text-accent-secondary)]">
                          {nextUpBook.title}
                        </p>
                        <p className="rf-type-caption mt-0.5 truncate text-[var(--rf-text-secondary)]">
                          {nextUpBook.author}
                        </p>
                        <p className="mt-1 font-sans text-[13px] font-semibold text-[var(--rf-text-secondary)]">
                          {nextUpBook.contextLabel}
                        </p>
                      </div>
                    </Link>
                  ) : (
                    <DashboardBlockEmpty
                      compact
                      title="Nenhum livro aguardando na fila"
                      description="Adicione uma obra ao acervo ou à lista de desejos para preparar sua próxima leitura."
                      actionLabel="Adicionar livro"
                      actionHref="/adicionar"
                    />
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </section>

      {/* ====================================================================
          03 · ACERVO & CADERNO (8/12 PRINCIPAL + 4/12 LATERAL EM >= 1200px)
          ==================================================================== */}
      <section aria-labelledby="acervo-caderno-titulo" className="space-y-4">
        <div className="border-b border-[var(--rf-divider)] pb-2">
          <h2 id="acervo-caderno-titulo" className="rf-section-marker">
            03 · Acervo &amp; Caderno
          </h2>
        </div>

        <div className="rf-dashboard-band">
          {/* Coluna Principal (8/12 em >= 1200px): Coleção, Atividade, Consolidado */}
          <div className="rf-dashboard-main">
            <div data-rf-block="collection">
              {!editorialData ? (
                <DashboardBlockError
                  eyebrow="Visão Geral do Acervo"
                  title="Coleção & Prateleiras"
                />
              ) : (
                <CollectionStatusOverview
                  counts={editorialData.collectionOverview.counts}
                  books={editorialData.collectionOverview.recentBooks}
                  wishlistBooks={editorialData.collectionOverview.wishlistBooks}
                />
              )}
            </div>

            <div data-rf-block="activity">
              {!editorialData ? (
                <DashboardBlockError
                  eyebrow="Caderno de Registros"
                  title="Atividade Recente"
                  className="h-full"
                />
              ) : (
                <RecentActivityFeed
                  events={editorialData.activityFeed}
                  referenceDateIso={editorialData.referenceDateIso}
                />
              )}
            </div>

            <div data-rf-block="monthly">
              {!editorialData ? (
                <DashboardBlockError
                  eyebrow="Consolidado Mensal"
                  title="Resumo do Mês"
                  className="h-full"
                />
              ) : (
                <MonthlyStatsCard monthly={editorialData.monthly} />
              )}
            </div>
          </div>

          {/* Coluna Lateral (4/12 em >= 1200px): Metas, Calendário, Ranking */}
          <div className="rf-dashboard-aside">
            {/* Metas Ativas: ÚNICO lugar de "Leituras de 2026" e "Páginas no ano" */}
            {!goalsData ? (
              <div data-rf-block="goals">
                <DashboardBlockError
                  eyebrow="Acompanhamento"
                  title="Metas Ativas"
                  className="h-full"
                />
              </div>
            ) : (
              <section
                data-rf-block="goals"
                aria-labelledby="metas-painel-titulo"
                className="rf-card flex h-full flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 border-b border-[var(--rf-divider)] pb-3.5">
                    <div>
                      <p className="rf-type-label text-[var(--rf-text-accent-secondary)]">
                        Acompanhamento
                      </p>
                      <h2
                        id="metas-painel-titulo"
                        className="rf-type-section-title mt-0.5"
                      >
                        Metas Ativas
                      </h2>
                    </div>

                    <Link
                      href="/metas"
                      className={rfButtonClassName({
                        variant: "subtle",
                        size: "sm",
                        className: "-mr-2",
                      })}
                    >
                      <span>Gerenciar</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>

                  {goalsData.entries.length === 0 ? (
                    <DashboardBlockEmpty
                      compact
                      title="Nenhuma meta ativa no período"
                      description="Crie uma meta anual ou mensal de livros ou páginas para acompanhar seu ritmo com serenidade."
                      actionLabel="Criar meta"
                      actionHref="/metas"
                    />
                  ) : (
                    <div className="mt-2 divide-y divide-[var(--rf-divider)]">
                      {goalsData.entries
                        .slice(0, 3)
                        .map(({ goal, evaluation }) => {
                          const unitSingular =
                            goal.kind === "books" ? "livro" : "página";
                          const unitPlural =
                            goal.kind === "books" ? "livros" : "páginas";
                          const remainingPhrase =
                            evaluation.remainingValue === 1
                              ? `Falta 1 ${unitSingular}`
                              : `Faltam ${formatNumberPtBr(evaluation.remainingValue)} ${unitPlural}`;

                          return (
                            <div
                              key={goal.id}
                              className="py-4 first:pt-2.5 last:pb-0"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="font-serif text-base font-bold text-[var(--rf-text-primary)]">
                                  {goal.title}
                                </h3>
                                <GoalPaceBadge status={evaluation.paceStatus} />
                              </div>

                              <div className="mt-2 flex items-baseline justify-between font-sans text-[13px] tabular-nums [font-variant-numeric:lining-nums_tabular-nums]">
                                <span className="font-semibold text-[var(--rf-text-primary)]">
                                  {formatNumberPtBr(evaluation.completedValue)} de{" "}
                                  {formatNumberPtBr(evaluation.targetValue)}{" "}
                                  {unitPlural}
                                </span>
                                <span className="font-serif text-base font-bold text-[var(--rf-text-accent-secondary)]">
                                  {evaluation.progressPercent}%
                                </span>
                              </div>

                              <div
                                role="progressbar"
                                aria-valuenow={evaluation.progressPercent}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label={`Progresso da meta ${goal.title}: ${evaluation.progressPercent}%`}
                                className="mt-2 h-1.5 w-full overflow-hidden rounded-[var(--rf-radius-full)] bg-[var(--rf-surface-subtle)]"
                              >
                                <div
                                  className="h-full rounded-[var(--rf-radius-full)] bg-gradient-to-r from-[var(--rf-accent-secondary)] to-[var(--rf-accent-primary)] transition-all duration-300"
                                  style={{
                                    width: `${Math.min(100, evaluation.progressPercent)}%`,
                                  }}
                                />
                              </div>

                              {evaluation.paceStatus === "completed" ? (
                                <p className="rf-type-caption mt-2.5 font-semibold text-[var(--rf-status-success)]">
                                  Meta cumprida neste período.
                                </p>
                              ) : (
                                <div className="mt-2.5 space-y-1.5 font-sans text-[13px] tabular-nums [font-variant-numeric:lining-nums_tabular-nums]">
                                  {/* Restante + dias até o prazo */}
                                  <p className="font-medium text-[var(--rf-text-primary)]">
                                    {remainingPhrase} ·{" "}
                                    <span className="text-[var(--rf-text-secondary)]">
                                      {evaluation.requiredBasisLabel}
                                    </span>
                                  </p>

                                  {/* Ritmo necessário por dia com tooltip da fórmula */}
                                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                                    <span className="font-semibold text-[var(--rf-text-accent-secondary)]">
                                      Necessário:{" "}
                                      {evaluation.requiredPerDayFormatted}
                                    </span>
                                    <MetricFormulaHint
                                      basisLabel="ver fórmula"
                                      formula={evaluation.requiredFormulaTooltip}
                                    />
                                  </div>

                                  {/* Equivalente em dias de leitura/semana no ritmo atual (quando há base) */}
                                  {evaluation.requiredDaysPerWeekLabel &&
                                    evaluation.requiredDaysPerWeekFormulaTooltip ? (
                                    <div>
                                      <MetricFormulaHint
                                        basisLabel={`Equivale a ${evaluation.requiredDaysPerWeekLabel}`}
                                        formula={
                                          evaluation.requiredDaysPerWeekFormulaTooltip
                                        }
                                      />
                                    </div>
                                  ) : null}

                                  {/* Projeção só aparece se terminar DENTRO do prazo da meta */}
                                  {evaluation.projectedFitsBeforeDeadline &&
                                    evaluation.projectedDaysToFinish &&
                                    evaluation.projectedDaysToFinish > 0 ? (
                                    <p className="rf-type-caption text-[var(--rf-status-success)]">
                                      No ritmo ({evaluation.currentBasisLabel})
                                      termina em{" "}
                                      {evaluation.projectedDaysToFinish}{" "}
                                      {evaluation.projectedDaysToFinish === 1
                                        ? "dia"
                                        : "dias"}
                                      .
                                    </p>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Calendário mensal ("Registro Diário" com 5 níveis por quantis) */}
            <div data-rf-block="calendar" className="h-full">
              {!editorialData ? (
                <DashboardBlockError
                  eyebrow="Registro Diário"
                  title="Calendário de Leitura"
                  className="h-full"
                />
              ) : (
                <ReadingStreakCard calendar={editorialData.calendar} />
              )}
            </div>

            {/* Destaques do Ranking */}
            {!ranking ? (
              <div data-rf-block="ranking">
                <DashboardBlockError
                  eyebrow="Avaliações"
                  title="Destaques do Ranking"
                />
              </div>
            ) : (
              <section
                data-rf-block="ranking"
                aria-labelledby="ranking-painel-titulo"
                className="rf-card"
              >
                <div className="flex items-start justify-between gap-2 border-b border-[var(--rf-divider)] pb-3.5">
                  <div>
                    <p className="rf-type-label text-[var(--rf-text-accent-secondary)]">
                      Avaliações
                    </p>
                    <h2
                      id="ranking-painel-titulo"
                      className="rf-type-section-title mt-0.5"
                    >
                      Destaques do Ranking
                    </h2>
                  </div>

                  <Link
                    href="/estatisticas"
                    className={rfButtonClassName({
                      variant: "subtle",
                      size: "sm",
                      className: "-mr-2",
                    })}
                  >
                    <span>Ver ranking</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>

                {ranking.length === 0 ? (
                  <DashboardBlockEmpty
                    compact
                    title="Nenhuma obra avaliada ainda"
                    description="Avalie livros concluídos de 0,5 a 5,0 estrelas para formar seu ranking pessoal automático."
                    actionLabel="Ver leituras concluídas"
                    actionHref="/leitura"
                  />
                ) : (
                  <ol className="rf-ranking-list mt-2">
                    {ranking.slice(0, 4).map((entry) => (
                      <li
                        key={entry.work.id}
                        className="flex items-center justify-between gap-3 py-3 first:pt-2 last:pb-0"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="w-6 shrink-0 text-center font-serif text-base font-bold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-accent-secondary)]">
                            {entry.position}º
                          </span>

                          <BookCover
                            title={entry.work.title}
                            author={entry.primaryAuthor}
                            coverUrl={entry.coverUrl}
                            spineColor={entry.spineColor}
                            spineAccent={entry.spineAccent}
                            seed={entry.seed ?? entry.work.id}
                            size="xs"
                          />

                          <div className="min-w-0">
                            <Link
                              href={`/livros/${entry.work.id}`}
                              className="block truncate font-serif text-sm font-bold text-[var(--rf-text-primary)] transition-colors hover:text-[var(--rf-text-accent-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
                            >
                              {entry.work.title}
                            </Link>
                            <p className="rf-type-caption truncate">
                              {entry.primaryAuthor}
                            </p>
                          </div>
                        </div>

                        <StarRatingDisplay
                          rating={entry.review.rating}
                          variant="gold"
                        />
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
