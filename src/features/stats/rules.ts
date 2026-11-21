import type { Edition, LibraryItem, Reading, Review, Work } from "@/lib/domain";
import {
  computePagesReadInPeriod,
  resolveReadingAudioSecondsContribution,
  resolveReadingPagesContribution,
  selectEligibleFinishedReadings,
} from "@/features/goals/rules";

export interface YearlyHistoryEntry {
  year: number;
  booksRead: number;
  pagesRead: number;
  hoursListened: number;
}

export interface RatingDistributionBucket {
  label: string;
  count: number;
  percent: number;
}

export interface LibraryStatistics {
  uniqueOwnedWorks: number;
  totalOwnedItems: number;
  finishedReadingsCount: number;
  pagesRead: number;
  hoursListened: number;
  averageRating: number | null;
  ratedWorksCount: number;
  ratingDistribution: RatingDistributionBucket[];
  abandonedCount: number;
  unreadOwnedItems: number;
  yearlyHistory: YearlyHistoryEntry[];
}

export function computeLibraryStatistics(params: {
  works: readonly Work[];
  editions: readonly Edition[];
  items: readonly LibraryItem[];
  readings: readonly Reading[];
  reviews: readonly Review[];
  countRereads: boolean;
  periodStartYmd: string;
  periodEndYmd: string;
}): LibraryStatistics {
  const editionsById = new Map(params.editions.map((e) => [e.id, e]));

  const ownedItems = params.items.filter(
    (item) => item.status === "owned" || item.status === "lent"
  );
  const ownedWorkIds = new Set<string>();
  for (const item of ownedItems) {
    const ed = editionsById.get(item.editionId);
    if (ed) ownedWorkIds.add(ed.workId);
  }

  const finishedEverWorkIds = new Set(
    params.readings.filter((r) => r.status === "finished").map((r) => r.workId)
  );

  let unreadOwnedItems = 0;
  for (const item of ownedItems) {
    const ed = editionsById.get(item.editionId);
    if (ed && !finishedEverWorkIds.has(ed.workId)) {
      unreadOwnedItems += 1;
    }
  }

  const eligibleFinished = selectEligibleFinishedReadings(params.readings, {
    startsOn: params.periodStartYmd,
    endsOn: params.periodEndYmd,
    countRereads: params.countRereads,
  });

  // Definição única de páginas lidas (concluídos + progresso atual no período)
  const pagesRead = computePagesReadInPeriod({
    readings: params.readings,
    editionsById,
    startsOn: params.periodStartYmd,
    endsOn: params.periodEndYmd,
    countRereads: params.countRereads,
  });

  let secondsListened = 0;
  for (const r of eligibleFinished) {
    if (r.format === "audiobook") {
      secondsListened += resolveReadingAudioSecondsContribution(
        r,
        editionsById
      );
    }
  }
  for (const r of params.readings) {
    if (r.status !== "reading" && r.status !== "paused") continue;
    if (r.format !== "audiobook") continue;
    if (r.dailyLogs && r.dailyLogs.length > 0) {
      for (const log of r.dailyLogs) {
        if (
          log.ymd >= params.periodStartYmd &&
          log.ymd <= params.periodEndYmd
        ) {
          secondsListened += Math.max(0, Math.round(log.seconds ?? 0));
        }
      }
    } else {
      const activeYmd = r.updatedAt?.slice(0, 10) || r.startedOn || "";
      if (
        activeYmd >= params.periodStartYmd &&
        activeYmd <= params.periodEndYmd
      ) {
        secondsListened += resolveReadingAudioSecondsContribution(
          r,
          editionsById
        );
      }
    }
  }

  const abandonedCount = params.readings.filter(
    (r) =>
      r.status === "abandoned" &&
      (!r.updatedAt ||
        (r.updatedAt.slice(0, 10) >= params.periodStartYmd &&
          r.updatedAt.slice(0, 10) <= params.periodEndYmd))
  ).length;

  const ratedValues = params.reviews
    .map((rev) => rev.rating)
    .filter((v) => v >= 0.5 && v <= 5);
  const ratedWorksCount = ratedValues.length;
  const averageRating =
    ratedWorksCount > 0
      ? Number(
          (
            ratedValues.reduce((acc, cur) => acc + cur, 0) / ratedWorksCount
          ).toFixed(2)
        )
      : null;

  const bucketDefs: Array<{ label: string; match: (v: number) => boolean }> = [
    { label: "5,0 ★", match: (v) => v >= 4.8 },
    { label: "4,5 ★", match: (v) => v >= 4.25 && v < 4.8 },
    { label: "4,0 ★", match: (v) => v >= 3.75 && v < 4.25 },
    { label: "≤ 3,5 ★", match: (v) => v < 3.75 },
  ];
  const ratingDistribution: RatingDistributionBucket[] = bucketDefs.map(
    (def) => {
      const count = ratedValues.filter(def.match).length;
      return {
        label: def.label,
        count,
        percent:
          ratedWorksCount > 0
            ? Math.round((count / ratedWorksCount) * 100)
            : 0,
      };
    }
  );

  // Yearly history across all finished and active readings
  const byYear = new Map<
    number,
    { booksRead: number; pagesRead: number; seconds: number }
  >();
  const allEligibleByTime = selectEligibleFinishedReadings(params.readings, {
    startsOn: "1900-01-01",
    endsOn: "2100-12-31",
    countRereads: params.countRereads,
  });

  for (const r of allEligibleByTime) {
    const year = Number((r.finishedOn ?? "2026-01-01").slice(0, 4));
    const bucket = byYear.get(year) ?? {
      booksRead: 0,
      pagesRead: 0,
      seconds: 0,
    };
    bucket.booksRead += 1;
    if (r.format === "audiobook") {
      bucket.seconds += resolveReadingAudioSecondsContribution(r, editionsById);
    } else {
      bucket.pagesRead += resolveReadingPagesContribution(r, editionsById);
    }
    byYear.set(year, bucket);
  }

  for (const r of params.readings) {
    if (r.status !== "reading" && r.status !== "paused") continue;
    if (!r.countsForGoals) continue;
    const year = Number(
      (r.updatedAt?.slice(0, 4) || r.startedOn?.slice(0, 4) || "2026")
    );
    const bucket = byYear.get(year) ?? {
      booksRead: 0,
      pagesRead: 0,
      seconds: 0,
    };
    if (r.format === "audiobook") {
      bucket.seconds += resolveReadingAudioSecondsContribution(r, editionsById);
    } else {
      bucket.pagesRead += resolveReadingPagesContribution(r, editionsById);
    }
    byYear.set(year, bucket);
  }

  const yearlyHistory: YearlyHistoryEntry[] = [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, data]) => ({
      year,
      booksRead: data.booksRead,
      pagesRead: data.pagesRead,
      hoursListened: Number((data.seconds / 3600).toFixed(1)),
    }));

  return {
    uniqueOwnedWorks: ownedWorkIds.size,
    totalOwnedItems: ownedItems.length,
    finishedReadingsCount: eligibleFinished.length,
    pagesRead,
    hoursListened: Number((secondsListened / 3600).toFixed(1)),
    averageRating,
    ratedWorksCount,
    ratingDistribution,
    abandonedCount,
    unreadOwnedItems,
    yearlyHistory,
  };
}
