export default function StatisticsLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Carregando estatísticas e ranking"
      className="space-y-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="rf-skeleton h-3 w-36" />
          <div className="rf-skeleton h-9 w-72 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-1.5 rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-surface)] p-1">
          <div className="rf-skeleton h-10 w-24 rounded-[6px]" />
          <div className="rf-skeleton h-10 w-24 rounded-[6px]" />
          <div className="rf-skeleton h-10 w-32 rounded-[6px]" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div
            key={idx}
            className="space-y-2 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
          >
            <div className="rf-skeleton h-3.5 w-28 max-w-full" />
            <div className="rf-skeleton h-8 w-16" />
            <div className="rf-skeleton h-3 w-36 max-w-full" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="min-w-0 space-y-3 lg:col-span-6">
          <div className="rf-skeleton h-6 w-40" />
          <div className="space-y-3 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <div className="rf-skeleton h-8 w-full" />
            <div className="rf-skeleton h-8 w-full" />
            <div className="rf-skeleton h-8 w-full" />
          </div>
        </div>

        <div className="min-w-0 space-y-3 lg:col-span-6">
          <div className="rf-skeleton h-6 w-56" />
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="flex min-h-[56px] items-center justify-between gap-3 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="rf-skeleton h-4 w-3/4" />
                  <div className="rf-skeleton h-3 w-1/2" />
                </div>
                <div className="rf-skeleton h-6 w-14 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
