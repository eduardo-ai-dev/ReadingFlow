/**
 * Módulo único de métricas de leitura do ReadingFlow.
 *
 * Todas as telas e blocos do `/painel` (KPIs, Na Cabeceira, Ritmo & Sessão,
 * Metas Ativas, Calendário e Consolidado Mensal) consomem estas fórmulas puras
 * para garantir consistência absoluta, base temporal explícita e rastreabilidade.
 */

import type { BookFormat, Edition, Reading, Work } from "@/lib/domain";
import { formatDateInTimezone, shiftYmdDays } from "@/lib/dates";
import { formatNumberPtBr } from "@/lib/formatters";

export const MONTH_NAMES_PT_BR = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

export interface DailyReadingSession {
  readingId: string;
  workId: string;
  title: string;
  author: string;
  format: BookFormat;
  pages: number;
  seconds: number;
}

export interface DailyReadingRecord {
  ymd: string;
  pages: number;
  seconds: number;
  sessionsCount: number;
  sessions: DailyReadingSession[];
}

export interface MetricWithBasis {
  value: number;
  formatted: string;
  unit: string;
  /** Rótulo curto da base de cálculo exibido na interface (ex.: "média nos dias ativos"). */
  basisLabel: string;
  /** Fórmula detalhada exibida em tooltip acessível. */
  formulaTooltip: string;
}

export interface ActiveDaysMetrics {
  activeDays: number;
  totalPages: number;
  totalSeconds: number;
  totalSessions: number;
}

export interface ReadingForecastResult {
  remainingPages: number;
  daysNeeded: number;
  remainingText: string;
  projectedDatePtBr: string;
  dailyPaceText: string;
  basisLabel: string;
  formulaTooltip: string;
}

export interface GoalPaceMetrics {
  remainingValue: number;
  requiredPerDay: number;
  requiredPerWeek: number;
  currentRatePerDay: number;
  currentRatePerWeek: number;
  projectedDaysToFinish: number | null;
  /** Verdadeiro somente quando a projeção cabe dentro do prazo restante da meta. */
  projectedFitsBeforeDeadline: boolean;
  /** Dias de leitura por semana equivalentes no ritmo atual (quando há base em páginas/dia). */
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
}

export interface RawDashboardActivityEvent {
  id: string;
  type: "progress" | "finished" | "added" | "reviewed";
  title: string;
  workTitle?: string;
  detail: string;
  timestamp: string;
  workId?: string;
  href?: string;
}

export interface CuratedDashboardActivityEvent {
  id: string;
  type: "progress" | "finished" | "added" | "reviewed";
  title: string;
  detail: string;
  timestamp: string;
  workId?: string;
  href?: string;
  batchCount?: number;
}

export interface CompletedMonthsComparison {
  latestYearMonth: string;
  previousYearMonth: string;
  latestMonthLabel: string;
  previousMonthLabel: string;
  latestPages: number;
  previousPages: number;
  pagesDelta: number;
  pagesDeltaPercent: number;
  basisLabel: string;
  formulaTooltip: string;
}

export type CalendarIntensityLevel = 0 | 1 | 2 | 3 | 4;

export interface CalendarQuantileLegendStep {
  level: CalendarIntensityLevel;
  label: string;
  rangeText: string;
}

export interface CalendarQuantileScale {
  hasActivity: boolean;
  thresholds: { q25: number; q50: number; q75: number; max: number } | null;
  classify: (pages: number) => CalendarIntensityLevel;
  legend: CalendarQuantileLegendStep[];
}

export interface CalendarMonthDay {
  ymd: string;
  dayOfMonth: number;
  weekday: number; // 0 = domingo, 6 = sábado
  pages: number;
  seconds: number;
  sessionsCount: number;
  sessions: DailyReadingSession[];
  level: CalendarIntensityLevel;
}

export interface CalendarMonthGrid {
  yearMonth: string;
  year: number;
  monthIndex: number; // 0..11
  monthName: string;
  monthNameLower: string;
  monthYearLabel: string;
  leadingEmptyDays: number;
  days: CalendarMonthDay[];
  activeDaysCount: number;
  totalPages: number;
  totalSessions: number;
  quantiles: CalendarQuantileScale;
}

function isPaginatedFormat(format: Reading["format"]): boolean {
  return format !== "audiobook";
}

