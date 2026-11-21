import { getServerEnv } from "@/lib/env";
import { getCatalogFetch } from "@/server/catalog/http-client";
import {
  buildGoogleBooksSearchUrl,
  buildOpenLibrarySearchUrl,
  normalizeGoogleResponse,
  normalizeOpenLibraryResponse,
} from "@/features/catalog/search-rules";
import type {
  BookSearchResponse,
  BookSearchResult,
} from "@/features/catalog/search-types";

export class BookSearchUnavailableError extends Error {
  constructor() {
    super("Busca online indisponível no momento.");
    this.name = "BookSearchUnavailableError";
  }
}

export interface SearchBooksOptions {
  /** Cancelamento vindo do cliente (digitação continuou ou aba fechada). */
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  apiKey?: string;
  userAgent?: string;
  timeoutMs?: number;
}

async function fetchJson(
  url: string,
  init: { signal: AbortSignal; fetchImpl: typeof fetch; userAgent?: string }
): Promise<unknown | null> {
  const res = await init.fetchImpl(url, {
    signal: init.signal,
    headers: {
      Accept: "application/json",
      ...(init.userAgent ? { "User-Agent": init.userAgent } : {}),
    },
  });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Google Books (principal) com fallback para a busca da Open Library quando o
 * Google falha (cota/429, 5xx, rede) ou não encontra nada. O cancelamento do
 * cliente é repassado às requisições externas.
 */
export async function searchBooksOnline(
  query: string,
  options: SearchBooksOptions = {}
): Promise<BookSearchResponse> {
  const env = options.fetchImpl ? null : getServerEnv();
  const fetchImpl = getCatalogFetch(options.fetchImpl);
  const apiKey = options.apiKey ?? env?.GOOGLE_BOOKS_API_KEY;
  const userAgent = options.userAgent ?? env?.OPEN_LIBRARY_USER_AGENT;
  const timeoutMs = options.timeoutMs ?? env?.CATALOG_LOOKUP_TIMEOUT_MS ?? 4000;

  const signals = [AbortSignal.timeout(timeoutMs)];
  if (options.signal) signals.push(options.signal);
  const signal = AbortSignal.any(signals);

  const throwIfClientAborted = () => {
    if (options.signal?.aborted) {
      throw new DOMException("Busca cancelada pelo cliente.", "AbortError");
    }
  };

  let googleResults: BookSearchResult[] | null = null;
  try {
    const payload = await fetchJson(buildGoogleBooksSearchUrl(query, apiKey), {
      signal,
      fetchImpl,
    });
    if (payload !== null) googleResults = normalizeGoogleResponse(payload);
  } catch {
    throwIfClientAborted();
  }
  throwIfClientAborted();

  if (googleResults && googleResults.length > 0) {
    return { results: googleResults, fonte: "google_books" };
  }

  // Fallback: Google indisponível (null) ou sem resultados.
  try {
    const payload = await fetchJson(buildOpenLibrarySearchUrl(query), {
      signal: AbortSignal.any([
        AbortSignal.timeout(timeoutMs),
        ...(options.signal ? [options.signal] : []),
      ]),
      fetchImpl,
      userAgent,
    });
    if (payload !== null) {
      return {
        results: normalizeOpenLibraryResponse(payload),
        fonte: "open_library",
      };
    }
  } catch {
    throwIfClientAborted();
  }
  throwIfClientAborted();

  // Google respondeu (sem resultados) e a Open Library falhou: lista vazia legítima.
  if (googleResults) return { results: [], fonte: "google_books" };
  throw new BookSearchUnavailableError();
}
