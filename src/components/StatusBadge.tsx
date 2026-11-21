import type { BookFormat, ReadingStatus } from "@/lib/domain";
import { ptBR } from "@/lib/i18n/pt-BR";
import type { GoalPaceStatus } from "@/features/goals/rules";

export function ReadingStatusBadge({ status }: { status: ReadingStatus }) {
  const styles: Record<ReadingStatus, string> = {
    not_started:
      "border-[var(--rf-border-default)] bg-[var(--rf-surface-subtle)] text-[var(--rf-text-secondary)]",
    reading:
      "border-[var(--rf-border-accent-soft)] bg-[var(--rf-surface-contrast)] text-[var(--rf-text-on-contrast-muted)] font-bold",
    paused:
      "border-[var(--rf-status-warning)] bg-[var(--rf-status-warning-bg)] text-[var(--rf-status-warning)]",
    finished:
      "border-[var(--rf-status-success)] bg-[var(--rf-status-success-bg)] text-[var(--rf-status-success)] font-semibold",
    abandoned:
      "border-[var(--rf-border-default)] bg-[var(--rf-surface-subtle)] text-[var(--rf-text-secondary)]",
  };

  return (
    <span
      className={`inline-flex items-center rounded-[var(--rf-radius-full)] border px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {ptBR.readingStatus[status]}
    </span>
  );
}

export function FormatBadge({ format }: { format: BookFormat }) {
  return (
    <span className="inline-flex items-center rounded-[var(--rf-radius-sm)] border border-[var(--rf-border-default)] bg-[var(--rf-surface-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--rf-text-secondary)]">
      {ptBR.formats[format]}
    </span>
  );
}

export function GoalPaceBadge({ status }: { status: GoalPaceStatus }) {
  const labels: Record<GoalPaceStatus, string> = {
    completed: "Cumprida",
    ahead: "Adiantada",
    on_track: "No ritmo",
    behind: "Atrasada",
  };
  const styles: Record<GoalPaceStatus, string> = {
    completed:
      "border-[var(--rf-status-success)] bg-[var(--rf-status-success-bg)] text-[var(--rf-status-success)]",
    ahead:
      "border-[var(--rf-status-success)] bg-[var(--rf-status-success-bg)] text-[var(--rf-status-success)]",
    on_track:
      "border-[var(--rf-status-warning)] bg-[var(--rf-status-warning-bg)] text-[var(--rf-status-warning)]",
    behind:
      "border-[var(--rf-status-error)] bg-[var(--rf-status-error-bg)] text-[var(--rf-status-error)]",
  };

  return (
    <span
      className={`inline-flex items-center rounded-[var(--rf-radius-full)] border px-2.5 py-0.5 font-sans text-[13px] font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
