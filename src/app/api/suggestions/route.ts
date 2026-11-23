import { NextResponse, type NextRequest } from "next/server";
import { DEMO_READONLY_CODE, DEMO_READONLY_ERROR } from "@/lib/auth-demo";
import {
  getAuthenticatedWorkspace,
  isDemoWorkspace,
} from "@/server/store/memory-repository";
import { getServerEnv } from "@/lib/env";
import { checkSlidingRateLimit } from "@/server/security/sanitize";
import {
  BookSearchUnavailableError,
  searchBooksOnline,
} from "@/server/catalog/search";
import { suggestionsQuerySchema } from "@/features/suggestions/schema";
import {
  buildNewBookDiscoveryQuery,
  filterNewBookSuggestions,
} from "@/features/suggestions/rules";
import { computeWorkFingerprint } from "@/features/catalog/rules";
import { normalizeToIsbn13 } from "@/lib/isbn";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ws = await getAuthenticatedWorkspace();
  if (!ws) {
    return NextResponse.json(
      { ok: false, error: "Não autenticado." },
      { status: 401 }
    );
  }
  if (isDemoWorkspace(ws)) {
    return NextResponse.json(
      { ok: false, error: DEMO_READONLY_ERROR, code: DEMO_READONLY_CODE },
      { status: 403, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const parsed = suggestionsQuerySchema.safeParse({
    mode: request.nextUrl.searchParams.get("mode") ?? "new_books",
    genre: request.nextUrl.searchParams.get("genre") ?? "todos",
    batch: request.nextUrl.searchParams.get("batch") ?? "0",
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error:
          parsed.error.issues[0]?.message ??
          "Parâmetros de sugestão inválidos.",
      },
      { status: 400 }
    );
  }

  const env = getServerEnv();
  const rl = checkSlidingRateLimit(
    `book-suggestions:${ws.profile.id}`,
    env.RATE_LIMIT_MAX_PER_MINUTE
  );
  if (!rl.allowed) {
    return NextResponse.json(
      {
        ok: false,
        serviceUnavailable: true,
        error: `Muitas solicitações seguidas. Aguarde ${rl.retryAfterSeconds}s e tente novamente.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      }
    );
  }

  const worksById = new Map(ws.works.map((w) => [w.id, w]));
  const editionsById = new Map(ws.editions.map((e) => [e.id, e]));

  // Conjuntos de obras/ISBNs já no acervo do usuário (excluídas estritamente do modo Novos Livros)
  const ownedWorkIds = new Set<string>();
  const ownedIsbn13s = new Set<string>();
  const ownedFingerprints = new Set<string>();

  for (const item of ws.items) {
    const ed = editionsById.get(item.editionId);
    if (!ed) continue;
    ownedWorkIds.add(ed.workId);
    if (ed.isbn13) {
      const n = normalizeToIsbn13(ed.isbn13);
      if (n) ownedIsbn13s.add(n);
    }
    if (ed.isbn10) {
      const n = normalizeToIsbn13(ed.isbn10);
      if (n) ownedIsbn13s.add(n);
    }
  }
  for (const reading of ws.readings) {
    ownedWorkIds.add(reading.workId);
  }
  for (const workId of ownedWorkIds) {
    const work = worksById.get(workId);
    if (!work) continue;
    if (work.fingerprint) ownedFingerprints.add(work.fingerprint);
    const author =
      work.contributors.find((c) => c.role === "author")?.name ?? "";
    ownedFingerprints.add(computeWorkFingerprint(work.title, author, "pt-BR"));
  }
  for (const ed of ws.editions) {
    if (!ownedWorkIds.has(ed.workId)) continue;
    if (ed.isbn13) {
      const n = normalizeToIsbn13(ed.isbn13);
      if (n) ownedIsbn13s.add(n);
    }
    if (ed.isbn10) {
      const n = normalizeToIsbn13(ed.isbn10);
      if (n) ownedIsbn13s.add(n);
    }
  }

  // Conjuntos de obras na Lista de Desejos ativa (para marcar como "Já nos desejos")
  const wishlistIsbn13s = new Set<string>();
  const wishlistFingerprints = new Set<string>();
  for (const wish of ws.wishlist) {
    if (wish.status !== "wanted") continue;
    const work = worksById.get(wish.workId);
    if (work) {
      if (work.fingerprint) wishlistFingerprints.add(work.fingerprint);
      const author =
        work.contributors.find((c) => c.role === "author")?.name ?? "";
      wishlistFingerprints.add(
        computeWorkFingerprint(work.title, author, "pt-BR")
      );
    }
    const ed = wish.editionId ? editionsById.get(wish.editionId) : undefined;
    if (ed?.isbn13) {
      const n = normalizeToIsbn13(ed.isbn13);
      if (n) wishlistIsbn13s.add(n);
    }
  }

  const ownedGenres = [
    ...new Set(
      ws.works
        .filter((w) => ownedWorkIds.has(w.id))
        .map((w) => w.primaryGenre?.trim() ?? "")
        .filter((g) => g.length >= 3)
    ),
  ];

  const queryUsed = buildNewBookDiscoveryQuery({
    genreFilter: parsed.data.genre,
    ownedGenres,
    batchIndex: parsed.data.batch,
  });

  try {
    let activeQuery = queryUsed;
    let response = await searchBooksOnline(activeQuery, {
      signal: request.signal,
    });
    let items = filterNewBookSuggestions(response.results, {
      ownedIsbn13s,
      ownedFingerprints,
      wishlistIsbn13s,
      wishlistFingerprints,
      limit: 8,
    });

    // Se a consulta específica veio vazia após excluir livros já no acervo, tenta uma consulta editorial ampla
    if (items.length === 0 && activeQuery !== "romance brasileiro") {
      activeQuery = "romance brasileiro";
      response = await searchBooksOnline(activeQuery, {
        signal: request.signal,
      });
      items = filterNewBookSuggestions(response.results, {
        ownedIsbn13s,
        ownedFingerprints,
        wishlistIsbn13s,
        wishlistFingerprints,
        limit: 8,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        items,
        source: response.fonte,
        queryUsed: activeQuery,
        batch: parsed.data.batch,
      },
      {
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return new NextResponse(null, { status: 499 });
    }
    if (error instanceof BookSearchUnavailableError) {
      return NextResponse.json(
        {
          ok: false,
          serviceUnavailable: true,
          error:
            "Catálogo externo temporariamente indisponível. Tente novamente em instantes.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      {
        ok: false,
        serviceUnavailable: true,
        error: "Não foi possível carregar novas sugestões agora.",
      },
      { status: 503 }
    );
  }
}
