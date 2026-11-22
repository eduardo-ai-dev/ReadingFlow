import Link from "next/link";
import { discoverLandingLayouts } from "@/server/landing/discover-layouts";
import { HeroRotator } from "@/components/HeroRotator";
import { LandingProductPreview } from "@/components/LandingProductPreview";
import { MarketingFooter } from "@/components/MarketingFooter";
import { ScrollReveal } from "@/components/MotionPrimitives";
import {
  Library,
  Clock,
  Award,
  ShieldCheck,
  Lock,
  Ban,
  Download,
} from "lucide-react";

export const dynamic = "force-static";

export default async function LandingPage() {
  const heroLayouts = await discoverLandingLayouts();

  const privacyCommitments = [
    {
      icon: Lock,
      title: "Acervo 100% privado",
      desc: "Suas leituras, notas e avaliações são visíveis apenas para você.",
    },
    {
      icon: Ban,
      title: "Sem anúncios",
      desc: "Experiência editorial silenciosa, livre de publicidade ou algoritmos.",
    },
    {
      icon: ShieldCheck,
      title: "Sem venda de dados",
      desc: "Seus hábitos literários jamais são comercializados ou compartilhados.",
    },
    {
      icon: Download,
      title: "Exportação livre pelo leitor",
      desc: "Baixe todo o seu acervo em JSON ou CSV quando quiser (LGPD).",
    },
  ];

  const faqs = [
    {
      q: "O ReadingFlow é uma rede social?",
      a: "Não. O ReadingFlow é 100% individual e privado. Sem feeds, curtidas ou seguidores. O foco é exclusivamente na sua experiência de leitura.",
    },
    {
      q: "Posso importar meu histórico do Goodreads?",
      a: "Em breve. A importação direta de arquivos CSV do Goodreads e de planilhas próprias está em desenvolvimento. Hoje você já pode catalogar livros por busca ou ISBN e exportar ou restaurar seu acervo completo em JSON e CSV.",
    },
    {
      q: "Como funciona a estante em 3D?",
      a: "Nossa estante tridimensional apresenta seu acervo com iluminação configurável, capas reais e acabamento de biblioteca clássica em tempo real, sem pesar na sua conexão.",
    },
    {
      q: "Funciona para livros físicos, e-books e audiobooks?",
      a: "Perfeitamente. Cada formato tem acompanhamento dedicado: páginas para livros físicos, porcentagem para e-books e minutagem exata para audiobooks.",
    },
  ];

  return (
    <div className="relative w-full overflow-x-hidden bg-[var(--rf-surface-canvas)] text-[var(--rf-text-primary)]">
      {/* 1. HERO 2D COM SELEÇÃO ALEATÓRIA DE LAYOUT A CADA RECARREGAMENTO (public/landing-layouts/) */}
      <HeroRotator layouts={heroLayouts} />

      {/* 2. SOBRE O READINGFLOW */}
      <section
        id="sobre"
        className="rf-light-section relative scroll-mt-14 sm:scroll-mt-16 border-t border-[var(--rf-border-accent-soft)] bg-[var(--rf-surface-canvas)] px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
      >
        <ScrollReveal className="mx-auto max-w-5xl text-center">
          <p className="rf-eyebrow mb-3 font-sans text-xs font-semibold uppercase tracking-[0.12em] text-[var(--rf-text-accent-secondary)] sm:text-sm">
            O refúgio particular do leitor
          </p>
          <h2 className="rf-title-h1 text-balance tracking-tight text-[var(--rf-text-heading)]">
            Sobre o ReadingFlow
          </h2>
          <div className="mx-auto mt-4 h-0.5 w-20 bg-[var(--rf-accent-secondary)]" />
          <p className="rf-body-text mx-auto mt-6 max-w-3xl leading-relaxed text-[var(--rf-text-primary)]">
            Uma biblioteca pessoal clássica, silenciosa e acolhedora, construída
            para organizar seus livros físicos, e-books e audiobooks em um só
            lugar. Sem algoritmos, sem comparações e sem ruído social. Seus
            dados e suas reflexões pertencem exclusivamente a você.
          </p>

          {/* Faixa Editorial de Compromissos de Privacidade (corpo >= 14px e contraste AA) */}
          <div
            aria-label="Compromissos de privacidade do ReadingFlow"
            className="mt-10 rounded-[var(--rf-radius-lg)] border border-[var(--rf-border-default)] bg-[var(--rf-surface-subtle)] p-6 text-left shadow-[var(--rf-shadow-xs)] sm:p-8"
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rf-divider)] pb-3">
              <span className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-[var(--rf-text-accent-secondary)] sm:text-sm">
                Pacto Editorial de Privacidade
              </span>
              <span className="font-sans text-sm font-medium text-[var(--rf-text-secondary)]">
                Privacidade por padrão · LGPD
              </span>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {privacyCommitments.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Icon
                        className="h-4 w-4 shrink-0 text-[var(--rf-text-accent-secondary)]"
                        aria-hidden="true"
                      />
                      <h3 className="font-sans text-[15px] font-semibold text-balance text-[var(--rf-text-heading)]">
                        {item.title}
                      </h3>
                    </div>
                    <p className="font-sans text-sm leading-relaxed text-[var(--rf-text-primary)]">
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/sobre"
              aria-label="Conheça nosso manifesto completo sobre o ReadingFlow"
              className="inline-flex min-h-[44px] items-center rounded-[var(--rf-radius-xs)] px-2 py-1 font-sans text-sm font-semibold text-[var(--rf-text-accent-secondary)] hover:text-[var(--rf-text-heading)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] lg:min-h-0"
            >
              Conheça nosso manifesto completo ➔
            </Link>
          </div>
        </ScrollReveal>
      </section>

      {/* 3. FUNCIONALIDADES */}
      <section
        id="funcionalidades"
        className="rf-light-section scroll-mt-14 sm:scroll-mt-16 border-t border-[var(--rf-divider)] bg-[var(--rf-surface-canvas)] px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <ScrollReveal className="mb-16 text-center">
            <p className="rf-eyebrow mb-2 font-sans text-xs font-semibold uppercase tracking-[0.12em] text-[var(--rf-text-accent-secondary)] sm:text-sm">
              Funcionalidades Essenciais
            </p>
            <h2 className="rf-title-h1 text-balance tracking-tight text-[var(--rf-text-heading)]">
              Projetado para Cada Momento da Sua Leitura
            </h2>
            <p className="rf-body-text mx-auto mt-4 max-w-2xl text-[var(--rf-text-primary)]">
              Três pilares fundamentais para transformar sua estante física e
              digital em um santuário de conhecimento.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Pilar 1: Estante Virtual */}
            <ScrollReveal delay={0.05} className="h-full">
              <div className="flex h-full flex-col justify-between rounded-[var(--rf-radius-lg)] border border-[var(--rf-border-default)] bg-[var(--rf-surface-subtle)] p-8 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--rf-border-accent)] hover:shadow-[var(--rf-shadow-lg)]">
                <div>
                  <div className="mb-5 inline-flex rounded-[var(--rf-radius-md)] bg-[var(--rf-accent-secondary-subtle)] p-3.5 text-[var(--rf-text-accent-secondary)]">
                    <Library className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <h3 className="rf-section-h3 mb-3 font-serif text-2xl text-balance text-[var(--rf-text-heading)] md:min-h-[3.9rem]">
                    Estante Virtual 3D & 2D
                  </h3>
                  <p className="text-sm leading-relaxed text-[var(--rf-text-primary)] sm:text-base">
                    Três estantes separadas para livros físicos, e-books e
                    audiobooks. Navegue pelo cenário tridimensional imersivo ou
                    alterne para listas e grades ágeis a qualquer momento.
                  </p>
                </div>
                <div className="mt-6 border-t border-[var(--rf-divider)] pt-4">
                  <Link
                    href="/funcionalidades"
                    aria-label="Conhecer a Estante Virtual"
                    className="inline-flex min-h-[44px] items-center rounded-[var(--rf-radius-xs)] px-1 py-0.5 font-sans text-[13px] font-semibold text-[var(--rf-text-accent-secondary)] hover:text-[var(--rf-text-heading)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] lg:min-h-0"
                  >
                    Conhecer a Estante ➔
                  </Link>
                </div>
              </div>
            </ScrollReveal>

            {/* Pilar 2: Cronômetro de Leitura */}
            <ScrollReveal delay={0.15} className="h-full">
              <div className="flex h-full flex-col justify-between rounded-[var(--rf-radius-lg)] border border-[var(--rf-border-default)] bg-[var(--rf-surface-subtle)] p-8 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--rf-border-accent)] hover:shadow-[var(--rf-shadow-lg)]">
                <div>
                  <div className="mb-5 inline-flex rounded-[var(--rf-radius-md)] bg-[var(--rf-accent-secondary-subtle)] p-3.5 text-[var(--rf-text-accent-secondary)]">
                    <Clock className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <h3 className="rf-section-h3 mb-3 font-serif text-2xl text-balance text-[var(--rf-text-heading)] md:min-h-[3.9rem]">
                    Cronômetro & Canto de Foco
                  </h3>
                  <p className="text-sm leading-relaxed text-[var(--rf-text-primary)] sm:text-base">
                    Mergulhe em sessões de leitura focada com cronômetro sem
                    distrações, som suave de chuva ambiente e registro de
                    progresso em páginas ou minutos.
                  </p>
                </div>
                <div className="mt-6 border-t border-[var(--rf-divider)] pt-4">
                  <Link
                    href="/funcionalidades"
                    aria-label="Conhecer o Canto de Foco"
                    className="inline-flex min-h-[44px] items-center rounded-[var(--rf-radius-xs)] px-1 py-0.5 font-sans text-[13px] font-semibold text-[var(--rf-text-accent-secondary)] hover:text-[var(--rf-text-heading)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] lg:min-h-0"
                  >
                    Conhecer o Canto de Foco ➔
                  </Link>
                </div>
              </div>
            </ScrollReveal>

            {/* Pilar 3: Metas & Evolução */}
            <ScrollReveal delay={0.25} className="h-full">
              <div className="flex h-full flex-col justify-between rounded-[var(--rf-radius-lg)] border border-[var(--rf-border-default)] bg-[var(--rf-surface-subtle)] p-8 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--rf-border-accent)] hover:shadow-[var(--rf-shadow-lg)]">
                <div>
                  <div className="mb-5 inline-flex rounded-[var(--rf-radius-md)] bg-[var(--rf-accent-secondary-subtle)] p-3.5 text-[var(--rf-text-accent-secondary)]">
                    <Award className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <h3 className="rf-section-h3 mb-3 font-serif text-2xl text-balance text-[var(--rf-text-heading)] md:min-h-[3.9rem]">
                    Metas & Evolução
                  </h3>
                  <p className="text-sm leading-relaxed text-[var(--rf-text-primary)] sm:text-base">
                    Defina metas anuais e mensais de livros e páginas. Acompanhe
                    seu ritmo de leitura com análise respeitosa, sem pressões ou
                    gamificação artificial.
                  </p>
                </div>
                <div className="mt-6 border-t border-[var(--rf-divider)] pt-4">
                  <Link
                    href="/funcionalidades"
                    aria-label="Conhecer a Evolução"
                    className="inline-flex min-h-[44px] items-center rounded-[var(--rf-radius-xs)] px-1 py-0.5 font-sans text-[13px] font-semibold text-[var(--rf-text-accent-secondary)] hover:text-[var(--rf-text-heading)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] lg:min-h-0"
                  >
                    Conhecer a Evolução ➔
                  </Link>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* 4. PRÉVIA DA ESTANTE */}
      <section
        id="preview"
        className="rf-light-section scroll-mt-14 sm:scroll-mt-16 border-y border-[var(--rf-divider)] bg-[var(--rf-surface-subtle)] px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
      >
        <div className="mx-auto max-w-5xl">
          <ScrollReveal className="mb-12 text-center">
            <p className="rf-eyebrow mb-2 font-sans text-xs font-semibold uppercase tracking-[0.12em] text-[var(--rf-text-accent-secondary)] sm:text-sm">
              Demonstração Interativa
            </p>
            <h2 className="rf-title-h1 text-balance tracking-tight text-[var(--rf-text-heading)]">
              Prévia da Sua Nova Estante
            </h2>
            <p className="rf-body-text mx-auto mt-3 max-w-xl text-[var(--rf-text-primary)]">
              Experimente a facilidade de organizar suas leituras por formato,
              registrar avaliações e acompanhar seu avanço.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.1} className="my-8">
            <LandingProductPreview />
          </ScrollReveal>

          <ScrollReveal delay={0.2} className="mt-10 text-center">
            <Link
              href="/criar-conta"
              aria-label="Criar minha estante"
              className="inline-flex min-h-[46px] items-center justify-center rounded-[var(--rf-radius-full)] border-2 border-[var(--rf-text-heading)] bg-transparent px-8 font-sans text-sm font-semibold text-[var(--rf-text-heading)] shadow-[var(--rf-shadow-xs)] transition-all hover:-translate-y-0.5 hover:border-[var(--rf-accent-secondary)] hover:bg-[var(--rf-accent-secondary)] hover:text-[var(--rf-accent-on-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] focus-visible:ring-offset-2 sm:text-base"
            >
              Criar minha estante
            </Link>
          </ScrollReveal>
        </div>
      </section>

      {/* 5. FAQ */}
      <section
        id="faq"
        className="rf-light-section scroll-mt-14 sm:scroll-mt-16 bg-[var(--rf-surface-canvas)] px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
      >
        <div className="mx-auto max-w-3xl">
          <ScrollReveal className="mb-12 text-center">
            <p className="rf-eyebrow mb-2 font-sans text-xs font-semibold uppercase tracking-[0.12em] text-[var(--rf-text-accent-secondary)] sm:text-sm">
              Dúvidas Frequentes
            </p>
            <h2 className="rf-title-h1 text-balance tracking-tight text-[var(--rf-text-heading)]">
              Perguntas & Respostas
            </h2>
          </ScrollReveal>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <ScrollReveal key={faq.q} delay={idx * 0.06}>
                <details className="group rounded-[var(--rf-radius-lg)] border border-[var(--rf-border-default)] bg-[var(--rf-surface-subtle)] p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--rf-border-accent)] open:border-[var(--rf-border-accent)]">
                  <summary
                    aria-label={faq.q}
                    className="flex min-h-[44px] cursor-pointer list-none items-center justify-between rounded-[var(--rf-radius-xs)] font-serif text-lg font-semibold text-[var(--rf-text-heading)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
                  >
                    <span>{faq.q}</span>
                    <span
                      className="ml-4 font-sans text-2xl font-light text-[var(--rf-text-accent-secondary)] transition-transform group-open:rotate-45"
                      aria-hidden="true"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 border-t border-[var(--rf-divider)] pt-2 text-sm leading-relaxed text-[var(--rf-text-primary)] sm:text-base">
                    {faq.a}
                  </p>
                </details>
              </ScrollReveal>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/faq"
              aria-label="Ver todas as perguntas na página de FAQ"
              className="inline-flex min-h-[44px] items-center rounded-[var(--rf-radius-xs)] px-2 py-1 font-sans text-[13px] font-semibold text-[var(--rf-text-accent-secondary)] hover:text-[var(--rf-text-heading)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] lg:min-h-0"
            >
              Ver todas as perguntas na página de FAQ ➔
            </Link>
          </div>
        </div>
      </section>

      {/* 6. CTA FINAL (verbo único "Criar minha estante" + frase de apoio "Grátis") */}
      <section className="rf-light-section relative border-t border-[var(--rf-divider)] bg-[var(--rf-surface-subtle)] px-4 py-24 sm:px-6 lg:px-8">
        <ScrollReveal className="mx-auto max-w-3xl text-center">
          <p className="rf-eyebrow mb-2 font-sans text-xs font-semibold uppercase tracking-[0.12em] text-[var(--rf-text-accent-secondary)] sm:text-sm">
            Seu acervo em boas mãos
          </p>
          <h2 className="rf-title-h1 mb-4 text-balance tracking-tight text-[var(--rf-text-heading)]">
            Entre na Sua Própria Biblioteca
          </h2>
          <p className="rf-body-text mx-auto mb-8 max-w-xl text-[var(--rf-text-primary)]">
            Junte-se a leitores que priorizam o silêncio, a concentração e a
            beleza de manter seu acervo organizado.
          </p>
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/criar-conta"
              aria-label="Criar minha estante"
              className="inline-flex min-h-[52px] items-center justify-center rounded-[var(--rf-radius-full)] bg-[var(--rf-accent-primary)] px-10 font-sans text-base font-semibold text-[var(--rf-accent-on-primary)] shadow-[var(--rf-shadow-lg)] transition-all hover:-translate-y-0.5 hover:bg-[var(--rf-accent-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] focus-visible:ring-offset-2 active:scale-95 sm:text-lg"
            >
              Criar minha estante
            </Link>
            <p className="font-sans text-sm font-medium text-[var(--rf-text-secondary)]">
              Grátis · sem anúncios · seus dados pertencem a você
            </p>
          </div>
        </ScrollReveal>
      </section>

      {/* 7. FOOTER (#contato) */}
      <MarketingFooter />
    </div>
  );
}
