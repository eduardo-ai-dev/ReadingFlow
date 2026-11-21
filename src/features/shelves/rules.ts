import type {
  BookFormat,
  Edition,
  LibraryItem,
  Reading,
  ReadingStatus,
  Review,
  Shelf,
  Work,
} from "@/lib/domain";
import { matchesCatalogQuery } from "@/features/catalog/rules";

export interface EnrichedShelfItem {
  item: LibraryItem;
  edition: Edition;
  work: Work;
  shelf: Shelf;
  latestReading?: Reading;
  effectiveReadingStatus: ReadingStatus;
  review?: Review;
  primaryAuthor: string;
}

export interface ShelfFilterParams {
  query?: string;
  readingStatus?: ReadingStatus | "all";
  format?: BookFormat | "all";
  genre?: string | "all";
  sortMode?: Shelf["sortMode"];
}

export function filterAndSortShelfItems(
  entries: readonly EnrichedShelfItem[],
  params: ShelfFilterParams
): EnrichedShelfItem[] {
  const filtered = entries.filter((entry) => {
    if (
      params.readingStatus &&
      params.readingStatus !== "all" &&
      entry.effectiveReadingStatus !== params.readingStatus
    ) {
      return false;
    }

    if (
      params.format &&
      params.format !== "all" &&
      entry.edition.format !== params.format
    ) {
      return false;
    }

    if (
      params.genre &&
      params.genre !== "all" &&
      entry.work.primaryGenre !== params.genre
    ) {
      return false;
    }

    if (params.query && params.query.trim().length > 0) {
      const fields = [
        entry.work.title,
        entry.edition.title,
        entry.edition.subtitle ?? "",
        entry.primaryAuthor,
        entry.edition.publisher ?? "",
        entry.edition.isbn13 ?? "",
        entry.work.primaryGenre ?? "",
      ];
      if (!matchesCatalogQuery(params.query, fields)) {
        return false;
      }
    }

    return true;
  });

  const sortMode = params.sortMode ?? "manual";
  return [...filtered].sort((a, b) => {
    if (sortMode === "title") {
      return a.work.title.localeCompare(b.work.title, "pt-BR");
    }
    if (sortMode === "author") {
      const cmp = a.primaryAuthor.localeCompare(b.primaryAuthor, "pt-BR");
      return cmp !== 0
        ? cmp
        : a.work.title.localeCompare(b.work.title, "pt-BR");
    }
    if (sortMode === "acquired") {
      return (b.item.acquiredOn ?? b.item.createdAt).localeCompare(
        a.item.acquiredOn ?? a.item.createdAt
      );
    }
    if (sortMode === "finished") {
      const finA = a.latestReading?.finishedOn ?? "";
      const finB = b.latestReading?.finishedOn ?? "";
      if (finA !== finB) {
        return finB.localeCompare(finA);
      }
      return a.work.title.localeCompare(b.work.title, "pt-BR");
    }
    return a.item.shelfPosition - b.item.shelfPosition;
  });
}