export function formatMetricRatePtBr(value: number): string {
  if (value >= 10 || Math.abs(value - Math.round(value)) < 0.05) {
    return formatNumberPtBr(Math.round(value));
  }
  return value.toFixed(1).replace(".", ",");
}

/**
 * Calcula páginas lidas de um registro de leitura (concluído ou em andamento/pausado).
 * Fórmula: para obras paginadas, usa `progressValue` (ou `pages` da edição quando concluído em %).
 */
export function resolveReadingPagesContribution(
  reading: Reading,
  editionsById: ReadonlyMap<string, Edition>
): number {
  if (!isPaginatedFormat(reading.format)) return 0;
  const editionPages = reading.editionId
    ? editionsById.get(reading.editionId)?.pages
    : undefined;
  const totalPages = editionPages ?? reading.progressTotal ?? 0;

  if (reading.status === "finished") {
    const pages =
      reading.progressUnit === "pages" ? reading.progressValue : totalPages;
    return Math.max(0, Math.round(pages));
  }

  if (reading.status === "reading" || reading.status === "paused") {
    if (reading.progressUnit === "pages") {
      return Math.max(0, Math.round(reading.progressValue));
    }
    if (reading.progressUnit === "percent" && totalPages > 0) {
      return Math.max(
        0,
        Math.round((Math.min(100, reading.progressValue) / 100) * totalPages)
      );
    }
  }

  return 0;
}

/**
 * Calcula segundos ouvidos de um registro de leitura em formato audiobook.
 */
export function resolveReadingAudioSecondsContribution(
  reading: Reading,
  editionsById: ReadonlyMap<string, Edition>
): number {
  if (reading.format !== "audiobook") return 0;
  const editionSeconds = reading.editionId
    ? editionsById.get(reading.editionId)?.durationSeconds
    : undefined;
  const totalSeconds = editionSeconds ?? reading.progressTotal ?? 0;

  if (reading.status === "finished") {
    const secs =
      reading.progressUnit === "seconds" ? reading.progressValue : totalSeconds;
    return Math.max(0, Math.round(secs));
  }

  if (reading.status === "reading" || reading.status === "paused") {
    if (reading.progressUnit === "seconds") {
      return Math.max(0, Math.round(reading.progressValue));
    }
    if (reading.progressUnit === "percent" && totalSeconds > 0) {
      return Math.max(
        0,
        Math.round((Math.min(100, reading.progressValue) / 100) * totalSeconds)
      );
    }
  }

  return 0;
}

/**
 * Livro-razão diário único (`ymd -> { pages, seconds, sessionsCount, sessions }`)
 * derivado exclusivamente dos registros de leitura existentes.
 */
export function deriveDailyReadingLedger(
  readings: readonly Reading[],
  worksById: ReadonlyMap<string, Work>,
  editionsById: ReadonlyMap<string, Edition>,
  timeZone = "America/Sao_Paulo"
): Map<string, DailyReadingRecord> {
  const byDay = new Map<string, DailyReadingRecord>();

  const pushSession = (
    ymd: string,
    reading: Reading,
    pages: number,
    seconds: number
  ) => {
    const safePages = Math.max(0, Math.round(pages));
    const safeSeconds = Math.max(0, Math.round(seconds));
    if (!ymd || (safePages === 0 && safeSeconds === 0)) return;

    const work = worksById.get(reading.workId);
    const title = work?.title ?? "Obra do acervo";
    const author =
      work?.contributors.find((c) => c.role === "author")?.name ??
      "Autor desconhecido";

    const existing = byDay.get(ymd) ?? {
      ymd,
      pages: 0,
      seconds: 0,
      sessionsCount: 0,
      sessions: [],
    };
    existing.pages += safePages;
    existing.seconds += safeSeconds;
    existing.sessionsCount += 1;
    existing.sessions.push({
      readingId: reading.id,
      workId: reading.workId,
      title,
      author,
      format: reading.format,
      pages: safePages,
      seconds: safeSeconds,
    });
    byDay.set(ymd, existing);
  };

  for (const reading of readings) {
    if (
      reading.status !== "finished" &&
      reading.status !== "reading" &&
      reading.status !== "paused"
    ) {
      continue;
    }

    if (reading.dailyLogs && reading.dailyLogs.length > 0) {
      for (const log of reading.dailyLogs) {
        pushSession(log.ymd, reading, log.pages ?? 0, log.seconds ?? 0);
      }
      continue;
    }

    const pages = resolveReadingPagesContribution(reading, editionsById);
    const seconds = resolveReadingAudioSecondsContribution(
      reading,
      editionsById
    );
    const fallbackYmd =
      reading.finishedOn ??
      (reading.updatedAt
        ? formatDateInTimezone(reading.updatedAt, timeZone)
        : undefined) ??
      reading.startedOn ??
      "";
    pushSession(fallbackYmd, reading, pages, seconds);
  }

  return byDay;
}

