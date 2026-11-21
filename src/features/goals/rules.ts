import type { Edition, Reading, ReadingGoal } from "@/lib/domain";
import { daysBetweenInclusive, formatDateInTimezone } from "@/lib/dates";
import {
  computeGoalPaceMetrics,
  resolveReadingAudioSecondsContribution,
  resolveReadingPagesContribution,
} from "@/lib/reading-metrics";

export {
  resolveReadingAudioSecondsContribution,
  resolveReadingPagesContribution,
};

export type GoalPaceStatus = "completed" | "ahead" | "on_track" | "behind";

export interface GoalEvaluation {
  completedValue: number;
  targetValue: number;
  progressPercent: number;
  expectedByToday: number;
  paceStatus: GoalPaceStatus;
  remainingValue: number;
  remainingDays: number;
  requiredPerDay: number;
  requiredPerWeek: number;
  currentRatePerWeek: number;
  projectedDaysToFinish: number | null;
  projectedFitsBeforeDeadline: boolean;
  requiredDaysPerWeekAtCurrentPace: number | null;
  requiredDaysPerWeekLabel: string | null;
  requiredDaysPerWeekFormulaTooltip: string | null;
  currentBasisLabel: string;
  requiredBasisLabel: string;
  currentFormulaTooltip: string;
  requiredFormulaTooltip: string;
  requiredPerDayFormatted: string;
  currentPerWeekFormatted: string;
  requiredPerWeekFormatted: string;
  neutralMessagePtBr: string;
}

function isPaginatedFormat(format: Reading["format"]): boolean {
  return format !== "audiobook";
}

/**
 * Mapa diário único (ymd -> { pages, seconds }) derivado exclusivamente dos registros de leitura.
 */
export function deriveDailyReadingActivityMap(
  readings: readonly Reading[],
  editionsById: ReadonlyMap<string, Edition>,
  timeZone = "America/Sao_Paulo"
): Map<string, { pages: number; seconds: number }> {
  const byDay = new Map<string, { pages: number; seconds: number }>();

  const addEntry = (ymd: string, pages: number, seconds: number) => {
    if (!ymd) return;
    const prev = byDay.get(ymd) ?? { pages: 0, seconds: 0 };
    prev.pages += Math.max(0, Math.round(pages));
    prev.seconds += Math.max(0, Math.round(seconds));
    byDay.set(ymd, prev);
  };

  for (const r of readings) {
    if (
      r.status !== "finished" &&
      r.status !== "reading" &&
      r.status !== "paused"
    ) {
      continue;
    }

    if (r.dailyLogs && r.dailyLogs.length > 0) {
      for (const log of r.dailyLogs) {
        addEntry(log.ymd, log.pages ?? 0, log.seconds ?? 0);
      }
      continue;
    }

    const pages = resolveReadingPagesContribution(r, editionsById);
    const seconds = resolveReadingAudioSecondsContribution(r, editionsById);
    const fallbackYmd =
      r.finishedOn ??
      (r.updatedAt ? formatDateInTimezone(r.updatedAt, timeZone) : undefined) ??
      r.startedOn ??
      "";
    addEntry(fallbackYmd, pages, seconds);
  }

  return byDay;
}

export function selectEligibleFinishedReadings(
  readings: readonly Reading[],
  options: {
    startsOn: string;
    endsOn: string;
    countRereads: boolean;
    formats?: readonly Reading["format"][];
  }
): Reading[] {
  const sorted = [...readings]
    .filter(
      (r) =>
        r.status === "finished" &&
        r.countsForGoals &&
        Boolean(r.finishedOn) &&
        (r.finishedOn ?? "") >= options.startsOn &&
        (r.finishedOn ?? "") <= options.endsOn &&
        (!options.formats ||
          options.formats.length === 0 ||
          options.formats.includes(r.format))
    )
    .sort((a, b) => (a.finishedOn ?? "").localeCompare(b.finishedOn ?? ""));

  if (options.countRereads) {
    return sorted;
  }

  const previouslyFinishedWorkIds = new Set(
    readings
      .filter(
        (r) =>
          r.status === "finished" &&
          Boolean(r.finishedOn) &&
          (r.finishedOn ?? "") < options.startsOn
      )
      .map((r) => r.workId)
  );

  const seenInPeriod = new Set<string>(previouslyFinishedWorkIds);
  const filtered: Reading[] = [];

  for (const r of sorted) {
    if (seenInPeriod.has(r.workId)) {
      continue;
    }
    seenInPeriod.add(r.workId);
    filtered.push(r);
  }

  return filtered;
}

