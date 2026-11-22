"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookCheck, X } from "lucide-react";
import { upsertReviewAction } from "@/features/ratings/actions";
import { StarRatingInput } from "@/components/StarRating";
import { formatNumberPtBr } from "@/lib/formatters";
import {
  dispatchFeedbackToast,
  type BookCompletedCardDetail,
} from "@/lib/feedback";

/**
 * Cartão sóbrio e editorial ao concluir um livro:
 * exibe dias de leitura, páginas por dia e avaliação inline, com fita marcadora bordô
 * animando discretamente (apenas transform/opacity, sem confete nem pontos).
 */
export function BookCompletedCardModal({
  stats,
  onClose,
}: {
  stats: BookCompletedCardDetail | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [rating, setRating] = useState<number | undefined>(
    stats?.existingRating
  );
  const [savedRating, setSavedRating] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Gerenciamento de foco acessível: guarda elemento gatilho, foca botão de fechar e restaura ao sair
  useEffect(() => {
    if (!stats) return;
    triggerRef.current = document.activeElement as HTMLElement | null;
    const id = window.requestAnimationFrame(() => {
      closeBtnRef.current?.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(id);
      document.removeEventListener("keydown", handleKeyDown);
      triggerRef.current?.focus?.();
    };
  }, [stats, onClose]);

  if (!stats) return null;

  const handleSaveRating = () => {
    if (!rating || isPending) return;
    setRatingError(null);
    startTransition(async () => {
      try {
        const res = await upsertReviewAction({
          workId: stats.workId,
          rating,
          isPrivate: true,
        });
        if (!res.ok) {
          setRatingError(res.error);
          return;
        }
        setSavedRating(true);
        dispatchFeedbackToast({
          message: `Nota ${rating.toFixed(1).replace(".", ",")} salva para "${stats.title}"`,
        });
        router.refresh();
      } catch {
        setRatingError(
          "Não foi possível salvar a nota agora. Tente novamente."
        );
      }
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="book-completed-title"
      data-testid="book-completed-card"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--rf-surface-overlay)] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="rf-toast-enter relative w-full max-w-md overflow-hidden rounded-[var(--rf-radius-xl)] border border-[var(--rf-border-accent-soft)] bg-[var(--rf-surface-card-solid)] p-6 text-[var(--rf-text-primary)] shadow-[var(--rf-nav-modal-shadow)]">
        {/* Marcador de página ("fita" bordô) descendo discretamente apenas via transform/opacity */}
        <div
          aria-hidden="true"
          data-testid="book-completed-ribbon"
          className="rf-bookmark-ribbon pointer-events-none absolute top-0 right-7 h-16 w-7"
        >
          <svg viewBox="0 0 28 64" className="h-full w-full drop-shadow-sm">
            <path
              d="M0 0 H28 V60 L14 48 L0 60 Z"
              fill="var(--rf-accent-secondary)"
            />
            <path
              d="M4 0 V50"
              stroke="var(--rf-accent-primary)"
              strokeOpacity="0.45"
              strokeWidth="1"
            />
            <path
              d="M24 0 V50"
              stroke="var(--rf-accent-primary)"
              strokeOpacity="0.45"
              strokeWidth="1"
            />
          </svg>
        </div>

        <div className="flex items-start justify-between gap-4 pr-10">
          <div>
            <span className="inline-flex items-center gap-1.5 font-sans text-xs font-semibold uppercase tracking-[0.14em] text-[var(--rf-text-accent-secondary)]">
              <BookCheck className="h-4 w-4" aria-hidden="true" />
              <span>Leitura concluída</span>
            </span>
            <h2
              id="book-completed-title"
              className="mt-1.5 font-serif text-2xl font-semibold leading-snug text-[var(--rf-text-heading)]"
            >
              {stats.title}
            </h2>
            <p className="mt-0.5 font-sans text-xs text-[var(--rf-text-secondary)]">
              {stats.author}
            </p>
          </div>
        </div>

        {/* Estatísticas sóbrias do livro */}
        <dl className="mt-5 grid grid-cols-3 gap-2.5 rounded-[var(--rf-radius-md)] border border-[var(--rf-border-subtle)] bg-[var(--rf-surface-canvas)] p-3.5 text-center tabular-nums [font-variant-numeric:lining-nums_tabular-nums]">
          <div>
            <dt className="font-sans text-[11px] font-semibold uppercase tracking-wide text-[var(--rf-text-secondary)]">
              Dias
            </dt>
            <dd className="mt-1 font-serif text-xl font-bold text-[var(--rf-text-heading)]">
              {formatNumberPtBr(stats.daysCount)}
            </dd>
          </div>

          <div className="border-x border-[var(--rf-divider)] px-2">
            <dt className="font-sans text-[11px] font-semibold uppercase tracking-wide text-[var(--rf-text-secondary)]">
              Pág./dia
            </dt>
            <dd className="mt-1 font-serif text-xl font-bold text-[var(--rf-text-heading)]">
              {stats.pagesPerDay !== null
                ? formatNumberPtBr(stats.pagesPerDay)
                : "—"}
            </dd>
          </div>

          <div>
            <dt className="font-sans text-[11px] font-semibold uppercase tracking-wide text-[var(--rf-text-secondary)]">
              Nota
            </dt>
            <dd className="mt-1 font-serif text-xl font-bold text-[var(--rf-text-accent-secondary)]">
              {rating ? rating.toFixed(1).replace(".", ",") : "—"}
            </dd>
          </div>
        </dl>

        {/* Avaliação rápida opcional */}
        <div className="mt-4 rounded-[var(--rf-radius-md)] border border-[var(--rf-border-subtle)] bg-[var(--rf-surface-elevated)] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-sans text-xs font-semibold text-[var(--rf-text-primary)]">
              Registrar nota pessoal (opcional)
            </span>
            {savedRating ? (
              <span className="font-sans text-xs font-semibold text-[var(--rf-status-success)]">
                Nota salva
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <StarRatingInput
              id={`completed-rating-${stats.workId}`}
              label={`Avaliar ${stats.title}`}
              value={rating}
              onChange={(val) => {
                setRating(val);
                setSavedRating(false);
              }}
            />
            <button
              type="button"
              disabled={!rating || isPending}
              onClick={handleSaveRating}
              className="inline-flex min-h-[38px] items-center rounded-[var(--rf-radius-md)] bg-[var(--rf-accent-secondary)] px-3.5 font-sans text-xs font-semibold text-[var(--rf-accent-on-secondary)] hover:bg-[var(--rf-accent-secondary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] disabled:opacity-50"
            >
              {isPending ? "Salvando..." : "Salvar nota"}
            </button>
          </div>
          {ratingError ? (
            <p
              role="alert"
              className="mt-2 font-sans text-xs font-medium text-[var(--rf-status-error)]"
            >
              {ratingError}
            </p>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--rf-divider)] pt-4">
          <Link
            href={`/livros/${stats.workId}`}
            onClick={onClose}
            className="inline-flex min-h-[40px] items-center font-sans text-xs font-semibold text-[var(--rf-text-accent-secondary)] hover:underline"
          >
            Abrir ficha da obra →
          </Link>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--rf-radius-md)] border border-[var(--rf-border-strong)] bg-[var(--rf-surface-elevated)] px-4 font-sans text-xs font-semibold text-[var(--rf-text-primary)] hover:border-[var(--rf-border-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] lg:min-h-[38px]"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Fechar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
