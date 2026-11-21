import { z } from "zod";
import {
  buildCoverCandidates,
  sanitizeGoogleCoverUrl,
  type GoogleImageLinks,
} from "@/features/catalog/cover-rules";
import {
  BOOK_SEARCH_MAX_RESULTS,
  type BookSearchResult,
} from "@/features/catalog/search-types";
import {
  isBrazilianIsbn13,
  isValidIsbn10,
  isValidIsbn13,
  stripIsbnFormatting,
} from "@/lib/isbn";
import { sanitizePlainText } from "@/server/security/sanitize";

export {
  BOOK_SEARCH_MAX_CHARS,
  BOOK_SEARCH_MAX_RESULTS,
  BOOK_SEARCH_MIN_CHARS,
  normalizeSearchQuery,
  type BookSearchResponse,
  type BookSearchResult,
} from "@/features/catalog/search-types";

const MAX_AUTHOR_LENGTH = 200;
const MAX_TITLE_LENGTH = 300;
const MAX_SUBTITLE_LENGTH = 120;

/** URL exata do endpoint principal (a chave opcional só existe no servidor). */
export function buildGoogleBooksSearchUrl(
  query: string,
  apiKey?: string
): string {
  const base = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&langRestrict=pt&maxResults=${BOOK_SEARCH_MAX_RESULTS}&printType=books`;
  return apiKey ? `${base}&key=${encodeURIComponent(apiKey)}` : base;
}

export function buildOpenLibrarySearchUrl(query: string): string {
  const fields = [
    "key",
    "title",
    "subtitle",
    "author_name",
    "first_publish_year",
    "number_of_pages_median",
    "isbn",
    "subject",
    "cover_i",
  ].join(",");
  return `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&lang=por&limit=${BOOK_SEARCH_MAX_RESULTS}&fields=${fields}`;
}

/**
 * ISBN_13 válido primeiro; senão ISBN_10 válido (hifens e espaços removidos).
 * Identificadores com dígito verificador inválido são ignorados para não
 * produzir erro de validação ao salvar o formulário.
 */
export function pickIsbn(
  identifiers?: ReadonlyArray<{ type?: string; identifier?: string }> | null
): string {
  if (!identifiers) return "";
  const clean = (type: string) =>
    identifiers
      .filter((id) => id.type === type && id.identifier)
      .map((id) => stripIsbnFormatting(id.identifier as string));
  const isbn13 = clean("ISBN_13").find(isValidIsbn13);
  if (isbn13) return isbn13;
  return clean("ISBN_10").find(isValidIsbn10) ?? "";
}

/** Título + subtítulo quando o subtítulo agrega informação e cabe no campo. */
export function buildTitle(title: string, subtitle?: string | null): string {
  const cleanTitle = sanitizePlainText(title, MAX_TITLE_LENGTH);
  const cleanSubtitle = subtitle
    ? sanitizePlainText(subtitle, MAX_TITLE_LENGTH)
    : "";
  if (
    !cleanSubtitle ||
    cleanSubtitle.length > MAX_SUBTITLE_LENGTH ||
    cleanTitle.toLowerCase().includes(cleanSubtitle.toLowerCase())
  ) {
    return cleanTitle;
  }
  const combined = `${cleanTitle}: ${cleanSubtitle}`;
  return combined.length <= MAX_TITLE_LENGTH ? combined : cleanTitle;
}

export function joinAuthors(authors?: readonly string[] | null): string {
  const cleaned = (authors ?? [])
    .map((name) => sanitizePlainText(name, MAX_AUTHOR_LENGTH))
    .filter(Boolean);
  if (cleaned.length === 0) return "Autor desconhecido";

  let joined = "";
  for (const name of cleaned) {
    const next = joined ? `${joined}, ${name}` : name;
    if (next.length > MAX_AUTHOR_LENGTH) break;
    joined = next;
  }
  return joined || cleaned[0]!.slice(0, MAX_AUTHOR_LENGTH);
}

export function parsePublishedYear(raw?: string | null): number | null {
  const match = raw?.match(/(\d{4})/);
  if (!match) return null;
  const year = Number(match[1]);
  return year >= 1000 && year <= 2100 ? year : null;
}

const googleVolumeSchema = z.object({
  id: z.string().optional(),
  volumeInfo: z.object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    authors: z.array(z.string()).optional(),
    pageCount: z.number().optional(),
    publishedDate: z.string().optional(),
    categories: z.array(z.string()).optional(),
    industryIdentifiers: z
      .array(
        z.object({
          type: z.string().optional(),
          identifier: z.string().optional(),
        })
      )
      .optional(),
    imageLinks: z.record(z.string(), z.string()).optional(),
  }),
});

export function normalizeGoogleVolume(
  item: unknown,
  index = 0
): BookSearchResult | null {
  const parsed = googleVolumeSchema.safeParse(item);
  if (!parsed.success) return null;

  const { id, volumeInfo: info } = parsed.data;
  if (!info.title?.trim()) return null;

  const isbn = pickIsbn(info.industryIdentifiers);
  const capas = buildCoverCandidates({
    googleImageLinks: info.imageLinks as GoogleImageLinks | undefined,
    isbn,
  });
  const googleThumb = sanitizeGoogleCoverUrl(
    info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail
  );

  return {
    id: `google_books:${id ?? `${index}-${isbn || info.title}`}`,
    fonte: "google_books",
    titulo: buildTitle(info.title, info.subtitle),
    autor: joinAuthors(info.authors),
    numero_paginas:
      info.pageCount && info.pageCount > 0 && info.pageCount <= 20000
        ? Math.round(info.pageCount)
        : null,
    isbn,
    genero: sanitizePlainText(info.categories?.[0] ?? "", 100),
    ano: parsePublishedYear(info.publishedDate),
    miniatura: googleThumb ?? null,
    capas,
  };
}

const openLibraryDocSchema = z.object({
  key: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  author_name: z.array(z.string()).optional(),
  first_publish_year: z.number().optional(),
  number_of_pages_median: z.number().optional(),
  isbn: z.array(z.string()).optional(),
  subject: z.array(z.string()).optional(),
  cover_i: z.number().optional(),
});

/** Entre as muitas edições da Open Library, prefere ISBN-13 brasileiro válido. */
export function pickOpenLibraryIsbn(isbns?: readonly string[] | null): string {
  const cleaned = (isbns ?? []).map(stripIsbnFormatting);
  const valid13 = cleaned.filter(isValidIsbn13);
  return (
    valid13.find(isBrazilianIsbn13) ??
    valid13[0] ??
    cleaned.find(isValidIsbn10) ??
    ""
  );
}

export function normalizeOpenLibraryDoc(
  doc: unknown,
  index = 0
): BookSearchResult | null {
  const parsed = openLibraryDocSchema.safeParse(doc);
  if (!parsed.success || !parsed.data.title?.trim()) return null;

  const d = parsed.data;
  const isbn = pickOpenLibraryIsbn(d.isbn);
  const capas = buildCoverCandidates({
    openLibraryCoverId: d.cover_i,
    isbn,
  });

  return {
    id: `open_library:${d.key ?? `${index}-${isbn || d.title}`}`,
    fonte: "open_library",
    titulo: buildTitle(d.title as string, d.subtitle),
    autor: joinAuthors(d.author_name),
    numero_paginas:
      d.number_of_pages_median &&
      d.number_of_pages_median > 0 &&
      d.number_of_pages_median <= 20000
        ? Math.round(d.number_of_pages_median)
        : null,
    isbn,
    genero: sanitizePlainText(d.subject?.[0] ?? "", 100),
    ano: parsePublishedYear(String(d.first_publish_year ?? "")),
    miniatura: d.cover_i
      ? `https://covers.openlibrary.org/b/id/${d.cover_i}-S.jpg?default=false`
      : null,
    capas,
  };
}

