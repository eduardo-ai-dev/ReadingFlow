import type { Metadata } from "next";
import Link from "next/link";
import { getStatisticsView, type StatsPreset } from "@/features/stats/queries";
import { getAutomaticRankingView } from "@/features/ratings/queries";
import { StarRatingDisplay } from "@/components/StarRating";
import { formatRatingPtBr } from "@/lib/formatters";
import { CountUp, Stagger, Item } from "@/components/MotionPrimitives";

export const metadata: Metadata = {
  title: "Estatísticas e Ranking",
};

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const sp = await searchParams;
  const preset: StatsPreset =
    sp.periodo === "current_month" || sp.periodo === "all_time"
      ? sp.periodo
      : "current_year";

  const [view, ranking] = await Promise.all([
    getStatisticsView({ preset }),
    getAutomaticRankingView(),
  ]);

  const { stats } = view;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="editorial-kicker">Análises e Ranking</p>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-[var(--text-heading)]">
            Estatísticas e Ranking Geral
          </h1>
        </div>

        <nav
          aria-label="Filtro de período das estatísticas"
          className="flex flex-wrap gap-1.5 rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-surface)] p-1"
        >
          {(
            [
              ["current_year", "Ano atual"],
              ["current_month", "Mês atual"],
              ["all_time", "Todo o histórico"],
            ] as const
          ).map(([key, label]) => {
            const active = preset === key;
            return (
              <Link
                key={key}
                href={`/estatisticas?periodo=${key}`}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-[44px] lg:min-h-[38px] items-center rounded-[6px] px-3 text-xs font-semibold ${
                  active
                    ? "bg-[var(--accent-primary)] text-[var(--on-primary)]"
                    : "text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Cartões de métricas com contagem animada e entrada sequencial */}
      <Stagger
        aria-label="Totais por dimensão"
        className="grid grid-cols-2 gap-4 sm:grid-cols-4"
      >
        {[
          {
            label: "Obras únicas possuídas",
            numeric: stats.uniqueOwnedWorks,
            suffix: "",
            hint: "Sem inflar por edições repetidas",
          },
          {
            label: "Exemplares na estante",
            numeric: stats.totalOwnedItems,
            suffix: "",
            hint: `${stats.unreadOwnedItems} aguardando primeira leitura`,
          },
          {
            label: "Leituras concluídas no período",
            numeric: stats.finishedReadingsCount,
            suffix: "",
            hint: view.countRereads
              ? "Incluindo releituras"
              : "Apenas primeiras leituras",
          },
          {
            label: "Páginas impressas / digitais",
            numeric: stats.pagesRead,
            suffix: "",
            hint: "Separadas de audiobooks",
          },
          {
            label: "Horas ouvidas em áudio",
            numeric: stats.hoursListened,
            suffix: " h",
            hint: "Somente audiobooks concluídos",
          },
          {
            label: "Média de avaliações",
            numeric: null,
            formatted:
              stats.averageRating !== null
                ? `${formatRatingPtBr(stats.averageRating)} ★`
                : "—",
            hint: "Escala de 0,5 a 5,0 estrelas",
          },
          {
            label: "Leituras abandonadas",
            numeric: stats.abandonedCount,
            suffix: "",
            hint: "Fora da meta de concluídos",
          },
          {
            label: "Não lidos no acervo",
            numeric: stats.unreadOwnedItems,
            suffix: "",
            hint: "Prontos na estante",
          },
        ].map((card) => (
          <Item
            key={card.label}
            className="card rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 hover:-translate-y-1 transition-all"
          >
            <p className="text-xs font-medium text-[var(--text-muted)]">
              {card.label}
            </p>
            <p className="mt-1.5 font-serif text-2xl font-semibold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--text-heading)]">
              {card.numeric !== null ? (
                <>
                  <CountUp to={card.numeric} />
                  {card.suffix}
                </>
              ) : (
                card.formatted
              )}
            </p>
            <p className="mt-1 text-[11px] tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--text-muted)]">
              {card.hint}
            </p>
          </Item>
        ))}
      </Stagger>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Histórico anual */}
        <section
          aria-labelledby="historico-anual-heading"
          className="min-w-0 space-y-3 lg:col-span-6"
        >
          <h2
            id="historico-anual-heading"
            className="font-serif text-xl font-semibold text-[var(--text-heading)]"
          >
            Histórico por ano
          </h2>
          <div className="overflow-x-auto rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            {stats.yearlyHistory.length === 0 ? (
              <p className="p-5 text-sm text-[var(--text-muted)]">
                Conclua leituras para visualizar a série anual.
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-xs text-[var(--text-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Ano</th>
                    <th className="px-4 py-3 font-semibold">Livros</th>
                    <th className="px-4 py-3 font-semibold">Páginas</th>
                    <th className="px-4 py-3 font-semibold">Áudio (h)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] tabular-nums [font-variant-numeric:lining-nums_tabular-nums]">
                  {stats.yearlyHistory.map((row) => (
                    <tr key={row.year}>
                      <td className="px-4 py-3 font-semibold">{row.year}</td>
                      <td className="px-4 py-3">{row.booksRead}</td>
                      <td className="px-4 py-3">{row.pagesRead}</td>
                      <td className="px-4 py-3">{row.hoursListened} h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Ranking geral automático */}
        <section
          aria-labelledby="ranking-geral-heading"
          className="min-w-0 space-y-3 lg:col-span-6"
        >
          <h2
            id="ranking-geral-heading"
            className="font-serif text-xl font-semibold text-[var(--text-heading)]"
          >
            Ranking Geral Automático ({ranking.length})
          </h2>
          {ranking.length === 0 ? (
            <p className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 text-sm text-[var(--text-muted)]">
              Nenhuma obra avaliada ainda.
            </p>
          ) : (
            <ol className="space-y-2.5">
              {ranking.map((entry) => (
                <li key={entry.work.id} className="min-w-0">
                  <Link
                    href={`/livros/${entry.work.id}`}
                    className="flex min-h-[56px] items-center justify-between gap-3 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 transition-colors hover:bg-[var(--bg-elevated)]"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-serif text-base font-semibold text-[var(--text-heading)]">
                        #{entry.position} · {entry.work.title}
                      </span>
                      <span className="block truncate text-xs text-[var(--text-muted)]">
                        {entry.primaryAuthor}
                        {entry.review.narrationRating
                          ? ` · Narração: ${formatRatingPtBr(entry.review.narrationRating)} ★`
                          : ""}
                      </span>
                    </div>
                    <span className="shrink-0">
                      <StarRatingDisplay rating={entry.review.rating} />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
