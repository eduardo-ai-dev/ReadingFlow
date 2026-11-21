"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  requireAuthenticatedWorkspace,
  saveUndoSnapshot,
} from "@/server/store/memory-repository";
import {
  addWishlistItemSchema,
  dropWishlistSchema,
  purchaseWishlistSchema,
} from "@/features/wishlist/schema";
import { applyWishlistPurchase } from "@/features/wishlist/rules";
import { canStartActiveReading, startRereadRecord } from "@/features/reading/rules";
import {
  classifyBookDuplication,
  computeWorkFingerprint,
  estimateBookDimensions,
} from "@/features/catalog/rules";
import { normalizeToIsbn13 } from "@/lib/isbn";
import { ptBR } from "@/lib/i18n/pt-BR";
import { formatDateInTimezone } from "@/lib/dates";
import { sanitizePlainText } from "@/server/security/sanitize";

export async function addWishlistItemAction(
  rawInput: unknown
): Promise<{ ok: true; wishId: string } | { ok: false; error: string }> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = addWishlistItemSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados do desejo inválidos.",
    };
  }

  const data = parsed.data;
  let normalizedIsbn: string | undefined;
  if (data.isbn && data.isbn.trim().length > 0) {
    const checked = normalizeToIsbn13(data.isbn);
    if (!checked) {
      return { ok: false, error: ptBR.validation.invalidIsbn };
    }
    normalizedIsbn = checked;
  }

  const cleanTitle = sanitizePlainText(data.title, 300);
  const cleanAuthor = sanitizePlainText(data.primaryAuthor, 200);
  const nowIso = new Date().toISOString();

  saveUndoSnapshot(ws, `Adição de "${cleanTitle}" aos desejos`);

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
      fingerprint: computeWorkFingerprint(cleanTitle, cleanAuthor, "pt-BR"),
      source: "manual",
      createdAt: nowIso,
    });
  }

  let editionId: string;
  if (dup.kind === "exact") {
    editionId = dup.editionId;
  } else {
    const existingEd = ws.editions.find((e) => e.workId === workId);
    if (existingEd) {
      editionId = existingEd.id;
    } else {
      editionId = `ed-${crypto.randomUUID()}`;
      const dims = estimateBookDimensions(data.format);
      ws.editions.push({
        id: editionId,
        workId,
        ownerId: ws.profile.id,
        isbn13: normalizedIsbn,
        title: cleanTitle,
        language: "pt-BR",
        format: data.format,
        heightMm: dims.heightMm,
        thicknessMm: dims.thicknessMm,
        contributors: [{ name: cleanAuthor, role: "author" }],
        source: "manual",
        createdAt: nowIso,
      });
    }
  }

  const wishId = `wish-${crypto.randomUUID()}`;
  ws.wishlist.push({
    id: wishId,
    userId: ws.profile.id,
    workId,
    editionId,
    priority: data.priority,
    targetPrice: data.targetPrice,
    currency: ws.profile.defaultCurrency,
    whereToBuy: data.whereToBuy
      ? sanitizePlainText(data.whereToBuy, 160)
      : undefined,
    notes: data.notes ? sanitizePlainText(data.notes, 1000) : undefined,
    status: "wanted",
    createdAt: nowIso,
  });

  revalidatePath("/", "layout");
  return { ok: true, wishId };
}

export async function purchaseWishlistItemAction(
  rawInput: unknown
): Promise<{ ok: true; itemId: string } | { ok: false; error: string }> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = purchaseWishlistSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Dados da compra inválidos." };
  }

  const data = parsed.data;
  const idx = ws.wishlist.findIndex((w) => w.id === data.wishId);
  const wish = idx >= 0 ? ws.wishlist[idx] : undefined;
  if (!wish || wish.status !== "wanted") {
    return {
      ok: false,
      error: "Item da lista de desejos inexistente ou já resolvido.",
    };
  }

  const work = ws.works.find((w) => w.id === wish.workId);
  saveUndoSnapshot(
    ws,
    `Compra de "${work?.title ?? "livro"}" (Desejos -> Estante)`
  );

  const nowIso = new Date().toISOString();
  let edition = wish.editionId
    ? ws.editions.find((e) => e.id === wish.editionId)
    : ws.editions.find((e) => e.workId === wish.workId);

  if (!edition) {
    const dims = estimateBookDimensions(data.format);
    edition = {
      id: `ed-${crypto.randomUUID()}`,
      workId: wish.workId,
      ownerId: ws.profile.id,
      title: work?.title ?? "Exemplar adquirido",
      language: "pt-BR",
      format: data.format,
      heightMm: dims.heightMm,
      thicknessMm: dims.thicknessMm,
      contributors: work?.contributors ?? [],
      source: "manual",
      createdAt: nowIso,
    };
    ws.editions.push(edition);
  } else if (edition.format !== data.format) {
    edition.format = data.format;
  }

  const { updatedWish, createdItem } = applyWishlistPurchase({
    wish,
    editionId: edition.id,
    format: data.format,
    shelves: ws.shelves,
    newItemId: `item-${crypto.randomUUID()}`,
    pricePaid: data.pricePaid,
    acquiredOn:
      data.acquiredOn ?? formatDateInTimezone(nowIso, ws.profile.timezone),
    store: data.store ? sanitizePlainText(data.store, 160) : undefined,
    condition: data.condition,
    nowIso,
  });

  createdItem.shelfPosition = ws.items.filter(
    (it) => it.shelfId === createdItem.shelfId
  ).length;

  ws.wishlist[idx] = updatedWish;
  ws.items.push(createdItem);

  revalidatePath("/", "layout");
  return { ok: true, itemId: createdItem.id };
}

