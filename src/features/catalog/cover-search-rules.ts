import { normalizeToIsbn13 } from "@/lib/isbn";
import {
  clampPaperHsl,
  deriveSpineAccentHex,
} from "@/features/catalog/spine-color-rules";

const EDITORIAL_SPINE_PALETTE: readonly string[] = [
  "#6E1E2A", // Couro Bordô
  "#2D5A43", // Verde Biblioteca
  "#7A4B2A", // Nogueira
  "#26466D", // Azul Ultramar Editorial
  "#8A3B2B", // Terracota
  "#5B3A63", // Ameixa Editorial
  "#7E5E24", // Ocre Dourado
  "#35524A", // Petróleo Escuro
  "#6C2D3C", // Vinho Antigo
  "#47392E", // Tabaco Escuro
];

/**
 * Regras puras e determinísticas para o pipeline de busca e validação de capas:
 * - Filtro de títulos espúrios (resumos, guias de estudo, análises, workbooks)
 * - Validação flexível de autor (tokens normalizados, suporte a só sobrenome e redução de pontuação em ambiguidade)
 * - Construção de queries do Google Books (frases entre aspas sem acento/subtítulo + 2ª tentativa sem operadores e sem langRestrict)
 * - Detecção de placeholders inválidos (1x1, "imagem indisponível") e ranqueamento por pontuação + tamanho
 * - Deduplicação de até 8 candidatas por ISBN ou URL normalizada
 * - Diagnóstico estruturado de dev por fonte e motivo exato de rejeição
 */

export type CoverProviderSource =
  "brasilapi" | "google" | "openlibrary" | "hardcover" | "apple" | "upload";

export type CoverDiagnosticReason =
  "ok" | "no_results" | "api_error" | "quality_filter";

export type CoverProviderAttemptStatus =
  | "ok"
  | "no_results"
  | "api_error"
  | "rate_limited"
  | "quality_filter"
  | "skipped";

export interface CoverSearchQueryLog {
  provider: CoverProviderSource;
  strategy: string;
  query: string;
  httpStatus?: number;
  totalResults: number;
  acceptedCount: number;
  rejectedByAuthor: number;
  rejectedBySummary: number;
  rejectedByDimension: number;
  rejectedByMissingImageLinks: number;
  errorDetail?: string;
}

export interface CoverProviderAttemptDiagnostic {
  provider: CoverProviderSource;
  status: CoverProviderAttemptStatus;
  strategy?: string;
  query?: string;
  httpStatus?: number;
  detail?: string;
  totalResults?: number;
  candidatesFound: number;
  rejectedByQuality?: number;
  rejectedByAuthor?: number;
  rejectedBySummary?: number;
  rejectedByDimension?: number;
  rejectedByMissingImageLinks?: number;
  pageCountFound?: number;
  queries?: CoverSearchQueryLog[];
}

export interface CoverSearchDiagnostic {
  reason: CoverDiagnosticReason;
  reasonPtBr: string;
  /** Motivo curto e real para o selo de dev (ex.: "google: 0 resultados · ol: 404 · filtro: autor") */
  badgePtBr: string;
  attempts: CoverProviderAttemptDiagnostic[];
  queriesSent?: CoverSearchQueryLog[];
}

export interface CoverSearchCandidate {
  id: string;
  source: Exclude<CoverProviderSource, "upload">;
  coverUrl: string;
  title: string;
  authors: string[];
  isbn?: string;
  publisher?: string;
  publishedYear?: number;
  pageCount?: number;
  width?: number;
  height?: number;
  /** Pontuação calculada (0..100) combinando título, autor, ISBN e resolução estimada. */
  matchScore?: number;
  /** Marcada como true quando a correspondência tem pontuação baixa ou ambiguidade de título/autor. */
  uncertainMatch?: boolean;
  /** Estratégia que originou a candidata. */
  strategy?: string;
}

export const COVER_MIN_WIDTH_PX = 200;
export const COVER_MIN_ASPECT_RATIO = 0.55;
export const COVER_MAX_ASPECT_RATIO = 0.75;
export const COVER_MAX_CANDIDATES = 8;

/** Limiar abaixo do qual uma candidata recebe o selo "correspondência incerta". */
export const COVER_UNCERTAIN_SCORE_THRESHOLD = 55;

const DISQUALIFIED_TITLE_PATTERNS: readonly RegExp[] = [
  /\bresumo\b/i,
  /\bsummary\b/i,
  /\ban[aá]lise\b/i,
  /\bguia\s+de\s+estudo\b/i,
  /\bstudy\s+guide\b/i,
  /\bsparkles?\s*notes\b/i,
  /\bcliff\s*notes\b/i,
  /\bblinkist\b/i,
  /\bworkbook\b/i,
  /\bapontamentos\b/i,
  /\bsinopse\s+comentada\b/i,
  /\bkey\s+takeaways\b/i,
];

