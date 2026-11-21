export default function Estante3DLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando Estante 3D"
      className="space-y-6 pb-8"
    >
      <div className="flex flex-col gap-4 border-b border-[var(--rf-divider)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="h-3 w-28 animate-pulse rounded bg-[var(--rf-surface-subtle)]" />
          <div className="h-9 w-56 animate-pulse rounded-md bg-[var(--rf-surface-subtle)]" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded bg-[var(--rf-surface-subtle)]" />
        </div>
        <div className="flex gap-2.5">
          <div className="h-10 w-32 animate-pulse rounded-full bg-[var(--rf-surface-subtle)]" />
          <div className="h-10 w-36 animate-pulse rounded-full bg-[var(--rf-surface-subtle)]" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[640px_minmax(280px,1fr)]">
        <div className="rf-card space-y-6 p-5">
          {[0, 1].map((row) => (
            <div key={row} className="space-y-2">
              <div className="flex items-end gap-1.5 px-3 pt-4">
                {[38, 28, 44, 32, 36, 26, 42, 30, 34].map((w, i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-t-sm bg-[var(--rf-surface-subtle)]"
                    style={{
                      width: `${w}px`,
                      height: `${154 + ((i * 19) % 36)}px`,
                    }}
                  />
                ))}
              </div>
              <div className="h-4 w-full rounded bg-[var(--rf-border-default)]/50" />
            </div>
          ))}
        </div>

        <div className="rf-card hidden h-80 animate-pulse bg-[var(--rf-surface-subtle)]/60 lg:block" />
      </div>
    </div>
  );
}
