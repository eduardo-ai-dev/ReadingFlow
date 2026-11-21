import type {
  BookFormat,
  Edition,
  LibraryItem,
  Shelf,
  ShelfKind,
  WishlistItem,
} from "@/lib/domain";

export function inferShelfKindFromFormat(format: BookFormat): ShelfKind {
  if (format === "ebook") return "digital";
  if (format === "audiobook") return "audio";
  return "physical";
}

export function detectWishlistOwnershipOverlap(
  workId: string,
  editionId: string | undefined,
  ownedItems: readonly LibraryItem[],
  editions: readonly Edition[]
): { ownsWork: boolean; ownsExactEdition: boolean } {
  const activeItems = ownedItems.filter(
    (item) => item.status === "owned" || item.status === "lent"
  );
  const editionsById = new Map(editions.map((e) => [e.id, e]));

  let ownsWork = false;
  let ownsExactEdition = false;

  for (const item of activeItems) {
    if (editionId && item.editionId === editionId) {
      ownsExactEdition = true;
      ownsWork = true;
    } else {
      const ed = editionsById.get(item.editionId);
      if (ed?.workId === workId) {
        ownsWork = true;
      }
    }
  }

  return { ownsWork, ownsExactEdition };
}

export function applyWishlistPurchase(params: {
  wish: WishlistItem;
  editionId: string;
  format: BookFormat;
  shelves: readonly Shelf[];
  explicitShelfId?: string;
  newItemId: string;
  pricePaid?: number;
  acquiredOn?: string;
  store?: string;
  condition?: LibraryItem["condition"];
  nowIso: string;
}): { updatedWish: WishlistItem; createdItem: LibraryItem } {
  if (params.wish.status !== "wanted") {
    throw new Error("Item da lista de desejos inexistente ou já resolvido.");
  }

  const targetKind = inferShelfKindFromFormat(params.format);
  const targetShelf =
    (params.explicitShelfId
      ? params.shelves.find((s) => s.id === params.explicitShelfId)
      : undefined) ?? params.shelves.find((s) => s.kind === targetKind);

  if (!targetShelf) {
    throw new Error("Nenhuma estante compatível encontrada para o formato.");
  }

  const createdItem: LibraryItem = {
    id: params.newItemId,
    userId: params.wish.userId,
    editionId: params.editionId,
    shelfId: targetShelf.id,
    shelfPosition: 0,
    status: "owned",
    acquiredOn: params.acquiredOn ?? params.nowIso.slice(0, 10),
    pricePaid: params.pricePaid,
    currency: params.wish.currency,
    store: params.store,
    condition: params.condition,
    createdAt: params.nowIso,
  };

  const updatedWish: WishlistItem = {
    ...params.wish,
    editionId: params.editionId,
    status: "purchased",
    resolvedAt: params.nowIso,
    libraryItemId: createdItem.id,
  };

  return { updatedWish, createdItem };
}

export function undoWishlistPurchase(params: {
  wish: WishlistItem;
}): WishlistItem {
  return {
    ...params.wish,
    status: "wanted",
    resolvedAt: undefined,
    libraryItemId: undefined,
  };
}
