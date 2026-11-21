"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  buildMonthCalendarGrid,
  shiftYearMonth,
  type CalendarIntensityLevel,
  type CalendarMonthDay,
  type DailyReadingRecord,
} from "@/lib/reading-metrics";
import { formatDisplayDatePtBr } from "@/lib/dates";
import { formatNumberPtBr } from "@/lib/formatters";
import { ptBR } from "@/lib/i18n/pt-BR";
import { rfButtonClassName } from "@/components/ui/ActionControls";

const WEEKDAY_HEADERS = [
  { short: "D", full: "Domingo" },
  { short: "S", full: "Segunda-feira" },
  { short: "T", full: "Terça-feira" },
  { short: "Q", full: "Quarta-feira" },
  { short: "Q", full: "Quinta-feira" },
  { short: "S", full: "Sexta-feira" },
  { short: "S", full: "Sábado" },
] as const;

const LEVEL_SWATCH_CLASSES: Record<CalendarIntensityLevel, string> = {
  0: "bg-[var(--rf-cal-0-bg)] text-[var(--rf-cal-0-text)] border border-[var(--rf-cal-0-border)]",
  1: "bg-[var(--rf-cal-1-bg)] text-[var(--rf-cal-1-text)] border border-[var(--rf-cal-1-border)] font-medium",
  2: "bg-[var(--rf-cal-2-bg)] text-[var(--rf-cal-2-text)] border border-[var(--rf-cal-2-border)] font-semibold",
  3: "bg-[var(--rf-cal-3-bg)] text-[var(--rf-cal-3-text)] border border-[var(--rf-cal-3-border)] font-bold",
  4: "bg-[var(--rf-cal-4-bg)] text-[var(--rf-cal-4-text)] border border-[var(--rf-cal-4-border)] font-bold",
};

function buildDayTooltipText(day: CalendarMonthDay): string {
  const dateLabel = formatDisplayDatePtBr(day.ymd);
  const pagesLabel = `${formatNumberPtBr(day.pages)} ${day.pages === 1 ? "página" : "páginas"
    }`;
  const sessionsLabel = `${day.sessionsCount} ${day.sessionsCount === 1 ? "sessão" : "sessões"
    }`;
  if (day.seconds > 0 && day.pages === 0) {
    const mins = Math.max(1, Math.round(day.seconds / 60));
    return `${dateLabel} · ${formatNumberPtBr(mins)} min ouvidos · ${sessionsLabel}`;
  }
  return `${dateLabel} · ${pagesLabel} · ${sessionsLabel}`;
}

