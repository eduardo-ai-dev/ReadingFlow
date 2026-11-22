"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import { undoLastAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/Button";
import { BookCompletedCardModal } from "@/components/BookCompletedCardModal";
import type {
  BookCompletedCardDetail,
  FeedbackToastDetail,
  FeedbackToastTone,
} from "@/lib/feedback";

const DEFAULT_TOAST_DURATION_MS = 5000;

interface ActiveToastState {
  id: string;
  message: string;
  tone: FeedbackToastTone;
  canUndo: boolean;
  retryLabel?: string;
  onRetry?: () => void;
  durationMs: number;
}

export function UndoBanner({
  undoInfo,
}: {
  undoInfo: { id: string; label: string } | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [customToast, setCustomToast] = useState<ActiveToastState | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [completedStats, setCompletedStats] =
    useState<BookCompletedCardDetail | null>(null);

  const toastContainerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const serverFallbackToast: ActiveToastState | null = undoInfo
    ? {
        id: undoInfo.id,
        message: undoInfo.label,
        tone: "success",
        canUndo: true,
        durationMs: DEFAULT_TOAST_DURATION_MS,
      }
    : null;

  const activeToast = customToast ?? serverFallbackToast;
  const activeId = activeToast?.id ?? null;
  const isVisible = Boolean(activeToast && dismissedId !== activeId);

  const dismissCurrent = useCallback(() => {
    const hadFocusInside =
      toastContainerRef.current &&
      document.activeElement &&
      toastContainerRef.current.contains(document.activeElement);
    if (activeId) {
      setDismissedId(activeId);
    }
    setCustomToast(null);
    if (hadFocusInside) {
      previousFocusRef.current?.focus?.();
    }
  }, [activeId]);

  // Escuta eventos unificados `rf:toast`, legados `rf:undo-toast` e cartão sóbrio `rf:book-completed-card`
  useEffect(() => {
    function handleUnifiedToast(e: Event & { detail?: FeedbackToastDetail }) {
      const detail = e.detail;
      if (!detail?.message) return;
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      const nextId =
        detail.undoId ??
        detail.id ??
        `toast-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      setDismissedId(null);
      setIsPaused(false);
      setCustomToast({
        id: nextId,
        message: detail.message,
        tone: detail.tone ?? "success",
        canUndo: Boolean(detail.undoId),
        retryLabel: detail.retryLabel,
        onRetry: detail.onRetry,
        durationMs:
          detail.durationMs ??
          (detail.tone === "error" ? 7000 : DEFAULT_TOAST_DURATION_MS),
      });
    }

    function handleLegacyUndoToast(
      e: Event & { detail?: { id?: string; label?: string } }
    ) {
      if (e.detail?.id && e.detail?.label) {
        previousFocusRef.current = document.activeElement as HTMLElement | null;
        setDismissedId(null);
        setIsPaused(false);
        setCustomToast({
          id: e.detail.id,
          message: e.detail.label,
          tone: "success",
          canUndo: true,
          durationMs: DEFAULT_TOAST_DURATION_MS,
        });
      }
    }

    function handleBookCompleted(
      e: Event & { detail?: BookCompletedCardDetail }
    ) {
      if (e.detail?.title) {
        setCompletedStats(e.detail);
      }
    }

    window.addEventListener("rf:toast", handleUnifiedToast as EventListener);
    window.addEventListener(
      "rf:undo-toast",
      handleLegacyUndoToast as EventListener
    );
    window.addEventListener(
      "rf:book-completed-card",
      handleBookCompleted as EventListener
    );
    return () => {
      window.removeEventListener(
        "rf:toast",
        handleUnifiedToast as EventListener
      );
      window.removeEventListener(
        "rf:undo-toast",
        handleLegacyUndoToast as EventListener
      );
      window.removeEventListener(
        "rf:book-completed-card",
        handleBookCompleted as EventListener
      );
    };
  }, []);

  // Auto-dispensa após ~5s (pausando se foco/cursor estiver sobre o toast)
  useEffect(() => {
    if (!isVisible || !activeId || !activeToast || isPaused || isPending) {
      return;
    }
    const timer = window.setTimeout(() => {
      setDismissedId(activeId);
      setCustomToast((curr) => (curr?.id === activeId ? null : curr));
    }, activeToast.durationMs);
    return () => window.clearTimeout(timer);
  }, [isVisible, activeId, activeToast, isPaused, isPending]);

  // Escape fecha o toast quando visível (sem conflitar com o modal aberto)
  useEffect(() => {
    if (!isVisible || completedStats) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        dismissCurrent();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isVisible, completedStats, dismissCurrent]);

  const handleUndo = () => {
    if (isPending) return;
    startTransition(async () => {
      try {
        const res = await undoLastAction();
        if (res.ok) {
          setCompletedStats(null);
          setCustomToast({
            id: `undone-${Date.now()}`,
            message: res.message,
            tone: "info",
            canUndo: false,
            durationMs: 4000,
          });
          setDismissedId(null);
          router.refresh();
        } else {
          setCustomToast({
            id: `undo-err-${Date.now()}`,
            message: res.error,
            tone: "error",
            canUndo: false,
            durationMs: 6000,
          });
          setDismissedId(null);
        }
      } catch {
        setCustomToast({
          id: `undo-err-${Date.now()}`,
          message: "Não foi possível desfazer agora. Tente novamente.",
          tone: "error",
          canUndo: false,
          durationMs: 6000,
        });
        setDismissedId(null);
      }
    });
  };

  const ToneIcon =
    activeToast?.tone === "error"
      ? AlertCircle
      : activeToast?.tone === "info"
        ? Info
        : CheckCircle2;

  return (
    <>
      <BookCompletedCardModal
        key={completedStats?.workId ?? "closed"}
        stats={completedStats}
        onClose={() => setCompletedStats(null)}
      />

      {isVisible && activeToast ? (
        <div
          ref={toastContainerRef}
          role={activeToast.tone === "error" ? "alert" : "status"}
          aria-live={activeToast.tone === "error" ? "assertive" : "polite"}
          aria-atomic="true"
          data-testid="feedback-toast"
          data-toast-tone={activeToast.tone}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onFocus={() => setIsPaused(true)}
          onBlur={() => setIsPaused(false)}
          className={`rf-toast-enter fixed right-4 bottom-20 z-50 flex w-[calc(100vw-2rem)] max-w-md items-center justify-between gap-3 rounded-[var(--rf-radius-lg)] border px-4 py-3 font-sans text-xs shadow-[var(--rf-nav-toast-shadow)] lg:right-6 lg:bottom-6 ${
            activeToast.tone === "error"
              ? "border-[var(--rf-status-error)] bg-[var(--rf-status-error-bg)] text-[var(--rf-status-error)]"
              : "border-[var(--rf-border-accent-soft)] bg-[var(--rf-nav-surface-elevated)] text-[var(--rf-nav-text)]"
          }`}
        >
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <ToneIcon
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                activeToast.tone === "error"
                  ? "text-[var(--rf-status-error)]"
                  : "text-[var(--rf-nav-accent)]"
              }`}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              {activeToast.canUndo ? (
                <p className="font-sans text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--rf-nav-accent-hover)]">
                  Ação registrada · 5s para desfazer
                </p>
              ) : null}
              <p className="mt-0.5 line-clamp-2 font-sans text-xs font-medium leading-snug tabular-nums [font-variant-numeric:lining-nums_tabular-nums]">
                {activeToast.message}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {activeToast.canUndo ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={isPending}
                aria-busy={isPending}
                onClick={handleUndo}
                className="!min-h-[36px] !px-3"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{isPending ? "Desfazendo..." : "Desfazer"}</span>
              </Button>
            ) : null}

            {activeToast.tone === "error" && activeToast.onRetry ? (
              <button
                type="button"
                onClick={() => {
                  const retryFn = activeToast.onRetry;
                  dismissCurrent();
                  retryFn?.();
                }}
                className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-[var(--rf-radius-sm)] border border-[var(--rf-status-error)] bg-[var(--rf-surface-elevated)] px-2.5 font-sans text-xs font-semibold text-[var(--rf-status-error)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                <span>{activeToast.retryLabel ?? "Tentar de novo"}</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={dismissCurrent}
              aria-label="Fechar aviso"
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--rf-radius-sm)] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${
                activeToast.tone === "error"
                  ? "border-[var(--rf-status-error)]/40 text-[var(--rf-status-error)] hover:bg-[var(--rf-status-error)]/10"
                  : "border-[var(--rf-nav-border)] bg-[var(--rf-nav-surface-hover)] text-[var(--rf-nav-accent-hover)] hover:border-[var(--rf-nav-accent)] hover:text-[var(--rf-nav-text)]"
              }`}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
