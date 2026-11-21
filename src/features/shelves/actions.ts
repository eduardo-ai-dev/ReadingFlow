"use server";

import { revalidatePath } from "next/cache";
import {
  requireAuthenticatedWorkspace,
  saveUndoSnapshot,
} from "@/server/store/memory-repository";
import {
  removeLibraryItemSchema,
  reorderShelfBooksSchema,
  updateBookSpineColorSchema,
  updateItemOwnershipSchema,
  updateShelfSortSchema,
} from "@/features/shelves/schema";
import {
  clampPaperHsl,
  deriveSpineAccentHex,
} from "@/features/catalog/spine-color-rules";

export async function updateShelfSortModeAction(
  rawInput: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = updateShelfSortSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Ordenação inválida." };
  }

  const shelf = ws.shelves.find((s) => s.id === parsed.data.shelfId);
  if (!shelf) {
    return { ok: false, error: "Estante não encontrada." };
  }

  shelf.sortMode = parsed.data.sortMode;
  revalidatePath("/estantes");
  return { ok: true };
}

export async function removeLibraryItemAction(
  rawInput: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = removeLibraryItemSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Exemplar inválido." };
  }

  const item = ws.items.find((it) => it.id === parsed.data.itemId);
  if (!item) {
    return { ok: false, error: "Exemplar não encontrado." };
  }

  const edition = ws.editions.find((e) => e.id === item.editionId);
  saveUndoSnapshot(
    ws,
    `Remoção de exemplar${edition ? ` "${edition.title}"` : ""}`
  );

  ws.items = ws.items.filter((it) => it.id !== item.id);
  for (const reading of ws.readings) {
    if (reading.libraryItemId === item.id) {
      reading.libraryItemId = undefined;
    }
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateItemOwnershipAction(
  rawInput: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = updateItemOwnershipSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Situação de posse inválida." };
  }

  const item = ws.items.find((it) => it.id === parsed.data.itemId);
  if (!item) {
    return { ok: false, error: "Exemplar não encontrado." };
  }

  saveUndoSnapshot(ws, "Alteração de situação do exemplar");
  item.status = parsed.data.status;
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function reorderShelfBooksAction(
  rawInput: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = reorderShelfBooksSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Ordem dos livros inválida." };
  }

  const orderedIds = parsed.data.itemIds;
  const itemsById = new Map(ws.items.map((it) => [it.id, it]));
  const validOrderedItems = orderedIds
    .map((id) => itemsById.get(id))
    .filter((it): it is NonNullable<typeof it> => Boolean(it));

  if (validOrderedItems.length === 0) {
    return { ok: false, error: "Nenhum exemplar encontrado para reordenar." };
  }

  const reorderedSet = new Set(validOrderedItems.map((it) => it.id));
  let cursor = 0;
  ws.items = ws.items.map((it) => {
    if (!reorderedSet.has(it.id)) return it;
    const replacement = validOrderedItems[cursor++];
    return replacement ?? it;
  });

  // Atualiza shelfPosition em ordem global consistente para preservar ordenação manual e unificada
  for (let i = 0; i < ws.items.length; i++) {
    ws.items[i]!.shelfPosition = i;
  }

  revalidatePath("/estante-3d");
  revalidatePath("/estantes");
  return { ok: true };
}

export async function updateBookSpineColorAction(
  rawInput: unknown
): Promise<
  | { ok: true; spineColor: string; spineAccent: string }
  | { ok: false; error: string }
> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = updateBookSpineColorSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Cor de lombada inválida." };
  }

  const item = ws.items.find((it) => it.id === parsed.data.itemId);
  if (!item) {
    return { ok: false, error: "Livro não encontrado no acervo." };
  }

  const edition = ws.editions.find((ed) => ed.id === item.editionId);
  if (!edition) {
    return { ok: false, error: "Edição não encontrada." };
  }

  const clampedColor = clampPaperHsl(parsed.data.spineColor);
  const derivedAccent = deriveSpineAccentHex(clampedColor, edition.id);
  edition.coverColor = clampedColor;
  edition.coverAccentColor = derivedAccent;

  revalidatePath("/estante-3d");
  revalidatePath("/estante-3d/arrumar");
  return { ok: true, spineColor: clampedColor, spineAccent: derivedAccent };
}
