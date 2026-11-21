export default function CantoDeFocoLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando Canto de Foco"
      className="space-y-6 pb-8"
    >
      <div className="space-y-2 border-b border-[var(--rf-divider)] pb-5">
        <div className="h-3 w-28 animate-pulse rounded bg-[var(--rf-surface-subtle)]" />
        <div className="h-9 w-52 animate-pulse rounded-md bg-[var(--rf-surface-subtle)]" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="rf-card flex h-96 flex-col items-center justify-center gap-4">
          <div className="h-48 w-48 animate-pulse rounded-full border-4 border-[var(--rf-border-subtle)] bg-[var(--rf-surface-subtle)]/50" />
          <div className="h-10 w-44 animate-pulse rounded-full bg-[var(--rf-surface-subtle)]" />
        </div>
        <div className="rf-card h-96 animate-pulse bg-[var(--rf-surface-subtle)]/50" />
      </div>
    </div>
  );
}
