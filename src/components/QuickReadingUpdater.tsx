"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BookmarkCheck,
  CheckCircle2,
  Loader2,
  Plus,
  Timer,
} from "lucide-react";
import type { ProgressUnit } from "@/lib/domain";
import {
  finishReadingAction,
  updateReadingProgressAction,
} from "@/features/reading/actions";
import { rfButtonClassName } from "@/components/ui/ActionControls";

const CHAPTER_FALLBACK_PAGES = 15;

export function QuickReadingUpdater({
  readingId,
  initialUnit,
  initialValue,
  total,
  focusHref,
  variant = "card",
  enableQuickShortcuts = false,
}: {
  readingId: string;
  initialUnit: ProgressUnit;
  initialValue: number;
  total?: number;
  focusHref?: string;
  variant?: "card" | "inline";
  enableQuickShortcuts?: boolean;
}) {
  const router = useRouter();
  const [unit, setUnit] = useState<ProgressUnit>(initialUnit);
  const [val, setVal] = useState(
    initialUnit === "seconds"
      ? String(Math.round(initialValue / 60))
      : String(initialValue)
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isBusy = isPending || isSubmitting;

  /**
   * Validação e envio únicos compartilhados entre o formulário "Atualizar"
   * e os atalhos de um toque (+10, +25, "Terminei o capítulo").
   */
  const submitProgress = (
    targetUnit: ProgressUnit,
    numeric: number,
    successMessage = "Progresso salvo."
  ) => {
    if (isBusy) return;
    setErrorMessage(null);
    setStatusMessage(null);

    if (!Number.isFinite(numeric) || numeric < 0) {
      setErrorMessage("Informe um valor numérico positivo.");
      return;
    }
    if (targetUnit === "percent" && numeric > 100) {
      setErrorMessage("A porcentagem não pode exceder 100%.");
      return;
    }
    if (targetUnit === "pages" && total && numeric > total) {
      setErrorMessage(
        `O número de páginas não pode exceder o total do livro (${total} pág.).`
      );
      return;
    }

    const rawVal =
      targetUnit === "seconds" ? Math.round(numeric * 60) : Math.round(numeric);
    setVal(String(Math.round(numeric)));

    setIsSubmitting(true);
    startTransition(async () => {
      try {
        const res = await updateReadingProgressAction({
          readingId,
          progressUnit: targetUnit,
          progressValue: rawVal,
        });
        if (!res.ok) {
          setErrorMessage(res.error);
          return;
        }
        setStatusMessage(successMessage);
        router.refresh();
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  const handleQuickPageDelta = (delta: number, label: string) => {
    const parsed = Number.parseFloat(val);
    const currentPages = Number.isFinite(parsed) && parsed >= 0 ? parsed : initialValue;
    const rawNext = currentPages + delta;
    const nextPages =
      typeof total === "number" && total > 0 ? Math.min(total, rawNext) : rawNext;
    submitProgress("pages", nextPages, label);
  };

  const handleUnitSwitch = (nextUnit: ProgressUnit) => {
    if (isBusy) return;
    setUnit(nextUnit);
    setErrorMessage(null);
    setStatusMessage(null);
    setIsSubmitting(true);
    startTransition(async () => {
      try {
        const res = await updateReadingProgressAction({
          readingId,
          progressUnit: nextUnit,
          progressValue: initialValue,
          convertFromPreviousUnit: true,
        });
        if (!res.ok) {
          setErrorMessage(res.error);
          return;
        }
        router.refresh();
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  const parsedCurrent = Number.parseFloat(val);
  const currentNumeric = Number.isFinite(parsedCurrent)
    ? parsedCurrent
    : initialValue;
  const reachedPageTotal =
    unit === "pages" && typeof total === "number" && total > 0 && currentNumeric >= total;

  return (
    <div
      className={
        variant === "inline"
          ? "pt-4 font-sans"
          : "mt-4 rounded-[var(--rf-card-radius)] border border-[var(--rf-border-accent-soft)] bg-[var(--rf-surface-contrast)] p-4 font-sans"
      }
    >
      {/* Atalhos de um toque (mesma validação e ação do "Atualizar") */}
      {enableQuickShortcuts && unit === "pages" ? (
        <div
          role="group"
          aria-label="Atalhos rápidos de registro de páginas"
          className="mb-3.5 flex flex-wrap items-center gap-2"
        >
          <span className="rf-type-label mr-1 text-[var(--rf-text-on-contrast-muted)]">
            Registro rápido
          </span>
          <button
            type="button"
            disabled={isBusy || reachedPageTotal}
            onClick={() =>
              handleQuickPageDelta(10, "+10 páginas registradas.")
            }
            aria-label="Avançar 10 páginas"
            className={rfButtonClassName({
              variant: "subtle",
              tone: "dark",
              size: "sm",
              pill: true,
            })}
          >
            <Plus className="h-3.5 w-3.5 text-[var(--rf-text-on-contrast-muted)]" aria-hidden="true" />
            <span>10 pág.</span>
          </button>

          <button
            type="button"
            disabled={isBusy || reachedPageTotal}
            onClick={() =>
              handleQuickPageDelta(25, "+25 páginas registradas.")
            }
            aria-label="Avançar 25 páginas"
            className={rfButtonClassName({
              variant: "subtle",
              tone: "dark",
              size: "sm",
              pill: true,
            })}
          >
            <Plus className="h-3.5 w-3.5 text-[var(--rf-text-on-contrast-muted)]" aria-hidden="true" />
            <span>25 pág.</span>
          </button>

          <button
            type="button"
            disabled={isBusy || reachedPageTotal}
            onClick={() =>
              handleQuickPageDelta(
                CHAPTER_FALLBACK_PAGES,
                `Capítulo registrado (+${CHAPTER_FALLBACK_PAGES} pág.).`
              )
            }
            title={`Avança +${CHAPTER_FALLBACK_PAGES} páginas (média de 1 capítulo) usando a mesma validação do Atualizar`}
            aria-label={`Terminei o capítulo (avançar ${CHAPTER_FALLBACK_PAGES} páginas)`}
            className={rfButtonClassName({
              variant: "subtle",
              tone: "dark",
              size: "sm",
              pill: true,
            })}
          >
            <BookmarkCheck
              className="h-3.5 w-3.5 text-[var(--rf-text-on-contrast-muted)]"
              aria-hidden="true"
            />
            <span>Terminei o capítulo</span>
          </button>
        </div>
      ) : null}

      <form
        aria-busy={isBusy}
        onSubmit={(e) => {
          e.preventDefault();
          submitProgress(unit, Number.parseFloat(val));
        }}
        className="flex flex-wrap items-end justify-between gap-3"
      >
        <div className="flex flex-wrap items-end gap-2.5">
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`prog-val-${readingId}`}
              className="rf-type-label text-[var(--rf-text-on-contrast-muted)]"
            >
              Progresso
            </label>
            <input
              id={`prog-val-${readingId}`}
              name="progressValue"
              type="number"
              min={0}
              disabled={isBusy}
              value={val}
              onChange={(e) => {
                setVal(e.target.value);
                if (errorMessage) setErrorMessage(null);
                if (statusMessage) setStatusMessage(null);
              }}
              className="min-h-[40px] w-24 rounded-[var(--rf-radius-md)] border border-[var(--rf-border-strong)] bg-[var(--rf-surface-card-solid)] px-3 font-sans text-sm font-semibold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-primary)] shadow-[var(--rf-shadow-xs)] transition-colors focus:border-[var(--rf-focus-ring-color)] focus:outline-none focus:ring-2 focus:ring-[var(--rf-focus-ring-color)] disabled:opacity-60"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor={`prog-unit-${readingId}`}
              className="rf-type-label text-[var(--rf-text-on-contrast-muted)]"
            >
              Unidade
            </label>
            <select
              id={`prog-unit-${readingId}`}
              name="progressUnit"
              disabled={isBusy}
              value={unit}
              onChange={(e) => handleUnitSwitch(e.target.value as ProgressUnit)}
              className="min-h-[40px] rounded-[var(--rf-radius-md)] border border-[var(--rf-border-strong)] bg-[var(--rf-surface-card-solid)] px-3 font-sans text-[13px] font-semibold text-[var(--rf-text-primary)] shadow-[var(--rf-shadow-xs)] transition-colors focus:border-[var(--rf-focus-ring-color)] focus:outline-none focus:ring-2 focus:ring-[var(--rf-focus-ring-color)] disabled:opacity-60"
            >
              <option value="pages">
                páginas{total && unit === "pages" ? ` (de ${total})` : ""}
              </option>
              <option value="percent">% concluído</option>
              <option value="seconds">minutos ouvidos</option>
            </select>
          </div>

          {/* Primária */}
          <button
            type="submit"
            disabled={isBusy}
            aria-busy={isBusy}
            className={rfButtonClassName({
              variant: "primary",
              tone: "dark",
              size: "md",
            })}
          >
            {isBusy ? (
              <>
                <Loader2
                  className="h-3.5 w-3.5 animate-spin text-[var(--rf-accent-on-primary)]"
                  aria-hidden="true"
                />
                <span>Salvando...</span>
              </>
            ) : (
              <span>Atualizar</span>
            )}
          </button>

          {/* Discreta (dark) — único CTA "Iniciar Foco" no painel */}
          {focusHref ? (
            <Link
              href={focusHref}
              className={rfButtonClassName({
                variant: "subtle",
                tone: "dark",
                size: "md",
              })}
              title="Abrir sessão cronometrada no Canto de Foco para este livro"
            >
              <Timer className="h-3.5 w-3.5 text-[var(--rf-text-on-contrast-muted)]" aria-hidden="true" />
              <span>Iniciar Foco</span>
            </Link>
          ) : null}
        </div>

        {/* Secundária vazada */}
        <button
          type="button"
          disabled={isBusy}
          aria-busy={isBusy}
          onClick={() => {
            if (isBusy) return;
            setErrorMessage(null);
            setStatusMessage(null);
            setIsSubmitting(true);
            startTransition(async () => {
              try {
                const res = await finishReadingAction({ readingId });
                if (!res.ok) {
                  setErrorMessage(res.error);
                  return;
                }
                if (typeof window !== "undefined") {
                  window.dispatchEvent(
                    new CustomEvent("rf:undo-toast", {
                      detail: { id: res.undoId, label: res.label },
                    })
                  );
                }
                router.refresh();
              } finally {
                setIsSubmitting(false);
              }
            });
          }}
          className={rfButtonClassName({
            variant: "secondary",
            secondaryStyle: "outline",
            tone: "dark",
            size: "md",
            className: "ml-auto",
          })}
        >
          <CheckCircle2
            className="h-3.5 w-3.5 shrink-0 text-[var(--rf-text-on-contrast-muted)]"
            aria-hidden="true"
          />
          <span>Concluir livro</span>
        </button>
      </form>

      {errorMessage ? (
        <p
          role="alert"
          className="mt-2.5 flex items-center gap-1.5 font-sans text-[13px] font-medium text-[var(--rf-nav-danger)]"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </p>
      ) : null}

      {statusMessage ? (
        <p
          role="status"
          className="mt-2.5 font-sans text-[13px] font-semibold text-[var(--rf-text-on-contrast-muted)]"
        >
          {statusMessage}
        </p>
      ) : null}
    </div>
  );
}
