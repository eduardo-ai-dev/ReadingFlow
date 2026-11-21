import { getServerEnv } from "@/lib/env";
import {
  sanitizePlainText,
  validateExternalCoverUrl,
} from "@/server/security/sanitize";
import {
  createCatalogLookupPipeline,
  type ResolvedCatalogMetadata,
} from "@/server/catalog/pipeline";

function toTitleCaseAuthor(name: string): string {
  const cleaned = sanitizePlainText(name, 160);
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 3) {
    return cleaned
      .toLowerCase()
      .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
  }
  return cleaned;
}

export async function fetchFromBrasilApi(
  isbn13: string,
  signal: AbortSignal
): Promise<ResolvedCatalogMetadata | null> {
  const res = await fetch(`https://brasilapi.com.br/api/isbn/v1/${isbn13}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    page_count?: number;
    year?: number;
    synopsis?: string;
    cover_url?: string;
    dimensions?: { height?: number; width?: number; unit?: string };
  };

  if (!data.title) return null;
  const factor = data.dimensions?.unit === "cm" ? 10 : 1;

  return {
    isbn13,
    title: sanitizePlainText(data.title, 300),
    subtitle: data.subtitle ? sanitizePlainText(data.subtitle, 300) : undefined,
    authors:
      data.authors && data.authors.length > 0
        ? data.authors.map(toTitleCaseAuthor)
        : ["Autor desconhecido"],
    publisher: data.publisher
      ? sanitizePlainText(data.publisher, 160)
      : undefined,
    pages:
      data.page_count && data.page_count > 0
        ? Math.round(data.page_count)
        : undefined,
    publishedYear: data.year,
    description: data.synopsis
      ? sanitizePlainText(data.synopsis, 2000)
      : undefined,
    coverUrl: validateExternalCoverUrl(data.cover_url),
    heightMm: data.dimensions?.height
      ? Math.round(data.dimensions.height * factor)
      : undefined,
    widthMm: data.dimensions?.width
      ? Math.round(data.dimensions.width * factor)
      : undefined,
    language: "pt-BR",
    source: "brasilapi",
  };
}

export async function fetchFromGoogleBooks(
  isbn13: string,
  signal: AbortSignal
): Promise<ResolvedCatalogMetadata | null> {
  const env = getServerEnv();
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", `isbn:${isbn13}`);
  if (env.GOOGLE_BOOKS_API_KEY) {
    url.searchParams.set("key", env.GOOGLE_BOOKS_API_KEY);
  }

  const res = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;

  const payload = (await res.json()) as {
    items?: Array<{
      volumeInfo?: {
        title?: string;
        subtitle?: string;
        authors?: string[];
        publisher?: string;
        pageCount?: number;
        publishedDate?: string;
        description?: string;
        language?: string;
        imageLinks?: { thumbnail?: string; smallThumbnail?: string };
      };
    }>;
  };

  const info = payload.items?.[0]?.volumeInfo;
  if (!info?.title) return null;

  const yearMatch = info.publishedDate?.match(/^(\d{4})/);

  return {
    isbn13,
    title: sanitizePlainText(info.title, 300),
    subtitle: info.subtitle ? sanitizePlainText(info.subtitle, 300) : undefined,
    authors:
      info.authors && info.authors.length > 0
        ? info.authors.map(toTitleCaseAuthor)
        : ["Autor desconhecido"],
    publisher: info.publisher
      ? sanitizePlainText(info.publisher, 160)
      : undefined,
    pages: info.pageCount && info.pageCount > 0 ? info.pageCount : undefined,
    publishedYear: yearMatch ? Number(yearMatch[1]) : undefined,
    description: info.description
      ? sanitizePlainText(info.description, 2000)
      : undefined,
    coverUrl: validateExternalCoverUrl(
      info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail
    ),
    language: info.language ?? "pt-BR",
    source: "google_books",
  };
}

export async function fetchFromOpenLibrary(
  isbn13: string,
  signal: AbortSignal
): Promise<ResolvedCatalogMetadata | null> {
  const env = getServerEnv();
  const key = `ISBN:${isbn13}`;
  const url = `https://openlibrary.org/api/books?bibkeys=${encodeURIComponent(key)}&format=json&jscmd=data`;

  const res = await fetch(url, {
    signal,
    headers: {
      Accept: "application/json",
      "User-Agent": env.OPEN_LIBRARY_USER_AGENT,
    },
  });
  if (!res.ok) return null;

  const payload = (await res.json()) as Record<
    string,
    | {
        title?: string;
        subtitle?: string;
        authors?: Array<{ name?: string }>;
        publishers?: Array<{ name?: string }>;
        number_of_pages?: number;
        publish_date?: string;
        cover?: { medium?: string; large?: string };
      }
    | undefined
  >;

  const entry = payload[key];
  if (!entry?.title) return null;

  const yearMatch = entry.publish_date?.match(/(\d{4})/);
  const authors = (entry.authors ?? [])
    .map((a) => a.name)
    .filter((n): n is string => Boolean(n))
    .map(toTitleCaseAuthor);

  return {
    isbn13,
    title: sanitizePlainText(entry.title, 300),
    subtitle: entry.subtitle
      ? sanitizePlainText(entry.subtitle, 300)
      : undefined,
    authors: authors.length > 0 ? authors : ["Autor desconhecido"],
    publisher: entry.publishers?.[0]?.name
      ? sanitizePlainText(entry.publishers[0].name, 160)
      : undefined,
    pages:
      entry.number_of_pages && entry.number_of_pages > 0
        ? entry.number_of_pages
        : undefined,
    publishedYear: yearMatch ? Number(yearMatch[1]) : undefined,
    coverUrl: validateExternalCoverUrl(
      entry.cover?.large ?? entry.cover?.medium
    ),
    language: "pt-BR",
    source: "open_library",
  };
}

export function createLiveCatalogPipeline(
  findInternalByIsbn13: (
    isbn13: string
  ) => Promise<ResolvedCatalogMetadata | null>
) {
  const env = getServerEnv();
  return createCatalogLookupPipeline({
    timeoutMs: env.CATALOG_LOOKUP_TIMEOUT_MS,
    dailyQuotaPerProvider: 800,
    findInternalByIsbn13,
    providers: {
      brasilapi: fetchFromBrasilApi,
      google_books: fetchFromGoogleBooks,
      open_library: fetchFromOpenLibrary,
    },
  });
}
