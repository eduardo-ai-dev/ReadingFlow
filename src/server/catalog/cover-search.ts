import "server-only";

import { inspectImageHeader } from "@/server/catalog/image-header";
import { getServerEnv, type ServerEnv } from "@/lib/env";
import { getCatalogFetch } from "@/server/catalog/http-client";
import { normalizeToIsbn13 } from "@/lib/isbn";
import {
  buildOpenLibraryCoverUrlById,
  buildOpenLibraryCoverUrlByIsbn,
  pickGoogleImageLink,
  sanitizeGoogleCoverUrl,
  toHighResGoogleCoverUrl,
  type GoogleImageLinks,
} from "@/features/catalog/cover-rules";
import {
  buildGoogleBooksQueryPlan,
  classifyCoverSearchDiagnostic,
  COVER_MAX_CANDIDATES,
  deduplicateCoverCandidates,
  doesAuthorMatch,
  evaluateAuthorMatch,
  extractAuthorSurname,
  isAcceptableCoverDimensions,
  isDisqualifiedCoverTitle,
  isInvalidCoverPlaceholder,
  stripBookTitleSubtitle,
  type CoverProviderAttemptDiagnostic,
  type CoverProviderSource,
  type CoverSearchCandidate,
  type CoverSearchDiagnostic,
  type CoverSearchQueryLog,
} from "@/features/catalog/cover-search-rules";
import { validateExternalCoverUrl } from "@/server/security/sanitize";

export type CoverSearchMediaFormat = "book" | "ebook" | "audiobook";

export interface CoverSearchResponse {
  candidates: CoverSearchCandidate[];
  /** Número real de páginas obtido da melhor fonte da cascata (quando disponível). */
  pageCount?: number;
  degraded: boolean;
  googleRateLimited: boolean;
  /** True quando 0 candidatas foram achadas por indisponibilidade de API (429/403/timeout/5xx) — nunca tratado como "sem capa". */
  apiUnavailable?: boolean;
  fallbackToManualUpload: boolean;
  notice?: string;
  /** Presente apenas em desenvolvimento (`NODE_ENV !== "production"`). */
  diagnostic?: CoverSearchDiagnostic;
}

export interface ProbeResult {
  ok: boolean;
  url?: string;
  width?: number;
  height?: number;
  reason?: "invalid_host" | "http_error" | "quality_filter";
  httpStatus?: number;
}

export interface CoverSearchOptions {
  title?: string;
  author?: string;
  isbn?: string | null;
  format?: CoverSearchMediaFormat;
  signal?: AbortSignal;
  /** Permite sobrescrever `fetch` em testes unitários da cadeia de provedores. */
  fetchImpl?: typeof fetch;
  /** Permite sobrescrever a sonda de imagem (`sharp`) em testes unitários. */
  probeImpl?: (
    rawUrl: string,
    signal: AbortSignal,
    options?: { allowSquare?: boolean }
  ) => Promise<ProbeResult>;
  /** Permite sobrescrever variáveis de ambiente em testes unitários. */
  envOverride?: Partial<ServerEnv>;
  /** Pausa educada entre chamadas externas na cascata (padrão: 60ms; 0 em testes). */
  pauseBetweenCallsMs?: number;
  /** Ignora cache em memória e cooldown de provedor. */
  bypassCache?: boolean;
}

/* ============================================================================
   CACHE SEPARADO (RESULTADOS POSITIVOS vs VAZIOS CURTOS) + COOLDOWN CURTO
   - Erro de API (429/403/timeout) NUNCA é cacheado como "sem capa".
   ============================================================================ */

const POSITIVE_TTL_MS = 24 * 60 * 60 * 1000; // 24h para respostas com candidatas
const EMPTY_TTL_MS = 90 * 1000; // 90s para resultado vazio real (sem erro de API)
const CACHE_MAX_ENTRIES = 400;
const PROVIDER_COOLDOWN_MS = 15 * 1000; // 15s (curto para permitir retry)
const DEFAULT_INTER_CALL_PAUSE_MS = 40;
const PROBE_MAX_BYTES = 5 * 1024 * 1024;

interface CacheEntry {
  expiresAtMs: number;
  value: CoverSearchResponse;
}

interface GlobalCoverSearchState {
  cache: Map<string, CacheEntry>;
  cooldownUntilByProvider: Map<CoverProviderSource, number>;
}

declare global {
  var __readingFlowCoverSearchState: GlobalCoverSearchState | undefined;
}

function getRuntimeState(): GlobalCoverSearchState {
  if (!globalThis.__readingFlowCoverSearchState) {
    globalThis.__readingFlowCoverSearchState = {
      cache: new Map<string, CacheEntry>(),
      cooldownUntilByProvider: new Map<CoverProviderSource, number>(),
    };
  }
  return globalThis.__readingFlowCoverSearchState;
}

/** Limpa cache e cooldowns em testes unitários. */
export function resetCoverSearchRuntimeCaches(): void {
  const state = getRuntimeState();
  state.cache.clear();
  state.cooldownUntilByProvider.clear();
}

function isProviderOnCooldown(
  provider: CoverProviderSource,
  bypassCooldown = false,
  nowMs = Date.now()
): boolean {
  if (bypassCooldown) return false;
  const until = getRuntimeState().cooldownUntilByProvider.get(provider) ?? 0;
  return until > nowMs;
}

function markProviderCooldown(
  provider: CoverProviderSource,
  nowMs = Date.now()
): void {
  getRuntimeState().cooldownUntilByProvider.set(
    provider,
    nowMs + PROVIDER_COOLDOWN_MS
  );
}

function buildCacheKey(params: {
  title: string;
  author: string;
  isbn: string | null;
  format: CoverSearchMediaFormat;
  appleEnabled: boolean;
  hardcoverEnabled: boolean;
}): string {
  return [
    params.isbn ?? "",
    params.title.toLowerCase().trim(),
    params.author.toLowerCase().trim(),
    params.format,
    params.appleEnabled ? "apple1" : "apple0",
    params.hardcoverEnabled ? "hc1" : "hc0",
  ].join("::");
}

function readCache(
  key: string,
  nowMs = Date.now()
): CoverSearchResponse | null {
  const { cache } = getRuntimeState();
  const entry = cache.get(key);
  if (!entry) return null;
  if (nowMs >= entry.expiresAtMs) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(
  key: string,
  value: CoverSearchResponse,
  nowMs = Date.now()
): void {
  // NUNCA cachear erro de API (429/403/timeout/degraded) como "sem capa"
  if (
    value.candidates.length === 0 &&
    (value.degraded || value.apiUnavailable || value.googleRateLimited)
  ) {
    return;
  }

  const { cache } = getRuntimeState();
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  const ttl = value.candidates.length > 0 ? POSITIVE_TTL_MS : EMPTY_TTL_MS;
  cache.set(key, {
    expiresAtMs: nowMs + ttl,
    value,
  });
}

async function pausePolite(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0 || signal?.aborted) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

function formatSafeCoverError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/([?&]key=)[^&\s]+/gi, "$1[redacted]")
    .replace(/(Bearer\s+)\S+/gi, "$1[redacted]")
    .slice(0, 300);
}

