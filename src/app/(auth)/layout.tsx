import Link from "next/link";
import { ptBR } from "@/lib/i18n/pt-BR";
import { LibraryBackdrop } from "@/components/layout/LibraryBackdrop";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-[var(--rf-surface-canvas)] text-[var(--rf-text-primary)]">
      <a href="#conteudo-auth" className="skip-link">
        {ptBR.nav.skipToContent}
      </a>

      <LibraryBackdrop variant="auth" />

      {/* 1. Cabeçalho Compacto Unificado (/entrar e /criar-conta) */}
      <header className="relative z-10 min-h-16 border-b border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)] pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="group inline-flex min-h-[44px] items-center gap-2.5 rounded-[var(--rf-radius-xs)] px-1 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
          >
            <span className="font-serif text-xl font-semibold tracking-tight text-[var(--rf-text-primary)] transition-colors group-hover:text-[var(--rf-text-accent-secondary)]">
              ReadingFlow
            </span>
            <span className="hidden font-serif text-sm italic text-[var(--rf-text-secondary)] sm:inline">
              Leia. Acompanhe. Evolua.
            </span>
          </Link>

          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--rf-radius-md)] px-3 py-1.5 font-sans text-xs font-semibold tracking-[0.01em] text-[var(--rf-text-heading)] no-underline transition-all duration-200 ease-[var(--ease-editorial)] hover:-translate-y-[1px] hover:bg-[var(--rf-surface-subtle)] hover:text-[var(--rf-text-accent-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
          >
            <span>← Voltar ao início</span>
          </Link>
        </div>
      </header>

      {/* Container Central do Card de Autenticação */}
      <main
        id="conteudo-auth"
        tabIndex={-1}
        className="relative z-10 flex flex-1 items-center justify-center px-4 py-8 sm:py-10"
      >
        <div className="w-full max-w-[456px]">{children}</div>
      </main>

      {/* 6. Rodapé Discreto */}
      <footer className="relative z-10 border-t border-[var(--rf-border-subtle)] py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center font-sans text-xs text-[var(--rf-text-heading)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-4 px-6">
          <Link
            href="/privacidade"
            className="rounded-[var(--rf-radius-xs)] px-1 no-underline transition-colors hover:text-[var(--rf-text-accent-secondary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
          >
            Política de Privacidade
          </Link>
          <span aria-hidden="true" className="text-[var(--rf-text-tertiary)]">
            ·
          </span>
          <Link
            href="/termos"
            className="rounded-[var(--rf-radius-xs)] px-1 no-underline transition-colors hover:text-[var(--rf-text-accent-secondary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
          >
            Termos de Uso
          </Link>
          <span aria-hidden="true" className="text-[var(--rf-text-tertiary)]">
            ·
          </span>
          <span>© 2026 ReadingFlow</span>
        </div>
      </footer>
    </div>
  );
}
