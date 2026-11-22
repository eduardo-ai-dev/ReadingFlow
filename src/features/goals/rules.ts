import type { Edition, Reading, ReadingGoal } from "@/lib/domain";
import { daysBetweenInclusive, formatDateInTimezone } from "@/lib/dates";
import { formatNumberPtBr } from "@/lib/formatters";
import {
  computeGoalPaceMetrics,
  formatMetricRatePtBr,
  resolveReadingAudioSecondsContribution,
  resolveReadingPagesContribution,
} from "@/lib/reading-metrics";

export {
  resolveReadingAudioSecondsContribution,
  resolveReadingPagesContribution,
};

/** Mínimo de dias de histórico de atividade para calcular projeções de viabilidade. */
export const MIN_ACTIVITY_DAYS_FOR_GOAL_PROJECTION = 14;

/**
 * Estados de meta baseados em viabilidade real (nunca punitivos, nunca por calendário rígido).
 * - `completed`: alvo atingido
 * - `paused`: pausada voluntariamente sem penalidade
 * - `collecting_data`: menos de 14 dias de histórico de atividade (sem projeção)
 * - `on_track`: ritmo necessário <= ritmo atual (dentro da tolerância)
 * - `achievable`: ritmo necessário <= 1,5x ritmo atual
 * - `ambitious`: acima de 1,5x ritmo atual (com sugestão realista de ajuste)
 */
export type GoalPaceStatus =
  | "completed"
  | "paused"
  | "collecting_data"
  | "on_track"
  | "achievable"
  | "ambitious";

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
  effectiveWeeklyRate: number;
  activityDaysCount: number;
  hasEnoughData: boolean;
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
  progressHeadlinePtBr: string;
  concreteActionPtBr: string;
  realisticAlternativePtBr: string | null;
  suggestedTargetValue: number | null;
  howToReachStepsPtBr: string[];
  neutralMessagePtBr: string;
}

function isPaginatedFormat(format: Reading["format"]): boolean {
  return format !== "audiobook";
}

