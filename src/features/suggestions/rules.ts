import { computeWorkFingerprint } from "@/features/catalog/rules";
import type { BookSearchResult } from "@/features/catalog/search-types";
import { normalizeToIsbn13 } from "@/lib/isbn";
import type { Reading } from "@/lib/domain";

export type BookSuggestionMode = "wishlist" | "new_books";

export type SuggestionGenreKey =
  | "todos"
  | "literatura-brasileira"
  | "ficcao"
  | "fantasia"
  | "classicos"
  | "filosofia"
  | "nao-ficcao"
  | "suspense";

export interface SuggestionGenreOption {
  key: SuggestionGenreKey;
  label: string;
  queries: readonly string[];
}

export const SUGGESTION_GENRE_OPTIONS: readonly SuggestionGenreOption[] = [
  {
    key: "todos",
    label: "Para você",
    queries: [
      "romance brasileiro",
      "clarice lispector",
      "jorge amado",
      "ficcao cientifica",
      "fantasia",
      "filosofia",
    ],
  },
  {
    key: "literatura-brasileira",
    label: "Literatura Brasileira",
    queries: [
      "romance brasileiro",
      "literatura brasileira",
      "jorge amado",
      "graciliano ramos",
    ],
  },
  {
    key: "ficcao",
    label: "Ficção",
    queries: ["romance", "contos", "ficcao cientifica", "distopia"],
  },
  {
    key: "fantasia",
    label: "Fantasia",
    queries: ["fantasia", "tolkien", "ursula le guin"],
  },
  {
    key: "classicos",
    label: "Clássicos",
    queries: ["dostoievski", "jane austen", "franz kafka", "machado de assis"],
  },
  {
    key: "filosofia",
    label: "Filosofia",
    queries: ["filosofia", "estoicismo", "albert camus"],
  },
  {
    key: "nao-ficcao",
    label: "Não-ficção",
    queries: ["historia brasil", "biografia", "ciencia"],
  },
  {
    key: "suspense",
    label: "Suspense",
    queries: ["suspense", "agatha christie", "misterio"],
  },
] as const;

export interface WishlistSuggestionItem {
  wishId: string;
  workId: string;
  title: string;
  author: string;
  genre?: string;
  priority: 1 | 2 | 3 | 4 | 5;
  targetPrice?: number;
  coverUrl?: string;
  spineColor?: string;
  spineAccent?: string;
  seed: string;
  createdAt: string;
}

export interface NewBookSuggestionItem {
  id: string;
  source: "google_books" | "open_library";
  title: string;
  author: string;
  genre?: string;
  isbn?: string;
  pages?: number | null;
  year?: number | null;
  coverUrl?: string;
  fingerprint: string;
  alreadyInWishlist: boolean;
}

export interface WishlistEligibilityInput {
  wishId: string;
  workId: string;
  status: "wanted" | "purchased" | "dropped";
  title: string;
  author: string;
  genre?: string;
  priority: 1 | 2 | 3 | 4 | 5;
  targetPrice?: number;
  coverUrl?: string;
  spineColor?: string;
  spineAccent?: string;
  seed: string;
  createdAt: string;
}

/**
 * Seleciona estritamente itens da Lista de Desejos elegíveis como sugestão:
 * - apenas `status === "wanted"`
 * - exclui obras já lidas (`finished`), em leitura (`reading`/`paused`) ou já no acervo
 * - exclui IDs descartados na sessão atual
 * - ordena por maior prioridade e, em empate, mais recente
 */
export function pickWishlistSuggestions(
  entries: readonly WishlistEligibilityInput[],
  options: {
    ownedWorkIds?: ReadonlySet<string>;
    readings?: readonly Pick<Reading, "workId" | "status">[];
    excludedWishIds?: ReadonlySet<string>;
  } = {}
): WishlistSuggestionItem[] {
  const ownedWorkIds = options.ownedWorkIds ?? new Set<string>();
  const excludedWishIds = options.excludedWishIds ?? new Set<string>();
  const blockedReadingWorkIds = new Set<string>();

  for (const r of options.readings ?? []) {
    if (
      r.status === "reading" ||
      r.status === "paused" ||
      r.status === "finished"
    ) {
      blockedReadingWorkIds.add(r.workId);
    }
  }

  return entries
    .filter((entry) => {
      if (entry.status !== "wanted") return false;
      if (excludedWishIds.has(entry.wishId)) return false;
      if (ownedWorkIds.has(entry.workId)) return false;
      if (blockedReadingWorkIds.has(entry.workId)) return false;
      return true;
    })
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.createdAt.localeCompare(a.createdAt);
    })
    .map((entry) => ({
      wishId: entry.wishId,
      workId: entry.workId,
      title: entry.title,
      author: entry.author,
      genre: entry.genre,
      priority: entry.priority,
      targetPrice: entry.targetPrice,
      coverUrl: normalizeSuggestionCoverUrl(entry.coverUrl),
      spineColor: entry.spineColor,
      spineAccent: entry.spineAccent,
      seed: entry.seed,
      createdAt: entry.createdAt,
    }));
}

