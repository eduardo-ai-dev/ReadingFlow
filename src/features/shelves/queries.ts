import "server-only";
import {
  cachedWorkspaceQuery,
  requireAuthenticatedWorkspace,
} from "@/server/store/memory-repository";
import {
  filterAndSortShelfItems,
  type EnrichedShelfItem,
  type ShelfFilterParams,
} from "@/features/shelves/rules";
import type { Reading, Shelf, ShelfKind } from "@/lib/domain";

export async function getAllEnrichedItems(): Promise<EnrichedShelfItem[]> {
  const ws = await requireAuthenticatedWorkspace();

  return cachedWorkspaceQuery(ws, "shelves:all-enriched-items", () => {
    const editionsById = new Map(ws.editions.map((e) => [e.id, e]));
    const worksById = new Map(ws.works.map((w) => [w.id, w]));
    const shelvesById = new Map(ws.shelves.map((s) => [s.id, s]));
    const reviewsByWorkId = new Map(ws.reviews.map((r) => [r.workId, r]));

    // Agrupa leituras por obra em O(M) em vez de filtrar+ordenar O(N*M) por livro
    const readingsByWorkId = new Map<string, Reading[]>();
    for (const r of ws.readings) {
      const list = readingsByWorkId.get(r.workId);
      if (list) list.push(r);
      else readingsByWorkId.set(r.workId, [r]);
    }
    for (const list of readingsByWorkId.values()) {
      if (list.length > 1) {
        list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      }
    }

    const entries: EnrichedShelfItem[] = [];
    for (const item of ws.items) {
      const edition = editionsById.get(item.editionId);
      const shelf = shelvesById.get(item.shelfId);
      if (!edition || !shelf) continue;
      const work = worksById.get(edition.workId);
      if (!work) continue;

      const workReadings = readingsByWorkId.get(work.id) ?? [];
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
  });
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
