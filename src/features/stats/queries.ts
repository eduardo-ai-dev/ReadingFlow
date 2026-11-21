import "server-only";
import { requireAuthenticatedWorkspace } from "@/server/store/memory-repository";
import {
  computeLibraryStatistics,
  type LibraryStatistics,
} from "@/features/stats/rules";
import { formatDateInTimezone } from "@/lib/dates";

export type StatsPreset =
  "current_year" | "current_month" | "all_time" | "custom";

export async function getStatisticsView(params?: {
  preset?: StatsPreset;
  startYmd?: string;
  endYmd?: string;
}): Promise<{
  preset: StatsPreset;
  periodStartYmd: string;
  periodEndYmd: string;
  timezone: string;
  countRereads: boolean;
  stats: LibraryStatistics;
}> {
  const ws = await requireAuthenticatedWorkspace();
  const todayYmd = formatDateInTimezone(new Date(), ws.profile.timezone);
  const year = todayYmd.slice(0, 4);
  const yearMonth = todayYmd.slice(0, 7);

  const preset = params?.preset ?? "current_year";
  let periodStartYmd = `${year}-01-01`;
  let periodEndYmd = `${year}-12-31`;

  if (preset === "current_month") {
    periodStartYmd = `${yearMonth}-01`;
    periodEndYmd = `${yearMonth}-31`;
  } else if (preset === "all_time") {
    periodStartYmd = "1900-01-01";
    periodEndYmd = "2100-12-31";
  } else if (preset === "custom" && params?.startYmd && params?.endYmd) {
    periodStartYmd = params.startYmd;
    periodEndYmd = params.endYmd;
  }

  const stats = computeLibraryStatistics({
    works: ws.works,
    editions: ws.editions,
    items: ws.items,
    readings: ws.readings,
    reviews: ws.reviews,
    countRereads: ws.profile.goalsCountRereads,
    periodStartYmd,
    periodEndYmd,
  });

  return {
    preset,
    periodStartYmd,
    periodEndYmd,
    timezone: ws.profile.timezone,
    countRereads: ws.profile.goalsCountRereads,
    stats,
  };
}