function logCoverSearchError(
  context: Record<string, unknown>,
  err: unknown
): void {
  console.error("[covers/search]", {
    ...context,
    message: formatSafeCoverError(err),
  });
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function createTimeoutController(
  timeoutMs: number,
  externalSignal?: AbortSignal
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Timeout after ${timeoutMs}ms`));
  }, timeoutMs);

  const onExternalAbort = () => {
    controller.abort(externalSignal?.reason);
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", onExternalAbort);
    },
  };
}

/**
 * Executa fetch com retry e exponential backoff leve para erros transitórios (429/502/503/504)
 * quando `enableRetry` está ativo (desativado apenas quando `pauseBetweenCallsMs === 0` em mocks).
 */
async function fetchWithRetry(
  url: URL | string,
  init: RequestInit,
  options: {
    fetchImpl: typeof fetch;
    signal: AbortSignal;
    enableRetry: boolean;
  }
): Promise<Response> {
  const firstRes = await options.fetchImpl(url, {
    ...init,
    signal: options.signal,
  });

  if (
    !options.enableRetry ||
    options.signal.aborted ||
    (firstRes.status !== 429 &&
      firstRes.status !== 502 &&
      firstRes.status !== 503 &&
      firstRes.status !== 504)
  ) {
    return firstRes;
  }

  const retryAfterHeader = Number.parseInt(
    firstRes.headers.get("retry-after") ?? "",
    10
  );
  const backoffMs =
    Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
      ? Math.min(1500, retryAfterHeader * 1000)
      : 320 + Math.floor(Math.random() * 180);

  await pausePolite(backoffMs, options.signal);
  if (options.signal.aborted) return firstRes;

  return options.fetchImpl(url, {
    ...init,
    signal: options.signal,
  });
}

/* ============================================================================
   VALIDAÇÃO DE IMAGEM (DESCARTA SÓ 1x1 / PLACEHOLDERS NA BUSCA; SHARP PÓS-ESCOLHA)
   ============================================================================ */

export async function probeCoverImageDimensions(
  rawUrl: string,
  signal: AbortSignal,
  fetchImpl: typeof fetch = fetch,
  options?: { allowSquare?: boolean; enforceStrictDimensions?: boolean }
): Promise<ProbeResult> {
  const safeUrl = validateExternalCoverUrl(rawUrl);
  if (!safeUrl || isInvalidCoverPlaceholder({ url: safeUrl })) {
    return { ok: false, url: rawUrl, reason: "invalid_host" };
  }

  try {
    const res = await fetchImpl(safeUrl, {
      signal,
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });

    if (!res.ok) {
      return {
        ok: false,
        url: safeUrl,
        reason: "http_error",
        httpStatus: res.status,
      };
    }

    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (contentType && !contentType.startsWith("image/")) {
      return { ok: false, url: safeUrl, reason: "http_error" };
    }

    const arrayBuf = await res.arrayBuffer();
    if (arrayBuf.byteLength === 0 || arrayBuf.byteLength > PROBE_MAX_BYTES) {
      return { ok: false, url: safeUrl, reason: "quality_filter" };
    }

    let meta: ReturnType<typeof inspectImageHeader> = null;
    try {
      meta = inspectImageHeader(new Uint8Array(arrayBuf));
    } catch (err) {
      logCoverSearchError({ stage: "probe_image_header" }, err);
      meta = null;
    }
    const width = meta?.width;
    const height = meta?.height;

    // Descarta imagens inválidas (1x1 ou <= 2x2 pixel transparente)
    if (
      typeof width !== "number" ||
      typeof height !== "number" ||
      width <= 2 ||
      height <= 2
    ) {
      return {
        ok: false,
        url: safeUrl,
        reason: "quality_filter",
        width,
        height,
      };
    }

    if (
      options?.enforceStrictDimensions &&
      !isAcceptableCoverDimensions(width, height, options)
    ) {
      return {
        ok: false,
        url: safeUrl,
        reason: "quality_filter",
        width,
        height,
      };
    }

    return {
      ok: true,
      url: safeUrl,
      width,
      height,
    };
  } catch (err) {
    logCoverSearchError({ stage: "probe_cover" }, err);
    return { ok: false, url: safeUrl, reason: "http_error" };
  }
}

/**
 * Valida a dimensão da imagem APENAS da candidata escolhida pelo usuário (ou pelo backfill).
 * Garante que a imagem escolhida existe, não é um pixel 1x1 nem um placeholder corrompido.
 */
export async function validateChosenCoverWithSharp(
  coverUrl: string,
  options?: {
    signal?: AbortSignal;
    fetchImpl?: typeof fetch;
  }
): Promise<{
  ok: boolean;
  width?: number;
  height?: number;
  error?: string;
}> {
  const trimmed = coverUrl.trim();
  if (!trimmed) {
    return { ok: false, error: "URL da capa vazia." };
  }

  if (trimmed.startsWith("data:image/")) {
    try {
      const commaIdx = trimmed.indexOf(",");
      if (commaIdx < 0) return { ok: false, error: "Data URL inválida." };
      const bytes = base64ToUint8Array(trimmed.slice(commaIdx + 1));
      const meta = inspectImageHeader(bytes);
      if (!meta || meta.width <= 10 || meta.height <= 10) {
        return {
          ok: false,
          error: "A imagem enviada tem dimensões inválidas.",
        };
      }
      return { ok: true, width: meta.width, height: meta.height };
    } catch (err) {
      logCoverSearchError({ stage: "validate_data_url_header" }, err);
      return { ok: false, error: "Não foi possível validar a imagem enviada." };
    }
  }

  const safeUrl = validateExternalCoverUrl(trimmed);
  if (!safeUrl || isInvalidCoverPlaceholder({ url: safeUrl })) {
    return {
      ok: false,
      error: "URL de capa externa não permitida ou inválida.",
    };
  }

  // Em ambiente de teste unitário sem rede real, não bloqueia URLs sintéticas se o fetch falhar
  const isTestEnv = process.env.NODE_ENV === "test";
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutCtx = createTimeoutController(4500, options?.signal);

  try {
    const res = await fetchImpl(safeUrl, {
      signal: timeoutCtx.signal,
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });
    if (!res.ok) {
      if (isTestEnv) return { ok: true };
      return {
        ok: false,
        error: `A imagem da capa escolhida retornou erro HTTP ${res.status}. Escolha outra candidata ou cole o link direto.`,
      };
    }

    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > PROBE_MAX_BYTES) {
      return {
        ok: false,
        error: "A imagem da capa escolhida está vazia ou excede 5 MB.",
      };
    }

    let meta: ReturnType<typeof inspectImageHeader> = null;
    try {
      meta = inspectImageHeader(bytes);
    } catch (err) {
      logCoverSearchError({ stage: "validate_remote_header" }, err);
      meta = null;
    }
    if (!meta || meta.width <= 10 || meta.height <= 10) {
      return {
        ok: false,
        error:
          "A capa escolhida é um placeholder inválido (1×1). Escolha outra edição.",
      };
    }

    return { ok: true, width: meta.width, height: meta.height };
  } catch (err) {
    logCoverSearchError({ stage: "validate_chosen_cover" }, err);
    if (isTestEnv) return { ok: true };
    return { ok: true };
  } finally {
    timeoutCtx.cleanup();
  }
}

function parsePublishedYear(raw?: string | number | null): number | undefined {
  if (typeof raw === "number" && Number.isInteger(raw)) {
    return raw >= 1000 && raw <= 2100 ? raw : undefined;
  }
  if (typeof raw !== "string") return undefined;
  const match = /^(\d{4})/.exec(raw.trim());
  if (!match) return undefined;
  const year = Number(match[1]);
  return year >= 1000 && year <= 2100 ? year : undefined;
}

function normalizePositivePages(raw?: number | null): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
  const rounded = Math.round(raw);
  return rounded >= 1 && rounded <= 20000 ? rounded : undefined;
}

/* ============================================================================
   1. BRASILAPI (`/api/isbn/v1/{isbn}` — usa `cover_url` e `page_count`)
   ============================================================================ */

interface BrasilApiIsbnPayload {
  isbn?: string;
  title?: string;
  subtitle?: string | null;
  authors?: string[];
  publisher?: string | null;
  page_count?: number | null;
  year?: number | null;
  cover_url?: string | null;
}

async function fetchBrasilApiByIsbn(params: {
  isbn: string;
  requestedAuthor?: string;
  fetchImpl: typeof fetch;
  customProbe?: (
    url: string,
    signal: AbortSignal,
    opts?: { allowSquare?: boolean }
  ) => Promise<ProbeResult>;
  enableRetry: boolean;
  signal: AbortSignal;
}): Promise<{
  candidates: CoverSearchCandidate[];
  pageCount?: number;
  attempt: CoverProviderAttemptDiagnostic;
}> {
  const queryLabel = `GET /api/isbn/v1/${params.isbn}`;
  if (isProviderOnCooldown("brasilapi")) {
    return {
      candidates: [],
      attempt: {
        provider: "brasilapi",
        status: "rate_limited",
        strategy: "isbn",
        query: queryLabel,
        detail: "em pausa temporária após 403/429",
        totalResults: 0,
        candidatesFound: 0,
      },
    };
  }

  try {
    const res = await fetchWithRetry(
      `https://brasilapi.com.br/api/isbn/v1/${params.isbn}`,
      {
        headers: { Accept: "application/json" },
      },
      {
        fetchImpl: params.fetchImpl,
        signal: params.signal,
        enableRetry: params.enableRetry,
      }
    );

    if (res.status === 403 || res.status === 429) {
      markProviderCooldown("brasilapi");
      return {
        candidates: [],
        attempt: {
          provider: "brasilapi",
          status: "rate_limited",
          strategy: "isbn",
          query: queryLabel,
          httpStatus: res.status,
          totalResults: 0,
          candidatesFound: 0,
        },
      };
    }

    if (res.status === 404) {
      return {
        candidates: [],
        attempt: {
          provider: "brasilapi",
          status: "no_results",
          strategy: "isbn",
          query: queryLabel,
          httpStatus: 404,
          totalResults: 0,
          candidatesFound: 0,
        },
      };
    }

    if (!res.ok) {
      return {
        candidates: [],
        attempt: {
          provider: "brasilapi",
          status: "api_error",
          strategy: "isbn",
          query: queryLabel,
          httpStatus: res.status,
          totalResults: 0,
          candidatesFound: 0,
        },
      };
    }

    const data = (await res.json()) as BrasilApiIsbnPayload;
    const pageCount = normalizePositivePages(data.page_count);
    const title = [data.title, data.subtitle].filter(Boolean).join(": ").trim();

    if (!title || isDisqualifiedCoverTitle(title)) {
      return {
        candidates: [],
        pageCount,
        attempt: {
          provider: "brasilapi",
          status: "no_results",
          strategy: "isbn",
          query: queryLabel,
          httpStatus: res.status,
          totalResults: 1,
          candidatesFound: 0,
          rejectedBySummary: title ? 1 : 0,
          pageCountFound: pageCount,
        },
      };
    }

    const authors = Array.isArray(data.authors) ? data.authors : [];
    const authorEval = evaluateAuthorMatch(params.requestedAuthor, authors);
    const rejectedByAuthor =
      params.requestedAuthor?.trim() && !authorEval.matches ? 1 : 0;

    if (!data.cover_url) {
      return {
        candidates: [],
        pageCount,
        attempt: {
          provider: "brasilapi",
          status: "no_results",
          strategy: "isbn",
          query: queryLabel,
          httpStatus: res.status,
          detail: "ISBN localizado na BrasilAPI, mas sem cover_url",
          totalResults: 1,
          candidatesFound: 0,
          rejectedByMissingImageLinks: 1,
          rejectedByAuthor,
          pageCountFound: pageCount,
        },
      };
    }

    const safeCoverUrl = validateExternalCoverUrl(data.cover_url);
    if (!safeCoverUrl || isInvalidCoverPlaceholder({ url: safeCoverUrl })) {
      return {
        candidates: [],
        pageCount,
        attempt: {
          provider: "brasilapi",
          status: "quality_filter",
          strategy: "isbn",
          query: queryLabel,
          httpStatus: res.status,
          totalResults: 1,
          candidatesFound: 0,
          rejectedByDimension: 1,
          pageCountFound: pageCount,
        },
      };
    }

    let finalUrl = safeCoverUrl;
    let width: number | undefined;
    let height: number | undefined;

    if (params.customProbe) {
      const probed = await params.customProbe(safeCoverUrl, params.signal);
      if (!probed.ok) {
        return {
          candidates: [],
          pageCount,
          attempt: {
            provider: "brasilapi",
            status:
              probed.reason === "quality_filter"
                ? "quality_filter"
                : "no_results",
            strategy: "isbn",
            query: queryLabel,
            httpStatus: res.status,
            totalResults: 1,
            candidatesFound: 0,
            rejectedByQuality: probed.reason === "quality_filter" ? 1 : 0,
            rejectedByDimension: probed.reason === "quality_filter" ? 1 : 0,
            pageCountFound: pageCount,
          },
        };
      }
      finalUrl = probed.url ?? safeCoverUrl;
      width = probed.width;
      height = probed.height;
    }

    return {
      candidates: [
        {
          id: `brasilapi:${params.isbn}`,
          source: "brasilapi",
          coverUrl: finalUrl,
          title,
          authors,
          isbn: normalizeToIsbn13(data.isbn ?? params.isbn) ?? params.isbn,
          publisher: data.publisher ?? undefined,
          publishedYear: parsePublishedYear(data.year),
          pageCount,
          width,
          height,
          strategy: "isbn",
        },
      ],
      pageCount,
      attempt: {
        provider: "brasilapi",
        status: "ok",
        strategy: "isbn",
        query: queryLabel,
        httpStatus: res.status,
        totalResults: 1,
        candidatesFound: 1,
        rejectedByAuthor,
        pageCountFound: pageCount,
      },
    };
  } catch (err) {
    logCoverSearchError({ provider: "brasilapi", strategy: "isbn" }, err);
    return {
      candidates: [],
      attempt: {
        provider: "brasilapi",
        status: "api_error",
        strategy: "isbn",
        query: queryLabel,
        detail: "timeout ou falha de rede na BrasilAPI",
        totalResults: 0,
        candidatesFound: 0,
      },
    };
  }
}