function formatDeadlineShortPtBr(endsOn: string, todayYmd: string): string {
  const [y, m, d] = endsOn.split("-");
  if (!y || !m || !d) return endsOn;
  const todayYear = todayYmd.slice(0, 4);
  return y === todayYear ? `${d}/${m}` : `${d}/${m}/${y}`;
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

/**
 * Calcula a amplitude em dias desde a primeira atividade registrada do usuário até `todayYmd`.
 * Contas novas com menos de 14 dias de histórico retornam < 14 e recebem o estado
 * "Ainda coletando dados" (sem projeções prematuras).
 */
export function computeActivityHistorySpanDays(
  readings: readonly Reading[],
  editionsById: ReadonlyMap<string, Edition>,
  todayYmd: string,
  timeZone = "America/Sao_Paulo"
): number {
  const byDay = deriveDailyReadingActivityMap(readings, editionsById, timeZone);
  let earliestYmd: string | null = null;

  const consider = (ymd: string | undefined) => {
    if (!ymd || ymd.length < 10 || ymd > todayYmd) return;
    if (!earliestYmd || ymd < earliestYmd) {
      earliestYmd = ymd;
    }
  };

  for (const [ymd, entry] of byDay.entries()) {
    if (entry.pages > 0 || entry.seconds > 0) {
      consider(ymd);
    }
  }

  for (const r of readings) {
    if (
      r.status !== "finished" &&
      r.status !== "reading" &&
      r.status !== "paused"
    ) {
      continue;
    }
    consider(r.startedOn);
    consider(r.finishedOn);
  }

  if (!earliestYmd) return 0;
  return daysBetweenInclusive(earliestYmd, todayYmd);
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
  readingFrequencyPerWeek?: number;
  activityDaysCount?: number;
  timeZone?: string;
}): GoalEvaluation {
  const {
    goal,
    readings,
    editionsById,
    todayYmd,
    activeDailyPacePages,
    readingFrequencyPerWeek,
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
  } = pace;

  const activityDaysCount =
    params.activityDaysCount !== undefined
      ? Math.max(0, Math.round(params.activityDaysCount))
      : computeActivityHistorySpanDays(
          readings,
          editionsById,
          todayYmd,
          timeZone
        );

  const hasEnoughData =
    activityDaysCount >= MIN_ACTIVITY_DAYS_FOR_GOAL_PROJECTION;

  // Ritmo real do usuário pela fonte única:
  // - Páginas: ritmo nos dias ativos × frequência semanal (quando disponível)
  // - Livros: ritmo médio semanal real no período
  const effectiveWeeklyRate =
    goal.kind === "pages" &&
    activeDailyPacePages !== undefined &&
    activeDailyPacePages > 0 &&
    readingFrequencyPerWeek !== undefined &&
    readingFrequencyPerWeek > 0
      ? activeDailyPacePages * readingFrequencyPerWeek
      : currentRatePerWeek;

  const effectiveDailyRate = effectiveWeeklyRate / 7;
  const tolerance = Math.max(0, goal.tolerancePercent ?? 5) / 100;

  let paceStatus: GoalPaceStatus;
  if (goal.paused) {
    paceStatus = "paused";
  } else if (completedValue >= goal.targetValue) {
    paceStatus = "completed";
  } else if (!hasEnoughData) {
    paceStatus = "collecting_data";
  } else if (
    effectiveWeeklyRate > 0 &&
    requiredPerWeek <= effectiveWeeklyRate * (1 + tolerance)
  ) {
    paceStatus = "on_track";
  } else if (
    effectiveWeeklyRate > 0 &&
    requiredPerWeek <= effectiveWeeklyRate * 1.5
  ) {
    paceStatus = "achievable";
  } else {
    paceStatus = "ambitious";
  }

  // Sem projeções quando não há dados suficientes (< 14 dias) ou meta pausada
  const projectedDaysToFinish =
    !hasEnoughData || goal.paused
      ? null
      : remainingValue === 0
        ? 0
        : effectiveDailyRate > 0
          ? Math.ceil(remainingValue / effectiveDailyRate)
          : null;

  const projectedFitsBeforeDeadline =
    projectedDaysToFinish !== null && projectedDaysToFinish <= remainingDays;

  const unitSingular = goal.kind === "books" ? "livro" : "página";
  const unitPlural = goal.kind === "books" ? "livros" : "páginas";
  const dayWord = remainingDays === 1 ? "dia" : "dias";
  const deadlineShort = formatDeadlineShortPtBr(goal.endsOn, todayYmd);

  const progressHeadlinePtBr = `${formatNumberPtBr(completedValue)} de ${formatNumberPtBr(goal.targetValue)} ${unitPlural}, ${progressPercent}%`;

  // Ação concreta respeitosa e direta
  let concreteActionPtBr: string;
  if (paceStatus === "completed") {
    concreteActionPtBr = `Você alcançou ${formatNumberPtBr(completedValue)} de ${formatNumberPtBr(goal.targetValue)} ${unitPlural} neste período.`;
  } else if (paceStatus === "paused") {
    concreteActionPtBr =
      "Meta pausada sem penalidade. Retome quando quiser voltar a acompanhar o ritmo.";
  } else if (paceStatus === "collecting_data") {
    concreteActionPtBr =
      "Ainda coletando dados — após 14 dias de histórico de leitura, calculamos seu ritmo e sugestões personalizadas.";
  } else if (remainingDays <= 0) {
    concreteActionPtBr = `${remainingValue === 1 ? `Falta 1 ${unitSingular}` : `Faltam ${formatNumberPtBr(remainingValue)} ${unitPlural}`} no período encerrado. Você pode ajustar a meta ou adiar o prazo.`;
  } else if (goal.kind === "pages") {
    const roundedDaily = Math.max(1, Math.round(requiredPerDay));
    const daysPerWeek = pace.requiredDaysPerWeekAtCurrentPace;
    if (daysPerWeek !== null && daysPerWeek > 0) {
      const formattedDays = formatMetricRatePtBr(daysPerWeek);
      const readingDaysPhrase =
        daysPerWeek > 7
          ? `mais de 7 dias de leitura por semana no ritmo atual`
          : `cerca de ${formattedDays} ${daysPerWeek <= 1.05 ? "dia" : "dias"} de leitura por semana`;
      concreteActionPtBr = `Faltam ${formatNumberPtBr(remainingValue)} páginas em ${remainingDays} ${dayWord}: ~${formatNumberPtBr(roundedDaily)} pág./dia, ${readingDaysPhrase}.`;
    } else {
      concreteActionPtBr = `Faltam ${formatNumberPtBr(remainingValue)} páginas em ${remainingDays} ${dayWord}: ~${formatNumberPtBr(roundedDaily)} pág./dia.`;
    }
  } else {
    if (remainingValue === 1) {
      concreteActionPtBr = `Falta 1 livro em ${remainingDays} ${dayWord} — você tem ${remainingDays} ${dayWord} para concluir essa leitura com calma.`;
    } else if (requiredPerWeek >= 1) {
      concreteActionPtBr = `Faltam ${formatNumberPtBr(remainingValue)} livros em ${remainingDays} ${dayWord}: ~${formatMetricRatePtBr(requiredPerWeek)} livros por semana.`;
    } else {
      const daysPerBook = Math.max(
        1,
        Math.round(remainingDays / remainingValue)
      );
      concreteActionPtBr = `Faltam ${formatNumberPtBr(remainingValue)} livros em ${remainingDays} ${dayWord}: cerca de 1 livro a cada ${daysPerBook} ${daysPerBook === 1 ? "dia" : "dias"}.`;
    }
  }

  // Alternativa realista quando a conta não fecha no ritmo atual (meta ambiciosa)
  let realisticAlternativePtBr: string | null = null;
  let suggestedTargetValue: number | null = null;

  if (paceStatus === "ambitious" && remainingDays > 0) {
    const projectedAdditional = effectiveDailyRate * remainingDays;
    if (goal.kind === "books") {
      if (effectiveWeeklyRate > 0) {
        const rawTotal = completedValue + projectedAdditional;
        const candidate =
          projectedAdditional >= 0.45
            ? Math.max(completedValue + 1, Math.round(rawTotal))
            : Math.max(1, completedValue);
        const bounded = Math.min(goal.targetValue - 1, candidate);
        if (bounded >= 1 && bounded < goal.targetValue) {
          suggestedTargetValue = bounded;
          realisticAlternativePtBr = `No seu ritmo, ${formatNumberPtBr(bounded)} ${bounded === 1 ? "livro" : "livros"} até ${deadlineShort}.`;
        }
      } else {
        realisticAlternativePtBr =
          "Você pode reduzir o alvo ou adiar o prazo sem penalidade para manter a leitura leve.";
      }
    } else if (effectiveWeeklyRate > 0) {
      const step = goal.targetValue >= 300 ? 50 : 10;
      const rawTotal = completedValue + projectedAdditional;
      const rounded = Math.round(rawTotal / step) * step;
      const candidate = Math.max(completedValue + step, rounded);
      const bounded =
        candidate < goal.targetValue
          ? candidate
          : Math.max(1, Math.floor((goal.targetValue - 1) / step) * step);
      if (bounded > 0 && bounded < goal.targetValue) {
        suggestedTargetValue = bounded;
        realisticAlternativePtBr = `No seu ritmo, ${formatNumberPtBr(bounded)} páginas até ${deadlineShort}.`;
      }
    } else {
      realisticAlternativePtBr =
        "Você pode ajustar a quantidade de páginas ou estender o prazo sem penalidade.";
    }
  }

  // Passos objetivos para o painel "Ver como chegar lá"
  const howToReachStepsPtBr: string[] = [];
  if (paceStatus === "collecting_data") {
    howToReachStepsPtBr.push(
      "Registre suas sessões de leitura nos próximos dias para conhecermos seu ritmo real."
    );
    howToReachStepsPtBr.push(
      "Depois de 14 dias de histórico, mostraremos sugestões concretas de dias por semana e ajustes."
    );
  } else if (paceStatus === "paused") {
    howToReachStepsPtBr.push(
      "Esta meta está pausada e não gera nenhuma cobrança."
    );
    howToReachStepsPtBr.push(
      "Quando fizer sentido para a sua rotina, clique em Retomar meta ou adie a data final."
    );
  } else if (paceStatus === "completed") {
    howToReachStepsPtBr.push(
      "Meta alcançada! Você pode manter este ritmo ou criar uma nova meta no próximo período."
    );
  } else {
    howToReachStepsPtBr.push(concreteActionPtBr);
    if (
      goal.kind === "pages" &&
      activeDailyPacePages &&
      activeDailyPacePages > 0
    ) {
      const freqText =
        readingFrequencyPerWeek && readingFrequencyPerWeek > 0
          ? `${formatMetricRatePtBr(readingFrequencyPerWeek)} dias/semana`
          : "sua frequência atual";
      howToReachStepsPtBr.push(
        `Seu ritmo recente é de ~${formatNumberPtBr(Math.round(activeDailyPacePages))} pág./dia ativo (${freqText}).`
      );
    } else if (goal.kind === "books" && currentRatePerWeek > 0) {
      howToReachStepsPtBr.push(
        `Seu ritmo médio no período é de ${pace.currentPerWeekFormatted}.`
      );
    }
    if (realisticAlternativePtBr) {
      howToReachStepsPtBr.push(
        `Alternativa confortável: ${realisticAlternativePtBr}`
      );
    } else if (paceStatus === "achievable") {
      howToReachStepsPtBr.push(
        "Adicionar uma sessão curta extra por semana já aproxima bastante a meta do seu ritmo atual."
      );
    } else if (paceStatus === "on_track") {
      howToReachStepsPtBr.push(
        "Mantendo sua cadência atual, você alcança o objetivo dentro do prazo."
      );
    }
  }

  const currentPerWeekLabel = `${pace.currentPerWeekFormatted} (${pace.currentBasisLabel})`;
  const projectedFinishLabel =
    projectedDaysToFinish !== null &&
    projectedDaysToFinish > 0 &&
    projectedFitsBeforeDeadline
      ? `No ritmo atual termina em ${projectedDaysToFinish} ${projectedDaysToFinish === 1 ? "dia" : "dias"}`
      : null;

  let neutralMessagePtBr: string;
  if (paceStatus === "completed") {
    neutralMessagePtBr = "Meta cumprida neste período.";
  } else if (paceStatus === "paused") {
    neutralMessagePtBr = "Meta pausada sem penalidade.";
  } else if (paceStatus === "collecting_data") {
    neutralMessagePtBr = "Ainda coletando dados para estimar o ritmo.";
  } else if (paceStatus === "on_track") {
    neutralMessagePtBr = `Ritmo atual: ${currentPerWeekLabel}${projectedFinishLabel ? ` · ${projectedFinishLabel}` : ` · ${concreteActionPtBr}`}`;
  } else {
    neutralMessagePtBr = `Ritmo atual: ${currentPerWeekLabel} · ${concreteActionPtBr}`;
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
    effectiveWeeklyRate,
    activityDaysCount,
    hasEnoughData,
    projectedDaysToFinish,
    projectedFitsBeforeDeadline,
    requiredDaysPerWeekAtCurrentPace: hasEnoughData
      ? pace.requiredDaysPerWeekAtCurrentPace
      : null,
    requiredDaysPerWeekLabel: hasEnoughData
      ? pace.requiredDaysPerWeekLabel
      : null,
    requiredDaysPerWeekFormulaTooltip: hasEnoughData
      ? pace.requiredDaysPerWeekFormulaTooltip
      : null,
    currentBasisLabel: pace.currentBasisLabel,
    requiredBasisLabel: pace.requiredBasisLabel,
    currentFormulaTooltip: pace.currentFormulaTooltip,
    requiredFormulaTooltip: pace.requiredFormulaTooltip,
    requiredPerDayFormatted: pace.requiredPerDayFormatted,
    currentPerWeekFormatted: pace.currentPerWeekFormatted,
    requiredPerWeekFormatted: pace.requiredPerWeekFormatted,
    progressHeadlinePtBr,
    concreteActionPtBr,
    realisticAlternativePtBr,
    suggestedTargetValue,
    howToReachStepsPtBr,
    neutralMessagePtBr,
  };
}
