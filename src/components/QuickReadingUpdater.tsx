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
import {
  dispatchBookCompletedCard,
  dispatchFeedbackToast,
  dispatchReadingDayPulse,
} from "@/lib/feedback";

const CHAPTER_FALLBACK_PAGES = 15;

export function QuickReadingUpdater({
  readingId,
  initialUnit,
  initialValue,
  total,
  focusHref,
  variant = "card",
  enableQuickShortcuts = false,
  onOptimisticProgress,
}: {
  readingId: string;
  initialUnit: ProgressUnit;
  initialValue: number;
  total?: number;
  focusHref?: string;
  variant?: "card" | "inline";
  enableQuickShortcuts?: boolean;
  onOptimisticProgress?: (value: number | null, unit: ProgressUnit) => void;
}) {
  const router = useRouter();
  const [unit, setUnit] = useState<ProgressUnit>(initialUnit);
  const [currentTotal, setCurrentTotal] = useState<number | undefined>(total);
  const [val, setVal] = useState(
    initialUnit === "seconds"
      ? String(Math.round(initialValue / 60))
      : String(initialValue)
  );
  const [prevInitialKey, setPrevInitialKey] = useState(
    `${readingId}:${initialUnit}:${initialValue}:${total ?? ""}`
  );
  const currentInitialKey = `${readingId}:${initialUnit}:${initialValue}:${total ?? ""}`;
  if (prevInitialKey !== currentInitialKey) {
    setPrevInitialKey(currentInitialKey);
    setUnit(initialUnit);
    setCurrentTotal(total);
    setVal(
      initialUnit === "seconds"
        ? String(Math.round(initialValue / 60))
        : String(initialValue)
    );
  }
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isBusy = isPending || isSubmitting;

  // Validação em linha em tempo real conforme o usuário digita (ex.: páginas acima do total)
  const validateRawInput = (
    targetUnit: ProgressUnit,
    rawInput: string | number
  ): { ok: true; numeric: number } | { ok: false; error: string } => {
    let numeric: number;
    if (typeof rawInput === "string") {
      const trimmed = rawInput.trim();
      if (!trimmed) {
        return {
          ok: false,
          error: "Informe um valor numérico para atualizar o progresso.",
        };
      }
      if (!/^-?\d+$/.test(trimmed)) {
        return {
          ok: false,
          error: "Informe um número inteiro sem casas decimais.",
        };
      }
      numeric = Number.parseInt(trimmed, 10);
    } else {
      numeric = rawInput;
    }

    if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) {
      return {
        ok: false,
        error: "Informe um número inteiro sem casas decimais.",
      };
    }
    if (numeric < 0) {
      return {
        ok: false,
        error: "Informe um valor numérico positivo (zero ou maior).",
      };
    }
    if (targetUnit === "percent" && numeric > 100) {
      return { ok: false, error: "A porcentagem não pode exceder 100%." };
    }
    if (targetUnit === "pages" && currentTotal && numeric > currentTotal) {
      return {
        ok: false,
        error: `O número de páginas não pode exceder o total do livro (${currentTotal} pág.).`,
      };
    }
    if (
      targetUnit === "seconds" &&
      currentTotal &&
      numeric * 60 > currentTotal
    ) {
      return {
        ok: false,
        error: `O tempo informado não pode exceder a duração total (${Math.round(currentTotal / 60)} min).`,
      };
    }
    return { ok: true, numeric };
  };

  const liveValidation = val.trim() ? validateRawInput(unit, val) : null;
  const inlineValidationError =
    liveValidation && !liveValidation.ok ? liveValidation.error : null;
  const activeErrorMessage = errorMessage ?? inlineValidationError;

  /**
   * Validação, atualização otimista com rollback e envio únicos compartilhados
   * entre o formulário "Atualizar" e os atalhos de um toque (+10, +25, "Terminei o capítulo").
   */
  const submitProgress = (
    targetUnit: ProgressUnit,
    rawInput: string | number,
    successMessage = "Progresso salvo."
  ) => {
    if (isBusy) return;
    setErrorMessage(null);
    setStatusMessage(null);

    const validated = validateRawInput(targetUnit, rawInput);
    if (!validated.ok) {
      setErrorMessage(validated.error);
      return;
    }

    const numeric = validated.numeric;
    const rawVal = targetUnit === "seconds" ? numeric * 60 : numeric;
    const previousValStr = val;
    setVal(String(numeric));
    // Atualização otimista imediata da barra e contadores
    onOptimisticProgress?.(rawVal, targetUnit);

    setIsSubmitting(true);
    startTransition(async () => {
      try {
        const res = await updateReadingProgressAction({
          readingId,
          progressUnit: targetUnit,
          progressValue: rawVal,
        });
        if (!res.ok) {
          // Rollback otimista + toast de erro com nova tentativa
          setVal(previousValStr);
          onOptimisticProgress?.(null, targetUnit);
          setErrorMessage(res.error);
          dispatchFeedbackToast({
            tone: "error",
            message: res.error,
            onRetry: () => submitProgress(targetUnit, rawInput, successMessage),
          });
          return;
        }
        const toastMsg = res.undoLabel ?? successMessage;
        setStatusMessage(toastMsg);
        dispatchFeedbackToast({
          message: toastMsg,
          undoId: res.undoId,
          durationMs: 5000,
        });
        if (res.deltaPages > 0 || res.progressValue > 0) {
          dispatchReadingDayPulse(res.todayYmd);
        }
        onOptimisticProgress?.(null, res.progressUnit);
        router.refresh();
      } catch {
        setVal(previousValStr);
        onOptimisticProgress?.(null, targetUnit);
        const fallbackErr =
          "Não foi possível salvar o progresso agora. Tente novamente.";
        setErrorMessage(fallbackErr);
        dispatchFeedbackToast({
          tone: "error",
          message: fallbackErr,
          onRetry: () => submitProgress(targetUnit, rawInput, successMessage),
        });
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  const handleQuickPageDelta = (delta: number, label: string) => {
    const parsed = Number.parseInt(val, 10);
    const currentPages =
      Number.isInteger(parsed) && parsed >= 0 ? parsed : initialValue;
    const rawNext = currentPages + delta;
    const nextPages =
      typeof currentTotal === "number" && currentTotal > 0
        ? Math.min(currentTotal, rawNext)
        : rawNext;
    submitProgress("pages", nextPages, label);
  };

  const handleUnitSwitch = (nextUnit: ProgressUnit) => {
    if (isBusy || nextUnit === unit) return;
    const prevUnit = unit;
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
          setUnit(prevUnit);
          setErrorMessage(res.error);
          return;
        }
        setUnit(res.progressUnit);
        setCurrentTotal(res.progressTotal);
        setVal(
          res.progressUnit === "seconds"
            ? String(Math.round(res.progressValue / 60))
            : String(res.progressValue)
        );
        setStatusMessage("Unidade convertida.");
        router.refresh();
      } catch {
        setUnit(prevUnit);
        setErrorMessage(
          "Não foi possível converter a unidade agora. Tente novamente."
        );
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  const parsedCurrent = Number.parseInt(val, 10);
  const currentNumeric = Number.isInteger(parsedCurrent)
    ? parsedCurrent
    : initialValue;
  const reachedPageTotal =
    unit === "pages" &&
    typeof currentTotal === "number" &&
    currentTotal > 0 &&
    currentNumeric >= currentTotal;

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
            onClick={() => handleQuickPageDelta(10, "+10 páginas registradas.")}
            aria-label="Avançar 10 páginas"
            className={rfButtonClassName({
              variant: "subtle",
              tone: "dark",
              size: "sm",
              pill: true,
            })}
          >
            <Plus
              className="h-3.5 w-3.5 text-[var(--rf-text-on-contrast-muted)]"
              aria-hidden="true"
            />
            <span>10 pág.</span>
          </button>

          <button
            type="button"
            disabled={isBusy || reachedPageTotal}
            onClick={() => handleQuickPageDelta(25, "+25 páginas registradas.")}
            aria-label="Avançar 25 páginas"
            className={rfButtonClassName({
              variant: "subtle",
              tone: "dark",
              size: "sm",
              pill: true,
            })}
          >
            <Plus
              className="h-3.5 w-3.5 text-[var(--rf-text-on-contrast-muted)]"
              aria-hidden="true"
            />
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
        noValidate
        aria-busy={isBusy}
        onSubmit={(e) => {
          e.preventDefault();
          submitProgress(unit, val);
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
              inputMode="numeric"
              min={0}
              disabled={isBusy}
              aria-invalid={Boolean(activeErrorMessage)}
              aria-describedby={
                activeErrorMessage ? `prog-err-${readingId}` : undefined
              }
              value={val}
              onChange={(e) => {
                setVal(e.target.value);
                if (errorMessage) setErrorMessage(null);
                if (statusMessage) setStatusMessage(null);
              }}
              className={`min-h-[44px] w-24 rounded-[var(--rf-radius-md)] border bg-[var(--rf-surface-card-solid)] px-3 font-sans text-base font-semibold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-primary)] shadow-[var(--rf-shadow-xs)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--rf-focus-ring-color)] disabled:opacity-60 sm:text-sm lg:min-h-[40px] ${
                activeErrorMessage
                  ? "border-[var(--rf-status-error)] focus:border-[var(--rf-status-error)]"
                  : "border-[var(--rf-border-strong)] focus:border-[var(--rf-focus-ring-color)]"
              }`}
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
              className="min-h-[44px] rounded-[var(--rf-radius-md)] border border-[var(--rf-border-strong)] bg-[var(--rf-surface-card-solid)] px-3 font-sans text-[13px] font-semibold text-[var(--rf-text-primary)] shadow-[var(--rf-shadow-xs)] transition-colors focus:border-[var(--rf-focus-ring-color)] focus:outline-none focus:ring-2 focus:ring-[var(--rf-focus-ring-color)] disabled:opacity-60 lg:min-h-[40px]"
            >
              <option value="pages">
                páginas
                {currentTotal && unit === "pages"
                  ? ` (de ${currentTotal})`
                  : ""}
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
              <Timer
                className="h-3.5 w-3.5 text-[var(--rf-text-on-contrast-muted)]"
                aria-hidden="true"
              />
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
            const runFinish = () => {
              if (isBusy) return;
              setErrorMessage(null);
              setStatusMessage(null);
              setIsSubmitting(true);
              startTransition(async () => {
                try {
                  const res = await finishReadingAction({ readingId });
                  if (!res.ok) {
                    setErrorMessage(res.error);
                    dispatchFeedbackToast({
                      tone: "error",
                      message: res.error,
                      onRetry: runFinish,
                    });
                    return;
                  }
                  dispatchFeedbackToast({
                    message: "Livro concluído",
                    undoId: res.undoId,
                    durationMs: 5000,
                  });
                  dispatchReadingDayPulse();
                  if (res.completionStats) {
                    dispatchBookCompletedCard(res.completionStats);
                  }
                  router.refresh();
                } catch {
                  const errMsg =
                    "Não foi possível concluir o livro agora. Tente novamente.";
                  setErrorMessage(errMsg);
                  dispatchFeedbackToast({
                    tone: "error",
                    message: errMsg,
                    onRetry: runFinish,
                  });
                } finally {
                  setIsSubmitting(false);
                }
              });
            };
            runFinish();
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
          <span>{isBusy ? "Concluindo..." : "Concluir livro"}</span>
        </button>
      </form>

      {activeErrorMessage ? (
        <p
          id={`prog-err-${readingId}`}
          role="alert"
          className="mt-2.5 flex items-center gap-1.5 font-sans text-[13px] font-medium text-[var(--rf-nav-danger)]"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{activeErrorMessage}</span>
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