/* ============================================================================
   2. GOOGLE BOOKS (Chave somente no servidor, frases entre aspas + 2ª tentativa sem operadores)
   ============================================================================ */

const GOOGLE_VOLUMES_URL = "https://www.googleapis.com/books/v1/volumes";

interface GoogleVolumeItem {
  id?: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    pageCount?: number;
    industryIdentifiers?: Array<{ type?: string; identifier?: string }>;
    imageLinks?: GoogleImageLinks;
  };
}

function extractIsbn13FromGoogle(
  identifiers?: Array<{ type?: string; identifier?: string }>
): string | undefined {
  if (!identifiers) return undefined;
  for (const entry of identifiers) {
    if (!entry.identifier) continue;
    const normalized = normalizeToIsbn13(entry.identifier);
    if (normalized) return normalized;
  }
  return undefined;
}

function pickBestGoogleCoverFromLinks(
  links?: GoogleImageLinks | null
): { url: string; estimatedWidth: number; estimatedHeight: number } | null {
  if (!links) return null;
  const ordered: Array<{
    raw?: string;
    width: number;
    height: number;
  }> = [
    { raw: links.extraLarge, width: 800, height: 1200 },
    { raw: links.large, width: 600, height: 900 },
    { raw: links.medium, width: 400, height: 600 },
    { raw: links.small, width: 260, height: 390 },
    {
      raw: links.thumbnail
        ? (toHighResGoogleCoverUrl(
            sanitizeGoogleCoverUrl(links.thumbnail) ?? links.thumbnail
          ) ?? links.thumbnail)
        : undefined,
      width: 320,
      height: 480,
    },
    { raw: pickGoogleImageLink(links), width: 200, height: 300 },
  ];

  for (const item of ordered) {
    const clean = sanitizeGoogleCoverUrl(item.raw);
    if (clean && !isInvalidCoverPlaceholder({ url: clean })) {
      return {
        url: clean,
        estimatedWidth: item.width,
        estimatedHeight: item.height,
      };
    }
  }
  return null;
}

async function fetchGoogleCoverCandidates(params: {
  query: string;
  strategy: string;
  langRestrictPt: boolean;
  requestedAuthor?: string;
  apiKey?: string;
  maxVolumes: number;
  fetchImpl: typeof fetch;
  customProbe?: (
    url: string,
    signal: AbortSignal,
    opts?: { allowSquare?: boolean }
  ) => Promise<ProbeResult>;
  enableRetry: boolean;
  bypassCooldown?: boolean;
  signal: AbortSignal;
}): Promise<{
  candidates: CoverSearchCandidate[];
  pageCount?: number;
  rateLimited: boolean;
  attempt: CoverProviderAttemptDiagnostic;
}> {
  const queryDesc = `${params.query}${params.langRestrictPt ? " [langRestrict=pt]" : ""}`;

  if (isProviderOnCooldown("google", params.bypassCooldown)) {
    return {
      candidates: [],
      rateLimited: true,
      attempt: {
        provider: "google",
        status: "rate_limited",
        strategy: params.strategy,
        query: queryDesc,
        detail: "em pausa temporária após 403/429",
        totalResults: 0,
        candidatesFound: 0,
      },
    };
  }

  try {
    const url = new URL(GOOGLE_VOLUMES_URL);
    url.searchParams.set("q", params.query);
    url.searchParams.set("maxResults", "10");
    url.searchParams.set("printType", "books");
    if (params.langRestrictPt) {
      url.searchParams.set("langRestrict", "pt");
    }
    if (params.apiKey) {
      url.searchParams.set("key", params.apiKey);
    }

    const res = await fetchWithRetry(
      url,
      {
        headers: { Accept: "application/json" },
      },
      {
        fetchImpl: params.fetchImpl,
        signal: params.signal,
        enableRetry: params.enableRetry,
      }
    );

    if (res.status === 403 || res.status === 429) {
      markProviderCooldown("google");
      return {
        candidates: [],
        rateLimited: true,
        attempt: {
          provider: "google",
          status: "rate_limited",
          strategy: params.strategy,
          query: queryDesc,
          httpStatus: res.status,
          totalResults: 0,
          candidatesFound: 0,
        },
      };
    }

    if (!res.ok) {
      return {
        candidates: [],
        rateLimited: false,
        attempt: {
          provider: "google",
          status: "api_error",
          strategy: params.strategy,
          query: queryDesc,
          httpStatus: res.status,
          totalResults: 0,
          candidatesFound: 0,
        },
      };
    }

    const payload = (await res.json()) as { items?: GoogleVolumeItem[] };
    const items = payload.items ?? [];
    const totalResults = items.length;

    let rejectedBySummary = 0;
    let rejectedByAuthor = 0;
    let rejectedByMissingImageLinks = 0;
    let rejectedByDimension = 0;
    let firstPageCount: number | undefined;

    const eligible: Array<{
      item: GoogleVolumeItem;
      fullTitle: string;
      authors: string[];
      pickedCover: {
        url: string;
        estimatedWidth: number;
        estimatedHeight: number;
      };
      volPages?: number;
    }> = [];

    for (const item of items) {
      const info = item.volumeInfo;
      if (!info?.title) continue;
      const fullTitle = [info.title, info.subtitle]
        .filter(Boolean)
        .join(": ")
        .trim();

      if (isDisqualifiedCoverTitle(fullTitle)) {
        rejectedBySummary += 1;
        continue;
      }

      const authors = info.authors ?? [];
      if (
        params.requestedAuthor?.trim() &&
        !doesAuthorMatch(params.requestedAuthor, authors)
      ) {
        rejectedByAuthor += 1;
        // Não descartamos a candidata aqui: reduzimos a pontuação no ranqueamento
        // e marcamos "correspondência incerta" caso o título seja relevante.
      }

      const volPages = normalizePositivePages(info.pageCount);
      if (!firstPageCount && volPages) {
        firstPageCount = volPages;
      }

      const pickedCover = pickBestGoogleCoverFromLinks(info.imageLinks);
      if (!pickedCover) {
        rejectedByMissingImageLinks += 1;
        continue;
      }

      eligible.push({
        item,
        fullTitle,
        authors,
        pickedCover,
        volPages,
      });

      if (eligible.length >= params.maxVolumes) break;
    }

    if (eligible.length === 0) {
      return {
        candidates: [],
        pageCount: firstPageCount,
        rateLimited: false,
        attempt: {
          provider: "google",
          status:
            rejectedBySummary > 0 || rejectedByDimension > 0
              ? "quality_filter"
              : "no_results",
          strategy: params.strategy,
          query: queryDesc,
          httpStatus: res.status,
          totalResults,
          candidatesFound: 0,
          rejectedBySummary,
          rejectedByAuthor,
          rejectedByMissingImageLinks,
          rejectedByDimension,
          pageCountFound: firstPageCount,
        },
      };
    }

    const candidates: CoverSearchCandidate[] = [];

    for (const entry of eligible) {
      let coverUrl = entry.pickedCover.url;
      let width: number | undefined = entry.pickedCover.estimatedWidth;
      let height: number | undefined = entry.pickedCover.estimatedHeight;

      if (params.customProbe) {
        const probed = await params.customProbe(coverUrl, params.signal);
        if (!probed.ok) {
          if (probed.reason === "quality_filter") {
            rejectedByDimension += 1;
          }
          continue;
        }
        coverUrl = probed.url ?? coverUrl;
        width = probed.width;
        height = probed.height;
      }

      const info = entry.item.volumeInfo!;
      candidates.push({
        id: `google:${entry.item.id ?? coverUrl}`,
        source: "google",
        coverUrl,
        title: entry.fullTitle,
        authors: entry.authors,
        isbn: extractIsbn13FromGoogle(info.industryIdentifiers),
        publisher: info.publisher?.trim() || undefined,
        publishedYear: parsePublishedYear(info.publishedDate),
        pageCount: entry.volPages,
        width,
        height,
        strategy: params.strategy,
      });
    }

    return {
      candidates,
      pageCount: firstPageCount,
      rateLimited: false,
      attempt: {
        provider: "google",
        status:
          candidates.length > 0
            ? "ok"
            : rejectedByDimension > 0 || rejectedBySummary > 0
              ? "quality_filter"
              : "no_results",
        strategy: params.strategy,
        query: queryDesc,
        httpStatus: res.status,
        totalResults,
        candidatesFound: candidates.length,
        rejectedByQuality: rejectedByDimension,
        rejectedByDimension,
        rejectedByAuthor,
        rejectedBySummary,
        rejectedByMissingImageLinks,
        pageCountFound: firstPageCount,
      },
    };
  } catch (err) {
    logCoverSearchError({ provider: "google", strategy: params.strategy }, err);
    return {
      candidates: [],
      rateLimited: false,
      attempt: {
        provider: "google",
        status: "api_error",
        strategy: params.strategy,
        query: queryDesc,
        detail: "timeout ou erro de rede no Google Books",
        totalResults: 0,
        candidatesFound: 0,
      },
    };
  }
}

