import type { CoverProviderSource } from "@/features/catalog/cover-search-rules";
import {
  searchBookCovers,
  type CoverSearchMediaFormat,
} from "@/server/catalog/cover-search";

export interface HydratedBookCoverResult {
  coverUrl: string | null;
  pages: number | null;
  source: CoverProviderSource | null;
}

/**
 * Resolve capa oficial em alta resolução e número real de páginas usando a
 * cadeia server-side unificada (`searchBookCovers`):
 * - Com ISBN: BrasilAPI (`cover_url` + `page_count`) -> Google Books -> Open Library (?default=false) -> Hardcover -> [Apple se flag ligada]
 * - Sem ISBN: Google Books -> Open Library -> Hardcover -> [Apple se flag ligada]
 */
export async function hydrateBookCoverMetadata(params: {
  title: string;
  author?: string;
  isbn?: string | null;
  format?: CoverSearchMediaFormat;
  signal?: AbortSignal;
}): Promise<HydratedBookCoverResult> {
  try {
    const res = await searchBookCovers({
      title: params.title,
      author: params.author,
      isbn: params.isbn ?? undefined,
      format: params.format,
      signal: params.signal,
    });
    const best = res.candidates[0] ?? null;
    return {
      coverUrl: best?.coverUrl ?? null,
      pages: best?.pageCount ?? res.pageCount ?? null,
      source: best?.source ?? null,
    };
  } catch {
    return {
      coverUrl: null,
      pages: null,
      source: null,
    };
  }
}