/** Remove duplicatas (mesmo ISBN ou mesmo título + autor), preservando a ordem. */
export function dedupeSearchResults(
  results: readonly BookSearchResult[]
): BookSearchResult[] {
  const seen = new Set<string>();
  const output: BookSearchResult[] = [];
  for (const result of results) {
    const key = result.isbn
      ? `isbn:${result.isbn}`
      : `ta:${result.titulo.toLowerCase()}|${result.autor.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(result);
  }
  return output;
}

export function normalizeGoogleResponse(payload: unknown): BookSearchResult[] {
  const items = (payload as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return [];
  return dedupeSearchResults(
    items
      .map((item, index) => normalizeGoogleVolume(item, index))
      .filter((r): r is BookSearchResult => r !== null)
  ).slice(0, BOOK_SEARCH_MAX_RESULTS);
}

export function normalizeOpenLibraryResponse(
  payload: unknown
): BookSearchResult[] {
  const docs = (payload as { docs?: unknown } | null)?.docs;
  if (!Array.isArray(docs)) return [];
  return dedupeSearchResults(
    docs
      .map((doc, index) => normalizeOpenLibraryDoc(doc, index))
      .filter((r): r is BookSearchResult => r !== null)
  ).slice(0, BOOK_SEARCH_MAX_RESULTS);
}
