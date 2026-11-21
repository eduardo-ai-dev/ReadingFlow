import "server-only";
import { requireAuthenticatedWorkspace } from "@/server/store/memory-repository";
import {
  evaluateReadingGoal,
  type GoalEvaluation,
} from "@/features/goals/rules";
import { formatDateInTimezone } from "@/lib/dates";
import {
  MONTH_NAMES_PT_BR,
  computeActiveDaysMetrics,
  computeDailyPaceOnActiveDays,
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

  // Calcula ritmo diário nos dias ativos do mês corrente pela fonte única
  const currentYearMonth = todayYmd.slice(0, 7);
  const monthIdx = Number.parseInt(todayYmd.slice(5, 7), 10) - 1;
  const monthNameLower = (MONTH_NAMES_PT_BR[monthIdx] ?? "mês").toLowerCase();
  const ledger = deriveDailyReadingLedger(ws.readings, worksById, editionsById);
  const monthPeriod = computeActiveDaysMetrics(
    ledger,
    `${currentYearMonth}-01`,
    `${currentYearMonth}-31`
  );
  const activeDailyPacePages = computeDailyPaceOnActiveDays({
    totalPages: monthPeriod.totalPages,
    activeDays: monthPeriod.activeDays,
    periodLabel: monthNameLower,
  }).value;

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
      }),
    }));

  return {
    todayYmd,
    timezone: ws.profile.timezone,
    entries,
  };
}
