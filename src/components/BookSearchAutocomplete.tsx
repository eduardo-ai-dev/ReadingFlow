"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Loader2, Search } from "lucide-react";
import { deriveTypographicCover } from "@/features/catalog/rules";
import {
  BOOK_SEARCH_MIN_CHARS,
  normalizeSearchQuery,
  type BookSearchResult,
} from "@/features/catalog/search-types";
import { useBookSearch } from "@/lib/useBookSearch";

const EMPTY_MESSAGE =
  "Nenhum livro encontrado na base online. Preencha os dados manualmente abaixo.";
const ERROR_MESSAGE =
  "Não foi possível consultar a base online agora. Preencha os dados manualmente abaixo ou tente novamente.";

function SuggestionThumb({ title, src }: { title: string; src: string | null }) {
  const [failed, setFailed] = useState(false);
  const typo = deriveTypographicCover(title);

  return (
    <span className="relative block h-[60px] w-10 shrink-0 overflow-hidden rounded-[4px] border border-[var(--border-subtle)]">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          style={{ backgroundColor: typo.backgroundColor, color: typo.textColor }}
          className="flex h-full w-full items-center justify-center font-sans text-[11px] font-bold tracking-[0.1em] uppercase"
        >
          {typo.monogram}
        </span>
      )}
    </span>
  );
}

