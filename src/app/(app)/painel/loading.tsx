export default function DashboardLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Carregando Mesa de Leitura"
      className="rf-dashboard-shell"
    >
      {/* 1. Cabeçalho + KPIs */}
      <div>
        <div className="border-y border-[var(--rf-divider)] py-4 sm:py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="rf-skeleton h-3.5 w-36" />
            <div className="rf-skeleton h-3.5 w-44" />
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
            <div className="rf-skeleton h-9 w-64 sm:h-11 sm:w-80" />
            <div className="rf-skeleton h-4 w-52" />
          </div>
        </div>

        <div className="grid grid-cols-2 divide-y divide-[var(--rf-divider)] border-b border-[var(--rf-divider)] py-5 md:grid-cols-4 md:divide-y-0">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="space-y-2 p-3 first:pl-0 md:border-r md:border-[var(--rf-divider)] md:last:border-r-0"
            >
              <div className="rf-skeleton h-3 w-24" />
              <div className="rf-skeleton h-9 w-16" />
              <div className="rf-skeleton h-3 w-32" />
            </div>
          ))}
        </div>
      </div>

      {/* 2. Na Cabeceira + Ritmo & Próximo */}
      <div className="space-y-4">
        <div className="flex items-end justify-between gap-2">
          <div className="space-y-1.5">
            <div className="rf-skeleton h-3 w-32" />
            <div className="rf-skeleton h-7 w-56" />
          </div>
          <div className="rf-skeleton h-4 w-32" />
        </div>

        <div className="rf-dashboard-band">
          <div className="rf-dashboard-main">
            <div
              data-rf-block="spotlight"
              className="rf-card-spotlight space-y-5"
            >
              <div className="flex flex-col gap-6 md:flex-row">
                <div className="rf-skeleton-dark mx-auto h-48 w-32 shrink-0 rounded-md md:mx-0" />
                <div className="flex-1 space-y-3">
                  <div className="rf-skeleton-dark h-4 w-40" />
                  <div className="rf-skeleton-dark h-8 w-3/4" />
                  <div className="rf-skeleton-dark h-4 w-44" />
                  <div className="pt-4">
                    <div className="rf-skeleton-dark h-2 w-full rounded-full" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-3">
                    <div className="rf-skeleton-dark h-10 w-full" />
                    <div className="rf-skeleton-dark h-10 w-full" />
                  </div>
                </div>
              </div>
              <div className="border-t border-[var(--rf-border-accent-soft)] pt-4">
                <div className="rf-skeleton-dark h-10 w-full" />
              </div>
            </div>
          </div>

          <div className="rf-dashboard-aside">
            <div data-rf-block="pace" className="rf-card space-y-4">
              <div className="space-y-1.5 border-b border-[var(--rf-divider)] pb-3">
                <div className="rf-skeleton h-3 w-28" />
                <div className="rf-skeleton h-6 w-36" />
              </div>
              <div className="space-y-3">
                <div className="rf-skeleton h-10 w-full" />
                <div className="rf-skeleton h-10 w-full" />
                <div className="rf-skeleton h-10 w-full" />
              </div>
            </div>

            <div data-rf-block="next-up" className="rf-card space-y-3">
              <div className="rf-skeleton h-3 w-28" />
              <div className="flex items-center gap-3">
                <div className="rf-skeleton h-16 w-11 shrink-0 rounded-md" />
                <div className="flex-1 space-y-2">
                  <div className="rf-skeleton h-4 w-3/4" />
                  <div className="rf-skeleton h-3 w-1/2" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Acervo & Caderno */}
      <div className="space-y-4">
        <div className="border-b border-[var(--rf-divider)] pb-2">
          <div className="rf-skeleton h-3.5 w-40" />
        </div>

        <div className="rf-dashboard-band">
          <div className="rf-dashboard-main">
            <div data-rf-block="collection" className="rf-card space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--rf-divider)] pb-3">
                <div className="rf-skeleton h-6 w-48" />
                <div className="rf-skeleton h-4 w-32" />
              </div>
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="rf-skeleton h-8 w-24 rounded-full" />
                ))}
              </div>
              <div className="rf-collection-grid">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-2">
                    <div className="rf-skeleton h-28 w-20 rounded-md" />
                    <div className="rf-skeleton h-3 w-20" />
                  </div>
                ))}
              </div>
            </div>

            <div data-rf-block="activity" className="rf-card space-y-3">
              <div className="rf-skeleton h-6 w-40" />
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <div className="rf-skeleton h-7 w-7 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <div className="rf-skeleton h-3.5 w-2/3" />
                    <div className="rf-skeleton h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>

            <div data-rf-block="monthly" className="rf-card space-y-4">
              <div className="rf-skeleton h-6 w-44" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rf-skeleton h-16 w-full" />
                <div className="rf-skeleton h-16 w-full" />
                <div className="rf-skeleton h-16 w-full" />
              </div>
            </div>
          </div>

          <div className="rf-dashboard-aside">
            <div data-rf-block="goals" className="rf-card space-y-4">
              <div className="rf-skeleton h-6 w-36" />
              <div className="rf-skeleton h-20 w-full" />
              <div className="rf-skeleton h-20 w-full" />
            </div>

            <div data-rf-block="calendar" className="rf-card space-y-3">
              <div className="rf-skeleton h-6 w-40" />
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: 28 }).map((_, idx) => (
                  <div key={idx} className="rf-skeleton h-8 w-full" />
                ))}
              </div>
            </div>

            <div data-rf-block="ranking" className="rf-card space-y-3">
              <div className="rf-skeleton h-6 w-44" />
              {[0, 1, 2].map((i) => (
                <div key={i} className="rf-skeleton h-12 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