/**
 * Dias ativos, páginas totais, áudio e número de sessões em um intervalo [startYmd, endYmd].
 * Fórmula (dias ativos): contagem de dias distintos no intervalo com páginas > 0 ou áudio > 0.
 */
export function computeActiveDaysMetrics(
  ledger: ReadonlyMap<string, DailyReadingRecord>,
  startYmd: string,
  endYmd: string
): ActiveDaysMetrics {
  let activeDays = 0;
  let totalPages = 0;
  let totalSeconds = 0;
  let totalSessions = 0;

  for (const [ymd, entry] of ledger.entries()) {
    if (ymd < startYmd || ymd > endYmd) continue;
    totalPages += entry.pages;
    totalSeconds += entry.seconds;
    totalSessions += entry.sessionsCount;
    if (entry.pages > 0 || entry.seconds > 0) {
      activeDays += 1;
    }
  }

  return {
    activeDays,
    totalPages,
    totalSeconds,
    totalSessions,
  };
}

/**
 * Ritmo diário nos dias ativos.
 * Fórmula: `round(totalPages / activeDays)` quando `activeDays > 0`, senão `0`.
 */
export function computeDailyPaceOnActiveDays(params: {
  totalPages: number;
  activeDays: number;
  periodLabel: string;
}): MetricWithBasis {
  const safePages = Math.max(0, Math.round(params.totalPages));
  const safeDays = Math.max(0, Math.round(params.activeDays));
  const value = safeDays > 0 ? Math.round(safePages / safeDays) : 0;

  return {
    value,
    formatted: `${formatNumberPtBr(value)} pág./dia`,
    unit: "pág./dia",
    basisLabel: "média nos dias ativos",
    formulaTooltip:
      safeDays > 0
        ? `Fórmula: páginas em ${params.periodLabel} ÷ dias ativos = ${formatNumberPtBr(safePages)} ÷ ${safeDays} = ${formatNumberPtBr(value)} pág./dia`
        : `Fórmula: páginas em ${params.periodLabel} ÷ dias ativos (nenhum dia ativo registrado ainda)`,
  };
}

/**
 * Média semanal em uma base temporal explícita (mês corrido, ano corrido ou período).
 * Fórmula: `(totalPages / elapsedDays) * 7`.
 */
export function computeWeeklyAverage(params: {
  totalPages: number;
  elapsedDays: number;
  scope: "month" | "year" | "period";
  periodLabel: string;
}): MetricWithBasis {
  const safePages = Math.max(0, Math.round(params.totalPages));
  const safeElapsed = Math.max(0, Math.round(params.elapsedDays));
  const raw = safeElapsed > 0 ? (safePages / safeElapsed) * 7 : 0;
  const value = Math.round(raw);

  const basisLabel =
    params.scope === "year"
      ? "média do ano"
      : params.scope === "month"
        ? "média semanal do mês"
        : "média semanal do período";

  return {
    value,
    formatted: `${formatMetricRatePtBr(raw)} pág./semana`,
    unit: "pág./semana",
    basisLabel,
    formulaTooltip:
      safeElapsed > 0
        ? `Fórmula: (páginas em ${params.periodLabel} ÷ dias corridos) × 7 = (${formatNumberPtBr(safePages)} ÷ ${safeElapsed}) × 7 ≈ ${formatMetricRatePtBr(raw)} pág./semana`
        : `Fórmula: (páginas no período ÷ dias corridos) × 7 (período ainda não iniciado)`,
  };
}

