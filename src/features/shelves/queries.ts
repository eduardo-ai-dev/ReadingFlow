import "server-only";
import { requireAuthenticatedWorkspace } from "@/server/store/memory-repository";
import {
  filterAndSortShelfItems,
  type EnrichedShelfItem,
  type ShelfFilterParams,
} from "@/features/shelves/rules";
import type { Shelf, ShelfKind } from "@/lib/domain";

export async function getAllEnrichedItems(): Promise<EnrichedShelfItem[]> {
  const ws = await requireAuthenticatedWorkspace();
  const editionsById = new Map(ws.editions.map((e) => [e.id, e]));
  const worksById = new Map(ws.works.map((w) => [w.id, w]));
  const shelvesById = new Map(ws.shelves.map((s) => [s.id, s]));
  const reviewsByWorkId = new Map(ws.reviews.map((r) => [r.workId, r]));

  const entries: EnrichedShelfItem[] = [];
  for (const item of ws.items) {
    const edition = editionsById.get(item.editionId);
    const shelf = shelvesById.get(item.shelfId);
    if (!edition || !shelf) continue;
    const work = worksById.get(edition.workId);
    if (!work) continue;

    const workReadings = ws.readings
      .filter((r) => r.workId === work.id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    const activeReading = workReadings.find(
      (r) => r.status === "reading" || r.status === "paused"
    );
    const latestReading = activeReading ?? workReadings[0];
    const effectiveReadingStatus = latestReading?.status ?? "not_started";
    const primaryAuthor =
      work.contributors.find((c) => c.role === "author")?.name ??
      edition.contributors.find((c) => c.role === "author")?.name ??
      "Autor desconhecido";

    entries.push({
      item,
      edition,
      work,
      shelf,
      latestReading,
      effectiveReadingStatus,
      review: reviewsByWorkId.get(work.id),
      primaryAuthor,
    });
  }

  return entries;
}

export async function getShelvesOverview(
  activeKind: ShelfKind,
  filters: ShelfFilterParams
): Promise<{
  shelves: Shelf[];
  activeShelf: Shelf;
  items: EnrichedShelfItem[];
  countsByKind: Record<ShelfKind, number>;
  availableGenres: string[];
}> {
  const ws = await requireAuthenticatedWorkspace();
  const all = await getAllEnrichedItems();

  const countsByKind: Record<ShelfKind, number> = {
    physical: 0,
    digital: 0,
    audio: 0,
  };
  const genresSet = new Set<string>();

  for (const entry of all) {
    countsByKind[entry.shelf.kind] += 1;
    if (entry.work.primaryGenre) {
      genresSet.add(entry.work.primaryGenre);
    }
  }

  const activeShelf =
    ws.shelves.find((s) => s.kind === activeKind) ?? ws.shelves[0]!;
  const inActiveShelf = all.filter((e) => e.shelf.kind === activeKind);

  const effectiveSort = filters.sortMode ?? activeShelf.sortMode;
  const items = filterAndSortShelfItems(inActiveShelf, {
    ...filters,
    sortMode: effectiveSort,
  });

  return {
    shelves: ws.shelves,
    activeShelf,
    items,
    countsByKind,
    availableGenres: [...genresSet].sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
}
