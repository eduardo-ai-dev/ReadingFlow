import "server-only";
import { requireAuthenticatedWorkspace } from "@/server/store/memory-repository";
import {
  computeActivityHistorySpanDays,
  evaluateReadingGoal,
  type GoalEvaluation,
} from "@/features/goals/rules";
import { daysBetweenInclusive, formatDateInTimezone } from "@/lib/dates";
import {
  MONTH_NAMES_PT_BR,
  computeActiveDaysMetrics,
  computeDailyPaceOnActiveDays,
  computeReadingFrequencyPerWeek,
  deriveDailyReadingLedger,
} from "@/lib/reading-metrics";
import type { ReadingGoal } from "@/lib/domain";

export interface EvaluatedGoalEntry {
  goal: ReadingGoal;
  evaluation: GoalEvaluation;
}

export async function getEvaluatedGoals(): Promise<{
  todayYmd: string;
  timezone: string;
  entries: EvaluatedGoalEntry[];
}> {
  const ws = await requireAuthenticatedWorkspace();
  const todayYmd = formatDateInTimezone(new Date(), ws.profile.timezone);
  const worksById = new Map(ws.works.map((w) => [w.id, w]));
  const editionsById = new Map(ws.editions.map((e) => [e.id, e]));

  // Calcula ritmo diário nos dias ativos e frequência semanal pela fonte única
  const currentYearMonth = todayYmd.slice(0, 7);
  const monthStartYmd = `${currentYearMonth}-01`;
  const monthIdx = Number.parseInt(todayYmd.slice(5, 7), 10) - 1;
  const monthNameLower = (MONTH_NAMES_PT_BR[monthIdx] ?? "mês").toLowerCase();
  const ledger = deriveDailyReadingLedger(
    ws.readings,
    worksById,
    editionsById,
    ws.profile.timezone
  );
  const monthPeriod = computeActiveDaysMetrics(
    ledger,
    monthStartYmd,
    `${currentYearMonth}-31`
  );
  const monthElapsedDays = Math.max(
    1,
    daysBetweenInclusive(monthStartYmd, todayYmd)
  );
  const activeDailyPacePages = computeDailyPaceOnActiveDays({
    totalPages: monthPeriod.totalPages,
    activeDays: monthPeriod.activeDays,
    periodLabel: monthNameLower,
  }).value;
  const readingFrequencyPerWeek = computeReadingFrequencyPerWeek({
    activeDays: monthPeriod.activeDays,
    elapsedDays: monthElapsedDays,
    periodLabel: monthNameLower,
  }).value;

  const activityDaysCount = computeActivityHistorySpanDays(
    ws.readings,
    editionsById,
    todayYmd,
    ws.profile.timezone
  );

  const entries = [...ws.goals]
    .sort((a, b) => b.startsOn.localeCompare(a.startsOn))
    .map((goal) => ({
      goal,
      evaluation: evaluateReadingGoal({
        goal,
        readings: ws.readings,
        editionsById,
        todayYmd,
        activeDailyPacePages,
        readingFrequencyPerWeek,
        activityDaysCount,
        timeZone: ws.profile.timezone,
      }),
    }));

  return {
    todayYmd,
    timezone: ws.profile.timezone,
    entries,
  };
}
