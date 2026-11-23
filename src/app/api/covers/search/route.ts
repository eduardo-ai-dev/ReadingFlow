import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_READONLY_CODE, DEMO_READONLY_ERROR } from "@/lib/auth-demo";
import {
  getAuthenticatedWorkspace,
  isDemoWorkspace,
} from "@/server/store/memory-repository";
import { getServerEnv } from "@/lib/env";
import {
  checkSlidingRateLimit,
  sanitizePlainText,
} from "@/server/security/sanitize";
import {
  searchBookCovers,
  type CoverSearchResponse,
} from "@/server/catalog/cover-search";
import { importCoverFromExternalUrl } from "@/server/catalog/cover-url-import";

const querySchema = z
  .object({
    title: z.string().trim().max(300).optional(),
    author: z.string().trim().max(200).optional(),
    isbn: z.string().trim().max(24).optional(),
    format: z.enum(["book", "ebook", "audiobook"]).optional(),
    nocache: z.enum(["0", "1"]).optional(),
  })
  .refine((val) => Boolean((val.title && val.title.length >= 2) || val.isbn), {
    message: "Informe pelo menos o título (mín. 2 caracteres) ou o ISBN.",
  });

const importUrlBodySchema = z.object({
  url: z
    .string()
    .trim()
    .min(8, "Informe um link HTTPS válido.")
    .max(2048, "O link da imagem é longo demais."),
  editionId: z.string().trim().max(120).optional(),
});

/**
 * GET /api/covers/search?title=...&author=...&isbn=...&format=book|ebook|audiobook
 *
 * Cadeia server-side de capas reais:
 * - Com ISBN: BrasilAPI `/api/isbn/v1/{isbn}` (`cover_url` e `page_count`) ->
 *   Google Books -> Open Library (`?default=false`) -> Hardcover (GraphQL, token só no servidor) ->
 *   [Apple iTunes Search se feature flag `ENABLE_APPLE_BOOKS_COVERS=true`] -> upload manual.
 * - Sem ISBN: Google Books (frases entre aspas -> sem operadores sem langRestrict) ->
 *   Open Library (`search.json`) -> Hardcover -> [Apple se flag ligada] -> seletor + upload manual.
 * - `GOOGLE_BOOKS_API_KEY` e `HARDCOVER_API_TOKEN` ficam estritamente no servidor.
 */
const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  const ws = await getAuthenticatedWorkspace();
  if (!ws) {
    return NextResponse.json(
      { error: "Sessão não autenticada." },
      { status: 401, headers: PRIVATE_NO_STORE }
    );
  }
  if (isDemoWorkspace(ws)) {
    return NextResponse.json(
      { error: DEMO_READONLY_ERROR, code: DEMO_READONLY_CODE },
      { status: 403, headers: PRIVATE_NO_STORE }
    );
  }

  const rawParams = {
    title: request.nextUrl.searchParams.get("title") ?? undefined,
    author: request.nextUrl.searchParams.get("author") ?? undefined,
    isbn: request.nextUrl.searchParams.get("isbn") ?? undefined,
    format: request.nextUrl.searchParams.get("format") ?? undefined,
    nocache: request.nextUrl.searchParams.get("nocache") ?? undefined,
  };

  const parsed = querySchema.safeParse(rawParams);
  if (!parsed.success) {
    const empty: CoverSearchResponse = {
      candidates: [],
      degraded: false,
      googleRateLimited: false,
      apiUnavailable: false,
      fallbackToManualUpload: true,
    };
    return NextResponse.json(empty, { status: 400, headers: PRIVATE_NO_STORE });
  }

  const env = getServerEnv();
  const limit = checkSlidingRateLimit(
    `cover-search:${ws.profile.id}`,
    Math.max(120, env.RATE_LIMIT_MAX_PER_MINUTE * 2)
  );
  if (!limit.allowed) {
    const rateLimitedPayload: CoverSearchResponse = {
      candidates: [],
      degraded: true,
      googleRateLimited: false,
      apiUnavailable: true,
      fallbackToManualUpload: true,
      notice: `Serviço indisponível, tentar de novo (aguarde ${limit.retryAfterSeconds}s).`,
    };
    return NextResponse.json(rateLimitedPayload, {
      status: 429,
      headers: {
        ...PRIVATE_NO_STORE,
        "Retry-After": String(limit.retryAfterSeconds),
      },
    });
  }

  const cleanTitle = parsed.data.title
    ? sanitizePlainText(parsed.data.title, 300)
    : undefined;
  const cleanAuthor = parsed.data.author
    ? sanitizePlainText(parsed.data.author, 200)
    : undefined;
  const cleanIsbn = parsed.data.isbn
    ? sanitizePlainText(parsed.data.isbn, 24)
    : undefined;

  try {
    const result = await searchBookCovers({
      title: cleanTitle,
      author: cleanAuthor,
      isbn: cleanIsbn,
      format: parsed.data.format ?? "book",
      bypassCache: parsed.data.nocache === "1",
    });

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control":
          parsed.data.nocache === "1" ||
          result.degraded ||
          result.apiUnavailable
            ? "private, no-store"
            : "private, max-age=120, stale-while-revalidate=600",
      },
    });
  } catch {
    const fallback: CoverSearchResponse = {
      candidates: [],
      degraded: true,
      googleRateLimited: false,
      apiUnavailable: true,
      fallbackToManualUpload: true,
      notice: "Serviço indisponível, tentar de novo.",
    };
    return NextResponse.json(fallback, {
      status: 200,
      headers: PRIVATE_NO_STORE,
    });
  }
}

/**
 * POST /api/covers/search
 * Opção "Colar link da imagem":
 * - Baixa a imagem no servidor com proteção contra SSRF (só `https`, bloqueio de IPs privados,
 *   loopback e link-local após resolver o DNS, `content-type: image/*`, <= 5 MB, timeout 5 s),
 * - Re-encoda com `sharp` para WebP e salva no bucket do usuário.
 */
export async function POST(request: NextRequest) {
  const ws = await getAuthenticatedWorkspace();
  if (!ws) {
    return NextResponse.json(
      { ok: false, error: "Sessão não autenticada." },
      { status: 401, headers: PRIVATE_NO_STORE }
    );
  }
  if (isDemoWorkspace(ws)) {
    return NextResponse.json(
      { ok: false, error: DEMO_READONLY_ERROR, code: DEMO_READONLY_CODE },
      { status: 403, headers: PRIVATE_NO_STORE }
    );
  }

  const env = getServerEnv();
  const limit = checkSlidingRateLimit(
    `cover-import-url:${ws.profile.id}`,
    Math.max(30, env.RATE_LIMIT_MAX_PER_MINUTE)
  );
  if (!limit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: `Muitas requisições. Aguarde ${limit.retryAfterSeconds}s e tente novamente.`,
      },
      { status: 429, headers: PRIVATE_NO_STORE }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Payload JSON inválido." },
      { status: 400, headers: PRIVATE_NO_STORE }
    );
  }

  const parsed = importUrlBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error:
          parsed.error.issues[0]?.message ??
          "Informe um link HTTPS válido para a imagem.",
      },
      { status: 400, headers: PRIVATE_NO_STORE }
    );
  }

  const result = await importCoverFromExternalUrl({
    url: parsed.data.url,
    userId: ws.profile.id,
    editionId: parsed.data.editionId,
  });

  if (!result.ok) {
    return NextResponse.json(result, {
      status: 422,
      headers: PRIVATE_NO_STORE,
    });
  }

  return NextResponse.json(result, { status: 200, headers: PRIVATE_NO_STORE });
}