/**
 * Definição única de "páginas lidas" no período (livros concluídos + progresso atual),
 * compartilhada entre o topo do painel, as Metas e o Consolidado mensal.
 */
export function computePagesReadInPeriod(params: {
  readings: readonly Reading[];
  editionsById: ReadonlyMap<string, Edition>;
  startsOn: string;
  endsOn: string;
  countRereads: boolean;
  formats?: readonly Reading["format"][];
  timeZone?: string;
}): number {
  const tz = params.timeZone ?? "America/Sao_Paulo";
  const eligibleFinished = selectEligibleFinishedReadings(params.readings, {
    startsOn: params.startsOn,
    endsOn: params.endsOn,
    countRereads: params.countRereads,
    formats: params.formats,
  });

  let totalPages = 0;
  for (const r of eligibleFinished) {
    totalPages += resolveReadingPagesContribution(r, params.editionsById);
  }

  // Inclui também o progresso atual de leituras em andamento/pausadas no período
  for (const r of params.readings) {
    if (r.status !== "reading" && r.status !== "paused") continue;
    if (!r.countsForGoals) continue;
    if (!isPaginatedFormat(r.format)) continue;
    if (
      params.formats &&
      params.formats.length > 0 &&
      !params.formats.includes(r.format)
    ) {
      continue;
    }

    if (r.dailyLogs && r.dailyLogs.length > 0) {
      for (const log of r.dailyLogs) {
        if (log.ymd >= params.startsOn && log.ymd <= params.endsOn) {
          totalPages += Math.max(0, Math.round(log.pages ?? 0));
        }
      }
    } else {
      const activeYmd =
        (r.updatedAt ? formatDateInTimezone(r.updatedAt, tz) : "") ||
        r.startedOn ||
        "";
      if (activeYmd >= params.startsOn && activeYmd <= params.endsOn) {
        totalPages += resolveReadingPagesContribution(r, params.editionsById);
      }
    }
  }

  return totalPages;
}

