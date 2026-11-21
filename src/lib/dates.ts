export function formatDateInTimezone(
  instantOrDate: string | Date,
  timezone: string
): string {
  if (
    typeof instantOrDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(instantOrDate)
  ) {
    return instantOrDate;
  }

  const date =
    typeof instantOrDate === "string" ? new Date(instantOrDate) : instantOrDate;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function getYearInTimezone(
  instantOrDate: string | Date,
  timezone: string
): number {
  const ymd = formatDateInTimezone(instantOrDate, timezone);
  return Number(ymd.slice(0, 4));
}

export function formatDisplayDatePtBr(ymd: string): string {
  const [year, month, day] = ymd.split("-");
  if (!year || !month || !day) return ymd;
  return `${day}/${month}/${year}`;
}

export function daysBetweenInclusive(startYmd: string, endYmd: string): number {
  const start = Date.parse(`${startYmd}T00:00:00.000Z`);
  const end = Date.parse(`${endYmd}T00:00:00.000Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return 0;
  }
  return Math.floor((end - start) / 86_400_000) + 1;
}

/**
 * Soma ou subtrai dias civis em uma data YYYY-MM-DD usando aritmética UTC pura
 * (imune a horário de verão e ao fuso do servidor).
 */
export function shiftYmdDays(ymd: string, deltaDays: number): string {
  const [yStr, mStr, dStr] = ymd.split("-");
  const year = Number.parseInt(yStr ?? "1970", 10);
  const month = Number.parseInt(mStr ?? "1", 10) - 1;
  const day = Number.parseInt(dStr ?? "1", 10);
  const dt = new Date(Date.UTC(year, month, day + deltaDays));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Dia da semana (0 = domingo .. 6 = sábado) de uma data civil YYYY-MM-DD. */
export function getWeekdayOfYmd(ymd: string): number {
  const [yStr, mStr, dStr] = ymd.split("-");
  const year = Number.parseInt(yStr ?? "1970", 10);
  const month = Number.parseInt(mStr ?? "1", 10) - 1;
  const day = Number.parseInt(dStr ?? "1", 10);
  return new Date(Date.UTC(year, month, day)).getUTCDay();
}
