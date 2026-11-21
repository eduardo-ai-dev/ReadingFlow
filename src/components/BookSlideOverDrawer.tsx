"use client";

import { useId, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Check, ExternalLink, Flame, Star, X } from "lucide-react";
import type { BookFormat, ProgressUnit, ReadingStatus } from "@/lib/domain";
import type { RealisticBookFormat } from "@/features/shelves/virtual-bookshelf";
import {
  finishReadingAction,
  startReadingAction,
  updateReadingProgressAction,
} from "@/features/reading/actions";
import { BookCover } from "@/components/BookCover";
import { useFocusTrap } from "@/lib/use-focus-trap";

export interface BookDrawerData {
  id: string;
  workId?: string;
  editionId?: string;
  libraryItemId?: string;
  readingId?: string | null;
  title: string;
  author: string;
  genre: string;
  publisher?: string | null;
  pages?: number | null;
  coverUrl?: string | null;
  spineColor?: string | null;
  spineAccent?: string | null;
  seed?: string | null;
  format?: RealisticBookFormat | BookFormat | null;
  readingStatus?: ReadingStatus;
  statusLabel?: string;
  progressUnit?: ProgressUnit;
  progressValue?: number;
  progressTotal?: number | null;
  progressPercent?: number;
  rating?: number | null;
  href?: string;
  isWishlist?: boolean;
  wishlistPriority?: number;
  targetPrice?: number;
}

const FORMAT_LABELS_PT: Record<string, string> = {
  hardcover: "Capa dura",
  capa_dura: "Capa dura",
  paperback: "Brochura",
  brochura: "Brochura",
  pocket: "Bolso",
  bolso: "Bolso",
  ebook: "E-book",
  audiobook: "Audiobook",
  audio: "Audiobook",
  box: "Box / Coleção",
  other: "Outro formato",
};

const STATUS_BADGE_LABELS: Record<ReadingStatus, string> = {
  not_started: "Não iniciado",
  reading: "Em andamento",
  paused: "Pausado",
  finished: "Concluído",
  abandoned: "Abandonado",
};

function resolveCanonicalFormat(
  format?: RealisticBookFormat | BookFormat | null
): BookFormat | undefined {
  if (!format) return undefined;
  if (format === "capa_dura") return "hardcover";
  if (format === "brochura") return "paperback";
  if (format === "bolso") return "pocket";
  if (format === "audio") return "audiobook";
  return format;
}

function getStatusBadgeClasses(status?: ReadingStatus): string {
  if (status === "reading") {
    return "border-[#C8A46E]/60 bg-[#C8A46E]/15 text-[#DFBE88]";
  }
  if (status === "finished") {
    return "border-[#7FB086]/45 bg-[#3B523E]/35 text-[#CDE4D0]";
  }
  if (status === "paused") {
    return "border-[#DFBE88]/35 bg-[#2C221E] text-[#DFBE88]";
  }
  return "border-[#C8A46E]/25 bg-[#222422] text-[#D4CBC0]";
}

