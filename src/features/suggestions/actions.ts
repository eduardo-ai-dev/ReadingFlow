"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  requireAuthenticatedWorkspace,
  saveUndoSnapshot,
} from "@/server/store/memory-repository";
import { sanitizePlainText } from "@/server/security/sanitize";
import {
  classifyBookDuplication,
  computeWorkFingerprint,
  estimateBookDimensions,
} from "@/features/catalog/rules";
import {
  canStartActiveReading,
  startRereadRecord,
} from "@/features/reading/rules";
import {
  saveSuggestionToWishlistSchema,
  startReadingNewSuggestionSchema,
} from "@/features/suggestions/schema";
import {
  normalizeSuggestionCoverUrl,
  type WishlistSuggestionItem,
} from "@/features/suggestions/rules";
import { normalizeToIsbn13 } from "@/lib/isbn";
import { formatDateInTimezone } from "@/lib/dates";
import { coverColor } from "@/lib/cover-color";
import {
  clampPaperHsl,
  deriveSpineAccentHex,
} from "@/features/catalog/spine-color-rules";

export async function saveSuggestionToWishlistAction(
  rawInput: unknown
): Promise<
  | {
      ok: true;
      wishId: string;
      alreadyExisted: boolean;
      item: WishlistSuggestionItem;
    }
  | { ok: false; error: string }
> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = saveSuggestionToWishlistSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Sugestão inválida.",
    };
  }

  const data = parsed.data;
  const cleanTitle = sanitizePlainText(data.title, 300);
  const cleanAuthor = sanitizePlainText(data.author, 200);
  const cleanGenre = data.genre ? sanitizePlainText(data.genre, 80) : undefined;
  const normalizedIsbn = data.isbn
    ? (normalizeToIsbn13(data.isbn) ?? undefined)
    : undefined;
  const safeCoverUrl = normalizeSuggestionCoverUrl(data.coverUrl);
  const nowIso = new Date().toISOString();

  const dup = classifyBookDuplication(
    {
      isbn: normalizedIsbn,
      title: cleanTitle,
      primaryAuthor: cleanAuthor,
      language: "pt-BR",
    },
    ws.editions,
    ws.works
  );

  let workId: string;
  if (dup.kind === "exact" || dup.kind === "probable") {
    workId = dup.workId;
  } else {
    workId = `work-${crypto.randomUUID()}`;
    ws.works.push({
      id: workId,
      ownerId: ws.profile.id,
      title: cleanTitle,
      contributors: [{ name: cleanAuthor, role: "author" }],
      primaryGenre: cleanGenre,
      fingerprint: computeWorkFingerprint(cleanTitle, cleanAuthor, "pt-BR"),
      source: "open_library",
      createdAt: nowIso,
    });
  }

  // Se já existe na lista de desejos ativa, retorna de forma idempotente
  const existingWish = ws.wishlist.find(
    (w) => w.workId === workId && w.status === "wanted"
  );
  if (existingWish) {
    const existingEd = existingWish.editionId
      ? ws.editions.find((e) => e.id === existingWish.editionId)
      : ws.editions.find((e) => e.workId === workId);
    return {
      ok: true,
      wishId: existingWish.id,
      alreadyExisted: true,
      item: {
        wishId: existingWish.id,
        workId,
        title: cleanTitle,
        author: cleanAuthor,
        genre: cleanGenre,
        priority: existingWish.priority,
        targetPrice: existingWish.targetPrice,
        coverUrl: existingEd?.coverUrl ?? safeCoverUrl,
        spineColor: existingEd?.coverColor,
        spineAccent: existingEd?.coverAccentColor,
        seed: existingEd?.isbn13 ?? workId,
        createdAt: existingWish.createdAt,
      },
    };
  }

  saveUndoSnapshot(ws, `Sugestão "${cleanTitle}" salva na Lista de Desejos`);

  let edition =
    dup.kind === "exact"
      ? ws.editions.find((e) => e.id === dup.editionId)
      : ws.editions.find((e) => e.workId === workId);

  if (!edition) {
    const dims = estimateBookDimensions("paperback");
    const seed = normalizedIsbn ?? workId;
    const spineColor = clampPaperHsl(coverColor(seed));
    const spineAccent = deriveSpineAccentHex(spineColor, seed);
    edition = {
      id: `ed-${crypto.randomUUID()}`,
      workId,
      ownerId: ws.profile.id,
      isbn13: normalizedIsbn,
      title: cleanTitle,
      language: "pt-BR",
      format: "paperback",
      pages: data.pages ?? undefined,
      heightMm: dims.heightMm,
      thicknessMm: dims.thicknessMm,
      coverUrl: safeCoverUrl,
      coverColor: spineColor,
      coverAccentColor: spineAccent,
      contributors: [{ name: cleanAuthor, role: "author" }],
      source: "open_library",
      createdAt: nowIso,
    };
    ws.editions.push(edition);
  } else if (safeCoverUrl && !edition.coverUrl) {
    edition.coverUrl = safeCoverUrl;
  }

  const wishId = `wish-${crypto.randomUUID()}`;
  ws.wishlist.push({
    id: wishId,
    userId: ws.profile.id,
    workId,
    editionId: edition.id,
    priority: data.priority,
    currency: ws.profile.defaultCurrency,
    status: "wanted",
    createdAt: nowIso,
  });

  revalidatePath("/", "layout");
  return {
    ok: true,
    wishId,
    alreadyExisted: false,
    item: {
      wishId,
      workId,
      title: cleanTitle,
      author: cleanAuthor,
      genre: cleanGenre,
      priority: data.priority,
      coverUrl: edition.coverUrl ?? safeCoverUrl,
      spineColor: edition.coverColor,
      spineAccent: edition.coverAccentColor,
      seed: edition.isbn13 ?? workId,
      createdAt: nowIso,
    },
  };
}

