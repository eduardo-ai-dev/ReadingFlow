/**
 * Serviço de busca no navegador: consulta a rota interna (que fala com Google Books /
 * Open Library no servidor) e resolve a melhor capa disponível. Sem imports de servidor.
 */
import type {
  BookSearchResponse,
  BookSearchResult,
} from "@/features/catalog/search-types";
import { isBrazilianIsbn13, normalizeToIsbn13 } from "@/lib/isbn";

export class BookSearchHttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "BookSearchHttpError";
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** GET /api/catalog/search — o `signal` cancela também a consulta externa no servidor. */
export async function fetchBookSuggestions(
  query: string,
  signal: AbortSignal
): Promise<BookSearchResponse> {
  const res = await fetch(
    `/api/catalog/search?q=${encodeURIComponent(query)}`,
    { signal, headers: { Accept: "application/json" } }
  );
  if (!res.ok) {
    let message = "Não foi possível consultar a base online.";
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* corpo não-JSON: mantém a mensagem padrão */
    }
    throw new BookSearchHttpError(res.status, message);
  }
  return (await res.json()) as BookSearchResponse;
}

/**
 * Carrega a imagem e confirma que é uma capa real: `naturalWidth > 1` descarta o
 * pixel transparente 1x1; erro HTTP (ex.: 404 da Open Library com `default=false`),
 * bloqueio de CSP, timeout e cancelamento contam como falha.
 */
export function probeImage(
  url: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<boolean> {
  const { signal, timeoutMs = 6000 } = options;
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(false);
      return;
    }
    const image = new Image();
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      image.onload = null;
      image.onerror = null;
      resolve(ok);
    };
    const onAbort = () => {
      image.src = "";
      finish(false);
    };
    const timer = setTimeout(() => {
      image.src = "";
      finish(false);
    }, timeoutMs);

    signal?.addEventListener("abort", onAbort, { once: true });
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.onload = () => finish(image.naturalWidth > 1 && image.naturalHeight > 1);
    image.onerror = () => finish(false);
    image.src = url;
  });
}

async function fetchBrasilApiCover(
  isbn: string,
  signal?: AbortSignal
): Promise<string | null> {
  try {
    const res = await fetch(
      `/api/catalog/cover?isbn=${encodeURIComponent(isbn)}`,
      { signal, headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { coverUrl?: string | null };
    return body.coverUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * Percorre as candidatas (Google HD → Google → Open Library) e devolve a primeira
 * que carrega de fato. Se todas falharem e o ISBN for brasileiro (97885/97865),
 * consulta a BrasilAPI como último recurso. `null` quando não há capa.
 */
export async function resolveBestCover(
  result: Pick<BookSearchResult, "capas" | "isbn">,
  options: {
    signal?: AbortSignal;
    probe?: typeof probeImage;
    fetchBrasilApi?: typeof fetchBrasilApiCover;
  } = {}
): Promise<string | null> {
  const probe = options.probe ?? probeImage;
  const lookupBrasilApi = options.fetchBrasilApi ?? fetchBrasilApiCover;

  for (const candidate of result.capas) {
    if (options.signal?.aborted) return null;
    if (await probe(candidate, { signal: options.signal })) return candidate;
  }

  const isbn13 = result.isbn ? normalizeToIsbn13(result.isbn) : null;
  if (isbn13 && isBrazilianIsbn13(isbn13) && !options.signal?.aborted) {
    const brasilApiCover = await lookupBrasilApi(isbn13, options.signal);
    if (
      brasilApiCover &&
      (await probe(brasilApiCover, { signal: options.signal }))
    ) {
      return brasilApiCover;
    }
  }
  return null;
}
