"use client";

import { useState } from "react";
import { ProgressBar } from "@/components/ProgressBar";

type AnalyticsPeriod = "year2026" | "month" | "alltime";
type ChartMetric = "books" | "pages";

interface PeriodDataset {
  label: string;
  subtitle: string;
  uniqueWorks: number;
  totalReadings: number;
  rereads: number;
  pagesRead: string;
  dailyPagesAvg: string;
  audioHours: string;
  ownedCopies: number;
  borrowedReadings: number;
  goalCurrent: number;
  goalTarget: number;
  goalPercent: number;
  goalStatus: string;
  goalNote: string;
  formatSplit: Array<{
    label: string;
    share: number;
    detail: string;
    color: string;
  }>;
  monthly: Array<{ month: string; books: number; pages: number }>;
  genres: Array<{
    num: string;
    name: string;
    books: number;
    share: number;
    color: string;
  }>;
}

const ANALYTICS_DATA: Record<AnalyticsPeriod, PeriodDataset> = {
  year2026: {
    label: "Ano 2026",
    subtitle: "Recorte consolidado de 01/01 até hoje",
    uniqueWorks: 14,
    totalReadings: 17,
    rereads: 3,
    pagesRead: "4.820",
    dailyPagesAvg: "29 pág./dia em livros impressos e e-books",
    audioHours: "38,5 h",
    ownedCopies: 42,
    borrowedReadings: 5,
    goalCurrent: 14,
    goalTarget: 18,
    goalPercent: 78,
    goalStatus: "No ritmo esperado (tolerância de 5%)",
    goalNote:
      "Faltam 4 livros até 31/12. Releituras ficam separadas conforme sua preferência.",
    formatSplit: [
      {
        label: "Físico (capa dura e brochura)",
        share: 58,
        detail: "10 leituras · 3.610 pág.",
        color: "#279BCB",
      },
      {
        label: "Digital (e-book)",
        share: 24,
        detail: "4 leituras · 1.210 pág.",
        color: "#E3DAFF",
      },
      {
        label: "Audiobook",
        share: 18,
        detail: "3 leituras · 38,5 h ouvidas",
        color: "#696773",
      },
    ],
    monthly: [
      { month: "Jan", books: 2, pages: 610 },
      { month: "Fev", books: 1, pages: 340 },
      { month: "Mar", books: 2, pages: 590 },
      { month: "Abr", books: 1, pages: 410 },
      { month: "Mai", books: 2, pages: 640 },
      { month: "Jun", books: 1, pages: 320 },
      { month: "Jul", books: 2, pages: 680 },
      { month: "Ago", books: 1, pages: 390 },
      { month: "Set", books: 1, pages: 430 },
      { month: "Out", books: 1, pages: 410 },
      { month: "Nov", books: 0, pages: 0 },
      { month: "Dez", books: 0, pages: 0 },
    ],
    genres: [
      {
        num: "04",
        name: "Brasiliana",
        books: 5,
        share: 36,
        color: "#6A3F28",
      },
      {
        num: "02",
        name: "Clássicos",
        books: 3,
        share: 21,
        color: "#1F3B2D",
      },
      {
        num: "03",
        name: "Ficção Atual",
        books: 3,
        share: 21,
        color: "#C49232",
      },
      {
        num: "01",
        name: "Terror & Gótico",
        books: 2,
        share: 14,
        color: "#7A2236",
      },
      {
        num: "06",
        name: "Fantasia & Sci-Fi",
        books: 1,
        share: 8,
        color: "#8C2A40",
      },
    ],
  },
  month: {
    label: "Últimos 30 dias",
    subtitle: "Atividade consolidada dos últimos 30 dias corridos",
    uniqueWorks: 2,
    totalReadings: 2,
    rereads: 0,
    pagesRead: "612",
    dailyPagesAvg: "20 pág./dia sem cobrança de ofensiva diária",
    audioHours: "6,0 h",
    ownedCopies: 42,
    borrowedReadings: 1,
    goalCurrent: 2,
    goalTarget: 2,
    goalPercent: 100,
    goalStatus: "Meta mensal concluída",
    goalNote: "2 de 2 leituras planejadas para o mês concluídas com folga.",
    formatSplit: [
      {
        label: "Físico (capa dura e brochura)",
        share: 50,
        detail: "1 leitura · 524 pág.",
        color: "#279BCB",
      },
      {
        label: "Digital (e-book)",
        share: 25,
        detail: "Em progresso · 88 pág.",
        color: "#E3DAFF",
      },
      {
        label: "Audiobook",
        share: 25,
        detail: "1 leitura · 6,0 h ouvidas",
        color: "#696773",
      },
    ],
    monthly: [
      { month: "S1", books: 0, pages: 128 },
      { month: "S2", books: 1, pages: 184 },
      { month: "S3", books: 0, pages: 142 },
      { month: "S4", books: 1, pages: 158 },
    ],
    genres: [
      {
        num: "03",
        name: "Ficção Atual",
        books: 1,
        share: 50,
        color: "#C49232",
      },
      {
        num: "01",
        name: "Terror & Gótico",
        books: 1,
        share: 50,
        color: "#7A2236",
      },
    ],
  },
  alltime: {
    label: "Histórico completo",
    subtitle: "Todo o acervo catalogado e importado (CSV + ISBN)",
    uniqueWorks: 64,
    totalReadings: 76,
    rereads: 12,
    pagesRead: "21.480",
    dailyPagesAvg: "Média histórica de 336 pág. por livro impresso",
    audioHours: "142,0 h",
    ownedCopies: 84,
    borrowedReadings: 19,
    goalCurrent: 64,
    goalTarget: 64,
    goalPercent: 100,
    goalStatus: "Histórico preservado e exportável (JSON/CSV)",
    goalNote:
      "Inclui lotes importados do Goodreads com deduplicação por ISBN e título normalizado.",
    formatSplit: [
      {
        label: "Físico (capa dura e brochura)",
        share: 62,
        detail: "47 leituras · 16.290 pág.",
        color: "#279BCB",
      },
      {
        label: "Digital (e-book)",
        share: 23,
        detail: "18 leituras · 5.190 pág.",
        color: "#E3DAFF",
      },
      {
        label: "Audiobook",
        share: 15,
        detail: "11 leituras · 142,0 h ouvidas",
        color: "#696773",
      },
    ],
    monthly: [
      { month: "2023", books: 16, pages: 5120 },
      { month: "2024", books: 21, pages: 7240 },
      { month: "2025", books: 20, pages: 4300 },
      { month: "2026", books: 17, pages: 4820 },
    ],
    genres: [
      {
        num: "04",
        name: "Brasiliana",
        books: 21,
        share: 33,
        color: "#6A3F28",
      },
      {
        num: "02",
        name: "Clássicos",
        books: 18,
        share: 28,
        color: "#1F3B2D",
      },
      {
        num: "03",
        name: "Ficção Atual",
        books: 12,
        share: 19,
        color: "#C49232",
      },
      {
        num: "01",
        name: "Terror & Gótico",
        books: 8,
        share: 12,
        color: "#7A2236",
      },
      {
        num: "05",
        name: "Memórias",
        books: 5,
        share: 8,
        color: "#16313F",
      },
    ],
  },
};