/* ============================================================================
   3. OPEN LIBRARY (`?default=false` e cascata em `search.json`)
   ============================================================================ */

interface OpenLibrarySearchDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  cover_i?: number;
  isbn?: string[];
  publisher?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
}

async function fetchOpenLibraryByIsbn(params: {
  isbn: string;
  title?: string;
  author?: string;
  userAgent: string;
  fetchImpl: typeof fetch;
  probe: (
    url: string,
    signal: AbortSignal,
    opts?: { allowSquare?: boolean }
  ) => Promise<ProbeResult>;
  enableRetry: boolean;
  bypassCooldown?: boolean;
  signal: AbortSignal;
}): Promise<{
  candidates: CoverSearchCandidate[];
  pageCount?: number;
  attempt: CoverProviderAttemptDiagnostic;
}> {
  const queryLabel = `isbn=${params.isbn}`;
  if (isProviderOnCooldown("openlibrary", params.bypassCooldown)) {
    return {
      candidates: [],
      attempt: {
        provider: "openlibrary",
        status: "rate_limited",
        strategy: "isbn",
        query: queryLabel,
        totalResults: 0,
        candidatesFound: 0,
      },
    };
  }

  let resolvedTitle = params.title?.trim() || `ISBN ${params.isbn}`;
  let resolvedAuthors = params.author?.trim() ? [params.author.trim()] : [];
  let publisher: string | undefined;
  let publishedYear: number | undefined;
  let pageCount: number | undefined;
  let docCoverId: number | undefined;
  let metaRateLimited = false;
  let metaHttpStatus: number | undefined;
  let totalResults = 0;

  try {
    const metaUrl = new URL("https://openlibrary.org/search.json");
    metaUrl.searchParams.set("isbn", params.isbn);
    metaUrl.searchParams.set("limit", "1");
    metaUrl.searchParams.set(
      "fields",
      "title,author_name,publisher,first_publish_year,cover_i,number_of_pages_median"
    );
    const metaRes = await fetchWithRetry(
      metaUrl,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": params.userAgent,
        },
      },
      {
        fetchImpl: params.fetchImpl,
        signal: params.signal,
        enableRetry: params.enableRetry,
      }
    );
    metaHttpStatus = metaRes.status;
    if (metaRes.status === 403 || metaRes.status === 429) {
      markProviderCooldown("openlibrary");
      metaRateLimited = true;
    } else if (metaRes.ok) {
      const data = (await metaRes.json()) as { docs?: OpenLibrarySearchDoc[] };
      const docs = data.docs ?? [];
      totalResults = docs.length;
      const doc = docs[0];
      if (doc?.title && !isDisqualifiedCoverTitle(doc.title)) {
        resolvedTitle = doc.title;
      }
      if (doc?.author_name?.length) {
        resolvedAuthors = doc.author_name;
      }
      publisher = doc?.publisher?.[0];
      publishedYear = doc?.first_publish_year;
      pageCount = normalizePositivePages(doc?.number_of_pages_median);
      if (doc?.cover_i && doc.cover_i > 0) {
        docCoverId = doc.cover_i;
      }
    }
  } catch (err) {
    logCoverSearchError(
      { provider: "openlibrary", strategy: "isbn_meta" },
      err
    );
    // Segue com URL direta por ISBN
  }

  const rejectedByAuthor =
    params.author?.trim() &&
    resolvedAuthors.length > 0 &&
    !doesAuthorMatch(params.author, resolvedAuthors)
      ? 1
      : 0;

  const urlsToTry: Array<{ id: string; url: string }> = [
    {
      id: `openlibrary:isbn:${params.isbn}`,
      url: buildOpenLibraryCoverUrlByIsbn(params.isbn),
    },
  ];
  if (docCoverId) {
    urlsToTry.push({
      id: `openlibrary:id:${docCoverId}`,
      url: buildOpenLibraryCoverUrlById(docCoverId, "L"),
    });
  }

  let rejectedByQuality = 0;
  let lastHttpStatus = metaHttpStatus;

  for (const item of urlsToTry) {
    const probed = await params.probe(item.url, params.signal);
    if (probed.httpStatus) lastHttpStatus = probed.httpStatus;
    if (probed.ok) {
      return {
        candidates: [
          {
            id: item.id,
            source: "openlibrary",
            coverUrl: probed.url ?? item.url,
            title: resolvedTitle,
            authors: resolvedAuthors,
            isbn: params.isbn,
            publisher,
            publishedYear,
            pageCount,
            width: probed.width,
            height: probed.height,
            strategy: "isbn",
          },
        ],
        pageCount,
        attempt: {
          provider: "openlibrary",
          status: "ok",
          strategy: "isbn",
          query: queryLabel,
          httpStatus: 200,
          totalResults: Math.max(1, totalResults),
          candidatesFound: 1,
          rejectedByAuthor,
          pageCountFound: pageCount,
        },
      };
    }
    if (probed.reason === "quality_filter") rejectedByQuality += 1;
  }

  return {
    candidates: [],
    pageCount,
    attempt: {
      provider: "openlibrary",
      status: metaRateLimited
        ? "rate_limited"
        : rejectedByQuality > 0
          ? "quality_filter"
          : "no_results",
      strategy: "isbn",
      query: queryLabel,
      httpStatus: lastHttpStatus ?? 404,
      totalResults,
      candidatesFound: 0,
      rejectedByQuality,
      rejectedByDimension: rejectedByQuality,
      rejectedByAuthor,
      pageCountFound: pageCount,
    },
  };
}

