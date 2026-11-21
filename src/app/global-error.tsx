"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body className="m-0 flex min-h-dvh flex-col items-center justify-center bg-[var(--rf-surface-canvas,#F4EFE6)] px-6 text-center font-sans text-[var(--rf-text-primary,#2C221E)] antialiased">
        <main className="max-w-md space-y-4">
          <p className="font-mono text-xs font-semibold tracking-widest text-[var(--rf-status-danger,#9E2A2B)] uppercase">
            Erro crítico da aplicação
          </p>
          <h1 className="font-serif text-3xl font-bold text-[var(--rf-text-heading,#2C221E)]">
            Algo saiu do esperado
          </h1>
          <p className="text-sm leading-relaxed text-[var(--rf-text-secondary,#61554B)]">
            Não foi possível concluir o carregamento desta página. Tente
            recarregar a aplicação.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-[8px] bg-[var(--rf-accent-secondary,#722F3E)] px-5 text-sm font-semibold text-[var(--rf-accent-on-secondary,#F4EFE6)] transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rf-focus-ring-color,#8C6D3F)]"
            >
              Recarregar página
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
