"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ImageDown,
  Loader2,
  SkipForward,
  Sparkles,
  X,
} from "lucide-react";
import {
  isUnambiguousCoverMatch,
  recordDevCoverDiagnostic,
  type CoverSearchCandidate,
  type CoverSearchDiagnostic,
} from "@/features/catalog/cover-search-rules";
import { updateEditionCoverAction } from "@/features/catalog/actions";
import {
  CoverEditionPicker,
  type CoverSelectionPayload,
} from "@/components/CoverEditionPicker";
import { rfButtonClassName } from "@/components/ui/ActionControls";
import { useFocusTrap } from "@/lib/use-focus-trap";

export interface BackfillBookTarget {
  editionId: string;
  workId: string;
  title: string;
  author: string;
  isbn?: string;
  spineColor?: string;
  spineAccent?: string;
}

interface PendingReviewItem {
  book: BackfillBookTarget;
  candidates: CoverSearchCandidate[];
  diagnostic?: CoverSearchDiagnostic | null;
  apiUnavailable?: boolean;
  notice?: string | null;
}

const BACKFILL_PAUSE_MS = 350;

function sleepWithAbort(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function BackfillCoversModal({
  booksWithoutCover,
  variant = "pill",
}: {
  booksWithoutCover: readonly BackfillBookTarget[];
  variant?: "pill" | "button";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "scanning" | "review" | "done">(
    "idle"
  );
  const [processedCount, setProcessedCount] = useState(0);
  const [currentTitle, setCurrentTitle] = useState("");
  const [autoAppliedTitles, setAutoAppliedTitles] = useState<string[]>([]);
  const [manualAppliedCount, setManualAppliedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [reviewQueue, setReviewQueue] = useState<PendingReviewItem[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [savingChoice, setSavingChoice] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const closeModal = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setOpen(false);
    setPhase("idle");
    router.refresh();
  }, [router]);

  useFocusTrap({
    active: open,
    containerRef: dialogRef,
    initialFocusRef: closeBtnRef,
    onEscape: closeModal,
    lockScroll: true,
  });

  const startBackfillScan = async () => {
    if (booksWithoutCover.length === 0) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setOpen(true);
    setPhase("scanning");
    setProcessedCount(0);
    setCurrentTitle("");
    setAutoAppliedTitles([]);
    setManualAppliedCount(0);
    setSkippedCount(0);
    setReviewQueue([]);
    setReviewIndex(0);
    setErrorMessage(null);

    const pending: PendingReviewItem[] = [];
    const applied: string[] = [];

    try {
      for (let i = 0; i < booksWithoutCover.length; i += 1) {
        if (controller.signal.aborted) return;
        const book = booksWithoutCover[i]!;
        setCurrentTitle(book.title);

        if (i > 0) {
          await sleepWithAbort(BACKFILL_PAUSE_MS, controller.signal);
        }

        const sp = new URLSearchParams();
        sp.set("title", book.title);
        if (book.author) sp.set("author", book.author);
        if (book.isbn) sp.set("isbn", book.isbn);

        let candidates: CoverSearchCandidate[] = [];
        let resolvedPageCount: number | undefined;
        let diagnostic: CoverSearchDiagnostic | null = null;
        let apiUnavailable = false;
        let notice: string | null = null;

        try {
          const res = await fetch(`/api/covers/search?${sp.toString()}`, {
            signal: controller.signal,
            headers: { Accept: "application/json" },
          });
          const data = (await res.json()) as {
            candidates?: CoverSearchCandidate[];
            pageCount?: number;
            degraded?: boolean;
            apiUnavailable?: boolean;
            notice?: string;
            diagnostic?: CoverSearchDiagnostic;
          };
          candidates = Array.isArray(data.candidates)
            ? data.candidates.slice(0, 8)
            : [];
          resolvedPageCount = data.pageCount;
          diagnostic = data.diagnostic ?? null;
          notice = data.notice ?? null;
          apiUnavailable = Boolean(
            data.apiUnavailable ||
            res.status === 429 ||
            res.status === 403 ||
            (data.degraded && candidates.length === 0)
          );

          const badge =
            diagnostic?.badgePtBr?.trim() || diagnostic?.reasonPtBr?.trim();
          if (badge) {
            recordDevCoverDiagnostic(
              {
                editionId: book.editionId,
                title: book.title,
                isbn: book.isbn,
              },
              badge
            );
          }

          if (
            process.env.NODE_ENV !== "production" &&
            candidates.length === 0 &&
            badge
          ) {
            console.info(
              `[ReadingFlow/backfill][dev] "${book.title}" sem capa — motivo: ${badge}`
            );
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          candidates = [];
          apiUnavailable = true;
          notice = "Serviço indisponível, tentar de novo.";
        }

        // Só aplica automático quando a correspondência for inequívoca (título e autor batem ou ISBN exato)
        const unambiguous = isUnambiguousCoverMatch(
          { title: book.title, author: book.author, isbn: book.isbn },
          candidates
        );

        if (unambiguous) {
          const saved = await updateEditionCoverAction({
            editionId: book.editionId,
            coverUrl: unambiguous.coverUrl,
            coverSource: unambiguous.source,
            pageCount: unambiguous.pageCount ?? resolvedPageCount,
          });
          if (saved.ok) {
            applied.push(book.title);
            setAutoAppliedTitles([...applied]);
          } else {
            pending.push({
              book,
              candidates,
              diagnostic,
              apiUnavailable,
              notice,
            });
          }
        } else {
          pending.push({
            book,
            candidates,
            diagnostic,
            apiUnavailable,
            notice,
          });
        }

        setProcessedCount(i + 1);
      }

      if (controller.signal.aborted) return;
      setReviewQueue(pending);
      setReviewIndex(0);
      setPhase(pending.length > 0 ? "review" : "done");
      if (applied.length > 0) {
        router.refresh();
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setErrorMessage(
        "A busca foi interrompida por um erro inesperado. Você pode tentar novamente."
      );
      setPhase("done");
    }
  };

  const currentReviewItem = reviewQueue[reviewIndex] ?? null;

  const advanceReview = () => {
    if (reviewIndex + 1 < reviewQueue.length) {
      setReviewIndex((idx) => idx + 1);
    } else {
      setPhase("done");
      router.refresh();
    }
  };

  const handleReviewApply = async (payload: CoverSelectionPayload) => {
    if (!currentReviewItem) return;
    setErrorMessage(null);

    if (!payload.coverUrl) {
      setSkippedCount((c) => c + 1);
      advanceReview();
      return;
    }

    setSavingChoice(true);
    try {
      const res = await updateEditionCoverAction({
        editionId: currentReviewItem.book.editionId,
        coverUrl: payload.coverUrl,
        coverSource: payload.coverSource,
        pageCount: payload.pageCount,
      });
      if (!res.ok) {
        setErrorMessage(res.error);
        return;
      }
      setManualAppliedCount((c) => c + 1);
      advanceReview();
    } finally {
      setSavingChoice(false);
    }
  };

  if (booksWithoutCover.length === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void startBackfillScan()}
        className={rfButtonClassName({
          variant: "secondary",
          secondaryStyle: "outline",
          size: variant === "pill" ? "md" : "lg",
          pill: variant === "pill",
        })}
      >
        <ImageDown className="h-4 w-4" aria-hidden="true" />
        <span>Buscar capas</span>
        <span className="rounded-[var(--rf-radius-full)] bg-[var(--rf-accent-secondary-subtle)] px-2 py-0.5 text-[11px] font-bold tabular-nums text-[var(--rf-text-accent-secondary)]">
          {booksWithoutCover.length}
        </span>
      </button>

      {open ? (
        <div
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--rf-surface-overlay)] p-4 backdrop-blur-xs"
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="backfill-covers-title"
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[var(--rf-card-radius)] border border-[var(--rf-border-default)] bg-[var(--rf-surface-canvas)] p-5 text-[var(--rf-text-primary)] shadow-[var(--rf-shadow-lg)] sm:p-6"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--rf-divider)] pb-3.5">
              <div>
                <p className="rf-type-label text-[var(--rf-text-accent-secondary)]">
                  Preenchimento de capas · Acervo atual
                </p>
                <h2
                  id="backfill-covers-title"
                  className="mt-0.5 font-serif text-xl font-bold text-[var(--rf-text-heading)]"
                >
                  Buscar capas para livros sem imagem
                </h2>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={closeModal}
                aria-label="Fechar busca de capas"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--rf-radius-full)] border border-[var(--rf-border-default)] bg-[var(--rf-surface-card-solid)] text-[var(--rf-text-primary)] hover:border-[var(--rf-border-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {errorMessage ? (
              <p
                role="alert"
                className="mt-4 rounded-[var(--rf-radius-md)] border border-[var(--rf-status-error)] bg-[var(--rf-status-error-bg)] p-3 text-xs font-medium text-[var(--rf-status-error)]"
              >
                {errorMessage}
              </p>
            ) : null}

            {/* Fase 1: Varredura */}
            {phase === "scanning" ? (
              <div className="mt-5 space-y-4">
                <div className="flex items-center gap-3 rounded-[var(--rf-radius-lg)] border border-[var(--rf-border-subtle)] bg-[var(--rf-surface-card-solid)] p-4">
                  <Loader2
                    className="h-5 w-5 shrink-0 animate-spin text-[var(--rf-text-accent-secondary)]"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-sans text-xs font-semibold text-[var(--rf-text-primary)]">
                      Verificando {processedCount} de {booksWithoutCover.length}{" "}
                      {booksWithoutCover.length === 1 ? "livro" : "livros"}…
                    </p>
                    {currentTitle ? (
                      <p className="mt-0.5 truncate font-serif text-sm italic text-[var(--rf-text-secondary)]">
                        Consultando “{currentTitle}”
                      </p>
                    ) : null}
                  </div>
                </div>

                <div
                  role="progressbar"
                  aria-valuenow={Math.round(
                    (processedCount / Math.max(1, booksWithoutCover.length)) *
                      100
                  )}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-2 w-full overflow-hidden rounded-[var(--rf-radius-full)] bg-[var(--rf-surface-subtle)]"
                >
                  <div
                    className="h-full rounded-[var(--rf-radius-full)] bg-gradient-to-r from-[var(--rf-accent-secondary)] to-[var(--rf-accent-primary)] transition-all duration-300"
                    style={{
                      width: `${Math.round(
                        (processedCount /
                          Math.max(1, booksWithoutCover.length)) *
                          100
                      )}%`,
                    }}
                  />
                </div>

                <p className="font-sans text-xs text-[var(--rf-text-secondary)]">
                  Apenas correspondências inequívocas (título e autor idênticos
                  ou ISBN exato) são aplicadas automaticamente. Obras com
                  múltiplas edições ou dúvida serão exibidas para sua
                  confirmação. Capas já escolhidas nunca são alteradas.
                </p>

                {autoAppliedTitles.length > 0 ? (
                  <p className="font-sans text-xs font-semibold text-[var(--rf-status-success)]">
                    {autoAppliedTitles.length}{" "}
                    {autoAppliedTitles.length === 1
                      ? "capa aplicada automaticamente"
                      : "capas aplicadas automaticamente"}{" "}
                    até agora.
                  </p>
                ) : null}

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className={rfButtonClassName({
                      variant: "secondary",
                      secondaryStyle: "outline",
                      size: "md",
                    })}
                  >
                    Interromper
                  </button>
                </div>
              </div>
            ) : null}

            {/* Fase 2: Confirmação manual pelo seletor para correspondências não inequívocas */}
            {phase === "review" && currentReviewItem ? (
              <div className="mt-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--rf-radius-lg)] border border-[var(--rf-border-default)] bg-[var(--rf-surface-subtle)] px-4 py-3">
                  <div>
                    <p className="rf-type-label text-[var(--rf-text-accent-secondary)]">
                      Confirmação de edição ({reviewIndex + 1} de{" "}
                      {reviewQueue.length})
                    </p>
                    <p className="font-serif text-base font-bold text-[var(--rf-text-heading)]">
                      {currentReviewItem.book.title}
                    </p>
                    <p className="font-sans text-xs text-[var(--rf-text-secondary)]">
                      {currentReviewItem.book.author}
                      {currentReviewItem.book.isbn
                        ? ` · ISBN ${currentReviewItem.book.isbn}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {autoAppliedTitles.length > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-[var(--rf-radius-full)] bg-[var(--rf-status-success-bg)] px-2.5 py-1 font-sans text-[11px] font-semibold text-[var(--rf-status-success)]">
                        <Sparkles className="h-3 w-3" aria-hidden="true" />
                        {autoAppliedTitles.length} automática(s)
                      </span>
                    ) : null}
                    <button
                      type="button"
                      disabled={savingChoice}
                      onClick={() => {
                        setSkippedCount((c) => c + 1);
                        advanceReview();
                      }}
                      className={rfButtonClassName({
                        variant: "secondary",
                        secondaryStyle: "outline",
                        size: "sm",
                      })}
                    >
                      <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
                      Pular livro
                    </button>
                  </div>
                </div>

                <CoverEditionPicker
                  key={currentReviewItem.book.editionId}
                  title={currentReviewItem.book.title}
                  author={currentReviewItem.book.author}
                  isbn={currentReviewItem.book.isbn}
                  seed={currentReviewItem.book.editionId}
                  spineColor={currentReviewItem.book.spineColor}
                  spineAccent={currentReviewItem.book.spineAccent}
                  initialCandidates={currentReviewItem.candidates}
                  initialDiagnostic={currentReviewItem.diagnostic}
                  initialApiUnavailable={currentReviewItem.apiUnavailable}
                  initialNotice={currentReviewItem.notice}
                  autoSearch={false}
                  isSaving={savingChoice}
                  onApply={handleReviewApply}
                />
              </div>
            ) : null}

            {/* Fase 3: Resumo final */}
            {phase === "done" ? (
              <div className="mt-5 space-y-4">
                <div className="flex items-start gap-3 rounded-[var(--rf-radius-lg)] border border-[var(--rf-status-success)] bg-[var(--rf-surface-card-solid)] p-4">
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 shrink-0 text-[var(--rf-status-success)]"
                    aria-hidden="true"
                  />
                  <div className="space-y-1">
                    <p className="font-serif text-base font-bold text-[var(--rf-text-heading)]">
                      Busca de capas concluída
                    </p>
                    <p className="font-sans text-xs text-[var(--rf-text-secondary)]">
                      • <strong>{autoAppliedTitles.length}</strong> aplicada(s)
                      automaticamente por correspondência inequívoca
                      <br />• <strong>{manualAppliedCount}</strong>{" "}
                      confirmada(s) por você
                      <br />• <strong>{skippedCount}</strong> mantida(s) com o
                      fallback editorial
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    className={rfButtonClassName({
                      variant: "secondary",
                      size: "md",
                    })}
                  >
                    Concluir e atualizar estante
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