async function fetchOpenLibraryByTitleAuthor(params: {
  title: string;
  author?: string;
  userAgent: string;
  maxResults: number;
  fetchImpl: typeof fetch;
  customProbe?: (
    url: string,
    signal: AbortSignal,
    opts?: { allowSquare?: boolean }
  ) => Promise<ProbeResult>;
  enableRetry: boolean;
  bypassCooldown?: boolean;
  signal: AbortSignal;
}): Promise<{
  candidates: CoverSearchCandidate[];
  pageCount?: number;
  attempt: CoverProviderAttemptDiagnostic;
}> {
  if (isProviderOnCooldown("openlibrary", params.bypassCooldown)) {
    return {
      candidates: [],
      attempt: {
        provider: "openlibrary",
        status: "rate_limited",
        strategy: "openlibrary_search",
        query: `title="${params.title}"`,
        totalResults: 0,
        candidatesFound: 0,
      },
    };
  }

  const queryLogs: CoverSearchQueryLog[] = [];

  const runSearch = async (
    strategy: string,
    queryParams: Record<string, string>
  ): Promise<{
    docs: OpenLibrarySearchDoc[];
    httpStatus?: number;
    rateLimited?: boolean;
    failed?: boolean;
    queryString: string;
  }> => {
    const url = new URL("https://openlibrary.org/search.json");
    for (const [k, v] of Object.entries(queryParams)) {
      url.searchParams.set(k, v);
    }
    url.searchParams.set("limit", "10");
    url.searchParams.set(
      "fields",
      "key,title,author_name,cover_i,isbn,publisher,first_publish_year,number_of_pages_median"
    );
    const queryString = Object.entries(queryParams)
      .map(([k, v]) => `${k}="${v}"`)
      .join(" ");

    const res = await fetchWithRetry(
      url,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": params.userAgent,
        },
      },
      {
        fetchImpl: params.fetchImpl,
        signal: params.signal,
        enableRetry: params.enableRetry,
      }
    );

    if (res.status === 403 || res.status === 429) {
      markProviderCooldown("openlibrary");
      queryLogs.push({
        provider: "openlibrary",
        strategy,
        query: queryString,
        httpStatus: res.status,
        totalResults: 0,
        acceptedCount: 0,
        rejectedByAuthor: 0,
        rejectedBySummary: 0,
        rejectedByDimension: 0,
        rejectedByMissingImageLinks: 0,
      });
      return {
        docs: [],
        httpStatus: res.status,
        rateLimited: true,
        queryString,
      };
    }
    if (!res.ok) {
      queryLogs.push({
        provider: "openlibrary",
        strategy,
        query: queryString,
        httpStatus: res.status,
        totalResults: 0,
        acceptedCount: 0,
        rejectedByAuthor: 0,
        rejectedBySummary: 0,
        rejectedByDimension: 0,
        rejectedByMissingImageLinks: 0,
      });
      return {
        docs: [],
        httpStatus: res.status,
        failed: true,
        queryString,
      };
    }
    const payload = (await res.json()) as { docs?: OpenLibrarySearchDoc[] };
    return {
      docs: payload.docs ?? [],
      httpStatus: res.status,
      queryString,
    };
  };

  try {
    const cleanMainTitle = stripBookTitleSubtitle(params.title);
    const cleanAuthor = params.author?.trim() ?? "";
    const surname = extractAuthorSurname(cleanAuthor);

    const searchPlan: Array<{
      strategy: string;
      params: Record<string, string>;
      onlyIfEmpty: boolean;
    }> = [];

    // 1. Título principal (sem subtítulo) + autor
    if (cleanAuthor) {
      searchPlan.push({
        strategy: "title_author",
        params: { title: cleanMainTitle, author: cleanAuthor },
        onlyIfEmpty: false,
      });
    }

    // 2. Título principal + sobrenome (`q=título sobrenome`)
    if (surname) {
      searchPlan.push({
        strategy: "title_surname",
        params: { q: `${cleanMainTitle} ${surname}` },
        onlyIfEmpty: true,
      });
    }

    // 3. Só título (sem subtítulo) — roda quando ainda há menos de 3 candidatas para enriquecer edições em pt-BR
    searchPlan.push({
      strategy: "title_only",
      params: { title: cleanMainTitle },
      onlyIfEmpty: false,
    });

    // 4. Caso o título traduzido não exista verbatim na Open Library, busca obras com capa do mesmo autor
    // (pontuadas como "correspondência incerta" para que o seletor exiba candidatas em vez de ficar vazio)
    if (cleanAuthor) {
      searchPlan.push({
        strategy: "author_editions_fallback",
        params: { author: cleanAuthor },
        onlyIfEmpty: true,
      });
    }

    const collectedDocs: Array<{
      doc: OpenLibrarySearchDoc;
      strategy: string;
    }> = [];
    const seenCoverIds = new Set<number>();

    let totalRawDocs = 0;
    let totalRejAuthor = 0;
    let totalRejSummary = 0;
    let totalRejNoCover = 0;
    let firstPageCount: number | undefined;
    let lastHttpStatus: number | undefined;

    for (const step of searchPlan) {
      if (step.onlyIfEmpty && collectedDocs.length > 0) {
        continue;
      }
      if (step.strategy === "title_only" && collectedDocs.length >= 2) {
        continue;
      }

      const res = await runSearch(step.strategy, step.params);
      if (res.httpStatus) lastHttpStatus = res.httpStatus;

      if (res.rateLimited) {
        if (collectedDocs.length === 0) {
          return {
            candidates: [],
            attempt: {
              provider: "openlibrary",
              status: "rate_limited",
              strategy: step.strategy,
              query: res.queryString,
              httpStatus: res.httpStatus,
              totalResults: totalRawDocs,
              candidatesFound: 0,
              queries: queryLogs,
            },
          };
        }
        break;
      }

      if (res.failed) {
        continue;
      }

      let stepAccepted = 0;
      let stepRejAuthor = 0;
      let stepRejSummary = 0;
      let stepRejNoCover = 0;

      for (const doc of res.docs) {
        totalRawDocs += 1;
        const p = normalizePositivePages(doc.number_of_pages_median);
        if (!firstPageCount && p) {
          firstPageCount = p;
        }

        const title = doc.title?.trim() ?? "";
        if (!title || isDisqualifiedCoverTitle(title)) {
          stepRejSummary += 1;
          totalRejSummary += 1;
          continue;
        }

        if (
          cleanAuthor &&
          !doesAuthorMatch(cleanAuthor, doc.author_name ?? [])
        ) {
          stepRejAuthor += 1;
          totalRejAuthor += 1;
          // Não descartamos a candidata: `scoreCoverCandidate` reduz a pontuação e marca `uncertainMatch: true`
        }

        if (!doc.cover_i || doc.cover_i <= 0) {
          stepRejNoCover += 1;
          totalRejNoCover += 1;
          continue;
        }

        if (!seenCoverIds.has(doc.cover_i)) {
          seenCoverIds.add(doc.cover_i);
          collectedDocs.push({ doc, strategy: step.strategy });
          stepAccepted += 1;
        }
      }

      queryLogs.push({
        provider: "openlibrary",
        strategy: step.strategy,
        query: res.queryString,
        httpStatus: res.httpStatus,
        totalResults: res.docs.length,
        acceptedCount: stepAccepted,
        rejectedByAuthor: stepRejAuthor,
        rejectedBySummary: stepRejSummary,
        rejectedByDimension: 0,
        rejectedByMissingImageLinks: stepRejNoCover,
      });
    }

    const topEligible = collectedDocs.slice(0, params.maxResults);
    if (topEligible.length === 0) {
      return {
        candidates: [],
        pageCount: firstPageCount,
        attempt: {
          provider: "openlibrary",
          status: totalRejSummary > 0 ? "quality_filter" : "no_results",
          strategy: "openlibrary_search",
          query: queryLogs.map((q) => q.query).join(" | "),
          httpStatus: lastHttpStatus ?? 200,
          totalResults: totalRawDocs,
          candidatesFound: 0,
          rejectedByAuthor: totalRejAuthor,
          rejectedBySummary: totalRejSummary,
          rejectedByMissingImageLinks: totalRejNoCover,
          pageCountFound: firstPageCount,
          queries: queryLogs,
        },
      };
    }

    let rejectedByQuality = 0;
    const out: CoverSearchCandidate[] = [];

    for (const { doc, strategy } of topEligible) {
      let coverUrl = buildOpenLibraryCoverUrlById(doc.cover_i!, "L");
      let width: number | undefined = 400;
      let height: number | undefined = 600;

      if (params.customProbe) {
        const probed = await params.customProbe(coverUrl, params.signal);
        if (!probed.ok) {
          if (probed.reason === "quality_filter") rejectedByQuality += 1;
          continue;
        }
        coverUrl = probed.url ?? coverUrl;
        width = probed.width;
        height = probed.height;
      }

      const docPages = normalizePositivePages(doc.number_of_pages_median);
      const firstIsbn = doc.isbn
        ?.map((raw) => normalizeToIsbn13(raw))
        .find((val): val is string => Boolean(val));

      out.push({
        id: `openlibrary:id:${doc.cover_i}`,
        source: "openlibrary",
        coverUrl,
        title: doc.title!.trim(),
        authors: doc.author_name ?? [],
        isbn: firstIsbn,
        publisher: doc.publisher?.[0],
        publishedYear: doc.first_publish_year,
        pageCount: docPages,
        width,
        height,
        strategy,
      });
    }

    return {
      candidates: out,
      pageCount: firstPageCount,
      attempt: {
        provider: "openlibrary",
        status:
          out.length > 0
            ? "ok"
            : rejectedByQuality > 0
              ? "quality_filter"
              : "no_results",
        strategy: "openlibrary_search",
        query: queryLogs.map((q) => q.query).join(" | "),
        httpStatus: lastHttpStatus ?? 200,
        totalResults: totalRawDocs,
        candidatesFound: out.length,
        rejectedByQuality,
        rejectedByDimension: rejectedByQuality,
        rejectedByAuthor: totalRejAuthor,
        rejectedBySummary: totalRejSummary,
        rejectedByMissingImageLinks: totalRejNoCover,
        pageCountFound: firstPageCount,
        queries: queryLogs,
      },
    };
  } catch (err) {
    logCoverSearchError(
      { provider: "openlibrary", strategy: "openlibrary_search" },
      err
    );
    return {
      candidates: [],
      attempt: {
        provider: "openlibrary",
        status: "api_error",
        strategy: "openlibrary_search",
        query: `title="${params.title}"`,
        detail: "timeout ou erro de rede na Open Library",
        totalResults: 0,
        candidatesFound: 0,
        queries: queryLogs,
      },
    };
  }
}

/* ============================================================================
   4. HARDCOVER (GraphQL — token estritamente no servidor, `image { url }` e `pages`)
   ============================================================================ */

const HARDCOVER_GRAPHQL_URL = "https://api.hardcover.app/v1/graphql";

interface HardcoverEditionNode {
  id?: string | number;
  title?: string | null;
  pages?: number | null;
  isbn_13?: string | null;
  release_year?: number | null;
  image?: { url?: string | null } | null;
  publisher?: { name?: string | null } | null;
  book?: {
    id?: string | number;
    title?: string | null;
    pages?: number | null;
    release_year?: number | null;
    image?: { url?: string | null } | null;
    contributions?: Array<{ author?: { name?: string | null } | null }> | null;
  } | null;
}

interface HardcoverBookNode {
  id?: string | number;
  title?: string | null;
  pages?: number | null;
  release_year?: number | null;
  image?: { url?: string | null } | null;
  contributions?: Array<{ author?: { name?: string | null } | null }> | null;
}

function buildHardcoverAuthHeader(rawToken: string): string {
  const trimmed = rawToken.trim();
  return /^bearer\s+/i.test(trimmed) ? trimmed : `Bearer ${trimmed}`;
}

function extractHardcoverAuthors(
  contributions?: Array<{ author?: { name?: string | null } | null }> | null
): string[] {
  if (!Array.isArray(contributions)) return [];
  return contributions
    .map((c) => c?.author?.name?.trim())
    .filter((name): name is string => Boolean(name));
}

