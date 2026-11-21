/**
 * readingflow · Utilitários puros de formatação (pt-BR)
 * Seguro para execução tanto em Server Components quanto em Client Components (zero diretivas "use client").
 */

export function formatRatingPtBr(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

export function formatNumberPtBr(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function formatFullDatePtBr(date: Date = new Date()): string {
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

  // Capitaliza o dia da semana: "domingo, 8 de novembro de 2026" -> "Domingo, 8 de novembro de 2026"
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatShortDatePtBr(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function formatRelativeTimePtBr(
  date: Date | string,
  referenceDate?: Date | string
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = referenceDate
    ? typeof referenceDate === "string"
      ? new Date(referenceDate)
      : referenceDate
    : new Date();
  const diffMs = Math.max(0, now.getTime() - d.getTime());
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 2) return "Há poucos instantes";
  if (diffHours < 1) return `Há ${diffMinutes} min`;
  if (diffHours < 24) return `Há ${diffHours}h`;
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `Há ${diffDays} dias`;
  return formatShortDatePtBr(d);
}