/**
 * Previsão de término da leitura atual com base no ritmo real nos dias ativos.
 * Fórmula: `ceil((progressTotal - progressValue) / dailyPacePages)`.
 * Retorna `null` quando não há ritmo real (`dailyPacePages <= 0`) ou quando a unidade não é páginas.
 */
export function computeReadingForecast(params: {
  progressValue: number;
  progressTotal?: number;
  progressUnit: string;
  dailyPacePages: number;
  referenceDate?: Date;
  timeZone?: string;
}): ReadingForecastResult | null {
  if (
    params.progressUnit !== "pages" ||
    !params.progressTotal ||
    params.progressTotal <= params.progressValue ||
    params.dailyPacePages <= 0
  ) {
    return null;
  }

  const remainingPages = Math.max(
    0,
    Math.round(params.progressTotal - params.progressValue)
  );
  const pace = Math.round(params.dailyPacePages);
  if (pace <= 0 || remainingPages <= 0) return null;

  const daysNeeded = Math.max(1, Math.ceil(remainingPages / pace));
  const tz = params.timeZone ?? "America/Sao_Paulo";
  const baseYmd = formatDateInTimezone(params.referenceDate ?? new Date(), tz);
  const projectedYmd = shiftYmdDays(baseYmd, daysNeeded);
  const [projY, projM, projD] = projectedYmd.split("-").map(Number);
  const projectedUtc = new Date(
    Date.UTC(projY ?? 2026, (projM ?? 1) - 1, projD ?? 1)
  );

  const formattedDate = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(projectedUtc);

  return {
    remainingPages,
    daysNeeded,
    remainingText: `${formatNumberPtBr(remainingPages)} páginas restantes`,
    projectedDatePtBr: `~${formattedDate} (em ${daysNeeded} ${daysNeeded === 1 ? "dia" : "dias"})`,
    dailyPaceText: `${formatNumberPtBr(pace)} pág./dia`,
    basisLabel: "com base na média nos dias ativos",
    formulaTooltip: `Fórmula: páginas restantes ÷ média nos dias ativos = ${formatNumberPtBr(remainingPages)} ÷ ${formatNumberPtBr(pace)} = ${daysNeeded} ${daysNeeded === 1 ? "dia" : "dias"}`,
  };
}

/**
 * Frequência semanal de dias ativos no período.
 * Fórmula: `(activeDays / elapsedDays) * 7`.
 */
export function computeReadingFrequencyPerWeek(params: {
  activeDays: number;
  elapsedDays: number;
  periodLabel: string;
}): MetricWithBasis {
  const safeActive = Math.max(0, Math.round(params.activeDays));
  const safeElapsed = Math.max(0, Math.round(params.elapsedDays));
  const raw = safeElapsed > 0 ? Math.min(7, (safeActive / safeElapsed) * 7) : 0;
  const formattedRate = formatMetricRatePtBr(raw);

  return {
    value: Number(raw.toFixed(1)),
    formatted: `${formattedRate} dias/semana`,
    unit: "dias/semana",
    basisLabel: `frequência em ${params.periodLabel}`,
    formulaTooltip:
      safeElapsed > 0
        ? `Fórmula: (dias ativos em ${params.periodLabel} ÷ dias corridos) × 7 = (${safeActive} ÷ ${safeElapsed}) × 7 ≈ ${formattedRate} dias/semana`
        : `Fórmula: (dias ativos ÷ dias corridos) × 7 (período ainda não iniciado)`,
  };
}

/**
 * Ritmo atual e ritmo necessário para cumprir uma meta no seu período.
 * Fórmulas:
 * - Ritmo atual: `(completedValue / elapsedDays) * 7` (base: média do ano / mês / período).
 * - Ritmo necessário: `remainingValue / remainingDays` (por dia) e `× 7` (por semana).
 * - Equivalente em dias/semana no ritmo atual (quando há base): `requiredPerWeek / activeDailyPacePages`.
 */
