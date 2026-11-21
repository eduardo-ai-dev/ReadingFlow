import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAuthenticatedWorkspace } from "@/server/store/memory-repository";
import { getServerEnv } from "@/lib/env";
import { isBrazilianIsbn13, normalizeToIsbn13 } from "@/lib/isbn";
import { checkSlidingRateLimit } from "@/server/security/sanitize";
import { fetchFromBrasilApi } from "@/server/catalog/providers";

const coverQuerySchema = z.object({
  isbn: z
    .string()
    .max(24)
    .transform((value) => normalizeToIsbn13(value))
    .refine(
      (value): value is string => value !== null && isBrazilianIsbn13(value),
      "Informe um ISBN brasileiro válido (prefixo 97885 ou 97865)."
    ),
});

/**
 * Último recurso automático de capa para ISBN brasileiro (BrasilAPI). Só devolve
 * URLs de hosts permitidos (a mesma lista da CSP); o cliente ainda valida o
 * carregamento da imagem (`naturalWidth > 1`).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const ws = await getAuthenticatedWorkspace();
  if (!ws) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const parsed = coverQuerySchema.safeParse({
    isbn: request.nextUrl.searchParams.get("isbn") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "ISBN inválido." },
      { status: 400 }
    );
  }

  const env = getServerEnv();
  const rl = checkSlidingRateLimit(
    `book-cover:${ws.profile.id}`,
    env.RATE_LIMIT_MAX_PER_MINUTE
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Muitas consultas. Aguarde ${rl.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  try {
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(env.CATALOG_LOOKUP_TIMEOUT_MS),
    ]);
    const metadata = await fetchFromBrasilApi(parsed.data.isbn, signal);
    return NextResponse.json(
      { coverUrl: metadata?.coverUrl ?? null },
      { headers: { "Cache-Control": "private, max-age=300" } }
    );
  } catch {
    return NextResponse.json({ coverUrl: null });
  }
}