export function BookSearchAutocomplete({
  onSelect,
  disabled = false,
}: {
  onSelect: (result: BookSearchResult) => void;
  disabled?: boolean;
}) {
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listboxId = `${baseId}-listbox`;
  const hintId = `${baseId}-hint`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const search = useBookSearch(query, open);
  const { results } = search;
  const isEligible = search.status !== "idle";
  const popupVisible = open && isEligible;
  const listVisible = popupVisible && search.status === "success";
  const safeIndex =
    listVisible && activeIndex >= 0 && activeIndex < results.length
      ? activeIndex
      : -1;

  // Fecha ao clicar fora do componente.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Mantém a opção ativa visível durante a navegação por teclado.
  useEffect(() => {
    if (safeIndex < 0) return;
    document
      .getElementById(`${baseId}-option-${safeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [safeIndex, baseId]);

  const select = (result: BookSearchResult) => {
    onSelect(result);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        if (results.length > 0 && listVisible) {
          setActiveIndex((safeIndex + 1) % results.length);
        }
        return;
      }
      case "ArrowUp": {
        event.preventDefault();
        if (results.length > 0 && listVisible) {
          setActiveIndex(safeIndex <= 0 ? results.length - 1 : safeIndex - 1);
        }
        return;
      }
      case "Enter": {
        if (listVisible && safeIndex >= 0) {
          event.preventDefault();
          const picked = results[safeIndex];
          if (picked) select(picked);
        }
        return;
      }
      case "Escape": {
        if (open) {
          event.preventDefault();
          setOpen(false);
          setActiveIndex(-1);
        }
        return;
      }
      case "Tab": {
        setOpen(false);
        return;
      }
    }
  };

  const liveMessage =
    !open || !isEligible
      ? ""
      : search.status === "loading"
        ? "Buscando livros..."
        : search.status === "success"
          ? `${results.length} ${results.length === 1 ? "sugestão encontrada" : "sugestões encontradas"}. Use as setas para navegar e Enter para escolher.`
          : search.status === "empty"
            ? EMPTY_MESSAGE
            : ERROR_MESSAGE;

  return (
    <div ref={containerRef} className="relative">
      <label
        htmlFor={inputId}
        className="block text-sm font-semibold text-[var(--text-primary)]"
      >
        Título ou autor
      </label>

      <div className="relative mt-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
          aria-hidden="true"
        />
        <input
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          aria-expanded={listVisible}
          aria-controls={listVisible ? listboxId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={safeIndex >= 0 ? optionId(safeIndex) : undefined}
          aria-describedby={hintId}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onClick={() => {
            if (normalizeSearchQuery(query)) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ex.: Dom Casmurro, Machado de Assis"
          className="min-h-[44px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] pr-10 pl-10 text-sm text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)] disabled:opacity-60"
        />
        {open && search.status === "loading" ? (
          <Loader2
            className="absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--text-muted)]"
            aria-hidden="true"
          />
        ) : null}
      </div>

      <p id={hintId} className="mt-1.5 text-xs text-[var(--text-muted)]">
        Digite ao menos {BOOK_SEARCH_MIN_CHARS} caracteres. Use ↑ ↓ para navegar,
        Enter para escolher e Esc para fechar.
      </p>

      <p role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

      {popupVisible ? (
        <div className="absolute top-full right-0 left-0 z-30 mt-1 max-h-[22rem] overflow-y-auto rounded-[12px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] shadow-lg">
          {search.status === "loading" ? (
            <div aria-hidden="true" className="space-y-1 p-2">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex animate-pulse gap-3 px-1 py-2">
                  <span className="h-[60px] w-10 shrink-0 rounded-[4px] bg-[var(--bg-subtle)]" />
                  <span className="flex-1 space-y-2 pt-1">
                    <span className="block h-3.5 w-3/5 rounded bg-[var(--bg-subtle)]" />
                    <span className="block h-3 w-2/5 rounded bg-[var(--bg-subtle)]" />
                    <span className="block h-3 w-1/3 rounded bg-[var(--bg-subtle)]" />
                  </span>
                </div>
              ))}
              <p className="px-2 pb-1 text-xs text-[var(--text-muted)]">
                Buscando livros...
              </p>
            </div>
          ) : null}

          {search.status === "empty" ? (
            <p className="p-4 text-sm text-[var(--text-primary)]">
              {EMPTY_MESSAGE}
            </p>
          ) : null}

          {search.status === "error" ? (
            <div className="space-y-2 p-4 text-sm text-[var(--text-primary)]">
              <p>{ERROR_MESSAGE}</p>
              <button
                type="button"
                onClick={search.retry}
                className="min-h-[36px] rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-surface)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
              >
                Tentar novamente
              </button>
            </div>
          ) : null}

          {listVisible ? (
            <>
              <ul
                id={listboxId}
                role="listbox"
                aria-label="Sugestões de livros"
                className="py-1"
              >
                {results.map((result, index) => {
                  const active = index === safeIndex;
                  const details = [
                    result.numero_paginas
                      ? `${result.numero_paginas} págs.`
                      : null,
                    result.isbn ? `ISBN ${result.isbn}` : null,
                  ].filter(Boolean);

                  return (
                    <li
                      key={result.id}
                      id={optionId(index)}
                      role="option"
                      aria-selected={active}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseMove={() => {
                        if (activeIndex !== index) setActiveIndex(index);
                      }}
                      onClick={() => select(result)}
                      className={`flex cursor-pointer items-start gap-3 border-l-[3px] px-3 py-2 ${
                        active
                          ? "border-[var(--accent-primary)] bg-[var(--bg-subtle)]"
                          : "border-transparent"
                      }`}
                    >
                      <SuggestionThumb
                        title={result.titulo}
                        src={result.miniatura}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className="line-clamp-1 min-w-0 flex-1 text-sm font-semibold text-[var(--text-primary)]">
                            {result.titulo}
                          </span>
                          {result.ano ? (
                            <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">
                              {result.ano}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 line-clamp-1 block text-xs text-[var(--text-muted)]">
                          {result.autor}
                        </span>
                        {details.length > 0 ? (
                          <span className="mt-0.5 block text-xs tabular-nums text-[var(--text-muted)]">
                            {details.join(" · ")}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {search.fonte === "open_library" ? (
                <p className="border-t border-[var(--border-subtle)] px-3 py-2 text-[11px] text-[var(--text-muted)]">
                  Resultados da Open Library (alternativa quando o Google Books
                  não responde ou não encontra o título).
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
