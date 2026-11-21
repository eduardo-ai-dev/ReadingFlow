"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchBookSuggestions,
  isAbortError,
} from "@/features/catalog/search-client";
import {
  BOOK_SEARCH_DEBOUNCE_MS,
  normalizeSearchQuery,
  type BookSearchResult,
} from "@/features/catalog/search-types";

export type BookSearchStatus =
  | "idle"
  | "loading"
  | "success"
  | "empty"
  | "error";

interface SettledSearch {
  query: string;
  status: "success" | "empty" | "error";
  results: BookSearchResult[];
  fonte?: BookSearchResult["fonte"];
  errorMessage?: string;
}

/**
 * Busca com debounce (350 ms, mínimo de 3 caracteres) e `AbortController`:
 * cada novo termo cancela a requisição anterior, evitando respostas fora de ordem.
 * O estado exibido é derivado (termo atual × último resultado), sem `setState`
 * síncrono dentro do efeito.
 */
export function useBookSearch(
  rawQuery: string,
  enabled: boolean,
  debounceMs: number = BOOK_SEARCH_DEBOUNCE_MS
): {
  status: BookSearchStatus;
  results: BookSearchResult[];
  fonte?: BookSearchResult["fonte"];
  errorMessage?: string;
  retry: () => void;
} {
  const query = normalizeSearchQuery(rawQuery);
  const [settled, setSettled] = useState<SettledSearch | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const settledQueryRef = useRef<string | null>(null);

  const retry = () => {
    settledQueryRef.current = null;
    setSettled(null);
    setRetryNonce((n) => n + 1);
  };

  useEffect(() => {
    if (!enabled || query === null) return;
    if (settledQueryRef.current === query) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = await fetchBookSuggestions(query, controller.signal);
        if (controller.signal.aborted) return;
        settledQueryRef.current = query;
        setSettled({
          query,
          status: data.results.length > 0 ? "success" : "empty",
          results: data.results,
          fonte: data.fonte,
        });
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) return;
        settledQueryRef.current = null;
        setSettled({
          query,
          status: "error",
          results: [],
          errorMessage:
            error instanceof Error ? error.message : "Falha na busca online.",
        });
      }
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, enabled, debounceMs, retryNonce]);

  if (query === null) return { status: "idle", results: [], retry };
  if (!settled || settled.query !== query) {
    return { status: "loading", results: [], retry };
  }
  return {
    status: settled.status,
    results: settled.results,
    fonte: settled.fonte,
    errorMessage: settled.errorMessage,
    retry,
  };
}