const RANKING_SAMPLE = [
  {
    rank: "01",
    title: "Grande Sertão: Veredas",
    author: "João Guimarães Rosa",
    format: "Capa dura",
    workRating: "5,0 ★",
    narrationRating: "—",
  },
  {
    rank: "02",
    title: "Dom Casmurro",
    author: "Machado de Assis",
    format: "Brochura · Releitura",
    workRating: "5,0 ★",
    narrationRating: "—",
  },
  {
    rank: "03",
    title: "O Avesso da Pele",
    author: "Jeferson Tenório (Narr.: Lázaro Ramos)",
    format: "Audiobook · 6 h",
    workRating: "4,5 ★",
    narrationRating: "5,0 ★",
  },
  {
    rank: "04",
    title: "Noite na Taverna",
    author: "Álvares de Azevedo",
    format: "Brochura",
    workRating: "4,5 ★",
    narrationRating: "—",
  },
];

export function LandingAnalyticsShowcase() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("year2026");
  const [metric, setMetric] = useState<ChartMetric>("pages");

  const data = ANALYTICS_DATA[period];
  const maxBarValue = Math.max(
    1,
    ...data.monthly.map((m) => (metric === "books" ? m.books : m.pages))
  );

  return (
    <section
      id="analises"
      aria-labelledby="analises-leitura-titulo"
      className="scroll-mt-8 py-14 sm:py-20"
    >
      {/* Cabeçalho Editorial + Seletor de Período */}
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <p className="editorial-kicker">Análises do acervo</p>
          <h2
            id="analises-leitura-titulo"
            className="mt-2 font-serif text-2xl font-semibold text-[var(--text-heading)] sm:text-4xl"
          >
            Depois da estante, clareza real sobre como você lê.
          </h2>
          <p className="prose-reading mt-3 text-[var(--text-muted)]">
            Obras únicas, exemplares, releituras, páginas impressas e horas de
            audiobook são contabilizados em trilhas próprias — nunca misturados
            para inflar números.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Período das análises de leitura"
          className="inline-flex self-start rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-surface)] p-1"
        >
          {(
            [
              ["year2026", "Ano 2026"],
              ["month", "Últimos 30 dias"],
              ["alltime", "Histórico"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={period === key}
              onClick={() => setPeriod(key)}
              className={`min-h-[38px] rounded-[6px] px-3.5 font-sans text-xs font-semibold sm:text-sm ${
                period === key
                  ? "bg-[var(--accent-primary)] text-[var(--on-primary)]"
                  : "text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Linha 1: 4 Contadores Independentes do Domínio */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow-card)]">
          <p className="editorial-kicker">Obras únicas × Leituras</p>
          <p className="mt-2 font-sans text-3xl font-bold tracking-tight text-[var(--text-heading)] tabular-nums">
            {data.uniqueWorks}{" "}
            <span className="text-base font-medium text-[var(--text-muted)]">
              obras
            </span>
          </p>
          <p className="mt-1.5 font-sans text-xs text-[var(--text-muted)] tabular-nums">
            {data.totalReadings} leituras registradas ({data.rereads}{" "}
            {data.rereads === 1 ? "releitura" : "releituras"} separadas)
          </p>
        </article>

        <article className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow-card)]">
          <p className="editorial-kicker">Volume impresso e digital</p>
          <p className="mt-2 font-sans text-3xl font-bold tracking-tight text-[var(--text-heading)] tabular-nums">
            {data.pagesRead}{" "}
            <span className="text-base font-medium text-[var(--text-muted)]">
              pág.
            </span>
          </p>
          <p className="mt-1.5 font-sans text-xs text-[var(--text-muted)] tabular-nums">
            {data.dailyPagesAvg}
          </p>
        </article>

        <article className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow-card)]">
          <p className="editorial-kicker">Tempo em audiobooks</p>
          <p className="mt-2 font-sans text-3xl font-bold tracking-tight text-[var(--text-heading)] tabular-nums">
            {data.audioHours}
          </p>
          <p className="mt-1.5 font-sans text-xs text-[var(--text-muted)]">
            Contabilizado em horas, sem converter áudio em páginas falsas
          </p>
        </article>

        <article className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow-card)]">
          <p className="editorial-kicker">Posse × Empréstimos</p>
          <p className="mt-2 font-sans text-3xl font-bold tracking-tight text-[var(--text-heading)] tabular-nums">
            {data.ownedCopies}{" "}
            <span className="text-base font-medium text-[var(--text-muted)]">
              exemplares
            </span>
          </p>
          <p className="mt-1.5 font-sans text-xs text-[var(--text-muted)] tabular-nums">
            +{data.borrowedReadings} leituras de biblioteca ou amigos sem posse
          </p>
        </article>
      </div>

      {/* Linha 2: Gráfico de Ritmo de Leitura + Meta Sem Culpa e Formatos */}
      <div className="mt-6 grid gap-5 lg:grid-cols-12">
        {/* Gráfico de barras acessível */}
        <article className="rounded-[12px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow-card)] lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
            <div>
              <h3 className="font-serif text-lg font-semibold text-[var(--text-heading)]">
                Ritmo de leitura ({data.label})
              </h3>
              <p className="font-sans text-xs text-[var(--text-muted)]">
                {data.subtitle}
              </p>
            </div>

            <div
              role="group"
              aria-label="Unidade do gráfico de ritmo"
              className="inline-flex rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0.5"
            >
              <button
                type="button"
                aria-pressed={metric === "pages"}
                onClick={() => setMetric("pages")}
                className={`min-h-[32px] rounded-[5px] px-2.5 font-sans text-xs font-semibold ${
                  metric === "pages"
                    ? "bg-[var(--accent-primary)] text-[var(--on-primary)]"
                    : "text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                }`}
              >
                Páginas
              </button>
              <button
                type="button"
                aria-pressed={metric === "books"}
                onClick={() => setMetric("books")}
                className={`min-h-[32px] rounded-[5px] px-2.5 font-sans text-xs font-semibold ${
                  metric === "books"
                    ? "bg-[var(--accent-primary)] text-[var(--on-primary)]"
                    : "text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                }`}
              >
                Livros
              </button>
            </div>
          </div>

          <div
            role="list"
            aria-label={`Evolução por período em ${metric === "pages" ? "páginas" : "livros"}`}
            className="mt-5 grid h-52 items-end gap-2 pt-5"
            style={{
              gridTemplateColumns: `repeat(${data.monthly.length}, minmax(0, 1fr))`,
            }}
          >
            {data.monthly.map((entry, idx) => {
              const rawVal = metric === "books" ? entry.books : entry.pages;
              const pct =
                rawVal === 0
                  ? 4
                  : Math.max(12, Math.round((rawVal / maxBarValue) * 100));
              const isHighlighted =
                idx === data.monthly.length - 3 ||
                idx === data.monthly.length - 1;

              return (
                <div
                  key={entry.month}
                  role="listitem"
                  className="flex h-full flex-col items-center justify-end gap-1.5"
                >
                  <span className="font-sans text-[11px] font-semibold text-[var(--text-primary)] tabular-nums">
                    {rawVal > 0 ? rawVal : "—"}
                  </span>
                  <div className=" flex h-36 w-full items-end justify-center rounded-[5px] bg-[var(--bg-surface)] p-1">
                    <div
                      style={{ height: `${pct}%` }}
                      className={`w-full rounded-[3px] transition-all duration-300 ${
                        rawVal === 0
                          ? "bg-[var(--border-subtle)]"
                          : isHighlighted
                            ? "bg-[var(--accent-wood)]"
                            : "bg-[var(--accent-primary)]"
                      }`}
                    />
                  </div>
                  <span className="font-sans text-[11px] font-medium text-[var(--text-muted)]">
                    {entry.month}
                  </span>
                </div>
              );
            })}
          </div>
        </article>

        {/* Meta com tolerância de 5% + Divisão por Formato */}
        <article className="flex flex-col justify-between rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 lg:col-span-4">
          <div>
            <p className="editorial-kicker">Meta sem cobrança invasiva</p>
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <h3 className="font-serif text-xl font-semibold text-[var(--text-heading)] tabular-nums">
                {data.goalCurrent} de {data.goalTarget} livros
              </h3>
              <span className="font-sans text-sm font-bold text-[var(--accent-text)] tabular-nums">
                {data.goalPercent}%
              </span>
            </div>

            <div className="mt-3">
              <ProgressBar
                value={data.goalPercent}
                label={`Progresso da meta em ${data.label}`}
              />
            </div>

            <p className="mt-2.5 font-sans text-xs font-semibold text-[var(--text-primary)]">
              {data.goalStatus}
            </p>
            <p className="mt-1 font-sans text-xs leading-relaxed text-[var(--text-muted)]">
              {data.goalNote}
            </p>
          </div>

          <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
            <p className="font-sans text-xs font-bold tracking-wider text-[var(--text-heading)] uppercase">
              Equilíbrio entre formatos
            </p>
            <div className="mt-3 space-y-2.5">
              {data.formatSplit.map((fmt) => (
                <div key={fmt.label}>
                  <div className="flex items-center justify-between gap-2 font-sans text-xs">
                    <span className="font-medium text-[var(--text-primary)]">
                      {fmt.label}
                    </span>
                    <span className="font-semibold text-[var(--text-muted)] tabular-nums">
                      {fmt.share}%
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                    <div
                      style={{
                        width: `${fmt.share}%`,
                        backgroundColor: fmt.color,
                      }}
                      className="h-full rounded-full border border-[#C8A46E]/20"
                    />
                  </div>
                  <p className="mt-0.5 font-sans text-[11px] text-[var(--text-muted)] tabular-nums">
                    {fmt.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </article>
      </div>

      {/* Linha 3: Alas da Estante 3D Mais Lidas + Ranking Meia Estrela e Narração */}
      <div className="mt-6 grid gap-5 lg:grid-cols-12">
        {/* Distribuição por Ala Literária (espelhando as cores da estante 3D acima) */}
        <article className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow-card)] lg:col-span-5">
          <p className="editorial-kicker">Conexão com a estante 3D</p>
          <h3 className="mt-1 font-serif text-lg font-semibold text-[var(--text-heading)]">
            Alas literárias mais lidas
          </h3>
          <p className="mt-1 font-sans text-xs text-[var(--text-muted)]">
            Cada barra corresponde a um dos volumes numerados da estante acima.
          </p>

          <div className="mt-4 space-y-3">
            {data.genres.map((g) => (
              <div key={g.num}>
                <div className="flex items-center justify-between gap-2 font-sans text-xs">
                  <span className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                    <span
                      style={{ backgroundColor: g.color }}
                      className="inline-block h-3 w-3 rounded-[2px]"
                      aria-hidden="true"
                    />
                    <span className="tabular-nums text-[var(--text-muted)]">
                      {g.num}
                    </span>
                    <span>{g.name}</span>
                  </span>
                  <span className="font-medium text-[var(--text-muted)] tabular-nums">
                    {g.books} {g.books === 1 ? "obra" : "obras"} ({g.share}%)
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
                  <div
                    style={{ width: `${g.share}%`, backgroundColor: g.color }}
                    className="h-full rounded-full border border-[#C8A46E]/20 transition-all duration-300"
                  />
                </div>
              </div>
            ))}
          </div>
        </article>

        {/* Tabela de Ranking em Meia Estrela + Nota de Narração */}
        <article className="overflow-hidden rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow-card)] lg:col-span-7">
          <p className="editorial-kicker">Avaliação de 0,5 a 5,0 ★</p>
          <h3 className="mt-1 font-serif text-lg font-semibold text-[var(--text-heading)]">
            Ranking automático e nota própria de narração
          </h3>
          <p className="mt-1 font-sans text-xs text-[var(--text-muted)]">
            Em audiobooks, você avalia a obra e a performance de voz
            separadamente.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left font-sans text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[11px] tracking-wider text-[var(--text-muted)] uppercase">
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    #
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Obra e formato
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Obra
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    Narração
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {RANKING_SAMPLE.map((row) => (
                  <tr key={row.rank}>
                    <td className="py-2.5 pr-3 font-bold text-[var(--text-muted)] tabular-nums">
                      {row.rank}
                    </td>
                    <td className="py-2.5 pr-3">
                      <p className="font-serif font-semibold text-[var(--text-heading)]">
                        {row.title}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {row.author} · {row.format}
                      </p>
                    </td>
                    <td className="py-2.5 pr-3 font-semibold whitespace-nowrap text-[var(--accent-text)] tabular-nums">
                      {row.workRating}
                    </td>
                    <td className="py-2.5 font-semibold whitespace-nowrap text-[var(--text-primary)] tabular-nums">
                      {row.narrationRating}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}
