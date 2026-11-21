import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, Check, Flame, Sparkles } from "lucide-react";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FilterChip } from "@/components/ui/FilterChip";
import { ALLOWED_FONTS, THEME_LIST } from "@/lib/themes/themes.config";

export const metadata: Metadata = {
  title: "Laboratório de Temas (Dev)",
  robots: { index: false, follow: false },
};

const CHART_SERIES = [
  {
    token: "--rf-chart-1",
    name: "Série 1 · Ficção Literária",
    value: 84,
  },
  {
    token: "--rf-chart-2",
    name: "Série 2 · Não-ficção & Ensaios",
    value: 68,
  },
  {
    token: "--rf-chart-3",
    name: "Série 3 · Clássicos Brasileiros",
    value: 56,
  },
  {
    token: "--rf-chart-4",
    name: "Série 4 · História & Biografia",
    value: 44,
  },
  {
    token: "--rf-chart-5",
    name: "Série 5 · Filosofia",
    value: 34,
  },
  {
    token: "--rf-chart-6",
    name: "Série 6 · Poesia & Contos",
    value: 24,
  },
] as const;

const CALENDAR_LEVELS = [
  {
    level: 0,
    label: "Nível 0 (Sem leitura)",
    bgVar: "var(--rf-cal-0-bg)",
    textVar: "var(--rf-cal-0-text)",
    borderVar: "var(--rf-cal-0-border)",
  },
  {
    level: 1,
    label: "Nível 1 (1–15 pág.)",
    bgVar: "var(--rf-cal-1-bg)",
    textVar: "var(--rf-cal-1-text)",
    borderVar: "var(--rf-cal-1-border)",
  },
  {
    level: 2,
    label: "Nível 2 (16–35 pág.)",
    bgVar: "var(--rf-cal-2-bg)",
    textVar: "var(--rf-cal-2-text)",
    borderVar: "var(--rf-cal-2-border)",
  },
  {
    level: 3,
    label: "Nível 3 (36–60 pág.)",
    bgVar: "var(--rf-cal-3-bg)",
    textVar: "var(--rf-cal-3-text)",
    borderVar: "var(--rf-cal-3-border)",
  },
  {
    level: 4,
    label: "Nível 4 (61+ pág.)",
    bgVar: "var(--rf-cal-4-bg)",
    textVar: "var(--rf-cal-4-text)",
    borderVar: "var(--rf-cal-4-border)",
  },
] as const;

const STATUS_BADGES = [
  {
    label: "Sucesso",
    text: "var(--rf-status-success)",
    bg: "var(--rf-status-success-bg)",
    sample: "Meta no ritmo esperado",
  },
  {
    label: "Aviso",
    text: "var(--rf-status-warning)",
    bg: "var(--rf-status-warning-bg)",
    sample: "Correspondência incerta na capa",
  },
  {
    label: "Erro",
    text: "var(--rf-status-error)",
    bg: "var(--rf-status-error-bg)",
    sample: "Serviço indisponível, tentar de novo",
  },
  {
    label: "Informação",
    text: "var(--rf-status-info)",
    bg: "var(--rf-status-info-bg)",
    sample: "Preferência sincronizada no perfil",
  },
] as const;

