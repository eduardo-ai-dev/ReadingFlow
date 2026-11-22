import {
  CheckCircle2,
  Clock,
  Compass,
  PauseCircle,
  Target,
  TrendingUp,
} from "lucide-react";
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
  const config: Record<
    GoalPaceStatus,
    {
      label: string;
      style: string;
      Icon: typeof Compass;
    }
  > = {
    completed: {
      label: "Cumprida",
      style:
        "border-[var(--rf-status-success)] bg-[var(--rf-status-success-bg)] text-[var(--rf-status-success)]",
      Icon: CheckCircle2,
    },
    on_track: {
      label: "No ritmo",
      style:
        "border-[var(--rf-border-accent)] bg-[var(--rf-accent-primary-subtle)] text-[var(--rf-text-heading)]",
      Icon: Compass,
    },
    achievable: {
      label: "Dá para alcançar",
      style:
        "border-[var(--rf-status-warning)] bg-[var(--rf-status-warning-bg)] text-[var(--rf-status-warning)]",
      Icon: TrendingUp,
    },
    ambitious: {
      label: "Meta ambiciosa",
      style:
        "border-[var(--rf-border-secondary)] bg-[var(--rf-accent-secondary-subtle)] text-[var(--rf-text-accent-secondary)]",
      Icon: Target,
    },
    collecting_data: {
      label: "Ainda coletando dados",
      style:
        "border-[var(--rf-border-default)] bg-[var(--rf-surface-subtle)] text-[var(--rf-text-secondary)]",
      Icon: Clock,
    },
    paused: {
      label: "Pausada",
      style:
        "border-[var(--rf-border-default)] bg-[var(--rf-surface-subtle)] text-[var(--rf-text-secondary)]",
      Icon: PauseCircle,
    },
  };

  const { label, style, Icon } = config[status];

  return (
    <span
      data-goal-status={status}
      className={`inline-flex items-center gap-1.5 rounded-[var(--rf-radius-full)] border px-2.5 py-0.5 font-sans text-[13px] font-semibold ${style}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
