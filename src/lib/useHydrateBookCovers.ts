"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface HydratableBookRef {
  id: string | number;
  editionId?: string;
  title: string;
  author?: string;
  isbn?: string | null;
  coverUrl?: string | null;
  pages?: number | null;
  spineColor?: string;
}

interface HydratedCacheEntry {
  coverUrl: string | null;
  pages?: number | null;
  spineColor?: string | null;
  ts: number;
}

const STORAGE_KEY = "readingflow:hydrated-covers:v1";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias
const NEGATIVE_CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 1 dia sem capa encontrada

function makeCacheKey(book: HydratableBookRef): string {
  if (book.editionId) return `ed:${book.editionId}`;
  if (book.isbn) return `isbn:${book.isbn}`;
  return `ta:${book.title.trim().toLowerCase()}::${(book.author ?? "").trim().toLowerCase()}`;
}

function readLocalCache(): Record<string, HydratedCacheEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, HydratedCacheEntry>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalCache(cache: Record<string, HydratedCacheEntry>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Quota/storage indisponível: mantém apenas em memória
  }
}

/**
 * Hidrata automaticamente capas reais (Google Books -> Open Library -> BrasilAPI)
 * para volumes já cadastrados sem `coverUrl`, persistindo em `localStorage` e no
 * repositório do servidor para re-renderização imediata da Estante 3D.
 */
export function useHydrateBookCovers<T extends HydratableBookRef>(
  books: readonly T[]
): T[] {
  const [hydratedByKey, setHydratedByKey] = useState<
    Record<string, { coverUrl?: string; pages?: number; spineColor?: string }>
  >({});
  const attemptedKeysRef = useRef<Set<string>>(new Set());

  const mergedBooks = useMemo(
    () =>
      books.map((book) => {
        const key = makeCacheKey(book);
        const found = hydratedByKey[key];
        if (!found) return book;
        return {
          ...book,
          coverUrl: book.coverUrl || found.coverUrl || book.coverUrl,
          spineColor: book.spineColor || found.spineColor || book.spineColor,
          pages:
            book.pages && book.pages > 0
              ? book.pages
              : (found.pages ?? book.pages),
        };
      }),
    [books, hydratedByKey]
  );

  useEffect(() => {
    if (typeof window === "undefined" || books.length === 0) return;

    const controller = new AbortController();
    const cache = readLocalCache();
    const now = Date.now();

    const cachedUpdates: Record<
      string,
      { coverUrl?: string; pages?: number; spineColor?: string }
    > = {};
    const toFetch: HydratableBookRef[] = [];

    for (const book of books) {
      if (book.coverUrl) continue;
      const key = makeCacheKey(book);
      const cached = cache[key];
      if (cached && cached.coverUrl && now - cached.ts < CACHE_TTL_MS) {
        cachedUpdates[key] = {
          coverUrl: cached.coverUrl,
          pages: cached.pages ?? undefined,
          spineColor: cached.spineColor ?? undefined,
        };
        continue;
      }
      // Cache negativo: não repete a busca de quem já não tem capa disponível
      if (cached && !cached.coverUrl && now - cached.ts < NEGATIVE_CACHE_TTL_MS) {
        attemptedKeysRef.current.add(key);
        continue;
      }
      if (!attemptedKeysRef.current.has(key)) {
        attemptedKeysRef.current.add(key);
        toFetch.push(book);
      }
    }

    if (Object.keys(cachedUpdates).length > 0) {
      // Agenda em microtask para respeitar react-hooks/set-state-in-effect
      Promise.resolve().then(() => {
        if (!controller.signal.aborted) {
          setHydratedByKey((prev) => ({ ...cachedUpdates, ...prev }));
        }
      });
    }

    if (toFetch.length === 0) {
      return () => controller.abort();
    }

    const hydrateOne = async (book: HydratableBookRef) => {
      if (controller.signal.aborted) return;
      const key = makeCacheKey(book);
      try {
        const res = await fetch("/api/catalog/hydrate", {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            editionId: book.editionId,
            title: book.title,
            author: book.author,
            isbn: book.isbn,
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          coverUrl?: string | null;
          pages?: number | null;
          spineColor?: string | null;
        };
        if (controller.signal.aborted) return;

        const latestCache = readLocalCache();
        latestCache[key] = {
          coverUrl: data.coverUrl ?? null,
          pages: data.pages ?? null,
          spineColor: data.spineColor ?? null,
          ts: Date.now(),
        };
        writeLocalCache(latestCache);

        if (data.coverUrl || data.pages) {
          setHydratedByKey((prev) => ({
            ...prev,
            [key]: {
              coverUrl: data.coverUrl ?? undefined,
              pages: data.pages ?? undefined,
              spineColor: data.spineColor ?? undefined,
            },
          }));
        }
      } catch {
        // Silencioso: fallback tipográfico editorial permanece ativo
      }
    };

    // Processa em fila com concorrência 2 para evitar sobrecarga de rede
    const queue = [...toFetch];
    const runWorker = async () => {
      while (queue.length > 0 && !controller.signal.aborted) {
        const next = queue.shift();
        if (next) await hydrateOne(next);
      }
    };

    void Promise.all([runWorker(), runWorker()]);

    return () => {
      controller.abort();
    };
  }, [books]);

  return mergedBooks;
}