/**
 * Normaliza e valida URLs externas de capa vindas de resultados de busca:
 * aceita somente HTTPS válido (promove http:// de Google Books / Open Library para https://).
 */
export function normalizeSuggestionCoverUrl(
  rawUrl?: string | null
): string | undefined {
  if (!rawUrl) return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;

  let candidate = trimmed;
  if (candidate.startsWith("http://")) {
    candidate = `https://${candidate.slice("http://".length)}`;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:") return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

/**
 * Filtra resultados de busca externa para o modo "Novos Livros":
 * - exclui estritamente qualquer obra já presente no acervo do usuário (por ISBN-13 ou fingerprint título+autor)
 * - exclui itens sem título válido ou já descartados
 * - deduplica por ISBN-13 e fingerprint
 * - sinaliza `alreadyInWishlist` quando a obra já está na Lista de Desejos
 */
export function filterNewBookSuggestions(
  candidates: readonly BookSearchResult[],
  options: {
    ownedIsbn13s?: ReadonlySet<string>;
    ownedFingerprints?: ReadonlySet<string>;
    wishlistIsbn13s?: ReadonlySet<string>;
    wishlistFingerprints?: ReadonlySet<string>;
    excludedIds?: ReadonlySet<string>;
    limit?: number;
  } = {}
): NewBookSuggestionItem[] {
  const ownedIsbn13s = options.ownedIsbn13s ?? new Set<string>();
  const ownedFingerprints = options.ownedFingerprints ?? new Set<string>();
  const wishlistIsbn13s = options.wishlistIsbn13s ?? new Set<string>();
  const wishlistFingerprints =
    options.wishlistFingerprints ?? new Set<string>();
  const excludedIds = options.excludedIds ?? new Set<string>();
  const limit = options.limit ?? 12;

  const seenFingerprints = new Set<string>();
  const seenIsbns = new Set<string>();
  const out: NewBookSuggestionItem[] = [];

  for (const cand of candidates) {
    const title = cand.titulo?.trim();
    if (!title || title.length < 2) continue;
    if (excludedIds.has(cand.id)) continue;

    const author = cand.autor?.trim() || "Autor desconhecido";
    const isbn13 = cand.isbn ? normalizeToIsbn13(cand.isbn) : null;
    const fingerprint = computeWorkFingerprint(title, author, "pt-BR");

    // Exclui qualquer livro já pertencente à biblioteca do usuário
    if (isbn13 && ownedIsbn13s.has(isbn13)) continue;
    if (ownedFingerprints.has(fingerprint)) continue;

    // Deduplica dentro do lote
    if (isbn13 && seenIsbns.has(isbn13)) continue;
    if (seenFingerprints.has(fingerprint)) continue;

    if (isbn13) seenIsbns.add(isbn13);
    seenFingerprints.add(fingerprint);

    const bestCover =
      normalizeSuggestionCoverUrl(cand.capas?.[0]) ??
      normalizeSuggestionCoverUrl(cand.miniatura);

    const alreadyInWishlist =
      Boolean(isbn13 && wishlistIsbn13s.has(isbn13)) ||
      wishlistFingerprints.has(fingerprint);

    out.push({
      id: cand.id,
      source: cand.fonte,
      title,
      author,
      genre: cand.genero?.trim() || undefined,
      isbn: isbn13 ?? (cand.isbn?.trim() || undefined),
      pages:
        typeof cand.numero_paginas === "number" && cand.numero_paginas > 0
          ? cand.numero_paginas
          : null,
      year: typeof cand.ano === "number" && cand.ano > 0 ? cand.ano : null,
      coverUrl: bestCover,
      fingerprint,
      alreadyInWishlist,
    });

    if (out.length >= limit) break;
  }

  return out;
}

/**
 * Monta a consulta de descoberta para o modo "Novos Livros", rotacionando entre
 * consultas editoriais ou gêneros reais do acervo conforme o lote (`batchIndex`).
 */
export function buildNewBookDiscoveryQuery(params: {
  genreFilter?: SuggestionGenreKey;
  ownedGenres?: readonly string[];
  batchIndex?: number;
}): string {
  const batch = Math.max(0, Math.floor(params.batchIndex ?? 0));
  const genreKey = params.genreFilter ?? "todos";

  if (genreKey === "todos") {
    const cleanOwnedGenres = (params.ownedGenres ?? [])
      .map((g) =>
        g
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .join(" ")
      )
      .filter(
        (g) =>
          g.length >= 4 && !/acervo geral|miscelanea|auditoria|teste/i.test(g)
      );

    const basePool = SUGGESTION_GENRE_OPTIONS[0]!.queries;
    const combinedPool = [...basePool, ...cleanOwnedGenres.slice(0, 3)];
    return combinedPool[batch % combinedPool.length]!;
  }

  const option =
    SUGGESTION_GENRE_OPTIONS.find((opt) => opt.key === genreKey) ??
    SUGGESTION_GENRE_OPTIONS[0]!;
  return option.queries[batch % option.queries.length]!;
}
