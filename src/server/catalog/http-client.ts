const MOCKABLE_THIRD_PARTY_HOSTS = new Set([
  "www.googleapis.com",
  "books.google.com",
  "books.googleusercontent.com",
  "openlibrary.org",
  "covers.openlibrary.org",
  "archive.org",
  "brasilapi.com.br",
  "api.mercadoeditorial.org",
  "mercadoeditorial.org",
  "api.hardcover.app",
  "assets.hardcover.app",
  "img.hardcover.app",
  "hardcover.app",
  "itunes.apple.com",
  "m.media-amazon.com",
  "images-na.ssl-images-amazon.com",
  "http2.mlstatic.com",
  "storage.googleapis.com",
]);

const MOCKABLE_HOST_SUFFIXES = [
  ".archive.org",
  ".hardcover.app",
  ".mzstatic.com",
] as const;

function isMockableThirdPartyHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (MOCKABLE_THIRD_PARTY_HOSTS.has(lower)) return true;
  return MOCKABLE_HOST_SUFFIXES.some(
    (suffix) => lower.endsWith(suffix) && lower.length > suffix.length
  );
}

export function getActiveMockCatalogBaseUrl(): string | null {
  if (process.env.LOADTEST_ALLOW !== "1") return null;
  const raw = process.env.MOCK_CATALOG_BASE_URL?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
      return null;
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/**
 * Retorna a implementação de `fetch` para chamadas de catálogo e capas.
 * Quando `LOADTEST_ALLOW=1` e `MOCK_CATALOG_BASE_URL` estão definidos, redireciona
 * 100% das chamadas a Google Books, Open Library, Hardcover, Apple e BrasilAPI para
 * o servidor de mock local e bloqueia qualquer tráfego externo real.
 */
export function getCatalogFetch(customFetch?: typeof fetch): typeof fetch {
  if (customFetch) return customFetch;

  const mockBase = getActiveMockCatalogBaseUrl();
  if (!mockBase) return fetch;

  const mockOrigin = new URL(mockBase).origin;

  const mockedFetch: typeof fetch = async (input, init) => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const parsed = new URL(rawUrl);
    if (parsed.origin === mockOrigin) {
      return fetch(rawUrl, init);
    }

    if (isMockableThirdPartyHost(parsed.hostname)) {
      const proxiedUrl = `${mockBase}/proxy/${parsed.hostname}${parsed.pathname}${parsed.search}`;
      return fetch(proxiedUrl, init);
    }

    throw new Error(
      `[SAFETY ABORT] Chamada externa bloqueada durante teste de carga: ${rawUrl}`
    );
  };

  return mockedFetch;
}