export async function dropWishlistItemAction(
  rawInput: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = dropWishlistSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Item inválido." };
  }

  const wish = ws.wishlist.find((w) => w.id === parsed.data.wishId);
  if (!wish) {
    return { ok: false, error: "Item não encontrado." };
  }

  saveUndoSnapshot(ws, "Arquivamento de desejo");
  wish.status = "dropped";
  wish.resolvedAt = new Date().toISOString();

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function startReadingFromWishlistAction(
  rawInput: unknown
): Promise<
  { ok: true; workId: string; readingId: string } | { ok: false; error: string }
> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = dropWishlistSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Identificador de desejo inválido." };
  }

  const idx = ws.wishlist.findIndex((w) => w.id === parsed.data.wishId);
  const wish = idx >= 0 ? ws.wishlist[idx] : undefined;
  if (!wish || wish.status !== "wanted") {
    return {
      ok: false,
      error: "Item da lista de desejos inexistente ou já resolvido.",
    };
  }

  const check = canStartActiveReading(
    wish.workId,
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

  const work = ws.works.find((w) => w.id === wish.workId);
  const nowIso = new Date().toISOString();
  const acquiredOn = formatDateInTimezone(nowIso, ws.profile.timezone);
  let edition = wish.editionId
    ? ws.editions.find((e) => e.id === wish.editionId)
    : ws.editions.find((e) => e.workId === wish.workId);

  saveUndoSnapshot(
    ws,
    `Início de leitura de "${work?.title ?? "livro"}" (Desejos -> Cabeceira)`
  );

  const format = edition?.format ?? "paperback";
  if (!edition) {
    const dims = estimateBookDimensions(format);
    edition = {
      id: `ed-${crypto.randomUUID()}`,
      workId: wish.workId,
      ownerId: ws.profile.id,
      title: work?.title ?? "Livro",
      language: "pt-BR",
      format,
      heightMm: dims.heightMm,
      thicknessMm: dims.thicknessMm,
      contributors: work?.contributors ?? [
        { name: "Autor desconhecido", role: "author" },
      ],
      source: "manual",
      createdAt: nowIso,
    };
    ws.editions.push(edition);
  }

  const { updatedWish, createdItem } = applyWishlistPurchase({
    wish,
    editionId: edition.id,
    format,
    shelves: ws.shelves,
    newItemId: `item-${crypto.randomUUID()}`,
    acquiredOn,
    nowIso,
  });
  createdItem.shelfPosition = ws.items.filter(
    (it) => it.shelfId === createdItem.shelfId
  ).length;

  ws.wishlist[idx] = updatedWish;
  ws.items.push(createdItem);

  const progressUnit =
    format === "audiobook" ? "seconds" : edition.pages ? "pages" : "percent";
  const progressTotal =
    progressUnit === "seconds"
      ? edition.durationSeconds
      : progressUnit === "pages"
        ? edition.pages
        : 100;

  const reading = startRereadRecord({
    newId: `read-${crypto.randomUUID()}`,
    userId: ws.profile.id,
    workId: wish.workId,
    editionId: edition.id,
    libraryItemId: createdItem.id,
    format,
    progressUnit,
    progressTotal,
    startedOn: acquiredOn,
    nowIso,
  });

  ws.readings.push(reading);
  revalidatePath("/", "layout");
  return { ok: true, workId: wish.workId, readingId: reading.id };
}
