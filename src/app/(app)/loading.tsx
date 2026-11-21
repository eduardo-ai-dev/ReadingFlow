export default function AppRouteLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando conteúdo"
      className="space-y-6 py-2"
    >
      <div className="space-y-3 border-b border-[var(--rf-divider)] pb-5">
        <div className="h-3 w-32 animate-pulse rounded bg-[var(--rf-surface-subtle)]" />
        <div className="h-9 w-64 animate-pulse rounded-md bg-[var(--rf-surface-subtle)]" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-[var(--rf-surface-subtle)]" />
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <div className="rf-card h-44 animate-pulse bg-[var(--rf-surface-subtle)]/60" />
        <div className="rf-card h-44 animate-pulse bg-[var(--rf-surface-subtle)]/60" />
        <div className="rf-card hidden h-44 animate-pulse bg-[var(--rf-surface-subtle)]/60 lg:block" />
      </div>

      <div className="rf-card h-64 animate-pulse bg-[var(--rf-surface-subtle)]/50" />
    </div>
  );
}