const AUTHOR_STOPWORDS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "van",
  "von",
  "del",
  "la",
  "le",
]);

const AUTHOR_GENERATIONAL_SUFFIXES = new Set([
  "jr",
  "junior",
  "filho",
  "neto",
  "sobrinho",
  "ii",
  "iii",
]);

const PLACEHOLDER_URL_PATTERNS: readonly RegExp[] = [
  /no[_-]?cover/i,
  /image[_-]?not[_-]?available/i,
  /default[_-]?cover/i,
  /placeholder/i,
  /blank\.(?:gif|png|jpg)/i,
  /1x1\.(?:gif|png|jpg)/i,
];

export function normalizeCoverText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Remove subtítulos após `:`, `—`, `–`, ` - ` e sufixos de formato entre parênteses
 * como `(Audiobook)`, `(Audiolivro)`, `(E-book)`, `(Edição...)`, preservando hifens
 * internos de palavras compostas como `Micro-Hábitos`.
 */
export function stripBookTitleSubtitle(rawTitle: string): string {
  const withoutFormatParens = rawTitle
    .replace(
      /\s*\((?:audiobook|audiolivro|e-?book|edi[cç][aã]o[^)]*|volume[^)]*|cole[cç][aã]o[^)]*|box[^)]*)\)\s*/gi,
      " "
    )
    .trim();

  const mainPart =
    withoutFormatParens.split(/\s*[:—–]\s*|\s+-\s+/)[0]?.trim() ?? "";

  return mainPart.length >= 2
    ? mainPart
    : withoutFormatParens || rawTitle.trim();
}

/**
 * Remove acentos e caracteres especiais de uma frase para consulta em provedores externos,
 * preservando hifens internos ou convertendo em espaços limpos sem aspas internas.
 */
