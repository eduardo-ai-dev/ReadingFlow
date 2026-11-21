import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer
      id="contato"
      className="relative scroll-mt-14 sm:scroll-mt-16 border-t border-[var(--rf-footer-border)] bg-gradient-to-b from-[var(--rf-footer-bg-from)] via-[var(--rf-footer-bg-via)] to-[var(--rf-footer-bg-to)] text-[var(--rf-nav-text-subtle)] shadow-[var(--rf-footer-inset-highlight)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-16"
        style={{ backgroundImage: "var(--rf-footer-glow)" }}
      />
      <div className="relative mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-4 px-6 py-10 font-sans text-xs sm:flex-row sm:items-center sm:px-10">
        <div>
          <p className="font-serif text-sm font-semibold text-[var(--rf-nav-text)] tracking-wide">
            ReadingFlow — Biblioteca Pessoal Digital
          </p>
          <p className="mt-1 font-sans text-[var(--rf-nav-text-muted)]">
            Estética clássica, rigor acadêmico e tecnologia moderna. Sem feed, sem anúncios e com portabilidade total.
          </p>
        </div>
        <div className="flex flex-wrap gap-5 font-sans text-[var(--rf-nav-accent-hover)]">
          <Link
            href="/termos"
            aria-label="Ler Termos de Uso"
            className="rounded-[var(--rf-radius-xs)] px-1 py-0.5 hover:text-[var(--rf-nav-text)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] transition-colors"
          >
            Termos de Uso
          </Link>
          <Link
            href="/privacidade"
            aria-label="Ler Política de Privacidade (LGPD)"
            className="rounded-[var(--rf-radius-xs)] px-1 py-0.5 hover:text-[var(--rf-nav-text)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] transition-colors"
          >
            Privacidade (LGPD)
          </Link>
          <Link
            href="/ajuda"
            aria-label="Ir para Ajuda e Portabilidade"
            className="rounded-[var(--rf-radius-xs)] px-1 py-0.5 hover:text-[var(--rf-nav-text)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] transition-colors"
          >
            Ajuda e Portabilidade
          </Link>
        </div>
      </div>
    </footer>
  );
}

