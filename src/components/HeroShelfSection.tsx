"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { BookFormat, ProgressUnit, ReadingStatus } from "@/lib/domain";
import { coverColor, extractAuthorSurname } from "@/lib/cover-color";
import { useShelfParallax } from "@/lib/useShelfParallax";
import { Book3D } from "@/components/Book3D";
import { normalizeRealisticBookFormat } from "@/features/shelves/virtual-bookshelf";
import {
  BookSlideOverDrawer,
  type BookDrawerData,
} from "@/components/BookSlideOverDrawer";
import styles from "./HeroShelfSection.module.css";

const HERO_GHOST_PRESETS = [
  { widthMm: 22, heightMm: 196 },
  { widthMm: 26, heightMm: 214 },
  { widthMm: 20, heightMm: 186 },
  { widthMm: 24, heightMm: 206 },
  { widthMm: 23, heightMm: 198 },
  { widthMm: 25, heightMm: 212 },
  { widthMm: 21, heightMm: 190 },
];

const TARGET_MIN_HERO_SLOTS = 8;

export interface HeroPhysicalBookInput {
  id: string;
  workId?: string;
  editionId?: string;
  libraryItemId?: string;
  readingId?: string | null;
  title: string;
  author: string;
  genre: string;
  pages?: number | null;
  format: BookFormat;
  publisher?: string | null;
  isbn13?: string | null;
  coverUrl?: string | null;
  status: ReadingStatus;
  progressUnit?: ProgressUnit;
  progressValue?: number;
  progressTotal?: number | null;
  progressPercent?: number;
  rating?: number | null;
}

const STATUS_LABELS_PT: Record<ReadingStatus, string> = {
  not_started: "Não iniciado",
  reading: "Em andamento",
  paused: "Pausado",
  finished: "Concluído",
  abandoned: "Abandonado",
};

