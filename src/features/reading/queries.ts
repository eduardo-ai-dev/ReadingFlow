import "server-only";
import { requireAuthenticatedWorkspace } from "@/server/store/memory-repository";
import { computeReadingPercent } from "@/features/reading/rules";
import type { Edition, Reading, Review, Work } from "@/lib/domain";

export interface EnrichedReadingEntry {
  reading: Reading;
  work: Work;
  edition?: Edition;
  review?: Review;
  percent: number;
  primaryAuthor: string;
  isReread: boolean;
}

export async function getReadingsOverview(): Promise<{
  active: EnrichedReadingEntry[];
  paused: EnrichedReadingEntry[];
  finished: EnrichedReadingEntry[];
  abandoned: EnrichedReadingEntry[];
  unreadOwnedWorks: Array<{
    work: Work;
    edition: Edition;
    itemId: string;
    primaryAuthor: string;
  }>;
}> {
  const ws = await requireAuthenticatedWorkspace();
  const worksById = new Map(ws.works.map((w) => [w.id, w]));
  const editionsById = new Map(ws.editions.map((e) => [e.id, e]));
  const reviewsByWorkId = new Map(ws.reviews.map((r) => [r.workId, r]));

  // Count finished chronological order per work to flag rereads
  const finishedByWork = new Map<string, string[]>();
  for (const r of [...ws.readings].sort((a, b) =>
    (a.createdAt ?? "").localeCompare(b.createdAt ?? "")
  )) {
    if (r.status === "finished") {
      const list = finishedByWork.get(r.workId) ?? [];
      list.push(r.id);
      finishedByWork.set(r.workId, list);
    }
  }

  const enriched: EnrichedReadingEntry[] = [];
  for (const reading of [...ws.readings].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  )) {
    const work = worksById.get(reading.workId);
    if (!work) continue;
    const edition = reading.editionId
      ? editionsById.get(reading.editionId)
      : ws.editions.find((e) => e.workId === work.id);

    const percent = computeReadingPercent({
      progressUnit: reading.progressUnit,
      progressValue: reading.progressValue,
      progressTotal:
        reading.progressTotal ??
        (reading.progressUnit === "pages"
          ? edition?.pages
          : reading.progressUnit === "seconds"
            ? edition?.durationSeconds
            : 100),
    });

    const primaryAuthor =
      work.contributors.find((c) => c.role === "author")?.name ??
      "Autor desconhecido";

    const finishedList = finishedByWork.get(work.id) ?? [];
    const isReread =
      reading.status === "finished"
        ? finishedList.indexOf(reading.id) > 0
        : finishedList.length > 0;

    enriched.push({
      reading,
      work,
      edition,
      review: reviewsByWorkId.get(work.id),
      percent,
      primaryAuthor,
      isReread,
    });
  }

  const startedOrFinishedWorkIds = new Set(ws.readings.map((r) => r.workId));
  const unreadOwnedWorks: Array<{
    work: Work;
    edition: Edition;
    itemId: string;
    primaryAuthor: string;
  }> = [];

  for (const item of ws.items) {
    if (item.status !== "owned") continue;
    const edition = editionsById.get(item.editionId);
    if (!edition) continue;
    const work = worksById.get(edition.workId);
    if (!work || startedOrFinishedWorkIds.has(work.id)) continue;
    startedOrFinishedWorkIds.add(work.id);
    unreadOwnedWorks.push({
      work,
      edition,
      itemId: item.id,
      primaryAuthor:
        work.contributors.find((c) => c.role === "author")?.name ??
        "Autor desconhecido",
    });
  }

  return {
    active: enriched.filter((e) => e.reading.status === "reading"),
    paused: enriched.filter((e) => e.reading.status === "paused"),
    finished: enriched.filter((e) => e.reading.status === "finished"),
    abandoned: enriched.filter((e) => e.reading.status === "abandoned"),
    unreadOwnedWorks,
  };
}
