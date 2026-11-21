import type { BookFormat, ProgressUnit, Reading } from "@/lib/domain";
import { formatDateInTimezone } from "@/lib/dates";

export function computeReadingPercent(input: {
  progressUnit: ProgressUnit;
  progressValue: number;
  progressTotal?: number;
}): number {
  if (input.progressUnit === "percent") {
    return Math.max(0, Math.min(100, Math.round(input.progressValue)));
  }
  if (!input.progressTotal || input.progressTotal <= 0) {
    return 0;
  }
  const pct = (input.progressValue / input.progressTotal) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export function convertReadingProgress(
  current: {
    progressUnit: ProgressUnit;
    progressValue: number;
    progressTotal?: number;
  },
  targetUnit: ProgressUnit,
  editionDimensions: { pages?: number; durationSeconds?: number }
): {
  progressUnit: ProgressUnit;
  progressValue: number;
  progressTotal?: number;
} {
  const pct = computeReadingPercent({
    progressUnit: current.progressUnit,
    progressValue: current.progressValue,
    progressTotal:
      current.progressTotal ??
      (current.progressUnit === "pages"
        ? editionDimensions.pages
        : current.progressUnit === "seconds"
          ? editionDimensions.durationSeconds
          : 100),
  });

  if (targetUnit === "percent") {
    return {
      progressUnit: "percent",
      progressValue: pct,
      progressTotal: 100,
    };
  }

  if (targetUnit === "pages") {
    const totalPages = editionDimensions.pages ?? current.progressTotal;
    return {
      progressUnit: "pages",
      progressValue: totalPages ? Math.round((pct / 100) * totalPages) : 0,
      progressTotal: totalPages,
    };
  }

  const totalSeconds =
    editionDimensions.durationSeconds ?? current.progressTotal;
  return {
    progressUnit: "seconds",
    progressValue: totalSeconds ? Math.round((pct / 100) * totalSeconds) : 0,
    progressTotal: totalSeconds,
  };
}

export function formatDurationPtBr(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

export function canStartActiveReading(
  workId: string,
  allReadings: readonly Reading[],
  maxSimultaneousReadings: number
):
  | { allowed: true }
  | {
      allowed: false;
      reason: "already_active_for_work" | "max_simultaneous_reached";
    } {
  const activeReadings = allReadings.filter(
    (r) => r.status === "reading" || r.status === "paused"
  );
  if (activeReadings.some((r) => r.workId === workId)) {
    return { allowed: false, reason: "already_active_for_work" };
  }
  if (activeReadings.length >= maxSimultaneousReadings) {
    return { allowed: false, reason: "max_simultaneous_reached" };
  }
  return { allowed: true };
}

export function finishReadingRecord(
  reading: Reading,
  options: {
    finishedOn?: string;
    nowIso: string;
    timezone: string;
  }
): Reading {
  const resolvedFinishedOn =
    options.finishedOn ??
    formatDateInTimezone(options.nowIso, options.timezone);

  if (reading.startedOn && resolvedFinishedOn < reading.startedOn) {
    throw new Error(
      "A data de conclusão não pode ser anterior à data de início."
    );
  }

  const completedValue =
    reading.progressUnit === "percent"
      ? 100
      : (reading.progressTotal ?? reading.progressValue);

  return {
    ...reading,
    status: "finished",
    finishedOn: resolvedFinishedOn,
    progressValue: completedValue,
    updatedAt: options.nowIso,
  };
}

export function startRereadRecord(params: {
  newId: string;
  userId: string;
  workId: string;
  editionId?: string;
  libraryItemId?: string;
  format: BookFormat;
  progressUnit: ProgressUnit;
  progressTotal?: number;
  startedOn: string;
  nowIso: string;
}): Reading {
  return {
    id: params.newId,
    userId: params.userId,
    workId: params.workId,
    editionId: params.editionId,
    libraryItemId: params.libraryItemId,
    format: params.format,
    status: "reading",
    startedOn: params.startedOn,
    progressUnit: params.progressUnit,
    progressValue: 0,
    progressTotal: params.progressTotal,
    countsForGoals: true,
    createdAt: params.nowIso,
    updatedAt: params.nowIso,
  };
}

/**
 * Mantém os registros diários (`dailyLogs`) coerentes quando há avanço ou ajuste de progresso,
 * evitando discrepâncias entre os cartões superiores e o mapa diário (heatmap).
 */
export function syncDailyLogsForProgressDelta(params: {
  existingLogs?: Reading["dailyLogs"];
  previousYmd: string;
  todayYmd: string;
  previousPages: number;
  nextPages: number;
  previousSeconds: number;
  nextSeconds: number;
}): Reading["dailyLogs"] {
  const deltaPages = Math.round(params.nextPages - params.previousPages);
  const deltaSeconds = Math.round(params.nextSeconds - params.previousSeconds);
  const logs: Array<{ ymd: string; pages?: number; seconds?: number }> =
    params.existingLogs && params.existingLogs.length > 0
      ? params.existingLogs.map((entry) => ({ ...entry }))
      : [];

  if (deltaPages === 0 && deltaSeconds === 0) {
    return logs.length > 0 ? logs : undefined;
  }

  if (logs.length === 0 && (params.previousPages > 0 || params.previousSeconds > 0)) {
    const baselineYmd = params.previousYmd || params.todayYmd;
    if (baselineYmd !== params.todayYmd) {
      logs.push({
        ymd: baselineYmd,
        pages: params.previousPages > 0 ? params.previousPages : undefined,
        seconds: params.previousSeconds > 0 ? params.previousSeconds : undefined,
      });
    } else {
      logs.push({
        ymd: params.todayYmd,
        pages: params.nextPages > 0 ? params.nextPages : undefined,
        seconds: params.nextSeconds > 0 ? params.nextSeconds : undefined,
      });
      return logs.filter((l) => (l.pages ?? 0) > 0 || (l.seconds ?? 0) > 0);
    }
  }

  const applyDelta = (field: "pages" | "seconds", delta: number) => {
    if (delta === 0) return;
    let todayEntry = logs.find((entry) => entry.ymd === params.todayYmd);
    if (delta > 0) {
      if (!todayEntry) {
        todayEntry = { ymd: params.todayYmd };
        logs.push(todayEntry);
      }
      todayEntry[field] = (todayEntry[field] ?? 0) + delta;
      return;
    }

    // Ajuste regressivo (ex.: correção de página): deduz do dia atual para os anteriores sem negativar
    let remainingToSubtract = Math.abs(delta);
    const orderedIndexes = logs
      .map((entry, idx) => ({ ymd: entry.ymd, idx }))
      .sort((a, b) => b.ymd.localeCompare(a.ymd))
      .map((x) => x.idx);

    for (const idx of orderedIndexes) {
      if (remainingToSubtract <= 0) break;
      const entry = logs[idx]!;
      const cur = entry[field] ?? 0;
      if (cur <= 0) continue;
      const take = Math.min(cur, remainingToSubtract);
      entry[field] = cur - take;
      remainingToSubtract -= take;
    }
  };

  applyDelta("pages", deltaPages);
  applyDelta("seconds", deltaSeconds);

  logs.sort((a, b) => a.ymd.localeCompare(b.ymd));
  const cleaned = logs.filter((entry) => (entry.pages ?? 0) > 0 || (entry.seconds ?? 0) > 0);
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Formata resumo motivacional neutro e informativo ao encerrar sessão no Canto de Foco.
 */
export function formatFocusSessionSummaryPtBr(params: {
  amount: number;
  unit: ProgressUnit;
  elapsedSeconds: number;
}): string {
  const safeAmount = Math.max(0, Math.round(params.amount));
  const safeSeconds = Math.max(0, Math.round(params.elapsedSeconds));

  if (safeAmount <= 0) {
    return "Informe quantas páginas você leu nesta sessão para registrar o avanço e calcular seu ritmo.";
  }

  const noun =
    params.unit === "seconds"
      ? safeAmount === 1
        ? "minuto ouvido"
        : "minutos ouvidos"
      : params.unit === "percent"
        ? "% concluído"
        : safeAmount === 1
          ? "página"
          : "páginas";

  if (safeSeconds <= 0) {
    return `Leu ${safeAmount} ${noun} nesta sessão — avanço pronto para registro.`;
  }

  const rawMinutes = safeSeconds / 60;
  // Garante mínimo de 1 minuto para evitar divisões por zero ou ritmos irreais em sessões muito curtas
  const effectiveMinutes = Math.max(1, rawMinutes);

  const minutesLabel =
    effectiveMinutes >= 10 || Math.abs(effectiveMinutes - Math.round(effectiveMinutes)) < 0.05
      ? String(Math.round(effectiveMinutes))
      : effectiveMinutes.toFixed(1).replace(".", ",");

  const minutesWord = minutesLabel === "1" ? "minuto" : "minutos";
  const rate = safeAmount / effectiveMinutes;
  const rateFormatted = rate.toFixed(1).replace(".", ",");
  const rateUnit =
    params.unit === "seconds"
      ? "min/min"
      : params.unit === "percent"
        ? "%/min"
        : "pág/min";

  const verb = params.unit === "seconds" ? "Registrou" : "Leu";
  return `${verb} ${safeAmount} ${noun} em ${minutesLabel} ${minutesWord} (ritmo: ${rateFormatted} ${rateUnit})`;
}