export function computeGoalPaceMetrics(params: {
  completedValue: number;
  targetValue: number;
  elapsedDays: number;
  remainingDays: number;
  unitKind: "books" | "pages";
  periodKind: "year" | "month" | "custom";
  activeDailyPacePages?: number;
}): GoalPaceMetrics {
  const unitSingular = params.unitKind === "books" ? "livro" : "pág.";
  const unitPlural = params.unitKind === "books" ? "livros" : "páginas";
  const unitShortPlural = params.unitKind === "books" ? "livros" : "pág.";
  const remainingValue = Math.max(
    0,
    params.targetValue - params.completedValue
  );
  const safeElapsed = Math.max(0, params.elapsedDays);
  const safeRemaining = Math.max(0, params.remainingDays);

  const requiredPerDay =
    remainingValue === 0
      ? 0
      : safeRemaining > 0
        ? remainingValue / safeRemaining
        : remainingValue;
  const requiredPerWeek = requiredPerDay * 7;

  const currentRatePerDay =
    safeElapsed > 0 ? params.completedValue / safeElapsed : 0;
  const currentRatePerWeek = currentRatePerDay * 7;

  const projectedDaysToFinish =
    remainingValue === 0
      ? 0
      : currentRatePerDay > 0
        ? Math.ceil(remainingValue / currentRatePerDay)
        : null;

  const projectedFitsBeforeDeadline =
    projectedDaysToFinish !== null && projectedDaysToFinish <= safeRemaining;

  const currentBasisLabel =
    params.periodKind === "year"
      ? "média do ano"
      : params.periodKind === "month"
        ? "média do mês"
        : "média do período";

  const requiredBasisLabel =
    safeRemaining > 0
      ? `${safeRemaining} ${safeRemaining === 1 ? "dia" : "dias"} até o prazo`
      : "prazo encerrado";

  const formatDailyRate = (v: number): string => {
    if (v <= 0) return `0 ${unitShortPlural}/dia`;
    if (params.unitKind === "books" && v < 0.1) {
      return `${v.toFixed(2).replace(".", ",")} ${unitSingular}/dia`;
    }
    const label =
      v >= 100
        ? formatNumberPtBr(Math.round(v))
        : Math.abs(v - Math.round(v)) < 0.05
          ? formatNumberPtBr(Math.round(v))
          : v.toFixed(1).replace(".", ",");
    const unitWord = v <= 1.05 ? unitSingular : unitShortPlural;
    return `${label} ${unitWord}/dia`;
  };

  const requiredPerDayFormatted = formatDailyRate(requiredPerDay);
  const currentPerWeekFormatted = `${formatMetricRatePtBr(currentRatePerWeek)} ${unitPlural}/semana`;
  const requiredPerWeekFormatted = `${formatMetricRatePtBr(requiredPerWeek)} ${unitPlural}/semana`;

  const currentFormulaTooltip =
    safeElapsed > 0
      ? `Fórmula (${currentBasisLabel}): (${formatNumberPtBr(params.completedValue)} ${unitPlural} ÷ ${safeElapsed} dias corridos) × 7 = ${currentPerWeekFormatted}`
      : `Fórmula (${currentBasisLabel}): período da meta ainda não iniciado`;

  const requiredFormulaTooltip =
    remainingValue === 0
      ? "Meta já cumprida no período."
      : safeRemaining > 0
        ? `Fórmula (ritmo necessário): ${formatNumberPtBr(remainingValue)} ${unitPlural} restantes ÷ ${safeRemaining} ${safeRemaining === 1 ? "dia" : "dias"} = ${requiredPerDayFormatted} (${requiredPerWeekFormatted})`
        : `Fórmula (ritmo necessário): restam ${formatNumberPtBr(remainingValue)} ${unitPlural} sem dias restantes no período`;

  let requiredDaysPerWeekAtCurrentPace: number | null = null;
  let requiredDaysPerWeekLabel: string | null = null;
  let requiredDaysPerWeekFormulaTooltip: string | null = null;

  if (
    params.unitKind === "pages" &&
    remainingValue > 0 &&
    safeRemaining > 0 &&
    params.activeDailyPacePages &&
    params.activeDailyPacePages > 0
  ) {
    const daysPerWeek = requiredPerWeek / params.activeDailyPacePages;
    requiredDaysPerWeekAtCurrentPace = Number(daysPerWeek.toFixed(1));
    const formattedDays = formatMetricRatePtBr(daysPerWeek);
    requiredDaysPerWeekLabel =
      daysPerWeek > 7
        ? `mais de 7 dias/semana no ritmo atual (${formattedDays})`
        : `~${formattedDays} ${daysPerWeek <= 1.05 ? "dia" : "dias"}/semana no ritmo atual`;
    requiredDaysPerWeekFormulaTooltip = `Fórmula: ritmo necessário semanal ÷ ritmo nos dias ativos = ${formatMetricRatePtBr(requiredPerWeek)} ÷ ${formatNumberPtBr(Math.round(params.activeDailyPacePages))} ≈ ${formattedDays} dias de leitura/semana`;
  }

  return {
    remainingValue,
    requiredPerDay,
    requiredPerWeek,
    currentRatePerDay,
    currentRatePerWeek,
    projectedDaysToFinish,
    projectedFitsBeforeDeadline,
    requiredDaysPerWeekAtCurrentPace,
    requiredDaysPerWeekLabel,
    requiredDaysPerWeekFormulaTooltip,
    currentBasisLabel,
    requiredBasisLabel,
    currentFormulaTooltip,
    requiredFormulaTooltip,
    requiredPerDayFormatted,
    currentPerWeekFormatted,
    requiredPerWeekFormatted,
  };
}