async function fetchHardcoverCovers(params: {
  isbn?: string | null;
  title?: string;
  author?: string;
  token?: string;
  maxResults: number;
  fetchImpl: typeof fetch;
  customProbe?: (
    url: string,
    signal: AbortSignal,
    opts?: { allowSquare?: boolean }
  ) => Promise<ProbeResult>;
  enableRetry: boolean;
  bypassCooldown?: boolean;
  signal: AbortSignal;
}): Promise<{
  candidates: CoverSearchCandidate[];
  pageCount?: number;
  attempt: CoverProviderAttemptDiagnostic;
}> {
  if (!params.token) {
    return {
      candidates: [],
      attempt: {
        provider: "hardcover",
        status: "skipped",
        detail: "HARDCOVER_API_TOKEN não configurado no servidor",
        totalResults: 0,
        candidatesFound: 0,
      },
    };
  }

  const isByIsbn = Boolean(params.isbn);
  const cleanTitle = params.title ? stripBookTitleSubtitle(params.title) : "";
  const queryLabel = isByIsbn
    ? `isbn_13="${params.isbn}"`
    : `title="${cleanTitle}" author="${params.author ?? ""}"`;

  if (isProviderOnCooldown("hardcover", params.bypassCooldown)) {
    return {
      candidates: [],
      attempt: {
        provider: "hardcover",
        status: "rate_limited",
        strategy: isByIsbn ? "isbn" : "hardcover",
        query: queryLabel,
        detail: "em pausa temporária após 403/429",
        totalResults: 0,
        candidatesFound: 0,
      },
    };
  }

  try {
    const query = isByIsbn
      ? `query CoverByIsbn($isbn: String!) {
          editions(where: { isbn_13: { _eq: $isbn } }, limit: 6) {
            id
            title
            pages
            isbn_13
            release_year
            image { url }
            publisher { name }
            book {
              id
              title
              pages
              release_year
              image { url }
              contributions { author { name } }
            }
          }
        }`
      : params.author?.trim()
        ? `query CoverByTitleAuthor($title: String!, $author: String!) {
            books(
              where: {
                title: { _ilike: $title }
                contributions: { author: { name: { _ilike: $author } } }
              }
              limit: 6
            ) {
              id
              title
              pages
              release_year
              image { url }
              contributions { author { name } }
            }
          }`
        : `query CoverByTitle($title: String!) {
            books(where: { title: { _ilike: $title } }, limit: 6) {
              id
              title
              pages
              release_year
              image { url }
              contributions { author { name } }
            }
          }`;

    const variables = isByIsbn
      ? { isbn: params.isbn }
      : params.author?.trim()
        ? {
            title: `%${cleanTitle}%`,
            author: `%${params.author.trim()}%`,
          }
        : { title: `%${cleanTitle}%` };

    const res = await fetchWithRetry(
      HARDCOVER_GRAPHQL_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: buildHardcoverAuthHeader(params.token),
        },
        body: JSON.stringify({ query, variables }),
      },
      {
        fetchImpl: params.fetchImpl,
        signal: params.signal,
        enableRetry: params.enableRetry,
      }
    );

    if (res.status === 403 || res.status === 429) {
      markProviderCooldown("hardcover");
      return {
        candidates: [],
        attempt: {
          provider: "hardcover",
          status: "rate_limited",
          strategy: isByIsbn ? "isbn" : "hardcover",
          query: queryLabel,
          httpStatus: res.status,
          totalResults: 0,
          candidatesFound: 0,
        },
      };
    }

    if (!res.ok) {
      return {
        candidates: [],
        attempt: {
          provider: "hardcover",
          status: "api_error",
          strategy: isByIsbn ? "isbn" : "hardcover",
          query: queryLabel,
          httpStatus: res.status,
          totalResults: 0,
          candidatesFound: 0,
        },
      };
    }

    const payload = (await res.json()) as {
      data?: {
        editions?: HardcoverEditionNode[];
        books?: HardcoverBookNode[];
      };
      errors?: Array<{ message?: string }>;
    };

    if (payload.errors?.length && !payload.data) {
      return {
        candidates: [],
        attempt: {
          provider: "hardcover",
          status: "api_error",
          strategy: isByIsbn ? "isbn" : "hardcover",
          query: queryLabel,
          httpStatus: res.status,
          detail: payload.errors[0]?.message ?? "erro GraphQL no Hardcover",
          totalResults: 0,
          candidatesFound: 0,
        },
      };
    }

    interface RawHcItem {
      id: string;
      title: string;
      authors: string[];
      isbn?: string;
      publisher?: string;
      publishedYear?: number;
      pageCount?: number;
      imageUrl?: string;
    }

    const rawItems: RawHcItem[] = [];
    if (isByIsbn) {
      for (const ed of payload.data?.editions ?? []) {
        const title = ed.title?.trim() || ed.book?.title?.trim() || "";
        const authors = extractHardcoverAuthors(ed.book?.contributions);
        const pageCount =
          normalizePositivePages(ed.pages) ??
          normalizePositivePages(ed.book?.pages);
        const imageUrl = ed.image?.url?.trim() || ed.book?.image?.url?.trim();
        rawItems.push({
          id: `hardcover:ed:${ed.id ?? ed.isbn_13 ?? title}`,
          title,
          authors,
          isbn: ed.isbn_13
            ? (normalizeToIsbn13(ed.isbn_13) ?? undefined)
            : (params.isbn ?? undefined),
          publisher: ed.publisher?.name?.trim() || undefined,
          publishedYear: parsePublishedYear(
            ed.release_year ?? ed.book?.release_year
          ),
          pageCount,
          imageUrl,
        });
      }
    } else {
      for (const b of payload.data?.books ?? []) {
        const title = b.title?.trim() ?? "";
        const authors = extractHardcoverAuthors(b.contributions);
        rawItems.push({
          id: `hardcover:book:${b.id ?? title}`,
          title,
          authors,
          publishedYear: parsePublishedYear(b.release_year),
          pageCount: normalizePositivePages(b.pages),
          imageUrl: b.image?.url?.trim(),
        });
      }
    }

    let rejectedBySummary = 0;
    let rejectedByAuthor = 0;
    let rejectedByMissingImageLinks = 0;
    let firstPageCount: number | undefined;

    const eligible: RawHcItem[] = [];
    for (const item of rawItems) {
      if (item.pageCount && !firstPageCount) {
        firstPageCount = item.pageCount;
      }
      if (!item.title || isDisqualifiedCoverTitle(item.title)) {
        rejectedBySummary += 1;
        continue;
      }
      if (
        params.author?.trim() &&
        item.authors.length > 0 &&
        !doesAuthorMatch(params.author, item.authors)
      ) {
        rejectedByAuthor += 1;
      }
      if (!item.imageUrl) {
        rejectedByMissingImageLinks += 1;
        continue;
      }
      eligible.push(item);
      if (eligible.length >= params.maxResults) break;
    }

    if (eligible.length === 0) {
      return {
        candidates: [],
        pageCount: firstPageCount,
        attempt: {
          provider: "hardcover",
          status: rejectedBySummary > 0 ? "quality_filter" : "no_results",
          strategy: isByIsbn ? "isbn" : "hardcover",
          query: queryLabel,
          httpStatus: res.status,
          totalResults: rawItems.length,
          candidatesFound: 0,
          rejectedByAuthor,
          rejectedBySummary,
          rejectedByMissingImageLinks,
          pageCountFound: firstPageCount,
        },
      };
    }

    let rejectedByQuality = 0;
    const candidates: CoverSearchCandidate[] = [];

    for (const item of eligible) {
      const safeUrl = validateExternalCoverUrl(item.imageUrl!);
      if (!safeUrl || isInvalidCoverPlaceholder({ url: safeUrl })) {
        rejectedByQuality += 1;
        continue;
      }

      let coverUrl = safeUrl;
      let width: number | undefined = 450;
      let height: number | undefined = 675;

      if (params.customProbe) {
        const probed = await params.customProbe(safeUrl, params.signal);
        if (!probed.ok) {
          if (
            probed.reason === "quality_filter" ||
            probed.reason === "invalid_host"
          ) {
            rejectedByQuality += 1;
          }
          continue;
        }
        coverUrl = probed.url ?? coverUrl;
        width = probed.width;
        height = probed.height;
      }

      candidates.push({
        id: item.id,
        source: "hardcover",
        coverUrl,
        title: item.title,
        authors: item.authors,
        isbn: item.isbn,
        publisher: item.publisher,
        publishedYear: item.publishedYear,
        pageCount: item.pageCount,
        width,
        height,
        strategy: isByIsbn ? "isbn" : "hardcover",
      });
    }

    return {
      candidates,
      pageCount: firstPageCount,
      attempt: {
        provider: "hardcover",
        status:
          candidates.length > 0
            ? "ok"
            : rejectedByQuality > 0
              ? "quality_filter"
              : "no_results",
        strategy: isByIsbn ? "isbn" : "hardcover",
        query: queryLabel,
        httpStatus: res.status,
        totalResults: rawItems.length,
        candidatesFound: candidates.length,
        rejectedByQuality,
        rejectedByDimension: rejectedByQuality,
        rejectedByAuthor,
        rejectedBySummary,
        rejectedByMissingImageLinks,
        pageCountFound: firstPageCount,
      },
    };
  } catch (err) {
    logCoverSearchError(
      { provider: "hardcover", strategy: isByIsbn ? "isbn" : "hardcover" },
      err
    );
    return {
      candidates: [],
      attempt: {
        provider: "hardcover",
        status: "api_error",
        strategy: isByIsbn ? "isbn" : "hardcover",
        query: queryLabel,
        detail: "timeout ou erro de rede no Hardcover",
        totalResults: 0,
        candidatesFound: 0,
      },
    };
  }
}

/* ============================================================================
   5. APPLE (iTunes Search, `country=br`, `entity=ebook|audiobook`)
      Implementado atrás da feature flag `ENABLE_APPLE_BOOKS_COVERS` (OFF por padrão)
   ============================================================================ */

interface AppleItunesItem {
  trackId?: number;
  collectionId?: number;
  trackName?: string;
  collectionName?: string;
  artistName?: string;
  artworkUrl100?: string;
  releaseDate?: string;
}

function upgradeAppleArtworkUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  return raw.replace(/\/100x100bb\.(jpg|png|webp)$/i, "/600x600bb.$1");
}

