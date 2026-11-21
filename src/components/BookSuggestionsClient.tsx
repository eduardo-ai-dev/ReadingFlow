"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  AlertCircle,
  BookOpen,
  BookmarkCheck,
  BookmarkPlus,
  Compass,
  Heart,
  Loader2,
  RefreshCw,
  RotateCcw,
  SkipForward,
  Sparkles,
} from "lucide-react";
import { BookCover } from "@/components/BookCover";
import { rfButtonClassName } from "@/components/ui/ActionControls";
import {
  SUGGESTION_GENRE_OPTIONS,
  type BookSuggestionMode,
  type NewBookSuggestionItem,
  type SuggestionGenreKey,
  type WishlistSuggestionItem,
} from "@/features/suggestions/rules";
import {
  saveSuggestionToWishlistAction,
  startReadingNewSuggestionAction,
} from "@/features/suggestions/actions";
import { startReadingFromWishlistAction } from "@/features/wishlist/actions";

interface BookSuggestionsClientProps {
  initialWishlistItems: readonly WishlistSuggestionItem[];
}

interface SuggestionsApiSuccess {
  ok: true;
  items: NewBookSuggestionItem[];
  source: "google_books" | "open_library";
  queryUsed: string;
  batch: number;
}

interface SuggestionsApiFailure {
  ok: false;
  serviceUnavailable?: boolean;
  error?: string;
}

const PRIORITY_LABEL: Record<number, string> = {
  5: "Prioridade máxima",
  4: "Alta prioridade",
  3: "Prioridade média",
  2: "Baixa prioridade",
  1: "Quando der",
};

