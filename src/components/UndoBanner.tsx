"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, X, CheckCircle2 } from "lucide-react";
import { undoLastAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/Button";

const TOAST_DURATION_MS = 6000;

export function UndoBanner({
  undoInfo,
}: {
  undoInfo: { id: string; label: string } | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [customToast, setCustomToast] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const activeToast = customToast ?? undoInfo;
  const activeId = activeToast?.id ?? null;
  const isVisible = Boolean(activeToast && dismissedId !== activeId);

  // Escuta eventos imediatos disparados ao concluir livro na Mesa de Leitura ou Ficha do Livro
  useEffect(() => {
    function handleUndoToast(
      e: Event & { detail?: { id?: string; label?: string } }
    ) {
      if (e.detail?.id && e.detail?.label) {
        setFeedback(null);
        setDismissedId(null);
        setCustomToast({ id: e.detail.id, label: e.detail.label });
      }
    }
    window.addEventListener("rf:undo-toast", handleUndoToast as EventListener);
    return () => {
      window.removeEventListener(
        "rf:undo-toast",
        handleUndoToast as EventListener
      );
    };
  }, []);

  // Auto-dispensa o toast após 6 segundos (pausando se o usuário estiver com foco/cursor sobre ele)
  useEffect(() => {
    if (!isVisible || !activeId || isPaused || isPending) return;
    const timer = window.setTimeout(() => {
      setDismissedId(activeId);
    }, TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [isVisible, activeId, isPaused, isPending]);

  // Auto-dispensa a mensagem de confirmação após 4 segundos
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => {
      setFeedback(null);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  if (feedback) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed right-4 bottom-20 z-50 flex w-[calc(100vw-2rem)] max-w-md items-center justify-between gap-3 rounded-[var(--rf-radius-lg)] border border-[var(--rf-border-accent-soft)] bg-[var(--rf-nav-surface-elevated)] px-4 py-3 font-sans text-xs text-[var(--rf-nav-text)] shadow-[var(--rf-nav-toast-shadow)] lg:right-6 lg:bottom-6"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <CheckCircle2
            className="h-4 w-4 shrink-0 text-[var(--rf-nav-accent)]"
            aria-hidden="true"
          />
          <span className="font-medium leading-snug text-[var(--rf-nav-text)]">
            {feedback}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setFeedback(null)}
          aria-label="Fechar confirmação"
          className="inline-flex min-h-[34px] shrink-0 items-center rounded-[var(--rf-radius-sm)] border border-[var(--rf-nav-border)] bg-[var(--rf-nav-surface-hover)] px-2.5 font-sans text-xs font-semibold text-[var(--rf-nav-accent-hover)] transition-colors hover:border-[var(--rf-nav-accent)] hover:text-[var(--rf-nav-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
        >
          Fechar
        </button>
      </div>
    );
  }

  if (!isVisible || !activeToast) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      className="fixed right-4 bottom-20 z-50 flex w-[calc(100vw-2rem)] max-w-md items-center justify-between gap-3 rounded-[var(--rf-radius-lg)] border border-[var(--rf-border-accent-soft)] bg-[var(--rf-nav-surface-elevated)] px-4 py-3 font-sans text-xs text-[var(--rf-nav-text)] shadow-[var(--rf-nav-toast-shadow)] lg:right-6 lg:bottom-6"
    >
      <div className="min-w-0 flex-1">
        <p className="font-sans text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--rf-nav-accent-hover)]">
          Ação Recente · 6s para desfazer
        </p>
        <p className="mt-0.5 line-clamp-2 font-sans text-xs font-medium leading-snug text-[var(--rf-nav-text)] tabular-nums [font-variant-numeric:lining-nums_tabular-nums]">
          {activeToast.label}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              const res = await undoLastAction();
              if (res.ok) {
                setCustomToast(null);
                setDismissedId(activeToast.id);
                setFeedback(
                  "Status 'Lendo agora' e progresso anterior restaurados."
                );
                router.refresh();
              }
            });
          }}
          className="min-h-[38px] px-3.5 text-xs font-bold shadow-[var(--rf-shadow-xs)]"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{isPending ? "Desfazendo..." : "Desfazer"}</span>
        </Button>

        <button
          type="button"
          aria-label="Ocultar aviso de desfazer"
          onClick={() => {
            setCustomToast(null);
            setDismissedId(activeToast.id);
          }}
          className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-[var(--rf-radius-md)] border border-[var(--rf-nav-border)] bg-[var(--rf-nav-surface-hover)] text-[var(--rf-nav-text-muted)] transition-colors hover:border-[var(--rf-nav-accent)] hover:text-[var(--rf-nav-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