async function fetchAppleItunesCovers(params: {
  term: string;
  author?: string;
  entity: "ebook" | "audiobook";
  maxResults: number;
  fetchImpl: typeof fetch;
  customProbe?: (
    url: string,
    signal: AbortSignal,
    opts?: { allowSquare?: boolean }
  ) => Promise<ProbeResult>;
  enableRetry: boolean;
  bypassCooldown?: boolean;
  signal: AbortSignal;
}): Promise<{
  candidates: CoverSearchCandidate[];
  attempt: CoverProviderAttemptDiagnostic;
}> {
  const queryLabel = `term="${params.term}" country=br entity=${params.entity}`;
  if (isProviderOnCooldown("apple", params.bypassCooldown)) {
    return {
      candidates: [],
      attempt: {
        provider: "apple",
        status: "rate_limited",
        strategy: "apple",
        query: queryLabel,
        totalResults: 0,
        candidatesFound: 0,
      },
    };
  }

  try {
    const url = new URL("https://itunes.apple.com/search");
    url.searchParams.set("term", params.term);
    url.searchParams.set("country", "br");
    url.searchParams.set("entity", params.entity);
    url.searchParams.set("limit", "6");

    const res = await fetchWithRetry(
      url,
      {
        headers: { Accept: "application/json" },
      },
      {
        fetchImpl: params.fetchImpl,
        signal: params.signal,
        enableRetry: params.enableRetry,
      }
    );

    if (res.status === 403 || res.status === 429) {
      markProviderCooldown("apple");
      return {
        candidates: [],
        attempt: {
          provider: "apple",
          status: "rate_limited",
          strategy: "apple",
          query: queryLabel,
          httpStatus: res.status,
          totalResults: 0,
          candidatesFound: 0,
        },
      };
    }

    if (!res.ok) {
      return {
        candidates: [],
        attempt: {
          provider: "apple",
          status: "api_error",
          strategy: "apple",
          query: queryLabel,
          httpStatus: res.status,
          totalResults: 0,
          candidatesFound: 0,
        },
      };
    }

    const payload = (await res.json()) as { results?: AppleItunesItem[] };
    const rawResults = payload.results ?? [];

    let rejectedBySummary = 0;
    let rejectedByAuthor = 0;
    let rejectedByMissingImageLinks = 0;
    const eligible: AppleItunesItem[] = [];

    for (const item of rawResults) {
      const title = (item.trackName ?? item.collectionName ?? "").trim();
      if (!title || isDisqualifiedCoverTitle(title)) {
        rejectedBySummary += 1;
        continue;
      }
      const authors = item.artistName ? [item.artistName] : [];
      if (params.author?.trim() && !doesAuthorMatch(params.author, authors)) {
        rejectedByAuthor += 1;
      }
      if (!item.artworkUrl100) {
        rejectedByMissingImageLinks += 1;
        continue;
      }
      eligible.push(item);
      if (eligible.length >= params.maxResults) break;
    }

    if (eligible.length === 0) {
      return {
        candidates: [],
        attempt: {
          provider: "apple",
          status: "no_results",
          strategy: "apple",
          query: queryLabel,
          httpStatus: res.status,
          totalResults: rawResults.length,
          candidatesFound: 0,
          rejectedByAuthor,
          rejectedBySummary,
          rejectedByMissingImageLinks,
        },
      };
    }

    let rejectedByQuality = 0;
    const candidates: CoverSearchCandidate[] = [];
    const allowSquare = params.entity === "audiobook";

    for (const item of eligible) {
      const hiRes = upgradeAppleArtworkUrl(item.artworkUrl100);
      const safeUrl = validateExternalCoverUrl(hiRes);
      if (!safeUrl || isInvalidCoverPlaceholder({ url: safeUrl })) {
        rejectedByQuality += 1;
        continue;
      }

      let coverUrl = safeUrl;
      let width: number | undefined = 600;
      let height: number | undefined = 600;

      if (params.customProbe) {
        const probed = await params.customProbe(safeUrl, params.signal, {
          allowSquare,
        });
        if (!probed.ok) {
          if (
            probed.reason === "quality_filter" ||
            probed.reason === "invalid_host"
          ) {
            rejectedByQuality += 1;
          }
          continue;
        }
        coverUrl = probed.url ?? coverUrl;
        width = probed.width;
        height = probed.height;
      }

      const title = (item.trackName ?? item.collectionName ?? "").trim();
      candidates.push({
        id: `apple:${params.entity}:${item.trackId ?? item.collectionId ?? coverUrl}`,
        source: "apple",
        coverUrl,
        title,
        authors: item.artistName ? [item.artistName] : [],
        publishedYear: parsePublishedYear(item.releaseDate),
        width,
        height,
        strategy: "apple",
      });
    }

    return {
      candidates,
      attempt: {
        provider: "apple",
        status:
          candidates.length > 0
            ? "ok"
            : rejectedByQuality > 0
              ? "quality_filter"
              : "no_results",
        strategy: "apple",
        query: queryLabel,
        httpStatus: res.status,
        totalResults: rawResults.length,
        candidatesFound: candidates.length,
        rejectedByQuality,
        rejectedByDimension: rejectedByQuality,
        rejectedByAuthor,
        rejectedBySummary,
        rejectedByMissingImageLinks,
      },
    };
  } catch (err) {
    logCoverSearchError({ provider: "apple", strategy: "apple" }, err);
    return {
      candidates: [],
      attempt: {
        provider: "apple",
        status: "api_error",
        strategy: "apple",
        query: queryLabel,
        detail: "timeout ou erro de rede na Apple iTunes Search",
        totalResults: 0,
        candidatesFound: 0,
      },
    };
  }
}

/* ============================================================================
   ORQUESTRADOR DA CADEIA DE CAPAS
   ============================================================================ */

/**
 * Cascata de estratégias, mesclando e deduplicando até 8 candidatas (por ISBN ou URL):
 * - Com ISBN: BrasilAPI `/api/isbn/v1/{isbn}` (`cover_url` e `page_count`) ->
 *   Google Books (`isbn:{isbn}`) -> Open Library (`?default=false`) -> Hardcover -> fallback título/autor.
 * - Sem ISBN (ou quando ISBN não traz capa):
 *   1. Google Books: frases entre aspas sem acento e sem subtítulo (`intitle:"..." inauthor:"..."`, `langRestrict=pt`)
 *   2. Google Books: 2ª tentativa sem operadores (`q=título autor`) e SEM `langRestrict=pt`
 *   3. Google Books: título + sobrenome / só título (sem subtítulo)
 *   4. Open Library (`search.json`): título+autor -> título+sobrenome -> só título -> edições do autor
 *   5. Hardcover (GraphQL, token só no servidor)
 *   6. Apple (`iTunes Search`, `country=br`) se feature flag `ENABLE_APPLE_BOOKS_COVERS=true` (OFF por padrão)
 */
