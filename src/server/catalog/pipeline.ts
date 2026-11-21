import { isBrazilianIsbn13, normalizeToIsbn13 } from "@/lib/isbn";

export type CatalogProviderId = "brasilapi" | "google_books" | "open_library";

export interface ResolvedCatalogMetadata {
  isbn13: string;
  title: string;
  subtitle?: string;
  authors: string[];
  publisher?: string;
  pages?: number;
  publishedYear?: number;
  description?: string;
  coverUrl?: string;
  heightMm?: number;
  widthMm?: number;
  language: string;
  source: "manual" | CatalogProviderId;
}

export type CatalogLookupResult =
  | { status: "invalid_isbn" }
  | { status: "found"; metadata: ResolvedCatalogMetadata; cached: boolean }
  | { status: "manual_fallback"; isbn13: string };

interface CacheEntry {
  found: boolean;
  metadata?: ResolvedCatalogMetadata;
  expiresAtMs: number;
}

export interface CatalogPipelineOptions {
  timeoutMs: number;
  dailyQuotaPerProvider: number;
  nowMs?: () => number;
  findInternalByIsbn13: (
    isbn13: string
  ) => Promise<ResolvedCatalogMetadata | null>;
  providers: Record<
    CatalogProviderId,
    (
      isbn13: string,
      signal: AbortSignal
    ) => Promise<ResolvedCatalogMetadata | null>
  >;
}

const POSITIVE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const NEGATIVE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function withTimeout<T>(
  promiseFactory: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Provider timeout"));
    }, timeoutMs);

    promiseFactory(controller.signal)
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export function createCatalogLookupPipeline(options: CatalogPipelineOptions) {
  const cache = new Map<string, CacheEntry>();
  const inflight = new Map<string, Promise<CatalogLookupResult>>();
  const quotaCounts = new Map<string, number>();
  const getNow = options.nowMs ?? (() => Date.now());

  function getQuotaKey(provider: CatalogProviderId): string {
    const day = new Date(getNow()).toISOString().slice(0, 10);
    return `${provider}:${day}`;
  }

  function canCallProvider(provider: CatalogProviderId): boolean {
    const used = quotaCounts.get(getQuotaKey(provider)) ?? 0;
    return used < options.dailyQuotaPerProvider;
  }

  function recordProviderCall(provider: CatalogProviderId): void {
    const key = getQuotaKey(provider);
    quotaCounts.set(key, (quotaCounts.get(key) ?? 0) + 1);
  }

  async function executeCascade(isbn13: string): Promise<CatalogLookupResult> {
    // 1. Internal catalog first (zero external requests)
    const internal = await options.findInternalByIsbn13(isbn13);
    if (internal) {
      return { status: "found", metadata: internal, cached: true };
    }

    // 2. External lookup cache
    const cached = cache.get(isbn13);
    const now = getNow();
    if (cached && cached.expiresAtMs > now) {
      if (cached.found && cached.metadata) {
        return { status: "found", metadata: cached.metadata, cached: true };
      }
      return { status: "manual_fallback", isbn13 };
    }

    // 3. External providers in priority order (§6.4)
    const providerOrder: CatalogProviderId[] = isBrazilianIsbn13(isbn13)
      ? ["brasilapi", "google_books", "open_library"]
      : ["google_books", "open_library", "brasilapi"];

    for (const providerId of providerOrder) {
      if (!canCallProvider(providerId)) {
        continue;
      }
      recordProviderCall(providerId);
      try {
        const result = await withTimeout(
          (signal) => options.providers[providerId](isbn13, signal),
          options.timeoutMs
        );
        if (result) {
          cache.set(isbn13, {
            found: true,
            metadata: result,
            expiresAtMs: getNow() + POSITIVE_TTL_MS,
          });
          return { status: "found", metadata: result, cached: false };
        }
      } catch {
        // Degrade gracefully to next provider
      }
    }

    cache.set(isbn13, {
      found: false,
      expiresAtMs: getNow() + NEGATIVE_TTL_MS,
    });

    return { status: "manual_fallback", isbn13 };
  }

  return {
    async lookupByIsbn(rawIsbn: string): Promise<CatalogLookupResult> {
      const normalized = normalizeToIsbn13(rawIsbn);
      if (!normalized) {
        return { status: "invalid_isbn" };
      }

      const existingInflight = inflight.get(normalized);
      if (existingInflight) {
        return existingInflight;
      }

      const promise = executeCascade(normalized).finally(() => {
        inflight.delete(normalized);
      });
      inflight.set(normalized, promise);
      return promise;
    },
  };
}
