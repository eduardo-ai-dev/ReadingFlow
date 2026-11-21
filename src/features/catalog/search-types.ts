/**
 * Tipos e normalização do termo de busca. Módulo mínimo e puro, seguro para
 * o cliente (não importa nada do servidor).
 */

/** Resultado normalizado de busca por título/autor (Google Books ou Open Library). */
export interface BookSearchResult {
  id: string;
  fonte: "google_books" | "open_library";
  titulo: string;
  autor: string;
  numero_paginas: number | null;
  /** ISBN-13 (preferido) ou ISBN-10 sem hifens/espaços; vazio quando indisponível. */
  isbn: string;
  /** Primeira categoria informada pela fonte; vazio quando indisponível. */
  genero: string;
  ano: number | null;
  /** Miniatura leve para a lista (nunca dispara varredura por ISBN). */
  miniatura: string | null;
  /** URLs candidatas de capa, da melhor para a pior. */
  capas: string[];
}

export interface BookSearchResponse {
  results: BookSearchResult[];
  fonte: BookSearchResult["fonte"];
}

export const BOOK_SEARCH_MIN_CHARS = 3;
export const BOOK_SEARCH_MAX_CHARS = 120;
export const BOOK_SEARCH_MAX_RESULTS = 8;
export const BOOK_SEARCH_DEBOUNCE_MS = 350;

/** Normaliza o termo digitado; `null` quando curto demais para consultar. */
export function normalizeSearchQuery(raw: string): string | null {
  const cleaned = raw
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, BOOK_SEARCH_MAX_CHARS);
  return cleaned.length >= BOOK_SEARCH_MIN_CHARS ? cleaned : null;
}
