"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { X, BookPlus } from "lucide-react";
import { addBookToLibraryAction } from "@/features/catalog/actions";
import { resolveBestCover } from "@/features/catalog/search-client";
import type { BookSearchResult } from "@/features/catalog/search-types";
import type { BookFormat } from "@/lib/domain";
import type { VirtualBookItem } from "@/features/shelves/virtual-bookshelf";
import { BookSearchAutocomplete } from "@/components/BookSearchAutocomplete";
import { useFocusTrap } from "@/lib/use-focus-trap";

export interface ArrangeQuickAddModalProps {
  open: boolean;
  targetShelfKey: string;
  targetShelfTitle: string;
  onClose: () => void;
  onBookAdded: (book: VirtualBookItem, targetShelfKey: string) => void;
}

const SPINE_COLOR_CHOICES = [
  { hex: "#141514", label: "Ébano" },
  { hex: "#2D4F3E", label: "Verde Musgo" },
  { hex: "#722F3E", label: "Bordô" },
  { hex: "#A63D2F", label: "Terracota" },
  { hex: "#C8A46E", label: "Camel" },
  { hex: "#2B5B84", label: "Azul Noturno" },
  { hex: "#6D442B", label: "Nogueira" },
  { hex: "#F5F2EB", label: "Pergaminho" },
];

