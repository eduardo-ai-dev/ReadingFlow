import "server-only";
import { requireAuthenticatedWorkspace } from "@/server/store/memory-repository";
import type {
  Edition,
  LibraryItem,
  Reading,
  Review,
  Shelf,
  WishlistItem,
  Work,
} from "@/lib/domain";

export interface BookDetailView {
  work: Work;
  editions: Edition[];
  primaryEdition: Edition;
  items: Array<LibraryItem & { shelf?: Shelf }>;
  readings: Reading[];
  review?: Review;
  wishlistItem?: WishlistItem;
}

export async function getBookDetailById(
  id: string
): Promise<BookDetailView | null> {
  const ws = await requireAuthenticatedWorkspace();

  const itemMatch = ws.items.find((it) => it.id === id);
  const editionFromItem = itemMatch
    ? ws.editions.find((ed) => ed.id === itemMatch.editionId)
    : undefined;

  const work =
    ws.works.find((w) => w.id === id) ??
    (editionFromItem
      ? ws.works.find((w) => w.id === editionFromItem.workId)
      : undefined) ??
    (() => {
      const edMatch = ws.editions.find((ed) => ed.id === id);
      return edMatch
        ? ws.works.find((w) => w.id === edMatch.workId)
        : undefined;
    })();

  if (!work) return null;

  const editions = ws.editions.filter((ed) => ed.workId === work.id);
  const primaryEdition = editionFromItem ??
    editions[0] ?? {
      id: `ed-fallback-${work.id}`,
      workId: work.id,
      ownerId: work.ownerId,
      title: work.title,
      language: "pt-BR",
      format: "paperback",
      contributors: work.contributors,
      source: work.source,
      createdAt: work.createdAt,
    };

  const editionIds = new Set(editions.map((e) => e.id));
  const shelvesById = new Map(ws.shelves.map((s) => [s.id, s]));

  const items = ws.items
    .filter((it) => editionIds.has(it.editionId))
    .map((it) => ({
      ...it,
      shelf: shelvesById.get(it.shelfId),
    }));

  const readings = ws.readings
    .filter((r) => r.workId === work.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const review = ws.reviews.find((rev) => rev.workId === work.id);
  const wishlistItem = ws.wishlist.find(
    (w) => w.workId === work.id && w.status === "wanted"
  );

  return {
    work,
    editions,
    primaryEdition,
    items,
    readings,
    review,
    wishlistItem,
  };
}
