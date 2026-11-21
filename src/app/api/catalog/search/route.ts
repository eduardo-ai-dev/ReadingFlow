import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAuthenticatedWorkspace } from "@/server/store/memory-repository";
import { getServerEnv } from "@/lib/env";
import { checkSlidingRateLimit } from "@/server/security/sanitize";
import {
  BookSearchUnavailableError,
  searchBooksOnline,
} from "@/server/catalog/search";
import {
  BOOK_SEARCH_MAX_CHARS,
  BOOK_SEARCH_MIN_CHARS,
  normalizeSearchQuery,
} from "@/features/catalog/search-types";

const searchQuerySchema = z.object({
  q: z
    .string()
    .max(BOOK_SEARCH_MAX_CHARS * 2, "Termo de busca muito longo.")
    .transform((value) => normalizeSearchQuery(value))
    .refine(
      (value): value is string => value !== null,
      `Digite ao menos ${BOOK_SEARCH_MIN_CHARS} caracteres para buscar.`
    ),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ws = await getAuthenticatedWorkspace();
  if (!ws) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const parsed = searchQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Termo de busca inválido." },
      { status: 400 }
    );
  }

  const env = getServerEnv();
  const rl = checkSlidingRateLimit(
    `book-search:${ws.profile.id}`,
    env.RATE_LIMIT_MAX_PER_MINUTE
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Muitas buscas seguidas. Aguarde ${rl.retryAfterSeconds}s.` },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      }
    );
  }

  try {
    const result = await searchBooksOnline(parsed.data.q, {
      signal: request.signal,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, max-age=120" },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return new NextResponse(null, { status: 499 });
    }
    if (error instanceof BookSearchUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return NextResponse.json(
      { error: "Não foi possível consultar a base online." },
      { status: 502 }
    );
  }
}
