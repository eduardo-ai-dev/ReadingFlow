"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Book3D, type Book3DItem } from "@/components/Book3D";
import { LITERARY_GENRE_VOLUMES } from "@/features/shelves/genres";

export function VirtualGenreShelf({
  countsBySlug = {},
  activeSlug,
}: {
  countsBySlug?: Record<string, number>;
  activeSlug?: string;
}) {
  const router = useRouter();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    activeSlug ?? null
  );
  const [focusedIndex, setFocusedIndex] = useState(0);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const booksWithCounts: Book3DItem[] = LITERARY_GENRE_VOLUMES.map((vol) => {
    const count = countsBySlug[vol.slug] ?? 0;
    return {
      ...vol,
      sub: `${vol.sub} · ${count}`,
    };
  });

  const selectedDef = LITERARY_GENRE_VOLUMES.find(
    (g) => g.slug === selectedSlug
  );
  const selectedCount = selectedDef ? (countsBySlug[selectedDef.slug] ?? 0) : 0;

  const handleSelect = (book: Book3DItem) => {
    if (selectedSlug === book.slug) {
      router.push(`/generos/${book.slug}`);
      return;
    }
    setSelectedSlug(book.slug);
  };

  return (
    <section aria-labelledby="estante-virtual-3d-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id="estante-virtual-3d-heading"
            className="font-serif text-lg font-semibold text-[var(--text-heading)]"
          >
            Estante Virtual por Gênero Literário
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Passe o cursor ou selecione um volume para puxá-lo da estante;
            clique novamente (ou use o botão abaixo) para abrir todos os livros
            do gênero.
          </p>
        </div>
      </div>

      <div className="rf-shelf-stage">
        <ul
          className="rf-shelf"
          aria-label="Volumes de gêneros literários na estante 3D"
        >
          {booksWithCounts.map((book, idx) => (
            <Book3D
              key={book.id}
              book={book}
              tabIndex={focusedIndex === idx ? 0 : -1}
              buttonRef={(el) => {
                buttonRefs.current[idx] = el;
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  const nextIdx = (idx + 1) % booksWithCounts.length;
                  setFocusedIndex(nextIdx);
                  buttonRefs.current[nextIdx]?.focus();
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  const prevIdx =
                    (idx - 1 + booksWithCounts.length) % booksWithCounts.length;
                  setFocusedIndex(prevIdx);
                  buttonRefs.current[prevIdx]?.focus();
                } else if (e.key === "Home") {
                  e.preventDefault();
                  setFocusedIndex(0);
                  buttonRefs.current[0]?.focus();
                } else if (e.key === "End") {
                  e.preventDefault();
                  const lastIdx = booksWithCounts.length - 1;
                  setFocusedIndex(lastIdx);
                  buttonRefs.current[lastIdx]?.focus();
                }
              }}
              isSelected={selectedSlug === book.slug}
              onSelect={handleSelect}
            />
          ))}
        </ul>
        <div className="rf-shelf-plank" aria-hidden="true" />
      </div>

      <div
        role="region"
        aria-live="polite"
        aria-label={
          selectedDef
            ? `Ala selecionada: ${selectedDef.title}`
            : "Instruções da estante virtual"
        }
        className="flex min-h-[68px] flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3 shadow-[var(--shadow-card)]"
      >
        {selectedDef ? (
          <>
            <div className="min-w-0">
              <p className="font-serif text-base font-semibold text-[var(--text-heading)]">
                Ala {selectedDef.num} · {selectedDef.title}{" "}
                <span className="font-sans text-xs font-normal text-[var(--text-muted)]">
                  ({selectedCount}{" "}
                  {selectedCount === 1 ? "livro no acervo" : "livros no acervo"}
                  )
                </span>
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {selectedDef.headline}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/generos/${selectedDef.slug}`}
                className="inline-flex min-h-[42px] items-center rounded-[8px] bg-[var(--accent-primary)] px-4 text-xs font-semibold text-[var(--on-primary)] hover:bg-[var(--accent-primary-hover)]"
              >
                Abrir livros de {selectedDef.title} →
              </Link>
            </div>
          </>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">
            Selecione qualquer lombada acima (com clique, toque ou tecla{" "}
            <kbd className="rounded border border-[var(--border-ui)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-primary)]">
              Tab
            </kbd>
            ) para inspecionar a ala literária e abrir todos os livros do
            gênero.
          </p>
        )}
      </div>
    </section>
  );
}