export function ArrangeQuickAddModal({
  open,
  targetShelfKey,
  targetShelfTitle,
  onClose,
  onBookAdded,
}: ArrangeQuickAddModalProps) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [pages, setPages] = useState("240");
  const [isbn, setIsbn] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [format, setFormat] = useState<BookFormat>("paperback");
  const [spineColor, setSpineColor] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const submittingRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useFocusTrap({
    active: open,
    containerRef: dialogRef,
    initialFocusRef: closeBtnRef,
    onEscape: onClose,
    lockScroll: true,
  });

  if (!open) return null;

  const handleAutocompleteSelect = async (result: BookSearchResult) => {
    setTitle(result.titulo);
    setAuthor(result.autor);
    if (result.numero_paginas && result.numero_paginas > 0) {
      setPages(String(result.numero_paginas));
    }
    if (result.isbn) setIsbn(result.isbn);
    const immediateCover = result.capas[0] ?? result.miniatura ?? "";
    setCoverUrl(immediateCover);
    setErrorMsg(null);

    try {
      const resolved = await resolveBestCover(result);
      if (resolved) setCoverUrl(resolved);
    } catch {
      // fallback already set
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setErrorMsg(null);

    const cleanTitle = title.trim();
    const cleanAuthor = author.trim();
    if (!cleanTitle || !cleanAuthor) {
      setErrorMsg("Informe pelo menos título e autor principal.");
      return;
    }

    const trimmedPages = pages.trim();
    let validPages: number | undefined;
    if (trimmedPages) {
      if (!/^\d+$/.test(trimmedPages)) {
        setErrorMsg("O número de páginas deve ser um inteiro positivo.");
        return;
      }
      const parsedPages = Number.parseInt(trimmedPages, 10);
      if (parsedPages < 1 || parsedPages > 20000) {
        setErrorMsg("O número de páginas deve estar entre 1 e 20.000.");
        return;
      }
      validPages = parsedPages;
    }

    submittingRef.current = true;
    startTransition(async () => {
      try {
        const res = await addBookToLibraryAction({
          title: cleanTitle,
          primaryAuthor: cleanAuthor,
          isbn: isbn.trim() || undefined,
          primaryGenre: targetShelfTitle,
          format,
          pages: validPages,
          coverUrl: coverUrl.trim() || undefined,
          ownershipStatus: "owned",
        });

        if (!res.ok) {
          setErrorMsg(res.error);
          return;
        }

        const createdBook: VirtualBookItem = {
          id: res.itemId ?? res.editionId,
          workId: res.workId,
          editionId: res.editionId,
          libraryItemId: res.itemId,
          title: cleanTitle,
          author: cleanAuthor,
          genre: targetShelfTitle,
          pages: res.pages ?? validPages ?? 240,
          format,
          coverUrl: res.coverUrl ?? (coverUrl.trim() || null),
          spineColor: spineColor || res.coverColor || undefined,
          spineAccent: res.coverAccentColor || undefined,
          status: "Não iniciado",
          readingStatus: "not_started",
          progressPercent: 0,
          href: `/livros/${res.workId}`,
          shelfKind:
            format === "ebook"
              ? "digital"
              : format === "audiobook"
                ? "audio"
                : "physical",
        };

        onBookAdded(createdBook, targetShelfKey);
        setTitle("");
        setAuthor("");
        setPages("240");
        setIsbn("");
        setCoverUrl("");
        setSpineColor("");
        onClose();
      } catch {
        setErrorMsg(
          "Não foi possível adicionar o livro agora. Tente novamente."
        );
      } finally {
        submittingRef.current = false;
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--rf-onyx)]/55 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="arrange-quick-add-title"
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-[var(--rf-onyx)]/15 bg-[var(--rf-linen)] p-5 text-[var(--rf-onyx)] shadow-2xl sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--rf-onyx)]/10 pb-3">
          <div>
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--rf-coffee)]">
              Adição rápida na prateleira
            </p>
            <h2
              id="arrange-quick-add-title"
              className="mt-0.5 font-serif text-xl font-semibold text-[var(--rf-onyx)]"
            >
              Adicionar em “{targetShelfTitle}”
            </h2>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de adição rápida"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--rf-fawn)]/40 text-[var(--rf-onyx)] transition hover:bg-[var(--rf-fawn)]/60"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4">
          <p className="mb-1.5 font-sans text-xs font-semibold text-[var(--rf-coffee)]">
            Buscar na base online (Google Books / Open Library)
          </p>
          <BookSearchAutocomplete
            onSelect={(res) => {
              void handleAutocompleteSelect(res);
            }}
            disabled={isPending}
          />
        </div>

        <form noValidate onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label
              htmlFor="quick-add-title"
              className="block font-sans text-xs font-semibold text-[var(--rf-onyx)]"
            >
              Título *
            </label>
            <input
              id="quick-add-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Memórias Póstumas de Brás Cubas"
              className="mt-1 w-full rounded-lg border border-[var(--rf-onyx)]/20 bg-[var(--rf-fawn)]/20 px-3 py-2 text-sm text-[var(--rf-onyx)] focus:border-[var(--rf-coffee)] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="quick-add-author"
                className="block font-sans text-xs font-semibold text-[var(--rf-onyx)]"
              >
                Autor principal *
              </label>
              <input
                id="quick-add-author"
                type="text"
                required
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Ex: Machado de Assis"
                className="mt-1 w-full rounded-lg border border-[var(--rf-onyx)]/20 bg-[var(--rf-fawn)]/20 px-3 py-2 text-sm text-[var(--rf-onyx)] focus:border-[var(--rf-coffee)] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="quick-add-pages"
                className="block font-sans text-xs font-semibold text-[var(--rf-onyx)]"
              >
                Páginas (espessura da lombada)
              </label>
              <input
                id="quick-add-pages"
                type="number"
                min={1}
                max={20000}
                value={pages}
                onChange={(e) => setPages(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--rf-onyx)]/20 bg-[var(--rf-fawn)]/20 px-3 py-2 text-sm text-[var(--rf-onyx)] focus:border-[var(--rf-coffee)] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="quick-add-format"
                className="block font-sans text-xs font-semibold text-[var(--rf-onyx)]"
              >
                Formato
              </label>
              <select
                id="quick-add-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as BookFormat)}
                className="mt-1 w-full rounded-lg border border-[var(--rf-onyx)]/20 bg-[var(--rf-fawn)]/20 px-3 py-2 text-sm text-[var(--rf-onyx)] focus:border-[var(--rf-coffee)] focus:outline-none"
              >
                <option value="paperback">Brochura</option>
                <option value="hardcover">Capa dura</option>
                <option value="pocket">Bolso</option>
                <option value="ebook">E-book</option>
                <option value="audiobook">Audiolivro</option>
              </select>
            </div>

            <div>
              <span className="block font-sans text-xs font-semibold text-[var(--rf-onyx)]">
                Cor da lombada (opcional)
              </span>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {SPINE_COLOR_CHOICES.map((c) => {
                  const selected = spineColor === c.hex;
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      title={c.label}
                      aria-label={`Cor da lombada: ${c.label}`}
                      aria-pressed={selected}
                      onClick={() =>
                        setSpineColor((prev) => (prev === c.hex ? "" : c.hex))
                      }
                      style={{ backgroundColor: c.hex }}
                      className={`h-6 w-6 rounded-full border transition ${
                        selected
                          ? "scale-110 border-[var(--rf-coffee)] ring-2 ring-[var(--rf-coffee)]"
                          : "border-black/25 hover:scale-105"
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {errorMsg ? (
            <p
              role="alert"
              className="rounded-lg border border-[var(--status-error)]/30 bg-[var(--status-error)]/10 px-3 py-2 text-xs font-medium text-[var(--status-error)]"
            >
              {errorMsg}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--rf-onyx)]/10 pt-4">
            <Link
              href={`/adicionar?genero=${encodeURIComponent(targetShelfTitle)}`}
              className="font-sans text-xs font-medium text-[var(--rf-coffee)] underline-offset-2 hover:underline"
            >
              Abrir formulário completo →
            </Link>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-[var(--rf-fawn)]/40 px-4 py-2 font-sans text-xs font-semibold text-[var(--rf-onyx)] hover:bg-[var(--rf-fawn)]/60"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--rf-coffee)] px-5 py-2 font-sans text-xs font-semibold text-[var(--rf-linen)] transition hover:bg-[var(--rf-onyx)] disabled:opacity-60"
              >
                <BookPlus className="h-3.5 w-3.5" aria-hidden="true" />
                {isPending ? "Adicionando..." : "Adicionar à prateleira"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