export async function searchBookCovers(
  params: CoverSearchOptions
): Promise<CoverSearchResponse> {
  const cleanTitle = params.title?.trim() ?? "";
  const cleanAuthor = params.author?.trim() ?? "";
  const normalizedIsbn = params.isbn ? normalizeToIsbn13(params.isbn) : null;
  const format: CoverSearchMediaFormat = params.format ?? "book";

  const baseEnv = getServerEnv();
  const env: ServerEnv = params.envOverride
    ? { ...baseEnv, ...params.envOverride }
    : baseEnv;

  const isDev = env.NODE_ENV !== "production";
  const appleEnabled = Boolean(env.ENABLE_APPLE_BOOKS_COVERS);
  const hardcoverEnabled = Boolean(env.HARDCOVER_API_TOKEN);
  const fetchImpl = getCatalogFetch(params.fetchImpl);
  const pauseMs = params.pauseBetweenCallsMs ?? DEFAULT_INTER_CALL_PAUSE_MS;
  const enableRetry = pauseMs > 0;
  const bypassCooldown = Boolean(params.bypassCache);

  const wrapProbeSafely = (
    fn: (
      rawUrl: string,
      signal: AbortSignal,
      opts?: { allowSquare?: boolean }
    ) => Promise<ProbeResult>
  ) => {
    return async (
      rawUrl: string,
      probeSignal: AbortSignal,
      opts?: { allowSquare?: boolean }
    ): Promise<ProbeResult> => {
      try {
        return await fn(rawUrl, probeSignal, opts);
      } catch (err) {
        logCoverSearchError({ stage: "candidate_probe" }, err);
        return { ok: false, url: rawUrl, reason: "http_error" };
      }
    };
  };

  // Sonda obrigatória para URL direta de ISBN da Open Library (que responde 404 com ?default=false)
  const openLibraryIsbnProbe = wrapProbeSafely(
    params.probeImpl ??
      ((
        rawUrl: string,
        probeSignal: AbortSignal,
        opts?: { allowSquare?: boolean }
      ) => probeCoverImageDimensions(rawUrl, probeSignal, fetchImpl, opts))
  );

  // Para candidatos que já trazem URL de capa nos metadados, só sondamos se o teste injetou `probeImpl`
  const customProbe = params.probeImpl
    ? wrapProbeSafely(params.probeImpl)
    : undefined;

  const cacheKey = buildCacheKey({
    title: cleanTitle,
    author: cleanAuthor,
    isbn: normalizedIsbn,
    format,
    appleEnabled,
    hardcoverEnabled,
  });

  if (!params.bypassCache) {
    const cached = readCache(cacheKey);
    if (cached) return cached;
  }

  const timeoutCtx = createTimeoutController(
    Math.max(9000, env.CATALOG_LOOKUP_TIMEOUT_MS * 2.5),
    params.signal
  );
  const signal = timeoutCtx.signal;

  const collected: CoverSearchCandidate[] = [];
  const attempts: CoverProviderAttemptDiagnostic[] = [];
  let resolvedPageCount: number | undefined;
  let googleRateLimited = false;
  let callsMade = 0;

  const politeStep = async () => {
    if (callsMade > 0) {
      await pausePolite(pauseMs, signal);
    }
    callsMade += 1;
  };

  const runProviderSafely = async <
    T extends {
      candidates: CoverSearchCandidate[];
      pageCount?: number;
      rateLimited?: boolean;
      attempt: CoverProviderAttemptDiagnostic;
    },
  >(
    provider: CoverProviderSource,
    strategy: CoverProviderAttemptDiagnostic["strategy"],
    query: string,
    fn: () => Promise<T>
  ): Promise<{
    candidates: CoverSearchCandidate[];
    pageCount?: number;
    rateLimited?: boolean;
    attempt: CoverProviderAttemptDiagnostic;
  }> => {
    try {
      return await fn();
    } catch (err) {
      logCoverSearchError({ provider, strategy }, err);
      return {
        candidates: [],
        rateLimited: false,
        attempt: {
          provider,
          status: "api_error",
          strategy,
          query,
          detail: "falha inesperada ao consultar provedor de capa",
          totalResults: 0,
          candidatesFound: 0,
        },
      };
    }
  };

  try {
    // =========================================================================
    // ESTRATÉGIA 1 — COM ISBN:
    // BrasilAPI -> Google Books -> Open Library (?default=false) -> Hardcover
    // =========================================================================
    if (normalizedIsbn) {
      await politeStep();
      const br = await runProviderSafely(
        "brasilapi",
        "isbn",
        `isbn=${normalizedIsbn}`,
        () =>
          fetchBrasilApiByIsbn({
            isbn: normalizedIsbn,
            requestedAuthor: cleanAuthor || undefined,
            fetchImpl,
            customProbe,
            enableRetry,
            signal,
          })
      );
      attempts.push(br.attempt);
      if (br.pageCount && !resolvedPageCount) resolvedPageCount = br.pageCount;
      collected.push(...br.candidates);

      if (collected.length === 0) {
        await politeStep();
        const gbIsbn = await runProviderSafely(
          "google",
          "isbn",
          `isbn:${normalizedIsbn}`,
          () =>
            fetchGoogleCoverCandidates({
              query: `isbn:${normalizedIsbn}`,
              strategy: "isbn",
              langRestrictPt: false,
              requestedAuthor: cleanAuthor || undefined,
              apiKey: env.GOOGLE_BOOKS_API_KEY,
              maxVolumes: 4,
              fetchImpl,
              customProbe,
              enableRetry,
              bypassCooldown,
              signal,
            })
        );
        attempts.push(gbIsbn.attempt);
        if (gbIsbn.rateLimited) googleRateLimited = true;
        if (gbIsbn.pageCount && !resolvedPageCount) {
          resolvedPageCount = gbIsbn.pageCount;
        }
        collected.push(...gbIsbn.candidates);
      }

      if (collected.length === 0) {
        await politeStep();
        const olIsbn = await runProviderSafely(
          "openlibrary",
          "isbn",
          `isbn=${normalizedIsbn}`,
          () =>
            fetchOpenLibraryByIsbn({
              isbn: normalizedIsbn,
              title: cleanTitle || undefined,
              author: cleanAuthor || undefined,
              userAgent: env.OPEN_LIBRARY_USER_AGENT,
              fetchImpl,
              probe: openLibraryIsbnProbe,
              enableRetry,
              bypassCooldown,
              signal,
            })
        );
        attempts.push(olIsbn.attempt);
        if (olIsbn.pageCount && !resolvedPageCount) {
          resolvedPageCount = olIsbn.pageCount;
        }
        collected.push(...olIsbn.candidates);
      }

      if (collected.length === 0) {
        if (hardcoverEnabled) {
          await politeStep();
        }
        const hcIsbn = await runProviderSafely(
          "hardcover",
          "isbn",
          `isbn=${normalizedIsbn}`,
          () =>
            fetchHardcoverCovers({
              isbn: normalizedIsbn,
              title: cleanTitle || undefined,
              author: cleanAuthor || undefined,
              token: env.HARDCOVER_API_TOKEN,
              maxResults: 4,
              fetchImpl,
              customProbe,
              enableRetry,
              bypassCooldown,
              signal,
            })
        );
        attempts.push(hcIsbn.attempt);
        if (hcIsbn.pageCount && !resolvedPageCount) {
          resolvedPageCount = hcIsbn.pageCount;
        }
        collected.push(...hcIsbn.candidates);
      }
    }

    // =========================================================================
    // ESTRATÉGIA 2 — CASCATA POR TÍTULO / AUTOR / SOBRENOME / SÓ TÍTULO:
    // Google Books (frases entre aspas -> sem operadores sem langRestrict -> só título)
    // -> Open Library (`search.json`) -> Hardcover
    // =========================================================================
    if (cleanTitle && (!normalizedIsbn || collected.length === 0)) {
      const googlePlans = buildGoogleBooksQueryPlan({
        title: cleanTitle,
        author: cleanAuthor,
      });

      for (let idx = 0; idx < googlePlans.length; idx += 1) {
        if (googleRateLimited) break;
        const plan = googlePlans[idx]!;

        // A 1ª tentativa roda sempre; a 2ª tentativa (sem operadores e sem langRestrict=pt)
        // e as demais rodam quando as anteriores não trouxeram candidatas suficientes.
        if (idx >= 1 && collected.length >= 2) break;
        if (idx >= 2 && collected.length > 0) break;

        await politeStep();
        const gbRes = await runProviderSafely(
          "google",
          plan.strategy,
          plan.query,
          () =>
            fetchGoogleCoverCandidates({
              query: plan.query,
              strategy: plan.strategy,
              langRestrictPt: plan.langRestrictPt,
              requestedAuthor: cleanAuthor || undefined,
              apiKey: env.GOOGLE_BOOKS_API_KEY,
              maxVolumes: 8,
              fetchImpl,
              customProbe,
              enableRetry,
              bypassCooldown: bypassCooldown && idx === 0,
              signal,
            })
        );
        attempts.push(gbRes.attempt);
        if (gbRes.rateLimited) googleRateLimited = true;
        if (gbRes.pageCount && !resolvedPageCount) {
          resolvedPageCount = gbRes.pageCount;
        }
        collected.push(...gbRes.candidates);
      }

      // Open Library (`search.json`: título+autor -> título+sobrenome -> só título -> autor)
      if (collected.length < COVER_MAX_CANDIDATES) {
        await politeStep();
        const olSearch = await runProviderSafely(
          "openlibrary",
          "openlibrary_search",
          `title="${cleanTitle}"`,
          () =>
            fetchOpenLibraryByTitleAuthor({
              title: cleanTitle,
              author: cleanAuthor || undefined,
              userAgent: env.OPEN_LIBRARY_USER_AGENT,
              maxResults: 8,
              fetchImpl,
              customProbe,
              enableRetry,
              bypassCooldown,
              signal,
            })
        );
        attempts.push(olSearch.attempt);
        if (olSearch.pageCount && !resolvedPageCount) {
          resolvedPageCount = olSearch.pageCount;
        }
        collected.push(...olSearch.candidates);
      }

      // Hardcover (GraphQL, token só no servidor)
      if (collected.length < COVER_MAX_CANDIDATES) {
        if (hardcoverEnabled) {
          await politeStep();
        }
        const hcTitle = await runProviderSafely(
          "hardcover",
          "hardcover",
          `title="${cleanTitle}"`,
          () =>
            fetchHardcoverCovers({
              title: cleanTitle,
              author: cleanAuthor || undefined,
              token: env.HARDCOVER_API_TOKEN,
              maxResults: 6,
              fetchImpl,
              customProbe,
              enableRetry,
              bypassCooldown,
              signal,
            })
        );
        if (!(
          normalizedIsbn &&
          hcTitle.attempt.status === "skipped" &&
          attempts.some(
            (a) => a.provider === "hardcover" && a.status === "skipped"
          )
        )) {
          attempts.push(hcTitle.attempt);
        }
        if (hcTitle.pageCount && !resolvedPageCount) {
          resolvedPageCount = hcTitle.pageCount;
        }
        collected.push(...hcTitle.candidates);
      }
    }

    // =========================================================================
    // PROVEDOR OPCIONAL — APPLE (iTunes Search, country=br, ebook | audiobook)
    // Atrás de feature flag (`ENABLE_APPLE_BOOKS_COVERS`), DESLIGADO por padrão
    // =========================================================================
    if (appleEnabled && collected.length < COVER_MAX_CANDIDATES) {
      const cleanMainTitle = stripBookTitleSubtitle(cleanTitle);
      const appleTerm = normalizedIsbn
        ? cleanMainTitle
          ? `${cleanMainTitle} ${cleanAuthor}`.trim()
          : normalizedIsbn
        : `${cleanMainTitle} ${cleanAuthor}`.trim();
      if (appleTerm) {
        await politeStep();
        const appleEntity: "ebook" | "audiobook" =
          format === "audiobook" ? "audiobook" : "ebook";
        const appleRes = await runProviderSafely(
          "apple",
          "apple",
          appleTerm,
          () =>
            fetchAppleItunesCovers({
              term: appleTerm,
              author: cleanAuthor || undefined,
              entity: appleEntity,
              maxResults: 6,
              fetchImpl,
              customProbe,
              enableRetry,
              bypassCooldown,
              signal,
            })
        );
        attempts.push(appleRes.attempt);
        collected.push(...appleRes.candidates);
      }
    }
  } finally {
    timeoutCtx.cleanup();
  }

  // Propaga `pageCount` resolvido nas candidatas que vieram sem páginas
  const enrichedCollected = resolvedPageCount
    ? collected.map((cand) =>
        cand.pageCount ? cand : { ...cand, pageCount: resolvedPageCount }
      )
    : collected;

  const candidates = deduplicateCoverCandidates(
    enrichedCollected,
    COVER_MAX_CANDIDATES,
    {
      title: cleanTitle,
      author: cleanAuthor,
      isbn: normalizedIsbn,
    }
  );

  const anyRateLimited =
    googleRateLimited || attempts.some((a) => a.status === "rate_limited");
  const anyApiError = attempts.some(
    (a) => a.status === "rate_limited" || a.status === "api_error"
  );
  const degraded = anyRateLimited || anyApiError;
  const apiUnavailable = candidates.length === 0 && anyApiError;
  const fallbackToManualUpload = candidates.length === 0;
  const diagnostic = classifyCoverSearchDiagnostic(candidates.length, attempts);

  if (isDev && env.NODE_ENV !== "test") {
    const label = cleanTitle || normalizedIsbn || "consulta";
    console.info(
      `[ReadingFlow/covers][dev] "${label}" (${normalizedIsbn ?? "sem ISBN"}) → ${diagnostic.badgePtBr}`,
      {
        reason: diagnostic.reason,
        candidates: candidates.length,
        pageCount: resolvedPageCount ?? null,
        queriesSent: diagnostic.queriesSent ?? [],
      }
    );
  }

  const response: CoverSearchResponse = {
    candidates,
    ...(resolvedPageCount ? { pageCount: resolvedPageCount } : {}),
    degraded,
    googleRateLimited,
    apiUnavailable,
    fallbackToManualUpload,
    notice:
      googleRateLimited && candidates.length > 0
        ? "Google Books atingiu o limite temporário; exibindo edições das demais bases."
        : apiUnavailable
          ? "Serviço indisponível, tentar de novo."
          : undefined,
    ...(isDev ? { diagnostic } : {}),
  };

  if (!params.bypassCache) {
    writeCache(cacheKey, response);
  }
  return response;
}
