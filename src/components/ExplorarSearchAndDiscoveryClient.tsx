"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookMarked, Search, X } from "lucide-react";
import { normalizeSearchText } from "@/features/catalog/rules";
import { BookCover } from "@/components/BookCover";
import { rfButtonClassName } from "@/components/ui/ActionControls";

export interface ExplorarSearchItem {
  id: string;
  workId: string;
  title: string;
  author: string;
  searchAuthors: string;
  isbn13?: string;
  isbn10?: string;
  canonicalGenre: string;
  statusLabel: string;
  coverUrl?: string;
  spineColor?: string;
  spineAccent?: string;
  seed: string;
  href: string;
  isWishlist: boolean;
}

export function ExplorarSearchAndDiscoveryClient({
  items,
}: {
  items: readonly ExplorarSearchItem[];
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("buscar") === "1") {
      inputRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isCtrlK =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      if (isCtrlK) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }

      const target = event.target as HTMLElement | null;
      const isEditingText =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if (isEditingText) return;

      if (event.key === "/") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const indexedItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        normTitle: normalizeSearchText(item.title),
        normAuthors: normalizeSearchText(
          `${item.author} ${item.searchAuthors}`
        ),
        cleanIsbn: `${item.isbn13 ?? ""} ${item.isbn10 ?? ""}`
          .replace(/[^0-9xX]/g, "")
          .toLowerCase(),
      })),
    [items]
  );

  const trimmedQuery = query.trim();
  const results = useMemo(() => {
    if (!trimmedQuery) return [];
    const normQ = normalizeSearchText(trimmedQuery);
    const cleanIsbnQ = trimmedQuery.replace(/[^0-9xX]/g, "").toLowerCase();

    return indexedItems.filter((item) => {
      if (normQ && item.normTitle.includes(normQ)) return true;
      if (normQ && item.normAuthors.includes(normQ)) return true;
      if (cleanIsbnQ.length >= 3 && item.cleanIsbn.includes(cleanIsbnQ)) {
        return true;
      }
      return false;
    });
  }, [indexedItems, trimmedQuery]);

  return (
    <section
      aria-label="Busca global no acervo"
      className="rounded-[var(--rf-card-radius)] border border-[var(--rf-border-accent-soft)] bg-[var(--rf-surface-contrast)] p-5 text-[var(--rf-text-on-contrast)] shadow-[var(--rf-shadow-spotlight)] sm:p-6"
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label
            htmlFor={inputId}
            className="rf-type-label text-[var(--rf-text-on-contrast-muted)]"
          >
            Busca Global no Acervo
          </label>
          <span className="font-sans text-xs tabular-nums text-[var(--rf-text-on-contrast)] opacity-85">
            {items.length}{" "}
            {items.length === 1 ? "obra indexada" : "obras indexadas"}
          </span>
        </div>

        <div className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-4 h-5 w-5 text-[var(--rf-text-secondary)]"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            id={inputId}
            data-rf-global-search-input="true"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar instantaneamente por Título, Autor ou ISBN..."
            aria-label="Buscar no acervo por título, autor ou ISBN"
            className="min-h-[50px] w-full rounded-[var(--rf-radius-md)] border border-[var(--rf-border-strong)] bg-[var(--rf-surface-card-solid)] pl-12 pr-20 font-sans text-sm font-medium text-[var(--rf-text-primary)] placeholder:text-[var(--rf-text-secondary)] shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
          />
          {trimmedQuery.length > 0 ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpar busca"
              className="absolute right-3 inline-flex h-8 w-8 items-center justify-center rounded-[var(--rf-radius-full)] text-[var(--rf-text-primary)] transition-colors hover:bg-[var(--rf-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <kbd
              aria-hidden="true"
              className="pointer-events-none absolute right-3.5 hidden rounded-[var(--rf-radius-sm)] border border-[var(--rf-border-default)] bg-[var(--rf-surface-subtle)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--rf-text-primary)] sm:inline-block"
            >
              /
            </kbd>
          )}
        </div>
      </div>

      {trimmedQuery.length > 0 ? (
        <div
          aria-live="polite"
          className="mt-5 border-t border-[var(--rf-border-accent-soft)] pt-4"
        >
          <p className="mb-3 font-sans text-xs font-semibold text-[var(--rf-text-on-contrast-muted)]">
            {results.length}{" "}
            {results.length === 1
              ? "resultado encontrado"
              : "resultados encontrados"}{" "}
            para &ldquo;{trimmedQuery}&rdquo;
          </p>

          {results.length === 0 ? (
            <div className="flex flex-col items-start justify-between gap-3 rounded-[var(--rf-radius-lg)] border border-[var(--rf-border-accent-soft)] bg-[var(--rf-surface-contrast-elevated)] p-4 sm:flex-row sm:items-center">
              <p className="font-sans text-sm text-[var(--rf-text-on-contrast)] opacity-90">
                Nenhuma obra no seu acervo ou lista de desejos corresponde a
                esta busca.
              </p>
              <Link
                href={`/adicionar?q=${encodeURIComponent(trimmedQuery)}`}
                className={rfButtonClassName({
                  variant: "primary",
                  size: "md",
                  pill: true,
                })}
              >
                Cadastrar livro
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {results.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="group flex items-center gap-3.5 rounded-[var(--rf-radius-lg)] border border-[var(--rf-border-accent-soft)] bg-[var(--rf-surface-contrast-elevated)] p-3 transition-all hover:border-[var(--rf-border-accent)] hover:bg-[var(--rf-surface-contrast-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
                  >
                    <BookCover
                      size="sm"
                      title={item.title}
                      author={item.author}
                      coverUrl={item.coverUrl}
                      spineColor={item.spineColor}
                      spineAccent={item.spineAccent}
                      seed={item.seed}
                      isWishlist={item.isWishlist}
                      className="shrink-0"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-[var(--rf-radius-full)] border border-[var(--rf-border-accent-soft)] bg-[var(--rf-surface-contrast)] px-2 py-0.5 font-sans text-[10px] font-semibold text-[var(--rf-text-on-contrast-muted)]">
                          {item.canonicalGenre}
                        </span>
                        <span className="rounded-[var(--rf-radius-full)] bg-[var(--rf-status-success-bg)] px-2 py-0.5 font-sans text-[10px] font-semibold text-[var(--rf-status-success)]">
                          {item.statusLabel}
                        </span>
                      </div>
                      <h3 className="truncate font-serif text-base font-semibold text-[var(--rf-text-on-contrast)] group-hover:text-[var(--rf-text-on-contrast-muted)]">
                        {item.title}
                      </h3>
                      <p className="truncate font-sans text-xs text-[var(--rf-text-on-contrast)] opacity-80">
                        {item.author}
                        {item.isbn13 ? ` · ISBN ${item.isbn13}` : ""}
                      </p>
                    </div>
                    <BookMarked
                      className="h-4 w-4 shrink-0 text-[var(--rf-text-on-contrast-muted)] opacity-75 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