export default function DevThemesPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className="min-h-dvh bg-[var(--rf-surface-canvas)] text-[var(--rf-text-primary)]">
      <div className="mx-auto max-w-[var(--rf-panel-max-width)] space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {/* Cabeçalho */}
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--rf-divider)] pb-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <span className="rf-section-marker">
                Dev · Fundação de Temas (Fase 1)
              </span>
              <Link
                href="/painel"
                className="inline-flex items-center gap-1.5 font-sans text-xs font-semibold text-[var(--rf-text-accent-secondary)] hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Voltar ao painel
              </Link>
            </div>
            <h1 className="rf-type-page-title text-[var(--rf-text-heading)]">
              Laboratório de Temas & Componentes-Piloto
            </h1>
            <p className="rf-type-body max-w-2xl text-[var(--rf-text-secondary)]">
              Página disponível apenas em desenvolvimento para validar a troca
              de tema em tempo real, densidade, movimento, os três
              componentes-piloto (<code>Button</code>, <code>Card</code> e{" "}
              <code>FilterChip</code>) e as paletas de gráficos.
            </p>
          </div>
        </header>

        {/* Seletor interativo (Client Component) */}
        <ThemeSwitcher />

        {/* 1. Piloto: Button */}
        <Card as="section" aria-labelledby="pilot-buttons-heading" className="space-y-5">
          <div className="border-b border-[var(--rf-divider)] pb-3">
            <p className="rf-type-label text-[var(--rf-text-accent-secondary)]">
              Piloto 01 · Button
            </p>
            <h2
              id="pilot-buttons-heading"
              className="rf-type-section-title mt-0.5 text-[var(--rf-text-heading)]"
            >
              Variantes, tamanhos e estados
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" size="lg" pill>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Primário Grande (Pill)
            </Button>
            <Button variant="primary" size="md">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              Primário Padrão
            </Button>
            <Button variant="secondary" size="md">
              <Flame className="h-4 w-4" aria-hidden="true" />
              Secundário Sólido
            </Button>
            <Button variant="secondary" secondaryStyle="outline" size="md">
              Secundário Vazado
            </Button>
            <Button variant="subtle" size="sm">
              Ação Discreta
            </Button>
            <Button variant="primary" size="sm" disabled>
              Desabilitado
            </Button>
          </div>
        </Card>

        {/* 2. Piloto: FilterChip */}
        <Card as="section" aria-labelledby="pilot-chips-heading" className="space-y-5">
          <div className="border-b border-[var(--rf-divider)] pb-3">
            <p className="rf-type-label text-[var(--rf-text-accent-secondary)]">
              Piloto 02 · FilterChip
            </p>
            <h2
              id="pilot-chips-heading"
              className="rf-type-section-title mt-0.5 text-[var(--rf-text-heading)]"
            >
              Estados ativo / inativo e contadores tabulares
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterChip label="Todos os livros" count={28} active />
            <FilterChip label="Físicos" count={26} active={false} />
            <FilterChip label="E-books" count={1} active={false} />
            <FilterChip label="Audiobooks" count={1} active={false} />
            <FilterChip label="Lendo agora" count={1} active={false} />
          </div>
        </Card>

        {/* 3. Piloto: Card */}
        <section aria-labelledby="pilot-cards-heading" className="space-y-4">
          <div>
            <p className="rf-type-label text-[var(--rf-text-accent-secondary)]">
              Piloto 03 · Card
            </p>
            <h2
              id="pilot-cards-heading"
              className="rf-type-section-title mt-0.5 text-[var(--rf-text-heading)]"
            >
              Superfícies semânticas (default, elevated, subtle e spotlight)
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card variant="default" className="space-y-2">
              <p className="rf-type-label text-[var(--rf-text-accent-secondary)]">
                Default
              </p>
              <h3 className="font-serif text-lg font-semibold text-[var(--rf-text-heading)]">
                Cartão Padrão
              </h3>
              <p className="rf-type-caption text-[var(--rf-text-secondary)]">
                Usa <code>--rf-surface-card</code>, borda sutil e sombra
                editorial.
              </p>
            </Card>

            <Card variant="elevated" className="space-y-2">
              <p className="rf-type-label text-[var(--rf-text-accent-secondary)]">
                Elevated
              </p>
              <h3 className="font-serif text-lg font-semibold text-[var(--rf-text-heading)]">
                Cartão Elevado
              </h3>
              <p className="rf-type-caption text-[var(--rf-text-secondary)]">
                Usa <code>--rf-surface-elevated</code> e sombra ampliada para
                destaque.
              </p>
            </Card>

            <Card variant="subtle" className="space-y-2">
              <p className="rf-type-label text-[var(--rf-text-accent-secondary)]">
                Subtle
              </p>
              <h3 className="font-serif text-lg font-semibold text-[var(--rf-text-heading)]">
                Cartão Sutil
              </h3>
              <p className="rf-type-caption text-[var(--rf-text-secondary)]">
                Usa <code>--rf-surface-subtle</code> sem sombra para áreas
                auxiliares.
              </p>
            </Card>

            <Card variant="spotlight" className="space-y-3">
              <p className="rf-type-label text-[var(--rf-text-on-contrast-muted)]">
                Spotlight
              </p>
              <h3 className="font-serif text-lg font-semibold text-[var(--rf-text-on-contrast)]">
                Na Cabeceira
              </h3>
              <p className="text-[13px] text-[var(--rf-text-on-contrast)]">
                Bloco escuro único por viewport com controles em tom escuro.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="primary" size="sm">
                  Atualizar
                </Button>
                <Button
                  variant="secondary"
                  secondaryStyle="outline"
                  tone="dark"
                  size="sm"
                >
                  Foco
                </Button>
              </div>
            </Card>
          </div>
        </section>

        {/* 4. Paletas de gráficos (6 categóricas + escala sequencial do calendário) */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card as="section" aria-labelledby="chart-cat-heading" className="space-y-4">
            <div className="border-b border-[var(--rf-divider)] pb-3">
              <p className="rf-type-label text-[var(--rf-text-accent-secondary)]">
                Paleta de Gráficos · Categórica
              </p>
              <h2
                id="chart-cat-heading"
                className="rf-type-section-title mt-0.5 text-[var(--rf-text-heading)]"
              >
                6 cores categóricas distinguíveis
              </h2>
            </div>

            <div className="space-y-3">
              {CHART_SERIES.map((series) => (
                <div key={series.token} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2 font-medium text-[var(--rf-text-primary)]">
                      <span
                        aria-hidden="true"
                        className="inline-block h-3 w-3 rounded-[var(--rf-radius-xs)]"
                        style={{ backgroundColor: `var(${series.token})` }}
                      />
                      {series.name}
                    </span>
                    <code className="font-mono text-[11px] text-[var(--rf-text-tertiary)]">
                      {series.token}
                    </code>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-[var(--rf-radius-full)] bg-[var(--rf-surface-subtle)]">
                    <div
                      className="h-full rounded-[var(--rf-radius-full)]"
                      style={{
                        width: `${series.value}%`,
                        backgroundColor: `var(${series.token})`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card as="section" aria-labelledby="chart-seq-heading" className="space-y-4">
            <div className="border-b border-[var(--rf-divider)] pb-3">
              <p className="rf-type-label text-[var(--rf-text-accent-secondary)]">
                Paleta de Gráficos · Sequencial
              </p>
              <h2
                id="chart-seq-heading"
                className="rf-type-section-title mt-0.5 text-[var(--rf-text-heading)]"
              >
                Escala de intensidade do calendário (5 níveis)
              </h2>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {CALENDAR_LEVELS.map((item) => (
                <div
                  key={item.level}
                  className="flex flex-col items-center justify-center rounded-[var(--rf-radius-md)] border p-3 text-center"
                  style={{
                    backgroundColor: item.bgVar,
                    color: item.textVar,
                    borderColor: item.borderVar,
                  }}
                >
                  <span className="font-serif text-lg font-bold tabular-nums">
                    {item.level}
                  </span>
                  <span className="mt-1 font-sans text-[10px] font-semibold">
                    Nível {item.level}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t border-[var(--rf-divider)] pt-4">
              <p className="rf-type-label text-[var(--rf-text-secondary)]">
                Estados semânticos (WCAG AA &gt;= 4,5:1)
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {STATUS_BADGES.map((st) => (
                  <div
                    key={st.label}
                    className="rounded-[var(--rf-radius-md)] border px-3 py-2 text-xs font-semibold"
                    style={{
                      backgroundColor: st.bg,
                      color: st.text,
                      borderColor: st.text,
                    }}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      {st.label}: {st.sample}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* 5. Catálogo de temas e 3 famílias tipográficas */}
        <Card as="section" className="space-y-4">
          <div className="border-b border-[var(--rf-divider)] pb-3">
            <p className="rf-type-label text-[var(--rf-text-accent-secondary)]">
              Configuração Ativa · Temas & Fontes
            </p>
            <h2 className="rf-type-section-title mt-0.5 text-[var(--rf-text-heading)]">
              Temas registrados e 3 famílias de fontes via next/font
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {THEME_LIST.map((theme) => (
              <div
                key={theme.id}
                className="rounded-[var(--rf-radius-lg)] border border-[var(--rf-border-subtle)] bg-[var(--rf-surface-subtle)] p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-serif text-base font-semibold text-[var(--rf-text-heading)]">
                    {theme.name}
                  </h3>
                  <code className="font-mono text-xs text-[var(--rf-text-tertiary)]">
                    data-theme=&quot;{theme.id}&quot;
                  </code>
                </div>
                <p className="mt-1 text-xs text-[var(--rf-text-secondary)]">
                  {theme.description}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 border-t border-[var(--rf-divider)] pt-4 sm:grid-cols-3">
            {Object.values(ALLOWED_FONTS).map((f) => (
              <div
                key={f.id}
                className="rounded-[var(--rf-radius-md)] border border-[var(--rf-border-subtle)] bg-[var(--rf-surface-elevated)] p-3"
              >
                <p className="font-sans text-[11px] font-bold uppercase tracking-wider text-[var(--rf-text-tertiary)]">
                  {f.id}
                </p>
                <p
                  className="mt-1 text-base font-semibold text-[var(--rf-text-primary)]"
                  style={{ fontFamily: f.cssVar }}
                >
                  Aa Bb Cc · 0123456789
                </p>
                <p className="mt-0.5 text-xs text-[var(--rf-text-secondary)]">
                  {f.label}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