export async function startReadingNewSuggestionAction(
  rawInput: unknown
): Promise<
  { ok: true; workId: string; readingId: string } | { ok: false; error: string }
> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = startReadingNewSuggestionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados do livro inválidos.",
    };
  }

  const data = parsed.data;
  const cleanTitle = sanitizePlainText(data.title, 300);
  const cleanAuthor = sanitizePlainText(data.author, 200);
  const cleanGenre = data.genre ? sanitizePlainText(data.genre, 80) : undefined;
  const normalizedIsbn = data.isbn
    ? (normalizeToIsbn13(data.isbn) ?? undefined)
    : undefined;
  const safeCoverUrl = normalizeSuggestionCoverUrl(data.coverUrl);
  const nowIso = new Date().toISOString();
  const todayYmd = formatDateInTimezone(nowIso, ws.profile.timezone);

  const dup = classifyBookDuplication(
    {
      isbn: normalizedIsbn,
      title: cleanTitle,
      primaryAuthor: cleanAuthor,
      language: "pt-BR",
    },
    ws.editions,
    ws.works
  );

  const candidateWorkId =
    dup.kind === "exact" || dup.kind === "probable"
      ? dup.workId
      : `work-${crypto.randomUUID()}`;

  const check = canStartActiveReading(
    candidateWorkId,
    ws.readings,
    ws.profile.maxSimultaneousReadings
  );
  if (!check.allowed) {
    return {
      ok: false,
      error:
        check.reason === "already_active_for_work"
          ? "Já existe uma leitura em andamento para esta obra."
          : `Limite de ${ws.profile.maxSimultaneousReadings} leituras simultâneas atingido.`,
    };
  }

  saveUndoSnapshot(ws, `Início de leitura da sugestão "${cleanTitle}"`);

  let workId = candidateWorkId;
  if (dup.kind === "distinct") {
    ws.works.push({
      id: workId,
      ownerId: ws.profile.id,
      title: cleanTitle,
      contributors: [{ name: cleanAuthor, role: "author" }],
      primaryGenre: cleanGenre,
      fingerprint: computeWorkFingerprint(cleanTitle, cleanAuthor, "pt-BR"),
      source: "open_library",
      createdAt: nowIso,
    });
  } else {
    workId = dup.workId;
  }

  let edition =
    dup.kind === "exact"
      ? ws.editions.find((e) => e.id === dup.editionId)
      : ws.editions.find((e) => e.workId === workId);

  if (!edition) {
    const dims = estimateBookDimensions("paperback");
    const seed = normalizedIsbn ?? workId;
    const spineColor = clampPaperHsl(coverColor(seed));
    const spineAccent = deriveSpineAccentHex(spineColor, seed);
    edition = {
      id: `ed-${crypto.randomUUID()}`,
      workId,
      ownerId: ws.profile.id,
      isbn13: normalizedIsbn,
      title: cleanTitle,
      language: "pt-BR",
      format: "paperback",
      pages: data.pages ?? undefined,
      heightMm: dims.heightMm,
      thicknessMm: dims.thicknessMm,
      coverUrl: safeCoverUrl,
      coverColor: spineColor,
      coverAccentColor: spineAccent,
      contributors: [{ name: cleanAuthor, role: "author" }],
      source: "open_library",
      createdAt: nowIso,
    };
    ws.editions.push(edition);
  } else if (safeCoverUrl && !edition.coverUrl) {
    edition.coverUrl = safeCoverUrl;
  }

  let libraryItem = ws.items.find((it) => it.editionId === edition.id);
  if (!libraryItem) {
    const physicalShelf =
      ws.shelves.find((s) => s.kind === "physical") ?? ws.shelves[0]!;
    const createdItem = {
      id: `item-${crypto.randomUUID()}`,
      userId: ws.profile.id,
      editionId: edition.id,
      shelfId: physicalShelf.id,
      shelfPosition: ws.items.filter((it) => it.shelfId === physicalShelf.id)
        .length,
      status: "owned" as const,
      currency: ws.profile.defaultCurrency,
      acquiredOn: todayYmd,
      createdAt: nowIso,
    };
    ws.items.push(createdItem);
    libraryItem = createdItem;
  }

  // Se havia desejo ativo da mesma obra, marca como comprado
  const existingWish = ws.wishlist.find(
    (w) => w.workId === workId && w.status === "wanted"
  );
  if (existingWish) {
    existingWish.status = "purchased";
    existingWish.resolvedAt = nowIso;
  }

  const progressUnit = edition.pages ? "pages" : "percent";
  const progressTotal = progressUnit === "pages" ? edition.pages : 100;
  const reading = startRereadRecord({
    newId: `read-${crypto.randomUUID()}`,
    userId: ws.profile.id,
    workId,
    editionId: edition.id,
    libraryItemId: libraryItem.id,
    format: edition.format,
    progressUnit,
    progressTotal,
    startedOn: todayYmd,
    nowIso,
  });

  ws.readings.push(reading);
  revalidatePath("/", "layout");
  return { ok: true, workId, readingId: reading.id };
}
