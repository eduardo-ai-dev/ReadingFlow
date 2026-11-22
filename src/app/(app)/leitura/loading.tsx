export default function ReadingLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando acompanhamento de leitura"
      className="space-y-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="rf-skeleton h-3 w-44" />
          <div className="rf-skeleton h-9 w-72 max-w-full" />
        </div>
        <div className="rf-skeleton h-11 w-44 rounded-[var(--rf-radius-md)]" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="flex gap-4 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5"
          >
            <div className="rf-skeleton h-36 w-24 shrink-0" />
            <div className="flex-1 space-y-2.5">
              <div className="rf-skeleton h-4 w-32" />
              <div className="rf-skeleton h-6 w-3/4" />
              <div className="rf-skeleton h-3 w-1/2" />
              <div className="rf-skeleton mt-4 h-2 w-full rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
