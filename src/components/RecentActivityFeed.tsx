import Link from "next/link";
import { BookOpen, CheckCircle2, Library, Star } from "lucide-react";
import { formatRelativeTimePtBr } from "@/lib/formatters";
import type { DashboardActivityEvent } from "@/features/dashboard/queries";
import { DashboardBlockEmpty } from "@/components/DashboardBlockState";
import { rfButtonClassName } from "@/components/ui/ActionControls";

export function RecentActivityFeed({
  events,
  referenceDateIso,
}: {
  events: DashboardActivityEvent[];
  referenceDateIso?: string;
}) {
  const iconMap: Record<
    DashboardActivityEvent["type"],
    { icon: React.ReactNode; bg: string; text: string }
  > = {
    progress: {
      icon: <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />,
      bg: "bg-[var(--rf-surface-subtle)]",
      text: "text-[var(--rf-text-accent-secondary)]",
    },
    finished: {
      icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />,
      bg: "bg-[var(--rf-status-success-bg)]",
      text: "text-[var(--rf-status-success)]",
    },
    added: {
      icon: <Library className="h-3.5 w-3.5" aria-hidden="true" />,
      bg: "bg-[var(--rf-surface-canvas)]",
      text: "text-[var(--rf-text-heading)]",
    },
    reviewed: {
      icon: <Star className="h-3.5 w-3.5" aria-hidden="true" />,
      bg: "bg-[var(--rf-status-warning-bg)]",
      text: "text-[var(--rf-status-warning)]",
    },
  };

  return (
    <section
      aria-labelledby="atividade-titulo"
      className="rf-card flex h-full flex-col justify-between"
    >
      <div>
        <div className="flex items-start justify-between gap-2 border-b border-[var(--rf-divider)] pb-3.5">
          <div>
            <p className="rf-type-label text-[var(--rf-text-accent-secondary)]">
              Caderno de Registros
            </p>
            <h2 id="atividade-titulo" className="rf-type-section-title mt-0.5">
              Atividade Recente
            </h2>
          </div>
          <Link
            href="/leitura"
            className={rfButtonClassName({
              variant: "subtle",
              size: "sm",
              className: "-mr-2",
            })}
          >
            <span>Ver histórico</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        {events.length === 0 ? (
          <DashboardBlockEmpty
            compact
            title="Nenhuma atividade registrada ainda"
            description="Avanços de página, conclusões, novas obras e avaliações aparecem aqui priorizando suas leituras."
            actionLabel="Abrir leituras"
            actionHref="/leitura"
          />
        ) : (
          <ul className="mt-2 divide-y divide-[var(--rf-divider)]">
            {events.map((ev) => {
              const config = iconMap[ev.type];
              const targetHref =
                ev.href ?? (ev.workId ? `/livros/${ev.workId}` : undefined);

              return (
                <li
                  key={ev.id}
                  className="flex items-start gap-3 py-3 first:pt-2 last:pb-0"
                >
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--rf-radius-full)] border border-[var(--rf-border-default)] ${config.bg} ${config.text}`}
                  >
                    {config.icon}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="rf-type-body font-medium text-[var(--rf-text-primary)]">
                      {targetHref ? (
                        <Link
                          href={targetHref}
                          className="transition-colors hover:text-[var(--rf-text-accent-secondary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
                        >
                          {ev.title}
                        </Link>
                      ) : (
                        ev.title
                      )}
                    </p>

                    <div className="rf-type-caption mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[var(--rf-text-secondary)]">
                      <span>{ev.detail}</span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={ev.timestamp}>
                        {formatRelativeTimePtBr(ev.timestamp, referenceDateIso)}
                      </time>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
