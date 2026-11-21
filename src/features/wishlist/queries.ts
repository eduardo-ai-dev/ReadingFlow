import "server-only";
import { requireAuthenticatedWorkspace } from "@/server/store/memory-repository";
import { detectWishlistOwnershipOverlap } from "@/features/wishlist/rules";
import { resolveWorkCoverEdition } from "@/features/catalog/cover-url";
import type { Edition, WishlistItem, Work } from "@/lib/domain";

export interface EnrichedWishEntry {
  wish: WishlistItem;
  work: Work;
  edition?: Edition;
  primaryAuthor: string;
  overlap: { ownsWork: boolean; ownsExactEdition: boolean };
}

export async function getWishlistOverview(): Promise<{
  wanted: EnrichedWishEntry[];
  purchased: EnrichedWishEntry[];
  dropped: EnrichedWishEntry[];
}> {
  const ws = await requireAuthenticatedWorkspace();
  const worksById = new Map(ws.works.map((w) => [w.id, w]));
  const editionsById = new Map(ws.editions.map((e) => [e.id, e]));

  const enrich = (wish: WishlistItem): EnrichedWishEntry | null => {
    const work = worksById.get(wish.workId);
    if (!work) return null;
    const edition = resolveWorkCoverEdition({
      workId: work.id,
      preferredEditionId: wish.editionId,
      editions: ws.editions,
      editionsById,
    });

    const overlap = detectWishlistOwnershipOverlap(
      work.id,
      edition?.id,
      ws.items,
      ws.editions
    );

    return {
      wish,
      work,
      edition,
      primaryAuthor:
        work.contributors.find((c) => c.role === "author")?.name ??
        "Autor desconhecido",
      overlap,
    };
  };

  const all = ws.wishlist
    .map(enrich)
    .filter((x): x is EnrichedWishEntry => x !== null);

  return {
    wanted: all
      .filter((x) => x.wish.status === "wanted")
      .sort((a, b) => b.wish.priority - a.wish.priority),
    purchased: all
      .filter((x) => x.wish.status === "purchased")
      .sort((a, b) =>
        (b.wish.resolvedAt ?? "").localeCompare(a.wish.resolvedAt ?? "")
      ),
    dropped: all.filter((x) => x.wish.status === "dropped"),
  };
}
