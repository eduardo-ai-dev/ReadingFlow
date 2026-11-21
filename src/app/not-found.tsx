import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[var(--bg-canvas)] px-6 text-center">
      <p className="editorial-kicker">Erro 404</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-[var(--text-heading)]">
        Página não encontrada no acervo
      </h1>
      <p className="mt-3 max-w-md text-sm text-[var(--text-muted)]">
        O endereço acessado não existe ou foi movido. Volte ao painel ou à
        página inicial para continuar navegando.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/painel"
          className="inline-flex min-h-[44px] items-center rounded-[8px] bg-[var(--accent-primary)] px-5 text-sm font-semibold text-[var(--on-primary)] hover:bg-[var(--accent-primary-hover)]"
        >
          Ir para o Painel
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
        >
          Página inicial
        </Link>
      </div>
    </main>
  );
}