/**
 * Agrupa eventos em lote do mesmo tipo e horário (mesmo minuto YYYY-MM-DDTHH:MM)
 * e prioriza eventos de leitura e conclusão sobre adições e avaliações.
 */
export function curateDashboardActivityFeed(
  rawEvents: readonly RawDashboardActivityEvent[],
  limit = 5
): CuratedDashboardActivityEvent[] {
  const buckets = new Map<string, RawDashboardActivityEvent[]>();

  for (const ev of rawEvents) {
    const timeKey = ev.timestamp.slice(0, 16);
    const key = `${ev.type}::${timeKey}`;
    const list = buckets.get(key) ?? [];
    list.push(ev);
    buckets.set(key, list);
  }

  const collapsed: CuratedDashboardActivityEvent[] = [];

  for (const [key, group] of buckets.entries()) {
    const first = group[0]!;
    if (group.length === 1) {
      collapsed.push({
        id: first.id,
        type: first.type,
        title: first.title,
        detail: first.detail,
        timestamp: first.timestamp,
        workId: first.workId,
        href: first.href,
      });
      continue;
    }

    const count = group.length;
    const sampleTitles = group
      .map((item) => item.workTitle)
      .filter((t): t is string => Boolean(t))
      .slice(0, 2);
    const remainingCount = Math.max(0, count - sampleTitles.length);
    const previewDetail =
      sampleTitles.length > 0
        ? `${sampleTitles.join(", ")}${remainingCount > 0 ? ` e mais ${remainingCount}` : ""}.`
        : `${count} registros no mesmo lote.`;

    const batchTitleByType: Record<RawDashboardActivityEvent["type"], string> =
      {
        added: `Adicionou ${count} livros`,
        finished: `Concluiu ${count} livros`,
        progress: `Atualizou ${count} leituras`,
        reviewed: `Avaliou ${count} livros`,
      };

    collapsed.push({
      id: `batch-${key}`,
      type: first.type,
      title: batchTitleByType[first.type],
      detail: previewDetail,
      timestamp: first.timestamp,
      href: first.type === "added" ? "/estantes" : "/leitura",
      batchCount: count,
    });
  }

  const primary = collapsed
    .filter((ev) => ev.type === "progress" || ev.type === "finished")
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const secondary = collapsed
    .filter((ev) => ev.type !== "progress" && ev.type !== "finished")
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // Prioriza leitura e conclusão; reserva até 1 vaga final para o evento em lote/secundário mais recente se existir
  if (primary.length >= limit && secondary.length > 0 && limit > 1) {
    return [...primary.slice(0, limit - 1), secondary[0]!];
  }

  return [...primary, ...secondary].slice(0, limit);
}

export function shiftYearMonth(yearMonth: string, deltaMonths: number): string {
  const [yStr, mStr] = yearMonth.split("-");
  const year = Number.parseInt(yStr ?? "2026", 10);
  const month = Number.parseInt(mStr ?? "1", 10) - 1;
  const shifted = new Date(Date.UTC(year, month + deltaMonths, 1));
  const nextYear = shifted.getUTCFullYear();
  const nextMonth = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  return `${nextYear}-${nextMonth}`;
}