export function HeroShelfSection({
  books,
}: {
  books: readonly HeroPhysicalBookInput[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const {
    containerRef: heroRef,
    handleMouseMove,
    handleMouseLeave,
  } = useShelfParallax<HTMLDivElement>();

  // Capas vêm persistidas no banco; nenhuma busca roda durante a renderização.
  const sortedBooks = useMemo(
    () =>
      [...books].sort((a, b) => {
        const genreCmp = a.genre.localeCompare(b.genre, "pt-BR");
        if (genreCmp !== 0) return genreCmp;
        return a.title.localeCompare(b.title, "pt-BR");
      }),
    [books]
  );

  // Calcula cores evitando repetição em lombadas vizinhas
  const resolvedColors = useMemo(() => {
    const colors: string[] = [];
    for (let i = 0; i < sortedBooks.length; i++) {
      const b = sortedBooks[i]!;
      const seed = b.isbn13 ?? b.id;
      const prevHex = i > 0 ? colors[i - 1] : null;
      colors.push(coverColor(seed, prevHex));
    }
    return colors;
  }, [sortedBooks]);

  const totalGhosts =
    sortedBooks.length > 0 && sortedBooks.length < TARGET_MIN_HERO_SLOTS
      ? TARGET_MIN_HERO_SLOTS - sortedBooks.length
      : 0;
  const leftGhostCount = Math.floor(totalGhosts / 2);
  const rightGhostCount = Math.ceil(totalGhosts / 2);

  const handleRowKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const total = sortedBooks.length;
    if (total === 0) return;

    const currentBtn = e.target as HTMLButtonElement;
    const currentIndex = buttonRefs.current.indexOf(currentBtn);
    if (currentIndex < 0) return;

    let nextIndex: number | undefined;
    if (e.key === "ArrowRight") nextIndex = currentIndex + 1;
    else if (e.key === "ArrowLeft") nextIndex = currentIndex - 1;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = total - 1;

    if (nextIndex === undefined) return;
    e.preventDefault();
    const clamped = Math.max(0, Math.min(total - 1, nextIndex));
    setFocusedIndex(clamped);
    buttonRefs.current[clamped]?.focus();
  };

  const selectedBook = sortedBooks.find((b) => b.id === selectedId) ?? null;

  const drawerBook: BookDrawerData | null = selectedBook
    ? {
        id: selectedBook.id,
        workId: selectedBook.workId,
        editionId: selectedBook.editionId,
        libraryItemId: selectedBook.libraryItemId,
        readingId: selectedBook.readingId,
        title: selectedBook.title,
        author: selectedBook.author,
        genre: selectedBook.genre,
        publisher: selectedBook.publisher,
        pages: selectedBook.pages,
        coverUrl: selectedBook.coverUrl,
        seed: selectedBook.isbn13 ?? selectedBook.id,
        format: selectedBook.format,
        readingStatus: selectedBook.status,
        statusLabel: STATUS_LABELS_PT[selectedBook.status],
        progressUnit: selectedBook.progressUnit,
        progressValue: selectedBook.progressValue,
        progressTotal: selectedBook.progressTotal,
        progressPercent: selectedBook.progressPercent ?? 0,
        rating: selectedBook.rating,
        href: selectedBook.workId ? `/livros/${selectedBook.workId}` : undefined,
      }
    : null;

  const renderGhostSlot = (slotKey: string, presetIdx: number) => {
    const preset =
      HERO_GHOST_PRESETS[presetIdx % HERO_GHOST_PRESETS.length]!;
    return (
      <Link
        key={slotKey}
        href="/adicionar"
        aria-label="Adicionar Livro ao acervo físico"
        className={styles.ghostSlot}
        style={
          {
            "--ghost-w": String(preset.widthMm),
            "--ghost-h": String(preset.heightMm),
          } as CSSProperties
        }
      >
        <span className={styles.ghostSilhouette} aria-hidden="true" />
        <span className={styles.ghostPlus} aria-hidden="true">
          +
        </span>
        <span className={styles.ghostLabel} aria-hidden="true">
          Adicionar Livro
        </span>
      </Link>
    );
  };

  return (
    <>
      <div
        ref={heroRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={styles.heroContainer}
      >
        {sortedBooks.length > 0 ? (
          <div
            role="group"
            aria-label="Volumes do acervo físico ordenados por gênero"
            className={styles.row}
            onKeyDown={handleRowKeyDown}
          >
            {Array.from({ length: leftGhostCount }, (_, gIdx) =>
              renderGhostSlot(`hero-ghost-left-${gIdx}`, gIdx)
            )}

            {sortedBooks.map((book, idx) => {
              const seed = book.isbn13 ?? book.id;
              const prevHex = idx > 0 ? resolvedColors[idx - 1] : null;
              const safeProgress = Math.max(
                0,
                Math.min(100, Math.round(book.progressPercent ?? 0))
              );
              const totalPagesForTip = book.progressTotal ?? book.pages;

              return (
                <Book3D
                  key={book.id}
                  as="div"
                  pages={book.pages ?? 220}
                  format={normalizeRealisticBookFormat(book.format)}
                  title={book.title}
                  author={book.author}
                  authorSurname={extractAuthorSurname(book.author)}
                  publisher={book.publisher}
                  seed={seed}
                  color={resolvedColors[idx]}
                  avoidNeighborHex={prevHex}
                  coverUrl={book.coverUrl}
                  status={STATUS_LABELS_PT[book.status]}
                  readingStatus={book.status}
                  progressPercent={safeProgress}
                  progressValue={book.progressValue}
                  progressTotal={totalPagesForTip}
                  genre={book.genre}
                  tabIndex={focusedIndex === idx ? 0 : -1}
                  buttonRef={(el) => {
                    buttonRefs.current[idx] = el;
                  }}
                  isSelected={selectedId === book.id}
                  onActivate={() => {
                    setFocusedIndex(idx);
                    setSelectedId((curr) => (curr === book.id ? null : book.id));
                  }}
                />
              );
            })}

            {Array.from({ length: rightGhostCount }, (_, gIdx) =>
              renderGhostSlot(`hero-ghost-right-${gIdx}`, leftGhostCount + gIdx)
            )}
          </div>
        ) : (
          <p className={styles.emptyNotice}>
            Seu acervo físico ainda não possui volumes cadastrados.
          </p>
        )}

        <div className={styles.plank} aria-hidden="true" />

        <div className="sr-only" aria-live="polite">
          {selectedBook ? `${selectedBook.title} selecionado na prateleira` : ""}
        </div>
      </div>

      <BookSlideOverDrawer
        book={drawerBook}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