function DrawerBody({
  book,
  titleId,
  closeBtnRef,
  onClose,
}: {
  book: BookDrawerData;
  titleId: string;
  closeBtnRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const totalPages =
    book.progressUnit === "pages"
      ? (book.progressTotal ?? book.pages ?? null)
      : (book.pages ?? null);
  const usePercentMode = book.progressUnit === "percent" && !book.pages;

  const initialValue =
    book.readingStatus === "finished" && totalPages && !usePercentMode
      ? totalPages
      : usePercentMode
        ? (book.progressPercent ?? Math.round(book.progressValue ?? 0))
        : (book.progressValue ?? 0);

  const [currentReadingId, setCurrentReadingId] = useState<string | null>(
    book.readingId ?? null
  );
  const [currentStatus, setCurrentStatus] = useState<ReadingStatus>(
    book.readingStatus ?? "not_started"
  );
  const [currentPercent, setCurrentPercent] = useState<number>(
    book.progressPercent ?? (book.readingStatus === "finished" ? 100 : 0)
  );
  const [inputValue, setInputValue] = useState<string>(String(initialValue));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<
    "update" | "finish" | "focus" | null
  >(null);

  const pagesInputId = useId();
  const statusDisplay =
    STATUS_BADGE_LABELS[currentStatus] ?? book.statusLabel ?? "Na estante";
  const formatDisplay = book.format
    ? (FORMAT_LABELS_PT[book.format] ?? "Livro")
    : "Livro";
  const isBusy = isPending || busyAction !== null;
  const hasActiveReading = Boolean(
    currentReadingId &&
    (currentStatus === "reading" || currentStatus === "paused")
  );
  const numericRating =
    typeof book.rating === "number" && book.rating > 0 ? book.rating : null;

  async function ensureReadingId(): Promise<string | null> {
    if (
      currentReadingId &&
      (currentStatus === "reading" || currentStatus === "paused")
    ) {
      return currentReadingId;
    }
    if (!book.workId) {
      setErrorMsg(
        "Esta obra não possui identificador para registro de leitura."
      );
      return null;
    }
    const res = await startReadingAction({
      workId: book.workId,
      editionId: book.editionId,
      libraryItemId: book.libraryItemId,
      format: resolveCanonicalFormat(book.format),
      countsForGoals: true,
    });
    if (!res.ok) {
      setErrorMsg(res.error);
      return null;
    }
    setCurrentReadingId(res.readingId);
    setCurrentStatus("reading");
    return res.readingId;
  }

  function handleUpdatePages(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setFeedbackMsg(null);

    const trimmed = inputValue.trim();
    if (!trimmed) {
      setErrorMsg("Informe um valor numérico para atualizar o progresso.");
      return;
    }
    if (!/^-?\d+$/.test(trimmed)) {
      setErrorMsg("Informe um número inteiro sem casas decimais.");
      return;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setErrorMsg("Informe um número inteiro maior ou igual a zero.");
      return;
    }

    const unit: ProgressUnit = usePercentMode ? "percent" : "pages";
    const maxVal = usePercentMode ? 100 : (totalPages ?? undefined);
    if (usePercentMode && parsed > 100) {
      setErrorMsg("A porcentagem não pode exceder 100%.");
      return;
    }
    if (!usePercentMode && maxVal !== undefined && parsed > maxVal) {
      setErrorMsg(
        `O número de páginas não pode exceder o total do livro (${maxVal} pág.).`
      );
      return;
    }

    setBusyAction("update");
    startTransition(async () => {
      try {
        const targetId = currentReadingId ?? (await ensureReadingId());
        if (!targetId) {
          setBusyAction(null);
          return;
        }

        const res = await updateReadingProgressAction({
          readingId: targetId,
          progressUnit: unit,
          progressValue: parsed,
          progressTotal: maxVal,
        });

        if (!res.ok) {
          setErrorMsg(res.error);
          return;
        }

        const nextPercent = usePercentMode
          ? Math.round(parsed)
          : maxVal && maxVal > 0
            ? Math.max(0, Math.min(100, Math.round((parsed / maxVal) * 100)))
            : currentPercent;

        setInputValue(String(parsed));
        setCurrentPercent(nextPercent);
        if (currentStatus === "not_started") {
          setCurrentStatus("reading");
        }
        setFeedbackMsg("Progresso atualizado.");
        router.refresh();
      } catch {
        setErrorMsg(
          "Não foi possível salvar o progresso agora. Tente novamente."
        );
      } finally {
        setBusyAction(null);
      }
    });
  }

  function handleFinishBook() {
    if (currentStatus === "finished") return;
    setErrorMsg(null);
    setFeedbackMsg(null);
    setBusyAction("finish");

    startTransition(async () => {
      try {
        const targetId =
          currentReadingId &&
          (currentStatus === "reading" || currentStatus === "paused")
            ? currentReadingId
            : await ensureReadingId();
        if (!targetId) {
          setBusyAction(null);
          return;
        }

        const res = await finishReadingAction({ readingId: targetId });
        if (!res.ok) {
          setErrorMsg(res.error);
          return;
        }

        setCurrentStatus("finished");
        setCurrentPercent(100);
        if (totalPages && !usePercentMode) {
          setInputValue(String(totalPages));
        } else if (usePercentMode) {
          setInputValue("100");
        }
        setFeedbackMsg("Leitura marcada como concluída.");
        window.dispatchEvent(
          new CustomEvent("rf:undo-toast", {
            detail: { id: res.undoId, label: res.label },
          })
        );
        router.refresh();
      } catch {
        setErrorMsg(
          "Não foi possível concluir a leitura agora. Tente novamente."
        );
      } finally {
        setBusyAction(null);
      }
    });
  }

  function handleStartFocusSession() {
    setErrorMsg(null);
    setFeedbackMsg(null);
    setBusyAction("focus");

    startTransition(async () => {
      try {
        const targetId = await ensureReadingId();
        if (!targetId) {
          setBusyAction(null);
          return;
        }
        onClose();
        router.push(`/leitura/foco?readingId=${encodeURIComponent(targetId)}`);
      } catch {
        setErrorMsg(
          "Não foi possível iniciar a sessão de foco agora. Tente novamente."
        );
      } finally {
        setBusyAction(null);
      }
    });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Cabeçalho do slide-over */}
      <div className="flex items-center justify-between gap-3 border-b border-[#C8A46E]/20 px-5 py-4 sm:px-6">
        <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-[#DFBE88]">
          Ficha Rápida · Estante 3D
        </span>
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          aria-label="Fechar painel do livro"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#C8A46E]/30 bg-[#222422] text-[#F4EFE6] transition-colors hover:border-[#C8A46E] hover:bg-[#2C221E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Corpo rolável */}
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-6">
        {/* Capa 2D + Identificação */}
        <div className="flex gap-4 sm:gap-5">
          <BookCover
            size="lg"
            title={book.title}
            author={book.author}
            coverUrl={book.coverUrl ?? undefined}
            spineColor={book.spineColor}
            spineAccent={book.spineAccent}
            seed={book.seed ?? book.workId ?? book.id}
            readingStatus={currentStatus}
            progressPercent={book.progressPercent}
            isWishlist={book.isWishlist}
            className="shrink-0 ring-1 ring-[#C8A46E]/25"
          />

          <div className="min-w-0 flex-1 space-y-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-sans text-[11px] font-semibold tracking-wide ${getStatusBadgeClasses(
                currentStatus
              )}`}
            >
              {currentStatus === "reading" ? (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#C8A46E]"
                  aria-hidden="true"
                />
              ) : null}
              {statusDisplay}
            </span>

            <h2
              id={titleId}
              className="font-serif text-xl font-semibold leading-snug text-[#F4EFE6] text-balance"
            >
              {book.title}
            </h2>

            <p className="font-sans text-sm font-medium text-[#DFBE88]">
              {book.author}
            </p>

            <dl className="space-y-0.5 pt-1 font-sans text-xs text-[#D4CBC0]">
              <div className="flex flex-wrap gap-x-1.5">
                <dt className="sr-only">Gênero e formato</dt>
                <dd>{book.genre}</dd>
                <span aria-hidden="true">·</span>
                <dd>{formatDisplay}</dd>
              </div>
              {totalPages ? (
                <div>
                  <dt className="sr-only">Páginas</dt>
                  <dd className="tabular-nums">{totalPages} páginas</dd>
                </div>
              ) : null}
              {book.publisher ? (
                <div>
                  <dt className="sr-only">Editora</dt>
                  <dd>{book.publisher}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>

        {/* Corpo específico para item da Lista de Desejos vs Acervo */}
        {book.isWishlist ? (
          <section
            aria-label="Detalhes do desejo"
            className="space-y-3 rounded-lg border border-[#C8A46E]/30 bg-[#222422] p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-sans text-xs font-semibold uppercase tracking-wider text-[#DFBE88]">
                Na Lista de Desejos
              </span>
              {book.wishlistPriority ? (
                <span className="rounded-full border border-[#C8A46E]/40 bg-[#2C221E] px-2.5 py-0.5 font-sans text-[11px] font-semibold text-[#DFBE88]">
                  Prioridade {book.wishlistPriority}/5
                </span>
              ) : null}
            </div>
            {typeof book.targetPrice === "number" ? (
              <p className="font-sans text-sm font-medium tabular-nums text-[#F4EFE6]">
                Preço-alvo estimado:{" "}
                <span className="text-[#DFBE88]">
                  R$ {book.targetPrice.toFixed(2).replace(".", ",")}
                </span>
              </p>
            ) : null}
            <p className="font-sans text-xs text-[#D4CBC0]">
              Acompanhe prioridade, loja sugerida ou registre a compra atômica
              diretamente na Lista de Desejos.
            </p>
            <Link
              href="/desejos"
              onClick={onClose}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md bg-[#C8A46E] px-4 font-sans text-sm font-semibold text-[#141514] transition-colors hover:bg-[#DFBE88] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4EFE6]"
            >
              Gerenciar na Lista de Desejos
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>
        ) : (
          <>
            {/* Classificação */}
            <section
              aria-label="Classificação da obra"
              className="rounded-lg border border-[#C8A46E]/20 bg-[#222422] px-4 py-3.5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-sans text-xs font-semibold uppercase tracking-wider text-[#D4CBC0]">
                  Classificação
                </span>
                {numericRating !== null ? (
                  <div className="flex items-center gap-2">
                    <div
                      className="flex items-center gap-0.5"
                      aria-hidden="true"
                    >
                      {[1, 2, 3, 4, 5].map((idx) => {
                        const filled = numericRating >= idx;
                        const half = !filled && numericRating >= idx - 0.5;
                        return (
                          <Star
                            key={idx}
                            className={`h-4 w-4 ${
                              filled
                                ? "fill-[#C8A46E] text-[#C8A46E]"
                                : half
                                  ? "fill-[#C8A46E]/55 text-[#C8A46E]"
                                  : "text-[#6D655C]"
                            }`}
                          />
                        );
                      })}
                    </div>
                    <span className="font-sans text-sm font-semibold tabular-nums text-[#DFBE88]">
                      {numericRating.toFixed(1)} / 5
                    </span>
                  </div>
                ) : (
                  <span className="font-sans text-xs text-[#D4CBC0]">
                    Ainda não avaliado
                  </span>
                )}
              </div>
            </section>

            {/* Progresso atual */}
            <section
              aria-label="Progresso atual de leitura"
              className="space-y-3 rounded-lg border border-[#C8A46E]/25 bg-[#222422] p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-sans text-xs font-semibold uppercase tracking-wider text-[#D4CBC0]">
                  Progresso atual
                </span>
                <span className="font-sans text-lg font-bold tabular-nums text-[#DFBE88]">
                  {currentPercent}%
                </span>
              </div>

              <div
                role="progressbar"
                aria-valuenow={currentPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progresso de leitura: ${currentPercent}%`}
                className="h-2.5 w-full overflow-hidden rounded-full bg-[#2C221E]"
              >
                <div
                  className="h-full rounded-full bg-[#C8A46E] transition-all duration-300"
                  style={{ width: `${currentPercent}%` }}
                />
              </div>

              <p className="font-sans text-xs tabular-nums text-[#D4CBC0]">
                {usePercentMode
                  ? `${currentPercent}% concluído`
                  : totalPages
                    ? `${Math.min(Number(inputValue) || 0, totalPages)} de ${totalPages} páginas`
                    : `${Number(inputValue) || 0} páginas registradas`}
              </p>

              {/* Formulário rápido: Atualizar Páginas */}
              <form
                noValidate
                onSubmit={handleUpdatePages}
                className="space-y-2.5 pt-2"
              >
                <label
                  htmlFor={pagesInputId}
                  className="block font-sans text-xs font-medium text-[#DFBE88]"
                >
                  {usePercentMode ? "Porcentagem atual" : "Página atual"}
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id={pagesInputId}
                    type="number"
                    min={0}
                    max={usePercentMode ? 100 : (totalPages ?? undefined)}
                    step={1}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    disabled={isBusy}
                    className="min-h-[42px] w-28 rounded-md border border-[#C8A46E]/45 bg-[#F4EFE6] px-3 font-sans text-sm font-semibold tabular-nums text-[#2C221E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E]"
                  />
                  <button
                    type="submit"
                    disabled={isBusy}
                    className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-md border border-[#C8A46E]/55 bg-[#2C221E] px-3.5 font-sans text-xs font-semibold text-[#F4EFE6] transition-colors hover:border-[#C8A46E] hover:bg-[#3A2D27] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E]"
                  >
                    <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                    {busyAction === "update"
                      ? "Salvando..."
                      : "Atualizar Páginas"}
                  </button>
                </div>
              </form>
            </section>

            {/* Mensagens de retorno */}
            {errorMsg ? (
              <p
                role="alert"
                className="rounded-md border border-[#DFBE88]/40 bg-[#722F3E]/35 px-3.5 py-2.5 font-sans text-xs font-medium text-[#F4EFE6]"
              >
                {errorMsg}
              </p>
            ) : null}

            {feedbackMsg ? (
              <p
                role="status"
                className="rounded-md border border-[#7FB086]/40 bg-[#3B523E]/35 px-3.5 py-2.5 font-sans text-xs font-medium text-[#E4F0E5]"
              >
                {feedbackMsg}
              </p>
            ) : null}

            {/* Ações rápidas principais */}
            <div className="space-y-2.5">
              {hasActiveReading ? (
                <Link
                  href={`/leitura/foco?readingId=${encodeURIComponent(currentReadingId!)}`}
                  onClick={onClose}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-[#C8A46E]/45 bg-[#222422] px-4 font-sans text-sm font-semibold text-[#DFBE88] transition-colors hover:border-[#C8A46E] hover:bg-[#2C221E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E]"
                >
                  <Flame className="h-4 w-4" aria-hidden="true" />
                  Iniciar Sessão de Foco
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleStartFocusSession}
                  disabled={isBusy}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-[#C8A46E]/45 bg-[#222422] px-4 font-sans text-sm font-semibold text-[#DFBE88] transition-colors hover:border-[#C8A46E] hover:bg-[#2C221E] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E]"
                >
                  <Flame className="h-4 w-4" aria-hidden="true" />
                  {busyAction === "focus"
                    ? "Preparando sessão..."
                    : "Iniciar Sessão de Foco"}
                </button>
              )}

              <button
                type="button"
                onClick={handleFinishBook}
                disabled={isBusy || currentStatus === "finished"}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md bg-[#C8A46E] px-4 font-sans text-sm font-semibold text-[#141514] shadow-sm transition-colors hover:bg-[#DFBE88] disabled:cursor-not-allowed disabled:bg-[#3B523E] disabled:text-[#E4F0E5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4EFE6]"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                {currentStatus === "finished"
                  ? "Leitura Concluída"
                  : busyAction === "finish"
                    ? "Concluindo..."
                    : "Concluir"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Rodapé com link para ficha completa */}
      {book.href || book.workId ? (
        <div className="border-t border-[#C8A46E]/20 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          <Link
            href={book.href ?? `/livros/${book.workId}`}
            onClick={onClose}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-[#C8A46E]/25 px-3 font-sans text-xs font-semibold text-[#DFBE88] transition-colors hover:border-[#C8A46E]/60 hover:bg-[#222422] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E]"
          >
            Abrir ficha completa da obra
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export function BookSlideOverDrawer({
  book,
  onClose,
}: {
  book: BookDrawerData | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useFocusTrap({
    active: Boolean(book),
    activationKey: book?.id ?? null,
    containerRef: dialogRef,
    initialFocusRef: closeBtnRef,
    onEscape: onClose,
    lockScroll: true,
  });

  if (!book || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#141514]/75"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative h-dvh w-full max-w-md overflow-y-auto overscroll-contain border-l border-[#C8A46E]/30 bg-[#1B1D1B] pt-[env(safe-area-inset-top)] text-[#F4EFE6] shadow-[-20px_0_48px_rgba(14,12,10,0.75)]"
      >
        <DrawerBody
          key={book.id}
          book={book}
          titleId={titleId}
          closeBtnRef={closeBtnRef}
          onClose={onClose}
        />
      </div>
    </div>,
    document.body
  );
}