export function formatYearMonthLabelPtBr(yearMonth: string): string {
  const [yStr, mStr] = yearMonth.split("-");
  const year = Number.parseInt(yStr ?? "2026", 10);
  const monthIdx = Number.parseInt(mStr ?? "1", 10) - 1;
  const monthName = MONTH_NAMES_PT_BR[monthIdx] ?? "Mês";
  return `${monthName} de ${year}`;
}

/**
 * Comparativo entre os 2 últimos meses completos anteriores ao mês atual (`M-1` vs `M-2`).
 * Regra: só retorna comparativo quando existem ≥ 2 períodos completos consecutivos com base válida;
 * caso contrário retorna `null` e a interface não exibe nenhum comparativo.
 */
export function computeCompletedMonthsComparison(params: {
  ledger: ReadonlyMap<string, DailyReadingRecord>;
  currentYearMonth: string;
}): CompletedMonthsComparison | null {
  const latestYearMonth = shiftYearMonth(params.currentYearMonth, -1);
  const previousYearMonth = shiftYearMonth(params.currentYearMonth, -2);

  let latestPages = 0;
  let previousPages = 0;

  for (const [ymd, entry] of params.ledger.entries()) {
    const ym = ymd.slice(0, 7);
    if (ym === latestYearMonth) {
      latestPages += entry.pages;
    } else if (ym === previousYearMonth) {
      previousPages += entry.pages;
    }
  }

  // Exige >= 2 períodos completos com volume registrado para comparação significativa
  if (latestPages <= 0 || previousPages <= 0) {
    return null;
  }

  const pagesDelta = latestPages - previousPages;
  const pagesDeltaPercent = Math.round((pagesDelta / previousPages) * 100);
  const latestMonthLabel = formatYearMonthLabelPtBr(latestYearMonth);
  const previousMonthLabel = formatYearMonthLabelPtBr(previousYearMonth);

  return {
    latestYearMonth,
    previousYearMonth,
    latestMonthLabel,
    previousMonthLabel,
    latestPages,
    previousPages,
    pagesDelta,
    pagesDeltaPercent,
    basisLabel: `${latestMonthLabel} vs. ${previousMonthLabel}`,
    formulaTooltip: `Fórmula: (${formatNumberPtBr(latestPages)} pág. em ${latestMonthLabel} − ${formatNumberPtBr(previousPages)} pág. em ${previousMonthLabel}) ÷ ${formatNumberPtBr(previousPages)} = ${pagesDeltaPercent >= 0 ? "+" : ""}${pagesDeltaPercent}%`,
  };
}

function interpolateQuantile(sortedAsc: readonly number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0]!;
  const pos = (sortedAsc.length - 1) * q;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  const weight = pos - lower;
  const loVal = sortedAsc[lower] ?? 0;
  const hiVal = sortedAsc[upper] ?? loVal;
  return loVal + (hiVal - loVal) * weight;
}

/**
 * Classifica páginas diárias em 5 níveis de intensidade (0..4) usando quantis (Q1/Q2/Q3)
 * dos dias com leitura no período, garantindo adaptação automática a qualquer ritmo.
 */
