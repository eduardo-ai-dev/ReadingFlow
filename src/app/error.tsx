"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[var(--bg-canvas)] px-6 text-center">
      <p className="font-mono text-xs font-semibold tracking-widest text-[var(--status-error)] uppercase">
        Falha inesperada
      </p>
      <h1 className="mt-2 font-serif text-3xl font-bold text-[var(--text-heading)]">
        Não foi possível carregar esta página
      </h1>
      <p className="mt-3 max-w-md text-sm text-[var(--text-muted)]">
        Nenhum dado do seu acervo foi perdido. Tente recarregar a visualização.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 inline-flex min-h-[44px] items-center rounded-[8px] bg-[var(--accent-primary)] px-5 text-sm font-semibold text-[var(--on-primary)] hover:bg-[var(--accent-primary-hover)]"
      >
        Tentar novamente
      </button>
    </main>
  );
}