export function stripAccentsForQuery(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/["'“”‘’]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extrai o sobrenome principal normalizado (sem acento) de um autor:
 * Ex.: "Robert Greene" -> "greene", "Machado de Assis" -> "assis",
 * "Itamar Vieira Junior" -> "vieira", "João Guimarães Rosa" -> "rosa".
 */
export function extractAuthorSurname(author?: string | null): string {
  if (!author?.trim()) return "";
  const rawTokens = normalizeCoverText(author)
    .split(" ")
    .filter((t) => t.length >= 2 && !AUTHOR_STOPWORDS.has(t));

  if (rawTokens.length === 0) return "";
  if (rawTokens.length === 1) return rawTokens[0]!;

  const withoutSuffix = rawTokens.filter(
    (t, idx) =>
      !(idx === rawTokens.length - 1 && AUTHOR_GENERATIONAL_SUFFIXES.has(t))
  );
  const effective = withoutSuffix.length > 0 ? withoutSuffix : rawTokens;
  return effective[effective.length - 1] ?? "";
}

export interface GoogleBooksQueryPlan {
  strategy:
    | "title_author_quoted"
    | "title_author_plain"
    | "title_surname_quoted"
    | "title_only_quoted";
  query: string;
  langRestrictPt: boolean;
}

/**
 * Constrói o plano de queries do Google Books:
 * 1. Frases entre aspas (`intitle:"as 48 leis do poder" inauthor:"greene"` ou autor completo), sem acentos e sem subtítulo, com `langRestrict=pt`
 * 2. 2ª tentativa sem operadores (`q=titulo autor`) e SEM `langRestrict=pt`
 * 3. `título + sobrenome` entre aspas (se o autor tiver nome composto)
 * 4. `só título (sem subtítulo)` entre aspas sem `langRestrict=pt`
 */
export function buildGoogleBooksQueryPlan(input: {
  title: string;
  author?: string | null;
}): GoogleBooksQueryPlan[] {
  const mainTitle = stripAccentsForQuery(stripBookTitleSubtitle(input.title))
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!mainTitle) return [];

  const fullAuthor = stripAccentsForQuery(input.author ?? "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const surname = extractAuthorSurname(input.author);

  const plan: GoogleBooksQueryPlan[] = [];
  const seen = new Set<string>();
  const pushPlan = (item: GoogleBooksQueryPlan) => {
    const key = `${item.query}::${item.langRestrictPt ? "pt" : "all"}`;
    if (!seen.has(key)) {
      seen.add(key);
      plan.push(item);
    }
  };

  if (surname) {
    // 1ª tentativa: frases entre aspas sem acento e sem subtítulo (usando sobrenome ou autor limpo)
    pushPlan({
      strategy: "title_author_quoted",
      query: `intitle:"${mainTitle}" inauthor:"${surname}"`,
      langRestrictPt: true,
    });

    // 2ª tentativa: sem operadores (`q=título autor`) e SEM `langRestrict=pt`
    pushPlan({
      strategy: "title_author_plain",
      query: `${mainTitle} ${fullAuthor || surname}`.trim(),
      langRestrictPt: false,
    });

    if (fullAuthor && fullAuthor !== surname) {
      pushPlan({
        strategy: "title_surname_quoted",
        query: `intitle:"${mainTitle}" inauthor:"${fullAuthor}"`,
        langRestrictPt: true,
      });
    }
  } else {
    pushPlan({
      strategy: "title_author_quoted",
      query: `intitle:"${mainTitle}"`,
      langRestrictPt: true,
    });
    pushPlan({
      strategy: "title_author_plain",
      query: mainTitle,
      langRestrictPt: false,
    });
  }

  // Fallback só título (sem subtítulo)
  pushPlan({
    strategy: "title_only_quoted",
    query: `intitle:"${mainTitle}"`,
    langRestrictPt: false,
  });

  return plan;
}

/**
 * Descarta obras que contenham "Resumo", "Summary", "Análise", "Guia de estudo" etc.
 */
export function isDisqualifiedCoverTitle(title: string): boolean {
  const trimmed = title.trim();
  if (!trimmed) return true;
  return DISQUALIFIED_TITLE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Tokeniza o nome de um autor removendo acentos e preposições ("de", "da", "do"),
 * e também agrupa iniciais adjacentes de 1 letra (ex.: "B. J. Fogg" -> inclui "bj" e "fogg").
 */
export function tokenizeAuthor(name: string): string[] {
  const rawParts = normalizeCoverText(name)
    .split(" ")
    .filter((token) => token.length >= 1 && !AUTHOR_STOPWORDS.has(token));

  const tokens: string[] = [];
  let initialBuffer = "";

  for (const part of rawParts) {
    if (part.length === 1) {
      initialBuffer += part;
    } else {
      if (initialBuffer.length >= 2) {
        tokens.push(initialBuffer);
      }
      initialBuffer = "";
      tokens.push(part);
    }
  }
  if (initialBuffer.length >= 2) {
    tokens.push(initialBuffer);
  }

  return Array.from(new Set(tokens));
}

function extractSingleLetterInitials(name: string): string[] {
  return normalizeCoverText(name)
    .split(" ")
    .filter((t) => t.length === 1 && !AUTHOR_STOPWORDS.has(t));
}

export type AuthorMatchStatus = "exact" | "partial" | "missing" | "mismatch";

export interface AuthorMatchEvaluation {
  status: AuthorMatchStatus;
  matches: boolean;
  isAmbiguous: boolean;
  scoreDelta: number;
}

/**
 * Avalia o casamento de autor por tokens normalizados:
 * - Todos os tokens guardados presentes no autor da candidata -> `exact` (+35 pts, inclusive quando o livro
 *   guardou apenas o sobrenome como "Assis", "Greene" ou "Rosa").
 * - Sobreposição parcial (ex.: candidata só tem sobrenome "Lispector" ou "Maquiavel", ou iniciais compatíveis)
 *   -> `partial` (+12 pts, reduz pontuação em vez de rejeitar).
 * - Candidata sem metadado de autor -> `missing` (-15 pts, ambíguo, não rejeita).
 * - Autor divergente (ex.: coautor listado sozinho) -> `mismatch` (-30 pts, ambíguo, não rejeita na busca).
 */
export function evaluateAuthorMatch(
  requestedAuthor: string | undefined | null,
  candidateAuthors: readonly string[]
): AuthorMatchEvaluation {
  const reqTrimmed = requestedAuthor?.trim() ?? "";
  if (!reqTrimmed) {
    return {
      status: "exact",
      matches: true,
      isAmbiguous: false,
      scoreDelta: 20,
    };
  }
  if (!candidateAuthors || candidateAuthors.length === 0) {
    return {
      status: "missing",
      matches: false,
      isAmbiguous: true,
      scoreDelta: -15,
    };
  }

  const reqTokens = tokenizeAuthor(reqTrimmed);
  const reqInitials = extractSingleLetterInitials(reqTrimmed);
  if (reqTokens.length === 0 && reqInitials.length === 0) {
    return {
      status: "exact",
      matches: true,
      isAmbiguous: false,
      scoreDelta: 20,
    };
  }

  const reqSurname = extractAuthorSurname(reqTrimmed);
  let bestStatus: AuthorMatchStatus = "mismatch";

  for (const cand of candidateAuthors) {
    const candTokens = tokenizeAuthor(cand);
    if (candTokens.length === 0) continue;
    const candSet = new Set(candTokens);
    const candInitials = new Set(candTokens.map((t) => t[0]!));

    // Regra principal: todos os tokens guardados existem no autor da candidata
    const allReqTokensExist =
      reqTokens.length > 0 && reqTokens.every((t) => candSet.has(t));
    const allInitialsMatch =
      reqInitials.length === 0 ||
      reqInitials.every((init) => candInitials.has(init));

    if (allReqTokensExist && allInitialsMatch) {
      return {
        status: "exact",
        matches: true,
        isAmbiguous: false,
        scoreDelta: 35,
      };
    }

    // Todos os tokens da candidata existem no autor guardado (ex.: candidata tem só "Lispector" ou "Maquiavel")
    const allCandTokensInReq =
      candTokens.length > 0 && candTokens.every((t) => reqTokens.includes(t));
    if (allCandTokensInReq) {
      bestStatus = "partial";
      continue;
    }

    // Coincidência de sobrenome principal ou pelo menos 2 tokens compartilhados
    const shared = reqTokens.filter((t) => candSet.has(t));
    if (
      (reqSurname && candSet.has(reqSurname)) ||
      shared.length >= Math.min(2, reqTokens.length)
    ) {
      bestStatus = "partial";
    }
  }

  if (bestStatus === "partial") {
    return {
      status: "partial",
      matches: true,
      isAmbiguous: true,
      scoreDelta: 15,
    };
  }

  return {
    status: "mismatch",
    matches: false,
    isAmbiguous: true,
    scoreDelta: -30,
  };
}

/**
 * Mantém compatibilidade booleana para verificação de correspondência de autor:
 * aceita `exact` (todos os tokens guardados existem no autor da candidata, inclusive só sobrenome
 * como "Assis", "Greene", "Rosa") e `partial` (variações de iniciais/sobrenome).
 */
export function doesAuthorMatch(
  requestedAuthor: string | undefined | null,
  candidateAuthors: readonly string[]
): boolean {
  return evaluateAuthorMatch(requestedAuthor, candidateAuthors).matches;
}

/**
 * Verifica se uma URL ou dimensões correspondem a imagem inválida (1x1 ou placeholder de "imagem indisponível").
 */
export function isInvalidCoverPlaceholder(input: {
  url?: string | null;
  width?: number | null;
  height?: number | null;
}): boolean {
  const rawUrl = input.url?.trim() ?? "";
  if (!rawUrl) return true;
  if (PLACEHOLDER_URL_PATTERNS.some((re) => re.test(rawUrl))) {
    return true;
  }
  if (
    typeof input.width === "number" &&
    typeof input.height === "number" &&
    (input.width <= 2 || input.height <= 2)
  ) {
    return true;
  }
  return false;
}

/**
 * Valida dimensões pós-seleção (ou para capas perfeitas em 2:3):
 * - Largura mínima de 200px
 * - Proporção largura/altura entre 0.55 e 0.75 (retrato de capa de livro; audiobooks aceitam 1:1 opcional)
 */
export function isAcceptableCoverDimensions(
  width: number | undefined | null,
  height: number | undefined | null,
  options?: { allowSquare?: boolean }
): boolean {
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return false;
  }
  if (width < COVER_MIN_WIDTH_PX || height <= 0) return false;
  const ratio = width / height;
  if (options?.allowSquare && ratio >= 0.88 && ratio <= 1.08) {
    return true;
  }
  return ratio >= COVER_MIN_ASPECT_RATIO && ratio <= COVER_MAX_ASPECT_RATIO;
}

/**
 * Estima bônus de resolução/tamanho da candidata para ranqueamento (sem rejeitar por largura de metadados).
 */
export function estimateCoverResolutionBonus(
  candidate: Pick<CoverSearchCandidate, "coverUrl" | "width" | "height">
): number {
  if (
    typeof candidate.width === "number" &&
    typeof candidate.height === "number" &&
    candidate.width > 2 &&
    candidate.height > 2
  ) {
    if (candidate.width >= 600) return 14;
    if (candidate.width >= 400) return 11;
    if (candidate.width >= 200) return 8;
    return 4;
  }

  const url = candidate.coverUrl.toLowerCase();
  if (url.includes("zoom=3") || url.includes("600x600")) return 12;
  if (url.includes("-l.jpg") || url.includes("zoom=2")) return 10;
  if (url.includes("-m.jpg") || url.includes("zoom=1")) return 6;
  return 7;
}

/**
 * Calcula pontuação de correspondência (0..100) e define `uncertainMatch` ("correspondência incerta")
 * sem descartar candidatas por ambiguidade de autor ou largura de metadados.
 */
export function scoreCoverCandidate(
  query: {
    title?: string | null;
    author?: string | null;
    isbn?: string | null;
  },
  candidate: CoverSearchCandidate
): { matchScore: number; uncertainMatch: boolean } {
  let score = 30;
  let uncertain = false;

  const queryIsbn = query.isbn ? normalizeToIsbn13(query.isbn) : null;
  const candIsbn = candidate.isbn ? normalizeToIsbn13(candidate.isbn) : null;
  const isbnExact = Boolean(queryIsbn && candIsbn && queryIsbn === candIsbn);

  if (isbnExact) {
    score += 45;
  }

  // Avaliação de título (comparando tanto título completo quanto título principal sem subtítulo)
  const rawQueryTitle = query.title?.trim() ?? "";
  const normQueryFull = normalizeCoverText(rawQueryTitle);
  const normQueryMain = normalizeCoverText(
    stripBookTitleSubtitle(rawQueryTitle)
  );
  const normCandFull = normalizeCoverText(candidate.title);
  const normCandMain = normalizeCoverText(
    stripBookTitleSubtitle(candidate.title)
  );

  let titleMatchedStrongly = false;
  if (!normQueryMain) {
    titleMatchedStrongly = true;
  } else if (
    normCandFull === normQueryFull ||
    normCandMain === normQueryMain ||
    normCandFull === normQueryMain ||
    normCandMain === normQueryFull
  ) {
    score += 35;
    titleMatchedStrongly = true;
  } else {
    const queryTokens = normQueryMain.split(" ").filter((t) => t.length >= 2);
    const candTokens = new Set(
      normCandFull.split(" ").filter((t) => t.length >= 2)
    );
    const sharedCount = queryTokens.filter((t) => candTokens.has(t)).length;
    const ratio = queryTokens.length > 0 ? sharedCount / queryTokens.length : 0;

    if (ratio >= 0.8) {
      score += 22;
      titleMatchedStrongly = true;
    } else if (ratio >= 0.5) {
      score += 10;
      uncertain = true;
    } else {
      score -= 18;
      uncertain = true;
    }
  }

  // Avaliação de autor (reduz pontuação em vez de rejeitar)
  const authorEval = evaluateAuthorMatch(query.author, candidate.authors);
  score += authorEval.scoreDelta;
  if (authorEval.isAmbiguous && !isbnExact) {
    if (authorEval.status === "mismatch" || authorEval.status === "missing") {
      uncertain = true;
    } else if (!titleMatchedStrongly) {
      uncertain = true;
    }
  }

  // Bônus por resolução / tamanho
  score += estimateCoverResolutionBonus(candidate);

  const clampedScore = Math.max(5, Math.min(100, Math.round(score)));
  if (clampedScore < COVER_UNCERTAIN_SCORE_THRESHOLD && !isbnExact) {
    uncertain = true;
  }

  return {
    matchScore: clampedScore,
    uncertainMatch: uncertain,
  };
}

function normalizeCandidateCoverUrlKey(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    parsed.searchParams.delete("edge");
    return parsed.toString().toLowerCase();
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

/**
 * Deduplica candidatas por ISBN normalizado ou URL de imagem, ranqueia por pontuação + tamanho
 * e limita a 8 candidatas.
 */
export function deduplicateCoverCandidates(
  candidates: readonly CoverSearchCandidate[],
  limit = COVER_MAX_CANDIDATES,
  queryContext?: {
    title?: string | null;
    author?: string | null;
    isbn?: string | null;
  }
): CoverSearchCandidate[] {
  const scored = candidates
    .filter(
      (cand) =>
        !isInvalidCoverPlaceholder({
          url: cand.coverUrl,
          width: cand.width,
          height: cand.height,
        })
    )
    .map((cand, index) => {
      if (queryContext) {
        const { matchScore, uncertainMatch } = scoreCoverCandidate(
          queryContext,
          cand
        );
        return {
          cand: {
            ...cand,
            matchScore: cand.matchScore ?? matchScore,
            uncertainMatch: cand.uncertainMatch ?? uncertainMatch,
          },
          index,
        };
      }
      return { cand, index };
    });

  if (queryContext) {
    scored.sort((a, b) => {
      const scoreDiff = (b.cand.matchScore ?? 0) - (a.cand.matchScore ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      const resDiff =
        estimateCoverResolutionBonus(b.cand) -
        estimateCoverResolutionBonus(a.cand);
      if (resDiff !== 0) return resDiff;
      return a.index - b.index;
    });
  }

  const seenIsbns = new Set<string>();
  const seenUrls = new Set<string>();
  const out: CoverSearchCandidate[] = [];

  for (const { cand } of scored) {
    const urlKey = normalizeCandidateCoverUrlKey(cand.coverUrl);
    if (!urlKey || seenUrls.has(urlKey)) continue;

    const normIsbn = cand.isbn ? normalizeToIsbn13(cand.isbn) : null;
    if (normIsbn && seenIsbns.has(normIsbn)) continue;

    seenUrls.add(urlKey);
    if (normIsbn) seenIsbns.add(normIsbn);
    out.push(cand);

    if (out.length >= limit) break;
  }

  return out;
}

/**
 * Verifica se uma candidata corresponde de maneira inequívoca ao livro solicitado
 * (para aplicação direta no backfill sem precisar abrir o seletor manual):
 * - ISBN idêntico, OU
 * - Título normalizado idêntico (ou título principal sem subtítulo idêntico) E autor compatível,
 *   e não marcada como `uncertainMatch`.
 */
export function isUnambiguousCoverMatch(
  query: {
    title: string;
    author?: string | null;
    isbn?: string | null;
  },
  candidates: readonly CoverSearchCandidate[]
): CoverSearchCandidate | null {
  if (candidates.length === 0) return null;

  const queryIsbn = query.isbn ? normalizeToIsbn13(query.isbn) : null;
  if (queryIsbn) {
    const byIsbn = candidates.find(
      (c) =>
        c.isbn &&
        normalizeToIsbn13(c.isbn) === queryIsbn &&
        (!query.author?.trim() || doesAuthorMatch(query.author, c.authors))
    );
    if (byIsbn) return byIsbn;
  }

  const normQueryFull = normalizeCoverText(query.title);
  const normQueryMain = normalizeCoverText(stripBookTitleSubtitle(query.title));
  if (!normQueryMain) return null;

  for (const cand of candidates) {
    if (cand.uncertainMatch) continue;
    const normCandFull = normalizeCoverText(cand.title);
    const normCandMain = normalizeCoverText(stripBookTitleSubtitle(cand.title));
    const titleMatches =
      normCandFull === normQueryFull ||
      normCandMain === normQueryMain ||
      normCandFull === normQueryMain ||
      normCandMain === normQueryFull;
    if (
      titleMatches &&
      (!query.author?.trim() || doesAuthorMatch(query.author, cand.authors))
    ) {
      return cand;
    }
  }

  return null;
}

const PROVIDER_SHORT_LABELS: Record<CoverProviderSource, string> = {
  brasilapi: "br",
  google: "google",
  openlibrary: "ol",
  hardcover: "hc",
  apple: "apple",
  upload: "upload",
};

/**
 * Monta o texto real e compacto para o selo de dev (ex.: `google: 0 resultados · ol: 404 · filtro: autor`).
 */
export function formatDiagnosticDevBadge(
  attempts: readonly CoverProviderAttemptDiagnostic[]
): string {
  const activeAttempts = attempts.filter((a) => a.status !== "skipped");
  if (activeAttempts.length === 0) {
    return "sem consulta ativa";
  }

  // Agrupa por provedor para resumir de forma concisa
  const byProvider = new Map<
    CoverProviderSource,
    {
      statuses: Set<CoverProviderAttemptStatus>;
      httpStatuses: number[];
      totalResults: number;
      candidatesFound: number;
    }
  >();

  let rejAuthor = 0;
  let rejSummary = 0;
  let rejDimension = 0;
  let rejNoImage = 0;

  for (const att of activeAttempts) {
    const entry = byProvider.get(att.provider) ?? {
      statuses: new Set<CoverProviderAttemptStatus>(),
      httpStatuses: [],
      totalResults: 0,
      candidatesFound: 0,
    };
    entry.statuses.add(att.status);
    if (typeof att.httpStatus === "number") {
      entry.httpStatuses.push(att.httpStatus);
    }
    entry.totalResults += att.totalResults ?? 0;
    entry.candidatesFound += att.candidatesFound;
    byProvider.set(att.provider, entry);

    rejAuthor += att.rejectedByAuthor ?? 0;
    rejSummary += att.rejectedBySummary ?? 0;
    rejDimension +=
      (att.rejectedByDimension ?? 0) + (att.rejectedByQuality ?? 0);
    rejNoImage += att.rejectedByMissingImageLinks ?? 0;
  }

  const parts: string[] = [];
  for (const [provider, info] of byProvider.entries()) {
    const label = PROVIDER_SHORT_LABELS[provider] ?? provider;
    const rateCode = info.httpStatuses.find((s) => s === 429 || s === 403);
    const has404 = info.httpStatuses.includes(404);
    const errCode = info.httpStatuses.find((s) => s >= 500);

    if (info.candidatesFound > 0) {
      parts.push(`${label}: ${info.candidatesFound} ok`);
    } else if (info.statuses.has("rate_limited") || rateCode) {
      parts.push(`${label}: ${rateCode ?? 429}`);
    } else if (has404 && info.totalResults === 0) {
      parts.push(`${label}: 404`);
    } else if (info.statuses.has("api_error")) {
      parts.push(`${label}: ${errCode ?? "erro/timeout"}`);
    } else if (info.totalResults > 0) {
      parts.push(`${label}: 0/${info.totalResults}`);
    } else {
      parts.push(`${label}: 0 resultados`);
    }
  }

  const filterReasons: string[] = [];
  if (rejAuthor > 0) filterReasons.push("autor");
  if (rejSummary > 0) filterReasons.push('"resumo"');
  if (rejDimension > 0) filterReasons.push("dimensão");
  if (rejNoImage > 0) filterReasons.push("sem imageLinks");

  if (filterReasons.length > 0) {
    parts.push(`filtro: ${filterReasons.join(", ")}`);
  }

  return parts.join(" · ");
}

/**
 * Classifica o diagnóstico consolidado (somente para desenvolvimento) quando a busca termina.
 */
export function classifyCoverSearchDiagnostic(
  candidatesCount: number,
  attempts: CoverProviderAttemptDiagnostic[]
): CoverSearchDiagnostic {
  const queriesSent: CoverSearchQueryLog[] = [];
  for (const att of attempts) {
    if (att.queries?.length) {
      queriesSent.push(...att.queries);
    } else if (att.query) {
      queriesSent.push({
        provider: att.provider,
        strategy: att.strategy ?? "default",
        query: att.query,
        httpStatus: att.httpStatus,
        totalResults: att.totalResults ?? 0,
        acceptedCount: att.candidatesFound,
        rejectedByAuthor: att.rejectedByAuthor ?? 0,
        rejectedBySummary: att.rejectedBySummary ?? 0,
        rejectedByDimension:
          (att.rejectedByDimension ?? 0) + (att.rejectedByQuality ?? 0),
        rejectedByMissingImageLinks: att.rejectedByMissingImageLinks ?? 0,
        errorDetail: att.detail,
      });
    }
  }

  const badgePtBr = formatDiagnosticDevBadge(attempts);

  if (candidatesCount > 0) {
    return {
      reason: "ok",
      reasonPtBr: `capa encontrada (${badgePtBr})`,
      badgePtBr,
      attempts,
      queriesSent,
    };
  }

  const totalQualityRejected = attempts.reduce(
    (acc, a) =>
      acc +
      (a.rejectedByQuality ?? 0) +
      (a.rejectedByDimension ?? 0) +
      (a.rejectedBySummary ?? 0) +
      (a.rejectedByAuthor ?? 0),
    0
  );
  if (
    totalQualityRejected > 0 ||
    attempts.some((a) => a.status === "quality_filter")
  ) {
    return {
      reason: "quality_filter",
      reasonPtBr: `descartada pelo filtro de qualidade (${badgePtBr})`,
      badgePtBr,
      attempts,
      queriesSent,
    };
  }

  const hasApiError = attempts.some(
    (a) => a.status === "api_error" || a.status === "rate_limited"
  );
  if (hasApiError) {
    return {
      reason: "api_error",
      reasonPtBr: `erro de API (${badgePtBr})`,
      badgePtBr,
      attempts,
      queriesSent,
    };
  }

  return {
    reason: "no_results",
    reasonPtBr: `nenhum resultado (${badgePtBr})`,
    badgePtBr,
    attempts,
    queriesSent,
  };
}

/* ============================================================================
   REGISTRO EM MEMÓRIA DE DIAGNÓSTICO DE DEV (propaga o motivo real ao BookCover)
   ============================================================================ */

const devCoverDiagnosticsMap = new Map<string, string>();
const devCoverDiagnosticListeners = new Set<() => void>();

export function buildDevCoverDiagnosticKey(input: {
  editionId?: string | null;
  title?: string | null;
  isbn?: string | null;
}): string {
  if (input.editionId?.trim()) return `ed:${input.editionId.trim()}`;
  if (input.isbn?.trim()) return `isbn:${input.isbn.trim()}`;
  return `title:${normalizeCoverText(input.title ?? "")}`;
}

export function recordDevCoverDiagnostic(
  input: {
    editionId?: string | null;
    title?: string | null;
    isbn?: string | null;
  },
  badgePtBr: string
): void {
  if (!badgePtBr.trim()) return;
  const keys = new Set<string>();
  if (input.editionId?.trim()) keys.add(`ed:${input.editionId.trim()}`);
  if (input.isbn?.trim()) keys.add(`isbn:${input.isbn.trim()}`);
  if (input.title?.trim()) {
    keys.add(`title:${normalizeCoverText(input.title)}`);
    keys.add(
      `title:${normalizeCoverText(stripBookTitleSubtitle(input.title))}`
    );
  }
  let changed = false;
  for (const k of keys) {
    if (devCoverDiagnosticsMap.get(k) !== badgePtBr) {
      devCoverDiagnosticsMap.set(k, badgePtBr);
      changed = true;
    }
  }
  if (changed) {
    for (const listener of devCoverDiagnosticListeners) {
      listener();
    }
  }
}

export function getDevCoverDiagnostic(input: {
  editionId?: string | null;
  title?: string | null;
  isbn?: string | null;
}): string | undefined {
  if (input.editionId?.trim()) {
    const byEd = devCoverDiagnosticsMap.get(`ed:${input.editionId.trim()}`);
    if (byEd) return byEd;
  }
  if (input.isbn?.trim()) {
    const byIsbn = devCoverDiagnosticsMap.get(`isbn:${input.isbn.trim()}`);
    if (byIsbn) return byIsbn;
  }
  if (input.title?.trim()) {
    const byTitle = devCoverDiagnosticsMap.get(
      `title:${normalizeCoverText(input.title)}`
    );
    if (byTitle) return byTitle;
    const byMain = devCoverDiagnosticsMap.get(
      `title:${normalizeCoverText(stripBookTitleSubtitle(input.title))}`
    );
    if (byMain) return byMain;
  }
  return undefined;
}

export function subscribeDevCoverDiagnostics(listener: () => void): () => void {
  devCoverDiagnosticListeners.add(listener);
  return () => {
    devCoverDiagnosticListeners.delete(listener);
  };
}

/* ============================================================================
   PALETA EDITORIAL DETERMINÍSTICA DE FALLBACK (para BookCover tipográfica)
   ============================================================================ */

const FLAT_GRAY_CHARCOAL_HEXES = new Set([
  "#141514",
  "#181918",
  "#1a1b1a",
  "#1c1d1c",
  "#1e201e",
  "#222422",
  "#262724",
]);

function fnv1aHash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function relativeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return 0.15;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export interface BookCoverFallbackPalette {
  backgroundHex: string;
  accentHex: string;
  inkHex: string;
  mutedInkHex: string;
  borderHex: string;
  isLightBackground: boolean;
}

/**
 * Resolve as cores vivas e editoriais da capa tipográfica de fallback:
 * - Respeita `spineColor` e `spineAccent` persistidos na edição quando não forem cinza-chumbo genérico.
 * - Caso contrário, deriva cor determinística pelo hash do `id`/`seed` na paleta editorial.
 */
export function resolveBookCoverFallbackPalette(params: {
  spineColor?: string | null;
  spineAccent?: string | null;
  seed: string;
  avoidNeighborHex?: string | null;
}): BookCoverFallbackPalette {
  const rawBg = params.spineColor?.trim().toLowerCase() ?? "";
  const hasDistinctStoredColor =
    /^#[0-9a-f]{6}$/i.test(rawBg) && !FLAT_GRAY_CHARCOAL_HEXES.has(rawBg);

  const hashIndex =
    fnv1aHash(params.seed || "readingflow-cover") %
    EDITORIAL_SPINE_PALETTE.length;
  let pickedPaletteHex = EDITORIAL_SPINE_PALETTE[hashIndex]!;
  if (
    params.avoidNeighborHex &&
    pickedPaletteHex.toLowerCase() ===
      params.avoidNeighborHex.trim().toLowerCase()
  ) {
    pickedPaletteHex =
      EDITORIAL_SPINE_PALETTE[
        (hashIndex + 1) % EDITORIAL_SPINE_PALETTE.length
      ]!;
  }

  const baseHex = hasDistinctStoredColor
    ? clampPaperHsl(params.spineColor!.trim())
    : clampPaperHsl(pickedPaletteHex);

  const accentHex =
    params.spineAccent && /^#[0-9a-f]{6}$/i.test(params.spineAccent.trim())
      ? clampPaperHsl(params.spineAccent.trim())
      : deriveSpineAccentHex(baseHex, params.seed || "readingflow-cover");

  const lum = relativeLuminance(baseHex);
  const isLightBackground = lum > 0.36;

  return {
    backgroundHex: baseHex,
    accentHex,
    inkHex: isLightBackground ? "#1E1915" : "#F4EFE6",
    mutedInkHex: isLightBackground
      ? "rgba(30, 25, 21, 0.74)"
      : "rgba(244, 239, 230, 0.78)",
    borderHex: isLightBackground
      ? "rgba(30, 25, 21, 0.24)"
      : "rgba(200, 164, 110, 0.42)",
    isLightBackground,
  };
}

export interface CoverCoverageStats {
  total: number;
  withRealCover: number;
  withoutCover: number;
  coveragePercent: number;
}

/**
 * Calcula a cobertura real de capas do acervo (quantos livros possuem `coverUrl` persistida).
 */
export function computeCoverCoverageStats(
  items: readonly { coverUrl?: string | null }[]
): CoverCoverageStats {
  const total = items.length;
  if (total === 0) {
    return {
      total: 0,
      withRealCover: 0,
      withoutCover: 0,
      coveragePercent: 0,
    };
  }
  let withRealCover = 0;
  for (const item of items) {
    if (item.coverUrl && item.coverUrl.trim().length > 0) {
      withRealCover += 1;
    }
  }
  const withoutCover = total - withRealCover;
  const coveragePercent = Math.round((withRealCover / total) * 100);
  return {
    total,
    withRealCover,
    withoutCover,
    coveragePercent,
  };
}
