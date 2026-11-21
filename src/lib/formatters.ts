/**
 * readingflow · Utilitários puros de formatação (pt-BR)
 * Seguro para execução tanto em Server Components quanto em Client Components (zero diretivas "use client").
 */

import { formatDateInTimezone, formatDisplayDatePtBr } from "@/lib/dates";

const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const YMD_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function formatRatingPtBr(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

export function formatNumberPtBr(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function formatFullDatePtBr(
  date: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE
): string {
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(date);

  // Capitaliza o dia da semana: "domingo, 8 de novembro de 2026" -> "Domingo, 8 de novembro de 2026"
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatShortDatePtBr(
  date: Date | string,
  timeZone: string = DEFAULT_TIMEZONE
): string {
  if (typeof date === "string" && YMD_ONLY_RE.test(date.trim())) {
    return formatDisplayDatePtBr(date.trim());
  }
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  }).format(d);
}

export function formatRelativeTimePtBr(
  date: Date | string,
  referenceDate?: Date | string,
  timeZone: string = DEFAULT_TIMEZONE
): string {
  const now = referenceDate
    ? typeof referenceDate === "string"
      ? new Date(referenceDate)
      : referenceDate
    : new Date();

  // Strings somente-data (YYYY-MM-DD) devem comparar dias civis no fuso do perfil
  if (typeof date === "string" && YMD_ONLY_RE.test(date.trim())) {
    const targetYmd = date.trim();
    const todayYmd = formatDateInTimezone(now, timeZone);
    const diffDays = Math.floor(
      (Date.parse(`${todayYmd}T00:00:00.000Z`) -
        Date.parse(`${targetYmd}T00:00:00.000Z`)) /
        86_400_000
    );
    if (diffDays <= 0) return "Hoje";
    if (diffDays === 1) return "Ontem";
    if (diffDays < 7) return `Há ${diffDays} dias`;
    return formatDisplayDatePtBr(targetYmd);
  }

  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Math.max(0, now.getTime() - d.getTime());
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 2) return "Há poucos instantes";
  if (diffHours < 1) return `Há ${diffMinutes} min`;
  if (diffHours < 24) return `Há ${diffHours}h`;
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `Há ${diffDays} dias`;
  return formatShortDatePtBr(d, timeZone);
}