export function computeCalendarQuantileLevels(
  pagesValues: readonly number[]
): CalendarQuantileScale {
  const positives = pagesValues.filter((v) => v > 0).sort((a, b) => a - b);

  if (positives.length === 0) {
    return {
      hasActivity: false,
      thresholds: null,
      classify: () => 0,
      legend: [
        { level: 0, label: "Sem leitura", rangeText: "0 pág." },
        { level: 1, label: "Nível 1 (Q1)", rangeText: "1º quartil" },
        { level: 2, label: "Nível 2 (Q2)", rangeText: "2º quartil" },
        { level: 3, label: "Nível 3 (Q3)", rangeText: "3º quartil" },
        { level: 4, label: "Nível 4 (Q4)", rangeText: "4º quartil" },
      ],
    };
  }

  const min = positives[0]!;
  const max = positives[positives.length - 1]!;
  const q25 = interpolateQuantile(positives, 0.25);
  const q50 = interpolateQuantile(positives, 0.5);
  const q75 = interpolateQuantile(positives, 0.75);

  const classify = (pages: number): CalendarIntensityLevel => {
    if (pages <= 0) return 0;
    if (min === max) return 3;
    if (pages <= q25) return 1;
    if (pages <= q50) return 2;
    if (pages <= q75) return 3;
    return 4;
  };

  const r25 = Math.max(1, Math.floor(q25));
  const r50 = Math.max(r25, Math.floor(q50));
  const r75 = Math.max(r50, Math.floor(q75));

  const legend: CalendarQuantileLegendStep[] =
    min === max
      ? [
          { level: 0, label: "Sem leitura", rangeText: "0 pág." },
          { level: 1, label: "Nível 1 (Q1)", rangeText: `< ${min} pág.` },
          { level: 2, label: "Nível 2 (Q2)", rangeText: `${min} pág.` },
          { level: 3, label: "Nível 3 (Q3)", rangeText: `${min} pág.` },
          { level: 4, label: "Nível 4 (Q4)", rangeText: `> ${max} pág.` },
        ]
      : [
          { level: 0, label: "Sem leitura", rangeText: "0 pág." },
          { level: 1, label: "Nível 1 (Q1)", rangeText: `1–${r25} pág.` },
          {
            level: 2,
            label: "Nível 2 (Q2)",
            rangeText: r50 > r25 ? `${r25 + 1}–${r50} pág.` : `${r50} pág.`,
          },
          {
            level: 3,
            label: "Nível 3 (Q3)",
            rangeText: r75 > r50 ? `${r50 + 1}–${r75} pág.` : `${r75} pág.`,
          },
          {
            level: 4,
            label: "Nível 4 (Q4)",
            rangeText: `${r75 + 1}+ pág.`,
          },
        ];

  return {
    hasActivity: true,
    thresholds: { q25, q50, q75, max },
    classify,
    legend,
  };
}

/**
 * Monta a grade completa de um mês calendário (colunas Dom–Sáb) com 5 níveis por quantis.
 */
export function buildMonthCalendarGrid(
  yearMonth: string,
  daysByYmd: Readonly<Record<string, DailyReadingRecord>>
): CalendarMonthGrid {
  const [yStr, mStr] = yearMonth.split("-");
  const year = Number.parseInt(yStr ?? "2026", 10);
  const monthIndex = Math.max(
    0,
    Math.min(11, Number.parseInt(mStr ?? "1", 10) - 1)
  );
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const leadingEmptyDays = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();

  const monthName = MONTH_NAMES_PT_BR[monthIndex] ?? "Mês";
  const monthNameLower = monthName.toLowerCase();
  const monthYearLabel = `${monthName} de ${year}`;

  const rawDays: Array<{
    ymd: string;
    dayOfMonth: number;
    weekday: number;
    record: DailyReadingRecord | undefined;
  }> = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dd = String(d).padStart(2, "0");
    const mm = String(monthIndex + 1).padStart(2, "0");
    const ymd = `${year}-${mm}-${dd}`;
    const weekday = (leadingEmptyDays + (d - 1)) % 7;
    rawDays.push({
      ymd,
      dayOfMonth: d,
      weekday,
      record: daysByYmd[ymd],
    });
  }

  const quantiles = computeCalendarQuantileLevels(
    rawDays.map((item) => item.record?.pages ?? 0)
  );

  let activeDaysCount = 0;
  let totalPages = 0;
  let totalSessions = 0;

  const days: CalendarMonthDay[] = rawDays.map((item) => {
    const pages = item.record?.pages ?? 0;
    const seconds = item.record?.seconds ?? 0;
    const sessionsCount = item.record?.sessionsCount ?? 0;
    const sessions = item.record?.sessions ?? [];
    if (pages > 0 || seconds > 0) {
      activeDaysCount += 1;
    }
    totalPages += pages;
    totalSessions += sessionsCount;

    // Se houve sessão de áudio (0 páginas mas segundos > 0), garante pelo menos nível 1
    const rawLevel = quantiles.classify(pages);
    const level: CalendarIntensityLevel =
      rawLevel === 0 && seconds > 0 ? 1 : rawLevel;

    return {
      ymd: item.ymd,
      dayOfMonth: item.dayOfMonth,
      weekday: item.weekday,
      pages,
      seconds,
      sessionsCount,
      sessions,
      level,
    };
  });

  return {
    yearMonth,
    year,
    monthIndex,
    monthName,
    monthNameLower,
    monthYearLabel,
    leadingEmptyDays,
    days,
    activeDaysCount,
    totalPages,
    totalSessions,
    quantiles,
  };
}
