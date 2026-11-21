"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { UNIFIED_GENRE_NAMES } from "@/features/shelves/genres";
import { useRouter } from "next/navigation";
import {
  addBookToLibraryAction,
  lookupBookByIsbnAction,
} from "@/features/catalog/actions";
import type { BookCoverSource, BookFormat } from "@/lib/domain";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";
import { BookSearchAutocomplete } from "@/components/BookSearchAutocomplete";
import { CoverUploader, type CoverSource } from "@/components/CoverUploader";
import { CoverEditionPicker } from "@/components/CoverEditionPicker";
import { resolveBestCover } from "@/features/catalog/search-client";
import type { BookSearchResult } from "@/features/catalog/search-types";

type AutofillField = "title" | "author" | "pages" | "isbn" | "genre";

export function AddBookFormClient({
  initialGenre = "",
  initialTitle = "",
}: {
  initialGenre?: string;
  initialTitle?: string;
}) {
  const router = useRouter();
  const [scannerOpen, setScannerOpen] = useState(false);

  const [isbnQuery, setIsbnQuery] = useState("");
  const [lookupMessage, setLookupMessage] = useState<{
    tone: "ok" | "warn" | "error";
    text: string;
  } | null>(null);

  const [isbn, setIsbn] = useState("");
  const [title, setTitle] = useState(initialTitle);
  const [primaryAuthor, setPrimaryAuthor] = useState("");
  const [translator, setTranslator] = useState("");
  const [narrator, setNarrator] = useState("");
  const [publisher, setPublisher] = useState("");
  const [publishedYear, setPublishedYear] = useState("");
  const [primaryGenre, setPrimaryGenre] = useState(initialGenre);
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState<BookFormat>("paperback");
  const [pages, setPages] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");

  // Capa: "auto" (API/ISBN/Seletor), "upload" (arquivo do usuário) ou "none" (sem capa por enquanto).
  const [autoCoverUrl, setAutoCoverUrl] = useState("");
  const [uploadedCover, setUploadedCover] = useState("");
  const [coverSource, setCoverSource] = useState<CoverSource>("auto");
  const [chosenBookCoverSource, setChosenBookCoverSource] =
    useState<BookCoverSource | null>(null);
  const [userSkippedCover, setUserSkippedCover] = useState(false);
  const [coverResolving, setCoverResolving] = useState(false);
  const coverAbortRef = useRef<AbortController | null>(null);
  const coverUrl =
    coverSource === "upload"
      ? uploadedCover
      : coverSource === "auto"
        ? autoCoverUrl
        : "";

  const [autofill, setAutofill] = useState<{
    fields: ReadonlySet<AutofillField>;
    phase: 0 | 1;
  }>({ fields: new Set(), phase: 0 });
  const [autofillNotice, setAutofillNotice] = useState<string | null>(null);

  const [pricePaid, setPricePaid] = useState("");
  const [store, setStore] = useState("");
  const [notes, setNotes] = useState("");
  const [addToWishlistOnly, setAddToWishlistOnly] = useState(false);
  const [startReadingImmediately, setStartReadingImmediately] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    existingWorkId: string;
    message: string;
  } | null>(null);

  const [isLookingUp, startLookup] = useTransition();
  const [isSaving, startSave] = useTransition();
  const submittingRef = useRef(false);

  const cancelCoverResolution = () => {
    coverAbortRef.current?.abort();
    coverAbortRef.current = null;
    setCoverResolving(false);
  };

  const applyAutoCover = (url: string, providerSource?: BookCoverSource) => {
    cancelCoverResolution();
    setAutoCoverUrl(url);
    setUploadedCover("");
    setCoverSource(url ? "auto" : "none");
    setChosenBookCoverSource(
      url
        ? (providerSource ??
            (url.includes("openlibrary.org") ? "openlibrary" : "google"))
        : null
    );
    setUserSkippedCover(false);
  };

  /** Destaque sutil nos campos preenchidos até o usuário editá-los. */
  const fieldHighlight = (field: AutofillField) =>
    autofill.fields.has(field)
      ? `rf-autofilled rf-autofill-flash-${autofill.phase}`
      : "";

  const clearAutofill = (field: AutofillField) => {
    if (!autofill.fields.has(field)) return;
    const next = new Set(autofill.fields);
    next.delete(field);
    setAutofill({ fields: next, phase: autofill.phase });
  };

  const handleSuggestionSelect = (result: BookSearchResult) => {
    setFormError(null);
    setDuplicateInfo(null);
    setTitle(result.titulo);
    setPrimaryAuthor(result.autor);
    setPages(result.numero_paginas ? String(result.numero_paginas) : "");
    setIsbn(result.isbn);
    setPrimaryGenre(result.genero);
    setAutofill((prev) => ({
      fields: new Set<AutofillField>([
        "title",
        "author",
        "pages",
        "isbn",
        "genre",
      ]),
      phase: prev.phase === 0 ? 1 : 0,
    }));
    setAutofillNotice(
      `Campos preenchidos com “${result.titulo}”. Revise e edite o que for preciso.`
    );

    // Capa em alta resolução: Google (HD) → Open Library → BrasilAPI (ISBN brasileiro).
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
      setAutoCoverUrl(url ?? "");
      if (!url) setCoverSource("none");
    });
  };

  const runIsbnLookup = (rawIsbn: string) => {
    setLookupMessage(null);
    setFormError(null);
    startLookup(async () => {
      try {
        const res = await lookupBookByIsbnAction({ isbn: rawIsbn });
        if (!res.ok) {
          setLookupMessage({ tone: "error", text: res.error });
          return;
        }

        if (res.result.status === "found") {
          const meta = res.result.metadata;
          setIsbn(meta.isbn13);
          setTitle(meta.title);
          setPrimaryAuthor(meta.authors[0] ?? "");
          setPublisher(meta.publisher ?? "");
          setPages(meta.pages ? String(meta.pages) : "");
          setPublishedYear(
            meta.publishedYear ? String(meta.publishedYear) : ""
          );
          setDescription(meta.description ?? "");
          applyAutoCover(meta.coverUrl ?? "");
          setLookupMessage({
            tone: "ok",
            text: `Dados preenchidos automaticamente via ${meta.source.toUpperCase()} (ISBN ${meta.isbn13}). Confira e salve.`,
          });
        } else if (res.result.status === "manual_fallback") {
          setIsbn(res.result.isbn13);
          setLookupMessage({
            tone: "warn",
            text: `ISBN ${res.result.isbn13} válido, mas sem registro nas bases externas. Preencha título e autor manualmente abaixo.`,
          });
        }
      } catch {
        setLookupMessage({
          tone: "error",
          text: "Não foi possível consultar o ISBN agora. Tente novamente ou preencha os campos manualmente.",
        });
      }
    });
  };

  const submitBook = (forceDuplicateCopy = false) => {
    if (submittingRef.current) return;
    setFormError(null);
    setDuplicateInfo(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFormError("Informe o título da obra.");
      return;
    }
    if (cleanTitle.length > 300) {
      setFormError("O título da obra pode ter no máximo 300 caracteres.");
      return;
    }

    const cleanAuthor = primaryAuthor.trim();
    if (!cleanAuthor) {
      setFormError("Informe o(a) autor(a) principal.");
      return;
    }
    if (cleanAuthor.length > 200) {
      setFormError("O nome do autor pode ter no máximo 200 caracteres.");
      return;
    }

    const trimmedPages = pages.trim();
    let validPages: number | undefined;
    if (trimmedPages) {
      if (!/^\d+$/.test(trimmedPages)) {
        setFormError(
          "O número de páginas deve ser um número inteiro positivo (sem casas decimais)."
        );
        return;
      }
      const parsedPages = Number.parseInt(trimmedPages, 10);
      if (parsedPages <= 0 || parsedPages > 20000) {
        setFormError(
          "O número de páginas deve ser um número inteiro entre 1 e 20.000."
        );
        return;
      }
      validPages = parsedPages;
    }

    const trimmedDuration = durationMinutes.trim();
    let validDuration: number | undefined;
    if (trimmedDuration) {
      if (!/^\d+$/.test(trimmedDuration)) {
        setFormError(
          "A duração em minutos deve ser um número inteiro positivo (sem casas decimais)."
        );
        return;
      }
      const parsedDuration = Number.parseInt(trimmedDuration, 10);
      if (parsedDuration <= 0 || parsedDuration > 60000) {
        setFormError(
          "A duração em minutos deve ser um número inteiro positivo (máximo 60.000 min)."
        );
        return;
      }
      validDuration = parsedDuration;
    }

    const trimmedYear = publishedYear.trim();
    let validYear: number | undefined;
    if (trimmedYear) {
      if (!/^\d{4}$/.test(trimmedYear)) {
        setFormError(
          "O ano de publicação deve ser um ano válido com 4 dígitos entre 1000 e 2100."
        );
        return;
      }
      const parsedYear = Number.parseInt(trimmedYear, 10);
      if (parsedYear < 1000 || parsedYear > 2100) {
        setFormError(
          "O ano de publicação deve ser um ano válido entre 1000 e 2100."
        );
        return;
      }
      validYear = parsedYear;
    }

    const trimmedPrice = pricePaid.trim();
    let validPrice: number | undefined;
    if (trimmedPrice) {
      if (!/^\d+(?:[.,]\d{1,2})?$/.test(trimmedPrice)) {
        setFormError(
          "Informe um valor monetário válido (ex.: 49,90), entre R$ 0,00 e R$ 100.000,00."
        );
        return;
      }
      const parsedPrice = Number.parseFloat(trimmedPrice.replace(",", "."));
      if (
        !Number.isFinite(parsedPrice) ||
        parsedPrice < 0 ||
        parsedPrice > 100000
      ) {
        setFormError(
          "O valor monetário deve estar entre R$ 0,00 e R$ 100.000,00."
        );
        return;
      }
      validPrice = parsedPrice;
    }

    submittingRef.current = true;
    startSave(async () => {
      try {
        const res = await addBookToLibraryAction({
          isbn: isbn || undefined,
          title: cleanTitle,
          primaryAuthor: cleanAuthor,
          translator: translator || undefined,
          narrator: narrator || undefined,
          publisher: publisher || undefined,
          publishedYear: validYear,
          primaryGenre: primaryGenre || undefined,
          description: description || undefined,
          language: "pt-BR",
          format,
          pages: validPages,
          durationMinutes: validDuration,
          coverUrl: coverUrl || undefined,
          coverSource: coverUrl
            ? coverSource === "upload"
              ? "upload"
              : (chosenBookCoverSource ??
                (coverUrl.includes("openlibrary.org")
                  ? "openlibrary"
                  : "google"))
            : userSkippedCover
              ? null
              : undefined,
          skipAutoCover: userSkippedCover,
          pricePaid: addToWishlistOnly ? undefined : validPrice,
          targetPrice: addToWishlistOnly ? validPrice : undefined,
          store: store || undefined,
          notes: notes || undefined,
          addToWishlistOnly,
          startReadingImmediately,
          forceDuplicateCopy,
        });

        if (!res.ok) {
          if (res.duplicateWarning) {
            setDuplicateInfo({
              existingWorkId: res.duplicateWarning.existingWorkId,
              message: res.error,
            });
          } else {
            setFormError(res.error);
          }
          return;
        }

        if (addToWishlistOnly) {
          router.push("/desejos");
        } else {
          router.push(`/livros/${res.workId}`);
        }
        router.refresh();
      } catch {
        setFormError(
          "Não foi possível salvar o livro agora. Seus dados foram preservados; tente novamente."
        );
      } finally {
        submittingRef.current = false;
      }
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="editorial-kicker">Módulo A · Catalogação rápida</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-[var(--text-heading)]">
          Adicionar Livro ao Acervo
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Busque pelo ISBN-10/13, escaneie o código de barras com a câmera ou
          cadastre manualmente edições sem ISBN.
        </p>
      </header>

      {/* Bloco 1: Busca por título/autor com autocomplete (Google Books, fallback Open Library) */}
      <section
        aria-labelledby="title-search-heading"
        className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5"
      >
        <h2
          id="title-search-heading"
          className="font-serif text-lg font-semibold text-[var(--text-heading)]"
        >
          1. Buscar livro por título ou autor
        </h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Escolha uma sugestão para preencher título, autor, páginas, ISBN,
          gênero e capa. Tudo continua editável.
        </p>
        <div className="mt-3">
          <BookSearchAutocomplete onSelect={handleSuggestionSelect} />
        </div>
        {autofillNotice ? (
          <p
            role="status"
            className="mt-3 rounded-[8px] border border-[var(--status-ok)] bg-[var(--status-ok-bg)] p-3 text-xs font-medium text-[var(--status-ok)]"
          >
            {autofillNotice}
          </p>
        ) : null}
      </section>

      {/* Bloco 2: Consulta automática por ISBN ou Câmera */}
      <section
        aria-labelledby="isbn-lookup-heading"
        className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5"
      >
        <h2
          id="isbn-lookup-heading"
          className="font-serif text-lg font-semibold text-[var(--text-heading)]"
        >
          2. Preenchimento rápido por ISBN (opcional)
        </h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isbnQuery.trim()) runIsbnLookup(isbnQuery.trim());
          }}
          className="mt-3 flex flex-wrap gap-2.5"
        >
          <label htmlFor="isbn-search-input" className="sr-only">
            Digite o ISBN-10 ou ISBN-13
          </label>
          <input
            id="isbn-search-input"
            type="text"
            inputMode="numeric"
            value={isbnQuery}
            onChange={(e) => setIsbnQuery(e.target.value)}
            placeholder="Ex.: 9788563560278 ou 978-65-5921-088-6"
            className="min-h-[44px] min-w-[220px] flex-1 rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3.5 text-sm text-[var(--text-primary)]"
          />
          <button
            type="submit"
            disabled={isLookingUp}
            className="min-h-[44px] rounded-[8px] bg-[var(--accent-primary)] px-4 text-sm font-semibold text-[var(--on-primary)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-60"
          >
            {isLookingUp ? "Consultando..." : "Buscar ISBN"}
          </button>
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="min-h-[44px] rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-4 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
          >
            Ler código pela câmera
          </button>
        </form>

        {lookupMessage ? (
          <div
            role={lookupMessage.tone === "error" ? "alert" : "status"}
            className={`mt-3 rounded-[8px] border p-3 text-xs font-medium ${
              lookupMessage.tone === "ok"
                ? "border-[var(--status-ok)] bg-[var(--status-ok-bg)] text-[var(--status-ok)]"
                : lookupMessage.tone === "warn"
                  ? "border-[var(--status-warn)] bg-[var(--status-warn-bg)] text-[var(--status-warn)]"
                  : "border-[var(--status-error)] bg-[var(--status-error-bg)] text-[var(--status-error)]"
            }`}
          >
            {lookupMessage.text}
          </div>
        ) : null}
      </section>

      {/* Alerta de duplicidade com opção explícita de outro exemplar */}
      {duplicateInfo ? (
        <div
          role="alert"
          className="rounded-[12px] border border-[var(--status-warn)] bg-[var(--status-warn-bg)] p-4 text-sm text-[var(--status-warn)]"
        >
          <p className="font-semibold">{duplicateInfo.message}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => submitBook(true)}
              className="min-h-[42px] rounded-[8px] bg-[var(--accent-primary)] px-4 text-xs font-semibold text-[var(--on-primary)]"
            >
              Confirmar: é outro exemplar
            </button>
            <Link
              href={`/livros/${duplicateInfo.existingWorkId}`}
              className="inline-flex min-h-[42px] items-center rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-4 text-xs font-semibold text-[var(--text-primary)]"
            >
              Abrir livro existente
            </Link>
          </div>
        </div>
      ) : null}

      {formError ? (
        <div
          role="alert"
          className="rounded-[8px] border border-[var(--status-error)] bg-[var(--status-error-bg)] p-3.5 text-sm font-medium text-[var(--status-error)]"
        >
          {formError}
        </div>
      ) : null}

      {/* Bloco 3: Dados da Obra, Edição e Exemplar */}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submitBook(false);
        }}
        className="space-y-6 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-6"
      >
        <div className="flex flex-col items-stretch gap-5 sm:flex-row sm:items-start">
          <CoverUploader
            title={title || "Novo Livro"}
            author={primaryAuthor || "Autor"}
            coverUrl={coverUrl}
            source={coverSource}
            canRestoreAuto={Boolean(autoCoverUrl)}
            isResolving={coverResolving}
            onUploadStart={cancelCoverResolution}
            onUpload={(dataUrl) => {
              setUploadedCover(dataUrl);
              setCoverSource("upload");
              setChosenBookCoverSource("upload");
              setUserSkippedCover(false);
            }}
            onRestoreAuto={() => {
              setCoverSource("auto");
              setUserSkippedCover(false);
            }}
            onRemove={() => {
              cancelCoverResolution();
              setCoverSource("none");
              setChosenBookCoverSource(null);
              setUserSkippedCover(true);
            }}
          />
          <div className="flex-1 space-y-3">
            <div>
              <label
                htmlFor="book-title"
                className="block text-sm font-semibold text-[var(--text-primary)]"
              >
                Título da obra *
              </label>
              <input
                id="book-title"
                type="text"
                required
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  clearAutofill("title");
                }}
                placeholder="Ex.: Memórias Póstumas de Brás Cubas"
                className={`mt-1 min-h-[44px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3.5 text-sm text-[var(--text-primary)] ${fieldHighlight("title")}`}
              />
            </div>

            <div>
              <label
                htmlFor="book-author"
                className="block text-sm font-semibold text-[var(--text-primary)]"
              >
                Autor(a) principal *
              </label>
              <input
                id="book-author"
                type="text"
                required
                value={primaryAuthor}
                onChange={(e) => {
                  setPrimaryAuthor(e.target.value);
                  clearAutofill("author");
                }}
                placeholder="Ex.: Machado de Assis"
                className={`mt-1 min-h-[44px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3.5 text-sm text-[var(--text-primary)] ${fieldHighlight("author")}`}
              />
            </div>
          </div>
        </div>

        {/* Seletor de edição com até 8 capas candidatas (Google Books + Open Library) */}
        <CoverEditionPicker
          title={title}
          author={primaryAuthor}
          isbn={isbn}
          selectedCoverUrl={coverUrl || null}
          selectedCoverSource={
            coverUrl
              ? coverSource === "upload"
                ? "upload"
                : chosenBookCoverSource
              : null
          }
          onApply={({
            coverUrl: nextUrl,
            coverSource: nextSource,
            pageCount,
          }) => {
            cancelCoverResolution();
            if (pageCount && pageCount > 0 && !pages.trim()) {
              setPages(String(pageCount));
            }
            if (!nextUrl) {
              setCoverSource("none");
              setChosenBookCoverSource(null);
              setUserSkippedCover(true);
              return;
            }
            if (nextSource === "upload") {
              setUploadedCover(nextUrl);
              setCoverSource("upload");
              setChosenBookCoverSource("upload");
              setUserSkippedCover(false);
              return;
            }
            setAutoCoverUrl(nextUrl);
            setUploadedCover("");
            setCoverSource("auto");
            setChosenBookCoverSource(nextSource ?? "google");
            setUserSkippedCover(false);
          }}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label
              htmlFor="book-format"
              className="block text-xs font-semibold text-[var(--text-primary)]"
            >
              Formato da edição *
            </label>
            <select
              id="book-format"
              value={format}
              onChange={(e) => setFormat(e.target.value as BookFormat)}
              className="mt-1 min-h-[44px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
            >
              <option value="paperback">Brochura (Estante Física)</option>
              <option value="hardcover">Capa dura (Estante Física)</option>
              <option value="pocket">Bolso (Estante Física)</option>
              <option value="ebook">E-book (Estante Digital)</option>
              <option value="audiobook">Audiobook (Estante Áudio)</option>
              <option value="box">Box (Estante Física)</option>
            </select>
          </div>

          {format === "audiobook" ? (
            <div>
              <label
                htmlFor="book-duration"
                className="block text-xs font-semibold text-[var(--text-primary)]"
              >
                Duração total (minutos)
              </label>
              <input
                id="book-duration"
                type="number"
                min={1}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="Ex.: 360"
                className="mt-1 min-h-[44px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
              />
            </div>
          ) : (
            <div>
              <label
                htmlFor="book-pages"
                className="block text-xs font-semibold text-[var(--text-primary)]"
              >
                Número de páginas
              </label>
              <input
                id="book-pages"
                type="number"
                min={1}
                value={pages}
                onChange={(e) => {
                  setPages(e.target.value);
                  clearAutofill("pages");
                }}
                placeholder="Ex.: 320"
                className={`mt-1 min-h-[44px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] ${fieldHighlight("pages")}`}
              />
            </div>
          )}

          <div>
            <label
              htmlFor="book-isbn-field"
              className="block text-xs font-semibold text-[var(--text-primary)]"
            >
              ISBN (opcional para livros antigos)
            </label>
            <input
              id="book-isbn-field"
              type="text"
              value={isbn}
              onChange={(e) => {
                setIsbn(e.target.value);
                clearAutofill("isbn");
              }}
              placeholder="Sem ISBN / sebo"
              className={`mt-1 min-h-[44px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] ${fieldHighlight("isbn")}`}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label
              htmlFor="book-publisher"
              className="block text-xs font-semibold text-[var(--text-primary)]"
            >
              Editora
            </label>
            <input
              id="book-publisher"
              type="text"
              value={publisher}
              onChange={(e) => setPublisher(e.target.value)}
              className="mt-1 min-h-[42px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label
              htmlFor="book-genre"
              className="block text-xs font-semibold text-[var(--text-primary)]"
            >
              Gênero principal
            </label>
            <input
              id="book-genre"
              type="text"
              list="readingflow-unified-genres"
              value={primaryGenre}
              onChange={(e) => {
                setPrimaryGenre(e.target.value);
                clearAutofill("genre");
              }}
              placeholder="Ex.: Literatura Brasileira"
              className={`mt-1 min-h-[42px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] ${fieldHighlight("genre")}`}
            />
            <datalist id="readingflow-unified-genres">
              {UNIFIED_GENRE_NAMES.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>

          <div>
            <label
              htmlFor="book-contributor-extra"
              className="block text-xs font-semibold text-[var(--text-primary)]"
            >
              {format === "audiobook" ? "Narrador(a)" : "Tradutor(a)"}
            </label>
            <input
              id="book-contributor-extra"
              type="text"
              value={format === "audiobook" ? narrator : translator}
              onChange={(e) =>
                format === "audiobook"
                  ? setNarrator(e.target.value)
                  : setTranslator(e.target.value)
              }
              className="mt-1 min-h-[42px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="book-price"
              className="block text-xs font-semibold text-[var(--text-primary)]"
            >
              {addToWishlistOnly ? "Preço-alvo estimado" : "Preço pago"}
            </label>
            <input
              id="book-price"
              type="text"
              inputMode="decimal"
              value={pricePaid}
              onChange={(e) => setPricePaid(e.target.value)}
              placeholder="Ex.: 49,90"
              className="mt-1 min-h-[42px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label
              htmlFor="book-store"
              className="block text-xs font-semibold text-[var(--text-primary)]"
            >
              Livraria / Origem
            </label>
            <input
              id="book-store"
              type="text"
              value={store}
              onChange={(e) => setStore(e.target.value)}
              placeholder="Ex.: Livraria da Travessa, Sebo..."
              className="mt-1 min-h-[42px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="book-notes"
            className="block text-xs font-semibold text-[var(--text-primary)]"
          >
            Notas privadas do exemplar
          </label>
          <textarea
            id="book-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Dedicatória, conservação, observações..."
            className="prose-reading mt-1 w-full max-w-none rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] p-3"
          />
        </div>

        <div className="space-y-2 border-t border-[var(--border-subtle)] pt-4 text-sm">
          <label className="flex min-h-[36px] cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={addToWishlistOnly}
              onChange={(e) => {
                setAddToWishlistOnly(e.target.checked);
                if (e.target.checked) setStartReadingImmediately(false);
              }}
              className="h-4 w-4 accent-[var(--accent-primary)]"
            />
            <span>
              Ainda não comprei — salvar apenas na{" "}
              <strong>Lista de Desejos</strong>
            </span>
          </label>

          {!addToWishlistOnly ? (
            <label className="flex min-h-[36px] cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={startReadingImmediately}
                onChange={(e) => setStartReadingImmediately(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent-primary)]"
              />
              <span>Iniciar leitura deste livro imediatamente</span>
            </label>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-3 pt-2">
          <Link
            href="/estantes"
            className="inline-flex min-h-[46px] items-center rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-5 text-sm font-semibold text-[var(--text-primary)]"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isSaving}
            className="min-h-[46px] rounded-[8px] bg-[var(--accent-primary)] px-6 text-sm font-semibold text-[var(--on-primary)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-60"
          >
            {isSaving
              ? "Salvando..."
              : addToWishlistOnly
                ? "Salvar nos Desejos"
                : "Salvar na Estante"}
          </button>
        </div>
      </form>

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(detected) => {
          setIsbnQuery(detected);
          runIsbnLookup(detected);
        }}
      />
    </div>
  );
}