export function BookSuggestionsClient({
  initialWishlistItems,
}: BookSuggestionsClientProps) {
  const [mode, setMode] = useState<BookSuggestionMode>("wishlist");
  const [wishlistItems, setWishlistItems] = useState<WishlistSuggestionItem[]>(
    () => [...initialWishlistItems]
  );
  const [dismissedWishIds, setDismissedWishIds] = useState<string[]>([]);

  // Estado do modo "Novos Livros"
  const [genreFilter, setGenreFilter] = useState<SuggestionGenreKey>("todos");
  const [batchIndex, setBatchIndex] = useState(0);
  const [newBooks, setNewBooks] = useState<NewBookSuggestionItem[]>([]);
  const [dismissedNewBookIds, setDismissedNewBookIds] = useState<string[]>([]);
  const [savedFingerprints, setSavedFingerprints] = useState<string[]>([]);
  const [startedFingerprints, setStartedFingerprints] = useState<string[]>([]);
  const [isLoadingNewBooks, setIsLoadingNewBooks] = useState(false);
  const [newBooksError, setNewBooksError] = useState<string | null>(null);
  const [hasLoadedNewBooks, setHasLoadedNewBooks] = useState(false);

  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [isMutating, startMutation] = useTransition();
  const abortRef = useRef<AbortController | null>(null);

  const fetchNewBooks = useCallback(
    async (targetGenre: SuggestionGenreKey, targetBatch: number) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoadingNewBooks(true);
      setNewBooksError(null);

      try {
        const params = new URLSearchParams({
          mode: "new_books",
          genre: targetGenre,
          batch: String(targetBatch),
        });
        const res = await fetch(`/api/suggestions?${params.toString()}`, {
          signal: controller.signal,
        });
        const payload = (await res.json().catch(() => null)) as
          SuggestionsApiSuccess | SuggestionsApiFailure | null;

        if (controller.signal.aborted) return;

        if (!res.ok || !payload || !payload.ok) {
          setNewBooksError(
            (payload && !payload.ok && payload.error) ||
              "Não foi possível consultar novas sugestões agora. Tente novamente."
          );
          setHasLoadedNewBooks(true);
          return;
        }

        setNewBooks(payload.items);
        setHasLoadedNewBooks(true);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setNewBooksError(
          "Falha de rede ao consultar o catálogo externo. Tente novamente."
        );
        setHasLoadedNewBooks(true);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingNewBooks(false);
        }
      }
    },
    []
  );

  // Cancela qualquer requisição pendente ao desmontar o componente
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const switchToNewBooks = useCallback(
    (nextGenre = genreFilter, nextBatch = batchIndex) => {
      setFeedback(null);
      setMode("new_books");
      void fetchNewBooks(nextGenre, nextBatch);
    },
    [genreFilter, batchIndex, fetchNewBooks]
  );

  const activeWishlistQueue = useMemo(
    () =>
      wishlistItems.filter((item) => !dismissedWishIds.includes(item.wishId)),
    [wishlistItems, dismissedWishIds]
  );

  const activeNewBooksQueue = useMemo(
    () =>
      newBooks.filter(
        (item) =>
          !dismissedNewBookIds.includes(item.id) &&
          !startedFingerprints.includes(item.fingerprint)
      ),
    [newBooks, dismissedNewBookIds, startedFingerprints]
  );

  const currentWish = activeWishlistQueue[0] ?? null;
  const currentNewBook = activeNewBooksQueue[0] ?? null;
  const isCurrentNewBookSaved = currentNewBook
    ? currentNewBook.alreadyInWishlist ||
      savedFingerprints.includes(currentNewBook.fingerprint)
    : false;

  const handleDismissWishlist = (wishId: string) => {
    setFeedback(null);
    setDismissedWishIds((prev) =>
      prev.includes(wishId) ? prev : [...prev, wishId]
    );
  };

  const handleStartWishlistReading = (item: WishlistSuggestionItem) => {
    setFeedback(null);
    startMutation(async () => {
      const res = await startReadingFromWishlistAction({ wishId: item.wishId });
      if (!res.ok) {
        setFeedback({ kind: "error", text: res.error });
        return;
      }
      setWishlistItems((prev) => prev.filter((w) => w.wishId !== item.wishId));
      setFeedback({
        kind: "success",
        text: `"${item.title}" foi movido para sua cabeceira de leitura.`,
      });
    });
  };

  const handleDismissNewBook = (bookId: string) => {
    setFeedback(null);
    setDismissedNewBookIds((prev) =>
      prev.includes(bookId) ? prev : [...prev, bookId]
    );
  };

  const handleSaveNewBookToWishlist = (item: NewBookSuggestionItem) => {
    setFeedback(null);
    startMutation(async () => {
      const res = await saveSuggestionToWishlistAction({
        title: item.title,
        author: item.author,
        genre: item.genre,
        isbn: item.isbn,
        pages: item.pages,
        coverUrl: item.coverUrl,
        priority: 4,
      });
      if (!res.ok) {
        setFeedback({ kind: "error", text: res.error });
        return;
      }
      setSavedFingerprints((prev) =>
        prev.includes(item.fingerprint) ? prev : [...prev, item.fingerprint]
      );
      setWishlistItems((prev) =>
        prev.some((w) => w.wishId === res.item.wishId)
          ? prev
          : [res.item, ...prev]
      );
      setFeedback({
        kind: "success",
        text: res.alreadyExisted
          ? `"${item.title}" já estava na sua Lista de Desejos.`
          : `"${item.title}" salvo na sua Lista de Desejos.`,
      });
    });
  };

  const handleStartNewBookReading = (item: NewBookSuggestionItem) => {
    setFeedback(null);
    startMutation(async () => {
      const res = await startReadingNewSuggestionAction({
        title: item.title,
        author: item.author,
        genre: item.genre,
        isbn: item.isbn,
        pages: item.pages,
        coverUrl: item.coverUrl,
      });
      if (!res.ok) {
        setFeedback({ kind: "error", text: res.error });
        return;
      }
      setStartedFingerprints((prev) =>
        prev.includes(item.fingerprint) ? prev : [...prev, item.fingerprint]
      );
      setFeedback({
        kind: "success",
        text: `"${item.title}" adicionado à estante e iniciado em Leitura.`,
      });
    });
  };

  const handleNextBatch = () => {
    setFeedback(null);
    setDismissedNewBookIds([]);
    const nextBatch = batchIndex + 1;
    setBatchIndex(nextBatch);
    void fetchNewBooks(genreFilter, nextBatch);
  };

  return (
    <section
      aria-labelledby="suggestions-heading"
      data-testid="book-suggestions-section"
      className="rf-panel overflow-hidden p-5 sm:p-6"
    >
      {/* Cabeçalho + alternador Lista de Desejos vs Novos Livros */}
      <div className="flex flex-col gap-4 border-b border-[var(--rf-divider)] pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <span className="rf-section-marker inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Sugestões de Leitura
          </span>
          <h2
            id="suggestions-heading"
            className="mt-1 font-serif text-xl font-semibold text-[var(--rf-text-heading)] sm:text-2xl"
          >
            O que ler a seguir
          </h2>
          <p className="mt-0.5 text-xs text-[var(--rf-text-secondary)] sm:text-sm">
            Escolha entre os títulos aguardando na sua Lista de Desejos ou
            descubra obras fora do seu acervo.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Origem das sugestões de livros"
          className="inline-flex self-start rounded-[var(--rf-radius-md)] border border-[var(--rf-border-default)] bg-[var(--rf-surface-desk)] p-1"
        >
          <button
            id="suggestions-tab-wishlist"
            type="button"
            role="tab"
            aria-selected={mode === "wishlist"}
            aria-controls="suggestions-panel-wishlist"
            onClick={() => {
              setFeedback(null);
              setMode("wishlist");
            }}
            className={`inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-[var(--rf-radius-sm)] px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${
              mode === "wishlist"
                ? "bg-[var(--rf-tab-active-bg)] text-[var(--rf-tab-active-text)] shadow-[var(--rf-shadow-xs)]"
                : "text-[var(--rf-text-heading)] hover:text-[var(--rf-text-accent-secondary)]"
            }`}
          >
            <Heart className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Lista de Desejos</span>
            <span className="rounded-[var(--rf-radius-full)] bg-black/15 px-1.5 py-0.5 text-[10px] tabular-nums">
              {wishlistItems.length}
            </span>
          </button>

          <button
            id="suggestions-tab-new-books"
            type="button"
            role="tab"
            aria-selected={mode === "new_books"}
            aria-controls="suggestions-panel-new-books"
            onClick={() => switchToNewBooks()}
            className={`inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-[var(--rf-radius-sm)] px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${
              mode === "new_books"
                ? "bg-[var(--rf-tab-active-bg)] text-[var(--rf-tab-active-text)] shadow-[var(--rf-shadow-xs)]"
                : "text-[var(--rf-text-heading)] hover:text-[var(--rf-text-accent-secondary)]"
            }`}
          >
            <Compass className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Novos Livros</span>
          </button>
        </div>
      </div>

      {/* Feedback persistente de ações */}
      {feedback ? (
        <div
          role="status"
          aria-live="polite"
          className={`mt-4 flex items-center gap-2 rounded-[var(--rf-radius-md)] border px-3.5 py-2.5 text-xs font-medium sm:text-sm ${
            feedback.kind === "success"
              ? "border-[var(--rf-status-success)]/45 bg-[var(--rf-status-success-bg)] text-[var(--rf-status-success)]"
              : "border-[var(--rf-status-danger)]/45 bg-[var(--rf-status-danger-bg)] text-[var(--rf-status-danger)]"
          }`}
        >
          {feedback.kind === "error" ? (
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <BookmarkCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{feedback.text}</span>
        </div>
      ) : null}

      {/* MODO 1: LISTA DE DESEJOS */}
      {mode === "wishlist" ? (
        <div
          id="suggestions-panel-wishlist"
          role="tabpanel"
          aria-labelledby="suggestions-tab-wishlist"
          className="mt-5"
        >
          {currentWish ? (
            <div
              data-testid="suggestion-card-wishlist"
              className="flex flex-col gap-5 rounded-[var(--rf-radius-md)] border border-[var(--rf-border-default)] bg-[var(--rf-surface-card-solid)] p-4 sm:flex-row sm:items-center sm:p-5"
            >
              <BookCover
                size="md"
                title={currentWish.title}
                author={currentWish.author}
                coverUrl={currentWish.coverUrl ?? null}
                spineColor={currentWish.spineColor}
                spineAccent={currentWish.spineAccent}
                seed={currentWish.seed}
                isWishlist
              />

              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-[var(--rf-radius-full)] border border-[var(--rf-border-accent)] bg-[var(--rf-accent-primary-subtle)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--rf-text-heading)]">
                    {PRIORITY_LABEL[currentWish.priority] ??
                      "Na lista de desejos"}
                  </span>
                  {currentWish.genre ? (
                    <span className="rounded-[var(--rf-radius-full)] border border-[var(--rf-border-subtle)] bg-[var(--rf-surface-subtle)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--rf-text-secondary)]">
                      {currentWish.genre}
                    </span>
                  ) : null}
                  <span className="ml-auto text-xs font-medium tabular-nums text-[var(--rf-text-secondary)]">
                    Sugestão 1 de {activeWishlistQueue.length}
                  </span>
                </div>

                <div>
                  <h3 className="font-serif text-xl font-semibold text-[var(--rf-text-heading)]">
                    {currentWish.title}
                  </h3>
                  <p className="text-sm text-[var(--rf-text-secondary)]">
                    {currentWish.author}
                  </p>
                </div>

                {typeof currentWish.targetPrice === "number" ? (
                  <p className="text-xs font-medium tabular-nums text-[var(--rf-text-secondary)]">
                    Preço-alvo registrado:{" "}
                    <strong className="text-[var(--rf-text-heading)]">
                      R$ {currentWish.targetPrice.toFixed(2).replace(".", ",")}
                    </strong>
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() => handleStartWishlistReading(currentWish)}
                    className={rfButtonClassName({
                      variant: "primary",
                      size: "md",
                    })}
                  >
                    {isMutating ? (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <BookOpen className="h-4 w-4" aria-hidden="true" />
                    )}
                    Começar a ler
                  </button>

                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() => handleDismissWishlist(currentWish.wishId)}
                    className={rfButtonClassName({
                      variant: "secondary",
                      size: "md",
                    })}
                  >
                    <SkipForward className="h-4 w-4" aria-hidden="true" />
                    Descartar · Próxima
                  </button>

                  <Link
                    href="/desejos"
                    className="ml-auto text-xs font-semibold text-[var(--rf-text-accent-secondary)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
                  >
                    Ver lista completa
                  </Link>
                </div>
              </div>
            </div>
          ) : wishlistItems.length > 0 && dismissedWishIds.length > 0 ? (
            <div
              data-testid="suggestion-empty-wishlist-exhausted"
              className="flex flex-col items-start justify-between gap-3 rounded-[var(--rf-radius-md)] border border-[var(--rf-border-subtle)] bg-[var(--rf-surface-subtle)] p-5 sm:flex-row sm:items-center"
            >
              <div>
                <p className="font-serif text-base font-semibold text-[var(--rf-text-heading)]">
                  Você já passou por todas as sugestões da sua Lista de Desejos.
                </p>
                <p className="mt-1 text-xs text-[var(--rf-text-secondary)]">
                  Reexiba os títulos descartados ou explore livros inéditos fora
                  da sua estante.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDismissedWishIds([])}
                  className={rfButtonClassName({
                    variant: "secondary",
                    size: "sm",
                  })}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Rever descartadas
                </button>
                <button
                  type="button"
                  onClick={() => switchToNewBooks()}
                  className={rfButtonClassName({
                    variant: "primary",
                    size: "sm",
                  })}
                >
                  <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                  Explorar Novos Livros
                </button>
              </div>
            </div>
          ) : (
            <div
              data-testid="suggestion-empty-wishlist"
              className="flex flex-col items-start justify-between gap-4 rounded-[var(--rf-radius-md)] border border-dashed border-[var(--rf-border-default)] bg-[var(--rf-surface-subtle)] p-5 sm:flex-row sm:items-center"
            >
              <div>
                <p className="font-serif text-base font-semibold text-[var(--rf-text-heading)]">
                  Nenhum título elegível na sua Lista de Desejos
                </p>
                <p className="mt-1 text-xs text-[var(--rf-text-secondary)] sm:text-sm">
                  Livros já concluídos ou em andamento não aparecem aqui.
                  Cadastre um desejo ou alterne para Novos Livros.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => switchToNewBooks()}
                  className={rfButtonClassName({
                    variant: "primary",
                    size: "sm",
                  })}
                >
                  <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                  Descobrir Novos Livros
                </button>
                <Link
                  href="/desejos"
                  className={rfButtonClassName({
                    variant: "secondary",
                    size: "sm",
                  })}
                >
                  Ir para Lista de Desejos
                </Link>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* MODO 2: NOVOS LIVROS (FORA DO ACERVO) */
        <div
          id="suggestions-panel-new-books"
          role="tabpanel"
          aria-labelledby="suggestions-tab-new-books"
          className="mt-5 space-y-4"
        >
          {/* Filtros de gênero + atualizar lote */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div
              role="group"
              aria-label="Filtrar sugestões de novos livros por gênero"
              className="flex flex-wrap gap-1.5"
            >
              {SUGGESTION_GENRE_OPTIONS.map((opt) => {
                const active = genreFilter === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setFeedback(null);
                      setDismissedNewBookIds([]);
                      setBatchIndex(0);
                      setGenreFilter(opt.key);
                      void fetchNewBooks(opt.key, 0);
                    }}
                    className={`min-h-[34px] cursor-pointer rounded-[var(--rf-radius-full)] border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)] ${
                      active
                        ? "border-[var(--rf-tab-active-bg)] bg-[var(--rf-tab-active-bg)] text-[var(--rf-tab-active-text)]"
                        : "border-[var(--rf-border-default)] bg-[var(--rf-surface-canvas)] text-[var(--rf-text-heading)] hover:border-[var(--rf-border-accent)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={isLoadingNewBooks}
              onClick={handleNextBatch}
              className={rfButtonClassName({
                variant: "secondary",
                size: "sm",
              })}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isLoadingNewBooks ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              Gerar novas sugestões
            </button>
          </div>

          {/* Carregando */}
          {isLoadingNewBooks ? (
            <div
              data-testid="suggestion-loading"
              className="flex items-center gap-4 rounded-[var(--rf-radius-md)] border border-[var(--rf-border-subtle)] bg-[var(--rf-surface-card-solid)] p-5"
            >
              <div className="h-28 w-20 shrink-0 animate-pulse rounded bg-[var(--rf-surface-subtle)]" />
              <div className="flex-1 space-y-2.5">
                <div className="h-4 w-32 animate-pulse rounded bg-[var(--rf-surface-subtle)]" />
                <div className="h-6 w-2/3 animate-pulse rounded bg-[var(--rf-surface-subtle)]" />
                <div className="h-4 w-1/3 animate-pulse rounded bg-[var(--rf-surface-subtle)]" />
              </div>
            </div>
          ) : newBooksError ? (
            <div
              data-testid="suggestion-error"
              className="flex flex-col items-start justify-between gap-3 rounded-[var(--rf-radius-md)] border border-[var(--rf-status-danger)]/45 bg-[var(--rf-status-danger-bg)] p-5 sm:flex-row sm:items-center"
            >
              <div className="flex items-start gap-2.5 text-[var(--rf-status-danger)]">
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-semibold">{newBooksError}</p>
                  <p className="mt-0.5 text-xs opacity-90">
                    Seu acervo e sua Lista de Desejos continuam disponíveis
                    normalmente.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void fetchNewBooks(genreFilter, batchIndex)}
                className={rfButtonClassName({
                  variant: "secondary",
                  size: "sm",
                })}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Tentar novamente
              </button>
            </div>
          ) : currentNewBook ? (
            <div
              data-testid="suggestion-card-new-book"
              className="flex flex-col gap-5 rounded-[var(--rf-radius-md)] border border-[var(--rf-border-default)] bg-[var(--rf-surface-card-solid)] p-4 sm:flex-row sm:items-center sm:p-5"
            >
              <BookCover
                size="md"
                title={currentNewBook.title}
                author={currentNewBook.author}
                coverUrl={currentNewBook.coverUrl ?? null}
                seed={currentNewBook.isbn ?? currentNewBook.id}
              />

              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-[var(--rf-radius-full)] border border-[var(--rf-border-accent)] bg-[var(--rf-accent-primary-subtle)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--rf-text-heading)]">
                    Fora do seu acervo
                  </span>
                  {currentNewBook.genre ? (
                    <span className="rounded-[var(--rf-radius-full)] border border-[var(--rf-border-subtle)] bg-[var(--rf-surface-subtle)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--rf-text-secondary)]">
                      {currentNewBook.genre}
                    </span>
                  ) : null}
                  {currentNewBook.pages ? (
                    <span className="text-xs font-medium tabular-nums text-[var(--rf-text-secondary)]">
                      {currentNewBook.pages} págs.
                    </span>
                  ) : null}
                  <span className="ml-auto text-xs font-medium tabular-nums text-[var(--rf-text-secondary)]">
                    Restam {activeNewBooksQueue.length} neste lote
                  </span>
                </div>

                <div>
                  <h3 className="font-serif text-xl font-semibold text-[var(--rf-text-heading)]">
                    {currentNewBook.title}
                  </h3>
                  <p className="text-sm text-[var(--rf-text-secondary)]">
                    {currentNewBook.author}
                    {currentNewBook.year ? ` · ${currentNewBook.year}` : ""}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={isMutating || isCurrentNewBookSaved}
                    onClick={() => handleSaveNewBookToWishlist(currentNewBook)}
                    className={rfButtonClassName({
                      variant: isCurrentNewBookSaved ? "secondary" : "primary",
                      size: "md",
                    })}
                  >
                    {isCurrentNewBookSaved ? (
                      <>
                        <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
                        Salvo nos Desejos
                      </>
                    ) : (
                      <>
                        <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
                        Salvar na Lista de Desejos
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() => handleStartNewBookReading(currentNewBook)}
                    className={rfButtonClassName({
                      variant: "secondary",
                      size: "md",
                    })}
                  >
                    <BookOpen className="h-4 w-4" aria-hidden="true" />
                    Começar a ler
                  </button>

                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() => handleDismissNewBook(currentNewBook.id)}
                    className={rfButtonClassName({
                      variant: "secondary",
                      size: "md",
                    })}
                  >
                    <SkipForward className="h-4 w-4" aria-hidden="true" />
                    Descartar · Próxima
                  </button>
                </div>
              </div>
            </div>
          ) : hasLoadedNewBooks ? (
            <div
              data-testid="suggestion-empty-new-books"
              className="flex flex-col items-start justify-between gap-3 rounded-[var(--rf-radius-md)] border border-dashed border-[var(--rf-border-default)] bg-[var(--rf-surface-subtle)] p-5 sm:flex-row sm:items-center"
            >
              <div>
                <p className="font-serif text-base font-semibold text-[var(--rf-text-heading)]">
                  Nenhuma nova sugestão restante neste lote
                </p>
                <p className="mt-1 text-xs text-[var(--rf-text-secondary)]">
                  Gere um novo lote ou troque o gênero para descobrir outros
                  títulos fora da sua biblioteca.
                </p>
              </div>
              <button
                type="button"
                onClick={handleNextBatch}
                className={rfButtonClassName({
                  variant: "primary",
                  size: "sm",
                })}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Buscar novo lote
              </button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
