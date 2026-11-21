import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthenticatedWorkspace,
  invalidateUserWorkspaceCache,
} from "@/server/store/memory-repository";
import {
  checkSlidingRateLimit,
  sanitizePlainText,
} from "@/server/security/sanitize";
import { hydrateBookCoverMetadata } from "@/server/catalog/hydrate";
import { extractSpinePaletteFromCover } from "@/server/catalog/spine-color";
import {
  clampPaperHsl,
  deriveSpineAccentHex,
} from "@/features/catalog/spine-color-rules";

const hydratePayloadSchema = z.object({
  editionId: z.string().trim().max(120).optional(),
  title: z.string().trim().min(1).max(300),
  author: z.string().trim().max(200).optional(),
  isbn: z.string().trim().max(24).optional().nullable(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ws = await getAuthenticatedWorkspace();
  if (!ws) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const parsed = hydratePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parâmetros de hidratação inválidos." },
      { status: 400 }
    );
  }

  const rl = checkSlidingRateLimit(`book-hydrate:${ws.profile.id}`, 120);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Aguarde ${rl.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const result = await hydrateBookCoverMetadata({
    title: sanitizePlainText(parsed.data.title, 300),
    author: parsed.data.author
      ? sanitizePlainText(parsed.data.author, 200)
      : undefined,
    isbn: parsed.data.isbn ?? undefined,
    signal: request.signal,
  });

  // Persiste no acervo do servidor quando há editionId válido (sobrevive a recarregamentos),
  // mas NUNCA sobrescreve uma capa travada manualmente pelo usuário (`coverLocked = true`).
  let spineColor: string | null = null;
  let spineAccent: string | null = null;
  let mutated = false;
  if (parsed.data.editionId && result.coverUrl) {
    const edition = ws.editions.find((e) => e.id === parsed.data.editionId);
    if (edition) {
      if (edition.ownerId && edition.ownerId !== ws.profile.id) {
        return NextResponse.json(
          { error: "Sem permissão para alterar esta edição." },
          { status: 403 }
        );
      }

      // Extrai paleta antes de mutar e revalida coverLocked após o await para evitar condição de corrida com escolha manual
      const canHydrateCover = !edition.coverLocked && !edition.coverUrl;
      const targetCoverForPalette = canHydrateCover
        ? result.coverUrl
        : edition.coverUrl;
      let extractedPalette: { spineColor: string; spineAccent: string } | null =
        null;

      if (
        (!edition.coverColor || !edition.coverAccentColor) &&
        targetCoverForPalette
      ) {
        extractedPalette = await extractSpinePaletteFromCover(
          targetCoverForPalette,
          AbortSignal.timeout(3500)
        );
      }

      if (!edition.coverLocked && !edition.coverUrl) {
        edition.coverUrl = result.coverUrl;
        mutated = true;
      }
      if ((!edition.pages || edition.pages <= 0) && result.pages) {
        edition.pages = result.pages;
        mutated = true;
      }
      if (extractedPalette && !edition.coverLocked) {
        if (!edition.coverColor) {
          edition.coverColor = clampPaperHsl(extractedPalette.spineColor);
          mutated = true;
        }
        if (!edition.coverAccentColor) {
          edition.coverAccentColor = clampPaperHsl(
            extractedPalette.spineAccent
          );
          mutated = true;
        }
      }
      if (edition.coverColor && !edition.coverAccentColor) {
        edition.coverAccentColor = deriveSpineAccentHex(
          edition.coverColor,
          edition.id
        );
        mutated = true;
      }
      spineColor = edition.coverColor ?? null;
      spineAccent = edition.coverAccentColor ?? null;
    }
  }

  if (mutated) {
    invalidateUserWorkspaceCache(ws.profile.id);
  }

  return NextResponse.json(
    { ...result, spineColor, spineAccent },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
