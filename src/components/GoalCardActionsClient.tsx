"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Compass,
  PauseCircle,
  PlayCircle,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  togglePauseGoalAction,
  updateGoalAction,
} from "@/features/goals/actions";
import type { GoalPaceStatus } from "@/features/goals/rules";
import { shiftYmdDays } from "@/lib/dates";
import { formatNumberPtBr } from "@/lib/formatters";

export interface GoalCardActionsProps {
  goalId: string;
  goalTitle: string;
  goalKind: "books" | "pages";
  targetValue: number;
  startsOn: string;
  endsOn: string;
  paused?: boolean;
  paceStatus: GoalPaceStatus;
  suggestedTargetValue: number | null;
  realisticAlternativePtBr: string | null;
  howToReachStepsPtBr: string[];
  compact?: boolean;
}

export function GoalCardActionsClient({
  goalId,
  goalTitle,
  goalKind,
  targetValue,
  startsOn,
  endsOn,
  paused = false,
  paceStatus,
  suggestedTargetValue,
  realisticAlternativePtBr,
  howToReachStepsPtBr,
  compact = false,
}: GoalCardActionsProps) {
  const router = useRouter();
  const [openPanel, setOpenPanel] = useState<"none" | "adjust" | "plan">(
    "none"
  );
  const [nextTarget, setNextTarget] = useState(String(targetValue));
  const [nextEndsOn, setNextEndsOn] = useState(endsOn);
  const [feedback, setFeedback] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const unitLabel = goalKind === "books" ? "livros" : "páginas";

  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const parsedTarget = Number.parseInt(nextTarget.trim(), 10);
    if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) {
      setFeedback({
        tone: "error",
        text: "Informe um número inteiro maior que zero.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const res = await updateGoalAction({
          goalId,
          targetValue: parsedTarget,
          endsOn: nextEndsOn,
        });
        if (!res.ok) {
          setFeedback({ tone: "error", text: res.error });
          return;
        }
        setFeedback({
          tone: "ok",
          text: "Meta ajustada com sucesso, sem penalidade.",
        });
        setOpenPanel("none");
        router.refresh();
      } catch {
        setFeedback({
          tone: "error",
          text: "Não foi possível salvar o ajuste agora. Tente novamente.",
        });
      }
    });
  };

  const handleApplySuggestion = () => {
    if (!suggestedTargetValue) return;
    setNextTarget(String(suggestedTargetValue));
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await updateGoalAction({
          goalId,
          targetValue: suggestedTargetValue,
        });
        if (!res.ok) {
          setFeedback({ tone: "error", text: res.error });
          return;
        }
        setFeedback({
          tone: "ok",
          text: `Meta ajustada para ${formatNumberPtBr(suggestedTargetValue)} ${unitLabel}.`,
        });
        setOpenPanel("none");
        router.refresh();
      } catch {
        setFeedback({
          tone: "error",
          text: "Não foi possível aplicar o ajuste agora.",
        });
      }
    });
  };

  const handleTogglePause = () => {
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await togglePauseGoalAction({
          goalId,
          paused: !paused,
        });
        if (!res.ok) {
          setFeedback({ tone: "error", text: res.error });
          return;
        }
        setFeedback({
          tone: "ok",
          text: res.paused
            ? "Meta pausada sem penalidade."
            : "Meta retomada com sucesso.",
        });
        router.refresh();
      } catch {
        setFeedback({
          tone: "error",
          text: "Não foi possível atualizar o estado da meta agora.",
        });
      }
    });
  };

  const postponeByDays = (days: number) => {
    setNextEndsOn((current) => shiftYmdDays(current || endsOn, days));
  };

  return (
    <div className={compact ? "mt-3 space-y-2.5" : "mt-4 space-y-3"}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setFeedback(null);
            setNextTarget(String(targetValue));
            setNextEndsOn(endsOn);
            setOpenPanel((prev) => (prev === "adjust" ? "none" : "adjust"));
          }}
          aria-expanded={openPanel === "adjust"}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--rf-radius-md)] border border-[var(--rf-border-strong)] bg-[var(--rf-surface-elevated)] px-3 py-1.5 font-sans text-xs font-semibold text-[var(--rf-text-primary)] transition-colors hover:border-[var(--rf-border-accent)] hover:bg-[var(--rf-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] lg:min-h-[34px]"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Ajustar meta</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setFeedback(null);
            setOpenPanel((prev) => (prev === "plan" ? "none" : "plan"));
          }}
          aria-expanded={openPanel === "plan"}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--rf-radius-md)] border border-[var(--rf-border-secondary)] bg-[var(--rf-accent-secondary-subtle)] px-3 py-1.5 font-sans text-xs font-semibold text-[var(--rf-text-accent-secondary)] transition-colors hover:border-[var(--rf-border-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] lg:min-h-[34px]"
        >
          <Compass className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Ver como chegar lá</span>
        </button>

        {paceStatus !== "completed" ? (
          <button
            type="button"
            disabled={isPending}
            onClick={handleTogglePause}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--rf-radius-md)] border border-[var(--rf-border-default)] bg-transparent px-3 py-1.5 font-sans text-xs font-medium text-[var(--rf-text-secondary)] transition-colors hover:border-[var(--rf-border-strong)] hover:text-[var(--rf-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] disabled:opacity-60 lg:min-h-[34px]"
          >
            {paused ? (
              <>
                <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Retomar</span>
              </>
            ) : (
              <>
                <PauseCircle className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Pausar</span>
              </>
            )}
          </button>
        ) : null}
      </div>

      {feedback ? (
        <p
          role={feedback.tone === "error" ? "alert" : "status"}
          className={`rounded-[var(--rf-radius-md)] border px-3 py-2 font-sans text-xs font-medium ${
            feedback.tone === "ok"
              ? "border-[var(--rf-status-success)] bg-[var(--rf-status-success-bg)] text-[var(--rf-status-success)]"
              : "border-[var(--rf-status-error)] bg-[var(--rf-status-error-bg)] text-[var(--rf-status-error)]"
          }`}
        >
          {feedback.text}
        </p>
      ) : null}

      {openPanel === "adjust" ? (
        <form
          onSubmit={handleSaveAdjustment}
          aria-label={`Ajustar meta ${goalTitle}`}
          className="space-y-3 rounded-[var(--rf-radius-md)] border border-[var(--rf-border-default)] bg-[var(--rf-surface-canvas)] p-3.5"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-sans text-xs font-semibold text-[var(--rf-text-heading)]">
              Ajustar alvo ou adiar prazo (sem penalidade)
            </p>
            <button
              type="button"
              onClick={() => setOpenPanel("none")}
              aria-label="Fechar painel de ajuste"
              className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--rf-radius-sm)] text-[var(--rf-text-secondary)] hover:bg-[var(--rf-surface-subtle)] hover:text-[var(--rf-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {suggestedTargetValue && realisticAlternativePtBr ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--rf-radius-sm)] border border-[var(--rf-border-accent-soft)] bg-[var(--rf-accent-primary-subtle)] px-3 py-2">
              <span className="font-sans text-xs text-[var(--rf-text-primary)]">
                {realisticAlternativePtBr}
              </span>
              <button
                type="button"
                disabled={isPending}
                onClick={handleApplySuggestion}
                className="inline-flex min-h-[36px] items-center rounded-[var(--rf-radius-sm)] bg-[var(--rf-accent-secondary)] px-3 font-sans text-xs font-semibold text-[var(--rf-accent-on-secondary)] hover:bg-[var(--rf-accent-secondary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] disabled:opacity-60"
              >
                Usar {formatNumberPtBr(suggestedTargetValue)} {unitLabel}
              </button>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor={`adjust-target-${goalId}`}
                className="block font-sans text-xs font-semibold text-[var(--rf-text-primary)]"
              >
                Novo alvo ({unitLabel})
              </label>
              <input
                id={`adjust-target-${goalId}`}
                type="number"
                inputMode="numeric"
                min={1}
                max={100000}
                value={nextTarget}
                onChange={(e) => setNextTarget(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-[var(--rf-radius-sm)] border border-[var(--rf-border-strong)] bg-[var(--rf-surface-elevated)] px-3 text-base text-[var(--rf-text-primary)] sm:text-sm"
              />
            </div>

            <div>
              <label
                htmlFor={`adjust-ends-${goalId}`}
                className="block font-sans text-xs font-semibold text-[var(--rf-text-primary)]"
              >
                Prazo final (adiar se quiser)
              </label>
              <input
                id={`adjust-ends-${goalId}`}
                type="date"
                min={startsOn}
                value={nextEndsOn}
                onChange={(e) => setNextEndsOn(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-[var(--rf-radius-sm)] border border-[var(--rf-border-strong)] bg-[var(--rf-surface-elevated)] px-3 text-base text-[var(--rf-text-primary)] sm:text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => postponeByDays(30)}
                className="inline-flex min-h-[36px] items-center rounded-[var(--rf-radius-sm)] border border-[var(--rf-border-default)] bg-[var(--rf-surface-elevated)] px-2.5 font-sans text-xs font-medium text-[var(--rf-text-secondary)] hover:text-[var(--rf-text-primary)]"
              >
                +30 dias
              </button>
              <button
                type="button"
                onClick={() => postponeByDays(90)}
                className="inline-flex min-h-[36px] items-center rounded-[var(--rf-radius-sm)] border border-[var(--rf-border-default)] bg-[var(--rf-surface-elevated)] px-2.5 font-sans text-xs font-medium text-[var(--rf-text-secondary)] hover:text-[var(--rf-text-primary)]"
              >
                +3 meses
              </button>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="inline-flex min-h-[44px] items-center rounded-[var(--rf-radius-md)] bg-[var(--rf-accent-secondary)] px-4 font-sans text-xs font-semibold text-[var(--rf-accent-on-secondary)] hover:bg-[var(--rf-accent-secondary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] disabled:opacity-60 lg:min-h-[36px]"
            >
              {isPending ? "Salvando..." : "Salvar ajuste"}
            </button>
          </div>
        </form>
      ) : null}

      {openPanel === "plan" ? (
        <div
          role="region"
          aria-label={`Como chegar lá na meta ${goalTitle}`}
          className="space-y-2.5 rounded-[var(--rf-radius-md)] border border-[var(--rf-border-default)] bg-[var(--rf-surface-canvas)] p-3.5"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-sans text-xs font-semibold text-[var(--rf-text-heading)]">
              Caminho sugerido no seu ritmo
            </p>
            <button
              type="button"
              onClick={() => setOpenPanel("none")}
              aria-label="Fechar plano"
              className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--rf-radius-sm)] text-[var(--rf-text-secondary)] hover:bg-[var(--rf-surface-subtle)] hover:text-[var(--rf-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <ul className="space-y-1.5 font-sans text-xs leading-relaxed text-[var(--rf-text-primary)]">
            {howToReachStepsPtBr.map((step, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--rf-accent-primary)]"
                />
                <span>{step}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--rf-divider)] pt-2.5">
            <Link
              href="/leitura/foco"
              className="inline-flex min-h-[36px] items-center font-sans text-xs font-semibold text-[var(--rf-text-accent-secondary)] hover:underline"
            >
              Abrir Canto de Foco →
            </Link>
            <Link
              href="/leitura"
              className="inline-flex min-h-[36px] items-center font-sans text-xs font-semibold text-[var(--rf-text-secondary)] hover:text-[var(--rf-text-primary)] hover:underline"
            >
              Registrar progresso →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
