"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookPlus,
  CheckCircle2,
  Compass,
  Headphones,
  Target,
  X,
} from "lucide-react";
import { updateOnboardingGuideAction } from "@/features/settings/actions";
import type { OnboardingGuideEvaluation } from "@/features/onboarding/rules";
import type { OnboardingStepId } from "@/lib/domain";

const STEP_ICONS: Record<OnboardingStepId, typeof BookPlus> = {
  first_book: BookPlus,
  annual_goal: Target,
  focus_corner: Headphones,
};

export function OnboardingGuideCard({
  guide,
}: {
  guide: OnboardingGuideEvaluation;
}) {
  const router = useRouter();
  const [hiddenLocally, setHiddenLocally] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!guide.shouldShow || hiddenLocally) {
    return null;
  }

  const handleDismiss = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await updateOnboardingGuideAction({ action: "dismiss" });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setHiddenLocally(true);
        router.refresh();
      } catch {
        setError("Não foi possível dispensar o guia agora. Tente novamente.");
      }
    });
  };

  const handleStepClick = (stepId: OnboardingStepId) => {
    if (stepId !== "focus_corner") return;
    startTransition(async () => {
      try {
        await updateOnboardingGuideAction({
          action: "complete_step",
          stepId: "focus_corner",
        });
      } catch {
        // Navegação continua normalmente
      }
    });
  };

  return (
    <section
      aria-labelledby="primeiros-passos-titulo"
      data-testid="onboarding-guide"
      className="rf-panel relative overflow-hidden border border-[var(--rf-border-accent-soft)] p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2">
            <Compass
              className="h-4 w-4 text-[var(--rf-text-accent-secondary)]"
              aria-hidden="true"
            />
            <span className="rf-section-marker">Primeiros passos</span>
            <span className="rounded-[var(--rf-radius-full)] border border-[var(--rf-border-default)] bg-[var(--rf-surface-subtle)] px-2.5 py-0.5 font-sans text-xs font-semibold tabular-nums text-[var(--rf-text-secondary)]">
              {guide.completedCount} de {guide.totalCount} concluídos
            </span>
          </div>

          <h2
            id="primeiros-passos-titulo"
            className="font-serif text-xl font-semibold text-[var(--rf-text-heading)] sm:text-2xl"
          >
            Boas-vindas à sua biblioteca pessoal
          </h2>
          <p className="max-w-2xl font-sans text-xs leading-relaxed text-[var(--rf-text-secondary)] sm:text-sm">
            Sua conta começa limpa e privada. Siga estes três passos no seu
            ritmo — você pode dispensar este guia agora e retomá-lo quando
            quiser em{" "}
            <Link
              href="/configuracoes#primeiros-passos"
              className="font-semibold text-[var(--rf-text-accent-secondary)] underline-offset-2 hover:underline"
            >
              Configurações → Primeiros passos
            </Link>
            .
          </p>
        </div>

        <button
          type="button"
          disabled={isPending}
          onClick={handleDismiss}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--rf-radius-md)] border border-[var(--rf-border-default)] bg-[var(--rf-surface-elevated)] px-3 py-1.5 font-sans text-xs font-semibold text-[var(--rf-text-secondary)] transition-colors hover:border-[var(--rf-border-strong)] hover:text-[var(--rf-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] disabled:opacity-60 lg:min-h-[36px]"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Dispensar guia</span>
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-[var(--rf-radius-md)] border border-[var(--rf-status-error)] bg-[var(--rf-status-error-bg)] px-3 py-2 text-xs font-medium text-[var(--rf-status-error)]"
        >
          {error}
        </p>
      ) : null}

      <ol className="mt-5 grid grid-cols-1 gap-3.5 md:grid-cols-3">
        {guide.steps.map((step) => {
          const Icon = STEP_ICONS[step.id];
          return (
            <li
              key={step.id}
              className={`flex flex-col justify-between rounded-[var(--rf-radius-md)] border p-4 transition-colors ${
                step.completed
                  ? "border-[var(--rf-status-success)]/45 bg-[var(--rf-status-success-bg)]/45"
                  : "border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-sans text-xs font-semibold text-[var(--rf-text-secondary)]">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--rf-border-default)] bg-[var(--rf-surface-elevated)] font-mono text-[11px] font-bold text-[var(--rf-text-heading)]">
                      {step.order}
                    </span>
                    {step.optional ? (
                      <span className="rounded-[var(--rf-radius-full)] bg-[var(--rf-surface-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--rf-text-secondary)]">
                        Opcional
                      </span>
                    ) : null}
                  </span>

                  {step.completed ? (
                    <span className="inline-flex items-center gap-1 font-sans text-xs font-semibold text-[var(--rf-status-success)]">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      <span>Concluído</span>
                    </span>
                  ) : (
                    <Icon
                      className="h-4 w-4 text-[var(--rf-text-accent-secondary)]"
                      aria-hidden="true"
                    />
                  )}
                </div>

                <h3 className="mt-3 font-serif text-base font-semibold text-[var(--rf-text-heading)]">
                  {step.title}
                </h3>
                <p className="mt-1 font-sans text-xs leading-relaxed text-[var(--rf-text-secondary)]">
                  {step.description}
                </p>
              </div>

              <div className="mt-4 pt-2">
                <Link
                  href={step.href}
                  onClick={() => handleStepClick(step.id)}
                  className={`inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-[var(--rf-radius-md)] px-3.5 font-sans text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] lg:min-h-[38px] ${
                    step.completed
                      ? "border border-[var(--rf-border-default)] bg-[var(--rf-surface-elevated)] text-[var(--rf-text-primary)] hover:border-[var(--rf-border-accent)]"
                      : "bg-[var(--rf-accent-secondary)] text-[var(--rf-accent-on-secondary)] hover:bg-[var(--rf-accent-secondary-hover)]"
                  }`}
                >
                  <span>{step.actionLabel}</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