export function ReadingStreakCard({
  calendar,
}: {
  calendar: {
    todayYmd: string;
    initialYearMonth: string;
    earliestYearMonth: string;
    daysByYmd: Record<string, DailyReadingRecord>;
  };
}) {
  const [selectedYearMonth, setSelectedYearMonth] = useState(
    calendar.initialYearMonth
  );
  const [selectedDayYmd, setSelectedDayYmd] = useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = useState<CalendarMonthDay | null>(null);

  const grid = useMemo(
    () => buildMonthCalendarGrid(selectedYearMonth, calendar.daysByYmd),
    [selectedYearMonth, calendar.daysByYmd]
  );

  const canGoNext = selectedYearMonth < calendar.initialYearMonth;
  const minYearMonth = shiftYearMonth(calendar.earliestYearMonth, -12);
  const canGoPrev = selectedYearMonth > minYearMonth;

  const selectedDay = useMemo(
    () =>
      selectedDayYmd
        ? (grid.days.find((d) => d.ymd === selectedDayYmd) ?? null)
        : null,
    [grid.days, selectedDayYmd]
  );

  const navigateMonth = (delta: number) => {
    setSelectedYearMonth((curr) => shiftYearMonth(curr, delta));
    setSelectedDayYmd(null);
    setHoveredDay(null);
  };

  return (
    <section
      aria-labelledby="calendario-titulo"
      className="rf-card flex h-full flex-col justify-between"
    >
      <div>
        {/* Cabeçalho com navegação mês anterior / seguinte */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--rf-divider)] pb-3.5">
          <div className="min-w-0">
            <p className="rf-type-label text-[var(--rf-text-accent-secondary)]">Registro Diário</p>
            <h2
              id="calendario-titulo"
              className="rf-type-section-title mt-0.5 truncate"
            >
              {grid.monthYearLabel}
            </h2>
          </div>

          <div
            className="flex shrink-0 items-center gap-1"
            role="group"
            aria-label="Navegação entre meses do calendário"
          >
            <button
              type="button"
              disabled={!canGoPrev}
              onClick={() => navigateMonth(-1)}
              aria-label={`Ver mês anterior (${shiftYearMonth(selectedYearMonth, -1)})`}
              title="Mês anterior"
              className={rfButtonClassName({
                variant: "subtle",
                size: "sm",
                className:
                  "!min-h-[36px] !w-9 !px-0 border-[var(--rf-border-default)] bg-[var(--rf-surface-canvas)] text-[var(--rf-text-heading)] hover:border-[var(--rf-border-accent)]",
              })}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => navigateMonth(1)}
              aria-label={`Ver mês seguinte (${shiftYearMonth(selectedYearMonth, 1)})`}
              title="Mês seguinte"
              className={rfButtonClassName({
                variant: "subtle",
                size: "sm",
                className:
                  "!min-h-[36px] !w-9 !px-0 border-[var(--rf-border-default)] bg-[var(--rf-surface-canvas)] text-[var(--rf-text-heading)] hover:border-[var(--rf-border-accent)]",
              })}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Resumo do mês exibido (sem repetir o total de páginas que fica no Consolidado Mensal) */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-sans text-[13px] font-semibold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-heading)]">
          <span>
            {grid.activeDaysCount}{" "}
            {grid.activeDaysCount === 1 ? "dia ativo" : "dias ativos"}
          </span>
          <span className="font-medium text-[var(--rf-text-secondary)]">
            {grid.totalSessions}{" "}
            {grid.totalSessions === 1 ? "sessão" : "sessões"} no mês
          </span>
        </div>

        {/* Cabeçalho dos dias da semana (rótulos caixa alta 11px) */}
        <div
          aria-hidden="true"
          className="mt-3 grid grid-cols-7 gap-1.5 text-center font-sans text-[11px] font-bold uppercase tracking-wider text-[var(--rf-text-secondary)]"
        >
          {WEEKDAY_HEADERS.map((wd, idx) => (
            <span key={`${wd.full}-${idx}`} title={wd.full}>
              {wd.short}
            </span>
          ))}
        </div>

        {/* Grade mensal (5 níveis por quantis) */}
        <div
          role="grid"
          aria-label={`Calendário de leitura de ${grid.monthYearLabel}`}
          className="mt-1.5 grid grid-cols-7 gap-1.5"
        >
          {Array.from({ length: grid.leadingEmptyDays }).map((_, idx) => (
            <span key={`empty-${idx}`} aria-hidden="true" className="h-8" />
          ))}

          {grid.days.map((day) => {
            const tooltip = buildDayTooltipText(day);
            const hasSessions = day.sessions.length > 0;
            const isSelected = selectedDayYmd === day.ymd;
            const isToday = day.ymd === calendar.todayYmd;
            const levelClass = LEVEL_SWATCH_CLASSES[day.level];

            const sharedClass = `flex h-8 w-full items-center justify-center rounded-[var(--rf-radius-sm)] font-sans text-[13px] tabular-nums [font-variant-numeric:lining-nums_tabular-nums] transition-colors ${levelClass} ${
              isToday && !isSelected
                ? "outline outline-1 outline-[var(--rf-text-accent-secondary)] outline-offset-1"
                : ""
            }`;

            if (hasSessions) {
              return (
                <button
                  key={day.ymd}
                  type="button"
                  role="gridcell"
                  title={tooltip}
                  aria-label={`${tooltip}. Clique para ver sessões`}
                  aria-expanded={isSelected}
                  aria-controls={
                    isSelected ? "calendario-sessoes-dia" : undefined
                  }
                  onClick={() =>
                    setSelectedDayYmd((prev) =>
                      prev === day.ymd ? null : day.ymd
                    )
                  }
                  onMouseEnter={() => setHoveredDay(day)}
                  onMouseLeave={() => setHoveredDay(null)}
                  onFocus={() => setHoveredDay(day)}
                  onBlur={() => setHoveredDay(null)}
                  className={`rf-icon-btn cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--rf-focus-ring-color)] focus-visible:outline-offset-2 ${sharedClass} ${
                    isSelected
                      ? "outline-2 outline-[var(--rf-text-primary)] outline-offset-1"
                      : "hover:brightness-95"
                  }`}
                >
                  {day.dayOfMonth}
                </button>
              );
            }

            return (
              <div
                key={day.ymd}
                role="gridcell"
                title={tooltip}
                aria-label={tooltip}
                onMouseEnter={() => setHoveredDay(day)}
                onMouseLeave={() => setHoveredDay(null)}
                className={sharedClass}
              >
                {day.dayOfMonth}
              </div>
            );
          })}
        </div>

        {/* Tooltip contextual inline */}
        <div
          aria-live="polite"
          className="mt-2.5 min-h-[20px] font-sans text-[13px] font-medium tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-secondary)]"
        >
          {hoveredDay ? (
            <span>
              {buildDayTooltipText(hoveredDay)}
              {hoveredDay.sessions.length > 0
                ? " · Clique para abrir sessões"
                : ""}
            </span>
          ) : grid.activeDaysCount === 0 ? (
            <span>
              Nenhuma leitura registrada em {grid.monthNameLower} de {grid.year}.
            </span>
          ) : (
            <span>
              Clique em um dia destacado para abrir as sessões registradas.
            </span>
          )}
        </div>
      </div>

      {/* Legenda dos 5 níveis por quantis */}
      <div className="mt-3.5 border-t border-[var(--rf-divider)] pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-sans text-[13px] font-medium text-[var(--rf-text-secondary)]">
            Quantis no mês
          </span>
          <div
            className="flex items-center gap-1.5 font-sans text-[13px] text-[var(--rf-text-secondary)]"
            aria-label="Legenda de 5 níveis de intensidade por quantis"
          >
            <span>Menos</span>
            {grid.quantiles.legend.map((step) => (
              <span
                key={step.level}
                title={`${step.label}: ${step.rangeText}`}
                aria-label={`${step.label}: ${step.rangeText}`}
                className={`inline-block h-3.5 w-3.5 rounded-[var(--rf-radius-xs)] ${LEVEL_SWATCH_CLASSES[step.level]}`}
              />
            ))}
            <span>Mais</span>
          </div>
        </div>

        {/* Lista de sessões do dia clicado (quando houver dados de sessão) */}
        {selectedDay && selectedDay.sessions.length > 0 ? (
          <div
            id="calendario-sessoes-dia"
            className="mt-3.5 border-t border-[var(--rf-divider)] pt-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="rf-type-label text-[var(--rf-text-accent-secondary)]">
                Sessões em {formatDisplayDatePtBr(selectedDay.ymd)} (
                {selectedDay.sessionsCount})
              </p>
              <button
                type="button"
                onClick={() => setSelectedDayYmd(null)}
                aria-label="Fechar lista de sessões do dia"
                className={rfButtonClassName({
                  variant: "subtle",
                  size: "sm",
                  className: "!min-h-[30px] !w-7 !px-0 text-[var(--rf-text-secondary)]",
                })}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <ul className="mt-2 divide-y divide-[var(--rf-divider)]">
              {selectedDay.sessions.map((session, idx) => (
                <li
                  key={`${session.readingId}-${idx}`}
                  className="flex items-baseline justify-between gap-2 py-2 first:pt-1 last:pb-0"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/livros/${session.workId}`}
                      className="block truncate font-serif text-sm font-semibold text-[var(--rf-text-primary)] hover:text-[var(--rf-text-accent-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
                    >
                      {session.title}
                    </Link>
                    <p className="rf-type-caption truncate">
                      {session.author} · {ptBR.formats[session.format]}
                    </p>
                  </div>
                  <span className="shrink-0 font-sans text-[13px] font-semibold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[var(--rf-text-accent-secondary)]">
                    {session.pages > 0
                      ? `${formatNumberPtBr(session.pages)} pág.`
                      : `${Math.max(1, Math.round(session.seconds / 60))} min`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
