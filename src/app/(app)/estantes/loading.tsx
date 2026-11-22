export default function ShelvesLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando estantes"
      className="space-y-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="rf-skeleton h-3 w-28" />
          <div className="rf-skeleton h-9 w-52" />
        </div>
        <div className="flex gap-2.5">
          <div className="rf-skeleton h-10 w-36 rounded-[var(--rf-radius-md)]" />
          <div className="rf-skeleton h-10 w-36 rounded-[var(--rf-radius-md)]" />
        </div>
      </div>

      <div className="rf-card h-64 w-full space-y-4 p-5">
        <div className="rf-skeleton h-5 w-44" />
        <div className="rf-skeleton h-40 w-full" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex gap-4 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
          >
            <div className="rf-skeleton h-32 w-24 shrink-0" />
            <div className="flex-1 space-y-2.5">
              <div className="rf-skeleton h-4 w-28" />
              <div className="rf-skeleton h-5 w-4/5" />
              <div className="rf-skeleton h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
