"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  BookFormat,
  Edition,
  LibraryItem,
  Review,
  Work,
} from "@/lib/domain";
import {
  abandonReadingAction,
  startReadingAction,
  togglePauseReadingAction,
} from "@/features/reading/actions";
import { upsertReviewAction } from "@/features/ratings/actions";
import {
  updateBookMetadataAction,
  updateEditionCoverAction,
} from "@/features/catalog/actions";
import { removeLibraryItemAction } from "@/features/shelves/actions";
import { StarRatingInput } from "@/components/StarRating";
import { BookSearchAutocomplete } from "@/components/BookSearchAutocomplete";
import { CoverUploader, type CoverSource } from "@/components/CoverUploader";
import { CoverEditionPicker } from "@/components/CoverEditionPicker";
import { resolveBestCover } from "@/features/catalog/search-client";
import type { BookSearchResult } from "@/features/catalog/search-types";

export function BookDetailActionsClient({
  work,
  edition,
  firstItem,
  activeReadingId,
  activeReadingStatus,
  hasFinishedBefore,
  existingReview,
}: {
  work: Work;
  edition: Edition;
  firstItem?: LibraryItem;
  activeReadingId?: string;
  activeReadingStatus?: "reading" | "paused";
  hasFinishedBefore: boolean;
  existingReview?: Review;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  // Review state
  const [rating, setRating] = useState<number | undefined>(
    existingReview?.rating
  );
  const [narrationRating, setNarrationRating] = useState<number | undefined>(
    existingReview?.narrationRating
  );
  const [reviewBody, setReviewBody] = useState(existingReview?.body ?? "");

  // Abandon modal state
  const [showAbandon, setShowAbandon] = useState(false);
  const [abandonReason, setAbandonReason] = useState("");
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  // Edit metadata state
  const [editing, setEditing] = useState(false);
  const [changingCover, setChangingCover] = useState(false);
  const [title, setTitle] = useState(work.title);
  const [author, setAuthor] = useState(
    work.contributors.find((c) => c.role === "author")?.name ?? ""
  );
  const [publisher, setPublisher] = useState(edition.publisher ?? "");
  const [isbn, setIsbn] = useState(edition.isbn13 ?? edition.isbn10 ?? "");
  const [genre, setGenre] = useState(work.primaryGenre ?? "");
  const [format, setFormat] = useState<BookFormat>(edition.format);
  const [pages, setPages] = useState(
    edition.pages ? String(edition.pages) : ""
  );
  const [notes, setNotes] = useState(firstItem?.notes ?? "");

  // Edit cover state
  const originalCover = edition.coverUrl ?? "";
  const [autoCoverUrl, setAutoCoverUrl] = useState(originalCover);
  const [uploadedCover, setUploadedCover] = useState("");
  const [coverSource, setCoverSource] = useState<CoverSource>(
    originalCover ? "auto" : "none"
  );
  const [coverResolving, setCoverResolving] = useState(false);
  const coverAbortRef = useRef<AbortController | null>(null);
  const effectiveCoverUrl =
    coverSource === "upload"
      ? uploadedCover
      : coverSource === "auto"
        ? autoCoverUrl
        : "";

  const cancelCoverResolution = () => {
    coverAbortRef.current?.abort();
    coverAbortRef.current = null;
    setCoverResolving(false);
  };

  const handleEditSuggestionSelect = (result: BookSearchResult) => {
    setTitle(result.titulo);
    setAuthor(result.autor);
    if (result.numero_paginas && !pages.trim()) {
      setPages(String(result.numero_paginas));
    }
    if (result.isbn && !isbn.trim()) {
      setIsbn(result.isbn);
    }
    if (result.genero) setGenre(result.genero);
    cancelCoverResolution();
    const controller = new AbortController();
    coverAbortRef.current = controller;
    setUploadedCover("");
    setAutoCoverUrl("");
    setCoverSource("auto");
    setCoverResolving(true);
    void resolveBestCover(result, { signal: controller.signal }).then((url) => {
      if (controller.signal.aborted) return;
      coverAbortRef.current = null;
      setCoverResolving(false);
      setAutoCoverUrl(url ?? originalCover);
      if (!url && !originalCover) setCoverSource("none");
    });
  };

  return (
    <div className="space-y-6">
      {feedback ? (
        <div
          role="status"
          className="rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] p-3 text-xs font-medium text-[var(--text-primary)]"
        >
          {feedback}
        </div>
      ) : null}

      {/* Controles de leitura */}
      <div className="flex flex-wrap gap-2.5">
        {!activeReadingId ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setFeedback(null);
              startTransition(async () => {
                try {
                  const res = await startReadingAction({
                    workId: work.id,
                    editionId: edition.id,
                    libraryItemId: firstItem?.id,
                    format: edition.format,
                  });
                  if (!res.ok) {
                    setFeedback(res.error);
                    return;
                  }
                  setFeedback(
                    hasFinishedBefore
                      ? "Nova releitura iniciada (histórico anterior preservado)."
                      : "Leitura iniciada."
                  );
                  router.refresh();
                } catch {
                  setFeedback(
                    "Não foi possível iniciar a leitura agora. Tente novamente."
                  );
                }
              });
            }}
            className="min-h-[44px] rounded-[8px] bg-[var(--accent-primary)] px-4 text-sm font-semibold text-[var(--on-primary)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-60"
          >
            {hasFinishedBefore ? "Iniciar Releitura" : "Iniciar Leitura"}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setFeedback(null);
                startTransition(async () => {
                  try {
                    const res = await togglePauseReadingAction({
                      readingId: activeReadingId,
                    });
                    if (!res.ok) {
                      setFeedback(res.error);
                      return;
                    }
                    router.refresh();
                  } catch {
                    setFeedback(
                      "Não foi possível atualizar o estado da leitura agora. Tente novamente."
                    );
                  }
                });
              }}
              className="min-h-[44px] rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-4 text-sm font-semibold text-[var(--text-primary)]"
            >
              {activeReadingStatus === "paused"
                ? "Retomar leitura"
                : "Pausar leitura"}
            </button>

            <button
              type="button"
              onClick={() => setShowAbandon((v) => !v)}
              className="min-h-[44px] rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-4 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Registrar abandono
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => {
            setChangingCover((v) => !v);
            setEditing(false);
          }}
          className="min-h-[44px] rounded-[8px] border border-[#722F3E]/40 bg-[#FAF7F1] px-4 text-sm font-semibold text-[#722F3E] transition-colors hover:border-[#722F3E] hover:bg-[#EFE9DD]"
        >
          {changingCover ? "Fechar seletor de capa" : "Trocar capa"}
        </button>

        <button
          type="button"
          onClick={() => {
            setEditing((v) => !v);
            setChangingCover(false);
          }}
          className="min-h-[44px] rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-4 text-sm font-semibold text-[var(--text-primary)]"
        >
          {editing ? "Fechar edição" : "Editar metadados"}
        </button>

        {firstItem ? (
          confirmingRemove ? (
            <div className="inline-flex flex-wrap items-center gap-2 rounded-[8px] border border-[var(--status-error)] bg-[var(--status-error-bg)] px-3 py-1.5">
              <span className="text-xs font-semibold text-[var(--status-error)]">
                Remover da estante? (histórico de leitura preservado)
              </span>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setFeedback(null);
                  startTransition(async () => {
                    try {
                      const res = await removeLibraryItemAction({
                        itemId: firstItem.id,
                      });
                      if (!res.ok) {
                        setFeedback(res.error);
                        setConfirmingRemove(false);
                        return;
                      }
                      router.push("/estantes");
                      router.refresh();
                    } catch {
                      setFeedback(
                        "Não foi possível remover o exemplar agora. Tente novamente."
                      );
                      setConfirmingRemove(false);
                    }
                  });
                }}
                className="min-h-[34px] rounded-[6px] bg-[var(--status-error)] px-3 text-xs font-semibold text-white disabled:opacity-60"
              >
                Confirmar remoção
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setConfirmingRemove(false)}
                className="min-h-[34px] rounded-[6px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-xs font-semibold text-[var(--text-primary)]"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirmingRemove(true)}
              className="min-h-[44px] rounded-[8px] border border-[var(--status-error)] px-4 text-xs font-semibold text-[var(--status-error)] hover:bg-[var(--status-error-bg)]"
            >
              Remover exemplar
            </button>
          )
        ) : null}
      </div>

      {showAbandon && activeReadingId ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const cleanReason = abandonReason.trim();
            if (cleanReason.length > 300) {
              setFeedback(
                "O motivo do abandono não pode ter mais de 300 caracteres."
              );
              return;
            }
            startTransition(async () => {
              try {
                const res = await abandonReadingAction({
                  readingId: activeReadingId,
                  abandonReason: cleanReason || undefined,
                });
                if (res.ok) {
                  setShowAbandon(false);
                  setFeedback("Abandono registrado.");
                  router.refresh();
                } else {
                  setFeedback(res.error);
                }
              } catch {
                setFeedback(
                  "Não foi possível registrar o abandono agora. Tente novamente."
                );
              }
            });
          }}
          className="rounded-[12px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] p-4"
        >
          <label
            htmlFor="abandon-reason"
            className="block text-xs font-semibold text-[var(--text-primary)]"
          >
            Motivo do abandono (opcional — não entra na meta de concluídos)
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              id="abandon-reason"
              type="text"
              maxLength={300}
              value={abandonReason}
              onChange={(e) => setAbandonReason(e.target.value)}
              placeholder="Ex.: Não era o momento certo"
              className="min-h-[42px] flex-1 rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-canvas)] px-3 text-sm"
            />
            <button
              type="submit"
              disabled={isPending}
              className="min-h-[42px] rounded-[8px] bg-[var(--accent-primary)] px-4 text-xs font-semibold text-[var(--on-primary)]"
            >
              Confirmar abandono
            </button>
          </div>
        </form>
      ) : null}

      {changingCover ? (
        <CoverEditionPicker
          title={work.title}
          author={author}
          isbn={edition.isbn13 ?? edition.isbn10}
          seed={edition.isbn13 ?? work.id}
          selectedCoverUrl={edition.coverUrl ?? null}
          selectedCoverSource={edition.coverSource ?? null}
          isCoverLocked={Boolean(edition.coverLocked)}
          onRestoreAutomatic={() => {
            setFeedback(null);
            startTransition(async () => {
              const res = await updateEditionCoverAction({
                editionId: edition.id,
                coverUrl: null,
                coverSource: null,
                sourceAction: "unlock",
              });
              if (!res.ok) {
                setFeedback(res.error);
                return;
              }
              setAutoCoverUrl("");
              setUploadedCover("");
              setCoverSource("none");
              setChangingCover(false);
              setFeedback(
                "Capa destravada para busca automática. Você pode escolher outra capa quando quiser."
              );
              router.refresh();
            });
          }}
          spineColor={edition.coverColor}
          spineAccent={edition.coverAccentColor}
          isSaving={isPending}
          onApply={({
            coverUrl: nextUrl,
            coverSource: nextSource,
            pageCount,
          }) => {
            setFeedback(null);
            startTransition(async () => {
              try {
                const res = await updateEditionCoverAction({
                  editionId: edition.id,
                  coverUrl: nextUrl,
                  coverSource: nextSource,
                  pageCount,
                });
                if (!res.ok) {
                  setFeedback(res.error);
                  return;
                }
                if (pageCount && pageCount > 0 && !pages.trim()) {
                  setPages(String(pageCount));
                }
                setAutoCoverUrl(res.coverUrl ?? "");
                setUploadedCover(
                  res.coverSource === "upload" ? (res.coverUrl ?? "") : ""
                );
                setCoverSource(
                  !res.coverUrl
                    ? "none"
                    : res.coverSource === "upload"
                      ? "upload"
                      : "auto"
                );
                setChangingCover(false);
                setFeedback(
                  res.coverUrl
                    ? "Capa e cores da lombada atualizadas com sucesso em todo o ReadingFlow."
                    : "Capa removida. O fallback editorial foi aplicado."
                );
                router.refresh();
              } catch {
                setFeedback(
                  "Não foi possível salvar a capa agora. Tente novamente."
                );
              }
            });
          }}
        />
      ) : null}

      {editing ? (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setFeedback(null);

            const cleanTitle = title.trim();
            if (!cleanTitle) {
              setFeedback("O título da obra é obrigatório.");
              return;
            }
            if (cleanTitle.length > 300) {
              setFeedback("O título não pode ter mais de 300 caracteres.");
              return;
            }

            const cleanAuthor = author.trim();
            if (!cleanAuthor) {
              setFeedback("O nome do autor(a) é obrigatório.");
              return;
            }
            if (cleanAuthor.length > 200) {
              setFeedback(
                "O nome do autor(a) não pode ter mais de 200 caracteres."
              );
              return;
            }

            let parsedPages: number | undefined;
            const trimmedPages = pages.trim();
            if (trimmedPages !== "") {
              if (!/^\d+$/.test(trimmedPages)) {
                setFeedback(
                  "O número de páginas deve ser um inteiro positivo (sem casas decimais)."
                );
                return;
              }
              const numPages = Number.parseInt(trimmedPages, 10);
              if (numPages < 1 || numPages > 20000) {
                setFeedback(
                  "O número de páginas deve ser um inteiro entre 1 e 20.000."
                );
                return;
              }
              parsedPages = numPages;
            }

            if (publisher.trim().length > 150) {
              setFeedback(
                "O nome da editora não pode ter mais de 150 caracteres."
              );
              return;
            }
            if (genre.trim().length > 80) {
              setFeedback("O gênero não pode ter mais de 80 caracteres.");
              return;
            }
            if (notes.length > 5000) {
              setFeedback("As notas não podem exceder 5.000 caracteres.");
              return;
            }

            startTransition(async () => {
              try {
                const res = await updateBookMetadataAction({
                  workId: work.id,
                  editionId: edition.id,
                  itemId: firstItem?.id,
                  isbn: isbn.trim(),
                  title: cleanTitle,
                  primaryAuthor: cleanAuthor,
                  publisher: publisher.trim() || undefined,
                  primaryGenre: genre.trim() || undefined,
                  format,
                  pages: parsedPages,
                  coverUrl: effectiveCoverUrl,
                  notes: notes.trim() || undefined,
                });
                if (!res.ok) {
                  setFeedback(res.error);
                  return;
                }
                setEditing(false);
                setFeedback("Metadados atualizados no seu acervo privado.");
                router.refresh();
              } catch {
                setFeedback(
                  "Não foi possível salvar os metadados agora. Tente novamente."
                );
              }
            });
          }}
          className="space-y-5 rounded-[12px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] p-5"
        >
          <h3 className="font-serif text-lg font-semibold text-[var(--text-heading)]">
            Editar dados privados da obra e edição
          </h3>

          <BookSearchAutocomplete onSelect={handleEditSuggestionSelect} />

          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <CoverUploader
              title={title || work.title}
              author={author || "Autor"}
              coverUrl={effectiveCoverUrl}
              source={coverSource}
              canRestoreAuto={Boolean(autoCoverUrl)}
              isResolving={coverResolving}
              restoreLabel={
                autoCoverUrl === originalCover && originalCover
                  ? "Restaurar capa original"
                  : "Restaurar capa automática"
              }
              onUploadStart={cancelCoverResolution}
              onUpload={(dataUrl) => {
                setUploadedCover(dataUrl);
                setCoverSource("upload");
              }}
              onRestoreAuto={() => setCoverSource("auto")}
              onRemove={() => {
                cancelCoverResolution();
                setCoverSource("none");
              }}
            />

            <div className="grid flex-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="edit-title"
                  className="block text-xs font-semibold"
                >
                  Título
                </label>
                <input
                  id="edit-title"
                  type="text"
                  required
                  maxLength={300}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 min-h-[42px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-canvas)] px-3 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-author"
                  className="block text-xs font-semibold"
                >
                  Autor(a)
                </label>
                <input
                  id="edit-author"
                  type="text"
                  required
                  maxLength={200}
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="mt-1 min-h-[42px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-canvas)] px-3 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-publisher"
                  className="block text-xs font-semibold"
                >
                  Editora
                </label>
                <input
                  id="edit-publisher"
                  type="text"
                  maxLength={150}
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                  className="mt-1 min-h-[42px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-canvas)] px-3 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-pages"
                  className="block text-xs font-semibold"
                >
                  Páginas
                </label>
                <input
                  id="edit-pages"
                  type="number"
                  min={1}
                  max={20000}
                  value={pages}
                  onChange={(e) => setPages(e.target.value)}
                  className="mt-1 min-h-[42px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-canvas)] px-3 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-format"
                  className="block text-xs font-semibold"
                >
                  Formato
                </label>
                <select
                  id="edit-format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value as BookFormat)}
                  className="mt-1 min-h-[42px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-canvas)] px-3 text-sm"
                >
                  <option value="paperback">Brochura</option>
                  <option value="hardcover">Capa dura</option>
                  <option value="pocket">Bolso</option>
                  <option value="ebook">E-book</option>
                  <option value="audiobook">Audiobook</option>
                  <option value="box">Box</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="edit-genre"
                  className="block text-xs font-semibold"
                >
                  Gênero
                </label>
                <input
                  id="edit-genre"
                  type="text"
                  maxLength={80}
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="mt-1 min-h-[42px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-canvas)] px-3 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="edit-isbn"
                  className="block text-xs font-semibold"
                >
                  ISBN (opcional)
                </label>
                <input
                  id="edit-isbn"
                  type="text"
                  inputMode="numeric"
                  maxLength={24}
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  placeholder="Ex.: 9788535931983 (ou deixe vazio se sem ISBN)"
                  className="mt-1 min-h-[42px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-canvas)] px-3 text-sm"
                />
              </div>
            </div>
          </div>
          <div>
            <label htmlFor="edit-notes" className="block text-xs font-semibold">
              Notas privadas do exemplar
            </label>
            <textarea
              id="edit-notes"
              rows={3}
              maxLength={5000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="prose-reading mt-1 w-full max-w-none rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-canvas)] p-3"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="min-h-[42px] rounded-[8px] bg-[var(--accent-primary)] px-5 text-xs font-semibold text-[var(--on-primary)]"
          >
            Salvar alterações
          </button>
        </form>
      ) : null}

      {/* Avaliação em meia estrela + Narração (Módulo E) */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setFeedback(null);
          if (!rating || rating < 0.5 || rating > 5.0) {
            setFeedback("Selecione uma nota de 0,5 a 5,0 estrelas.");
            return;
          }
          if (
            narrationRating !== undefined &&
            (narrationRating < 0.5 || narrationRating > 5.0)
          ) {
            setFeedback(
              "A nota da narração deve ser entre 0,5 e 5,0 estrelas."
            );
            return;
          }
          if (reviewBody.length > 10000) {
            setFeedback("A resenha não pode ter mais de 10.000 caracteres.");
            return;
          }
          startTransition(async () => {
            try {
              const res = await upsertReviewAction({
                workId: work.id,
                rating,
                narrationRating,
                body: reviewBody.trim() || undefined,
              });
              if (!res.ok) {
                setFeedback(res.error);
                return;
              }
              setFeedback("Avaliação salva no ranking pessoal.");
              router.refresh();
            } catch {
              setFeedback(
                "Não foi possível salvar a avaliação agora. Tente novamente."
              );
            }
          });
        }}
        className="space-y-4 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5"
      >
        <h3 className="font-serif text-lg font-semibold text-[var(--text-heading)]">
          Sua Avaliação Privada
        </h3>

        <StarRatingInput
          id="work-rating"
          label="Nota da obra (meia estrela)"
          value={rating}
          onChange={setRating}
        />

        {edition.format === "audiobook" ? (
          <StarRatingInput
            id="narration-rating"
            label="Nota da narração (audiobook)"
            value={narrationRating}
            onChange={setNarrationRating}
            allowClear
          />
        ) : null}

        {existingReview?.body ? (
          <blockquote className="prose-reading rounded-[8px] border-l-2 border-[var(--accent-brass-decorative)] bg-[var(--bg-elevated)] px-4 py-3">
            {existingReview.body}
          </blockquote>
        ) : null}

        <div>
          <label
            htmlFor="review-body"
            className="block text-xs font-semibold text-[var(--text-primary)]"
          >
            Resenha e impressões privadas (opcional)
          </label>
          <textarea
            id="review-body"
            rows={4}
            value={reviewBody}
            onChange={(e) => setReviewBody(e.target.value)}
            placeholder="Suas impressões pessoais, notas e citações sobre a leitura..."
            className="prose-reading mt-1 w-full max-w-none rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] p-3.5"
          />
        </div>

        <button
          type="submit"
          disabled={isPending || !rating}
          className="min-h-[42px] rounded-[8px] bg-[var(--accent-primary)] px-5 text-xs font-semibold text-[var(--on-primary)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-60"
        >
          Salvar avaliação
        </button>
      </form>
    </div>
  );
}