export function evaluateReadingGoal(params: {
  goal: ReadingGoal;
  readings: readonly Reading[];
  editionsById: ReadonlyMap<string, Edition>;
  todayYmd: string;
  activeDailyPacePages?: number;
  timeZone?: string;
}): GoalEvaluation {
  const {
    goal,
    readings,
    editionsById,
    todayYmd,
    activeDailyPacePages,
    timeZone,
  } = params;

  const eligible = selectEligibleFinishedReadings(readings, {
    startsOn: goal.startsOn,
    endsOn: goal.endsOn,
    countRereads: goal.countRereads,
    formats: goal.formats,
  });

  let completedValue = 0;
  if (goal.kind === "books") {
    completedValue = eligible.length;
  } else {
    completedValue = computePagesReadInPeriod({
      readings,
      editionsById,
      startsOn: goal.startsOn,
      endsOn: goal.endsOn,
      countRereads: goal.countRereads,
      formats: goal.formats,
      timeZone,
    });
  }

  const totalDays = Math.max(
    1,
    daysBetweenInclusive(goal.startsOn, goal.endsOn)
  );
  const clampedToday =
    todayYmd < goal.startsOn
      ? goal.startsOn
      : todayYmd > goal.endsOn
        ? goal.endsOn
        : todayYmd;

  const elapsedDays =
    todayYmd < goal.startsOn
      ? 0
      : daysBetweenInclusive(goal.startsOn, clampedToday);

  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const expectedByToday = goal.targetValue * (elapsedDays / totalDays);
  const progressPercent = Math.min(
    100,
    Math.round((completedValue / goal.targetValue) * 100)
  );

  const pace = computeGoalPaceMetrics({
    completedValue,
    targetValue: goal.targetValue,
    elapsedDays,
    remainingDays,
    unitKind: goal.kind,
    periodKind:
      goal.period === "year"
        ? "year"
        : goal.period === "month"
          ? "month"
          : "custom",
    activeDailyPacePages,
  });

  const {
    remainingValue,
    requiredPerDay,
    requiredPerWeek,
    currentRatePerWeek,
    projectedDaysToFinish,
    projectedFitsBeforeDeadline,
  } = pace;

  const tolerance = (goal.tolerancePercent ?? 5) / 100;
  let paceStatus: GoalPaceStatus;

  if (completedValue >= goal.targetValue) {
    paceStatus = "completed";
  } else if (completedValue >= expectedByToday * (1 + tolerance)) {
    paceStatus = "ahead";
  } else if (completedValue >= expectedByToday * (1 - tolerance)) {
    paceStatus = "on_track";
  } else {
    paceStatus = "behind";
  }

  const unitSingular = goal.kind === "books" ? "livro" : "página";
  const unitPlural = goal.kind === "books" ? "livros" : "páginas";
  const remainingLabel =
    remainingValue === 1
      ? `falta 1 ${unitSingular}`
      : `faltam ${remainingValue} ${unitPlural}`;

  const currentPerWeekLabel = `${pace.currentPerWeekFormatted} (${pace.currentBasisLabel})`;
  // Regra: nunca exibir "termina em N dias" quando N ultrapassa o prazo restante da meta
  const projectedFinishLabel =
    projectedDaysToFinish !== null &&
    projectedDaysToFinish > 0 &&
    projectedFitsBeforeDeadline
      ? `No ritmo atual termina em ${projectedDaysToFinish} ${projectedDaysToFinish === 1 ? "dia" : "dias"}`
      : null;

  let neutralMessagePtBr: string;
  if (paceStatus === "completed") {
    neutralMessagePtBr = "Meta cumprida neste período.";
  } else if (paceStatus === "ahead") {
    neutralMessagePtBr = `Ritmo atual: ${currentPerWeekLabel} · ${remainingLabel}.`;
  } else if (paceStatus === "on_track") {
    neutralMessagePtBr = `Ritmo atual: ${currentPerWeekLabel}${projectedFinishLabel ? ` · ${projectedFinishLabel}` : ` · ${remainingLabel}`}.`;
  } else if (projectedFinishLabel) {
    neutralMessagePtBr = `Ritmo atual: ${currentPerWeekLabel} · ${projectedFinishLabel}.`;
  } else {
    neutralMessagePtBr = `Ritmo atual: ${currentPerWeekLabel} · ${remainingLabel} em ${remainingDays} ${remainingDays === 1 ? "dia" : "dias"} (necessário: ${pace.requiredPerDayFormatted}).`;
  }

  return {
    completedValue,
    targetValue: goal.targetValue,
    progressPercent,
    expectedByToday,
    paceStatus,
    remainingValue,
    remainingDays,
    requiredPerDay,
    requiredPerWeek,
    currentRatePerWeek,
    projectedDaysToFinish,
    projectedFitsBeforeDeadline,
    requiredDaysPerWeekAtCurrentPace: pace.requiredDaysPerWeekAtCurrentPace,
    requiredDaysPerWeekLabel: pace.requiredDaysPerWeekLabel,
    requiredDaysPerWeekFormulaTooltip: pace.requiredDaysPerWeekFormulaTooltip,
    currentBasisLabel: pace.currentBasisLabel,
    requiredBasisLabel: pace.requiredBasisLabel,
    currentFormulaTooltip: pace.currentFormulaTooltip,
    requiredFormulaTooltip: pace.requiredFormulaTooltip,
    requiredPerDayFormatted: pace.requiredPerDayFormatted,
    currentPerWeekFormatted: pace.currentPerWeekFormatted,
    requiredPerWeekFormatted: pace.requiredPerWeekFormatted,
    neutralMessagePtBr,
  };
}
