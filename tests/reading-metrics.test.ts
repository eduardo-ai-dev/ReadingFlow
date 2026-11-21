import { describe, expect, it } from "vitest";
import {
  buildMonthCalendarGrid,
  computeActiveDaysMetrics,
  computeCalendarQuantileLevels,
  computeCompletedMonthsComparison,
  computeDailyPaceOnActiveDays,
  computeGoalPaceMetrics,
  computeReadingForecast,
  computeReadingFrequencyPerWeek,
  computeWeeklyAverage,
  curateDashboardActivityFeed,
  deriveDailyReadingLedger,
} from "@/lib/reading-metrics";
import type { Edition, Reading, Work } from "@/lib/domain";

function makeWork(id: string, title: string, author: string): Work {
  return {
    id,
    ownerId: null,
    title,
    contributors: [{ name: author, role: "author" }],
    fingerprint: `${title.toLowerCase()}::${author.toLowerCase()}::pt-br`,
    source: "manual",
    createdAt: "2026-01-01T12:00:00.000Z",
  };
}

function makeEdition(id: string, workId: string, pages: number): Edition {
  return {
    id,
    workId,
    ownerId: null,
    title: id,
    language: "pt-BR",
    format: "hardcover",
    pages,
    contributors: [],
    source: "manual",
    createdAt: "2026-01-01T12:00:00.000Z",
  };
}

describe("reading-metrics single source of truth", () => {
  it("derives daily ledger with pages, audio seconds, and per-day sessions", () => {
    const worksById = new Map<string, Work>([
      ["w-1", makeWork("w-1", "Grande Sertão: Veredas", "João Guimarães Rosa")],
      ["w-2", makeWork("w-2", "Dom Casmurro", "Machado de Assis")],
    ]);
    const editionsById = new Map<string, Edition>([
      ["e-1", makeEdition("e-1", "w-1", 560)],
      ["e-2", makeEdition("e-2", "w-2", 400)],
    ]);

    const readings: Reading[] = [
      {
        id: "r-1",
        userId: "u-1",
        workId: "w-1",
        editionId: "e-1",
        format: "hardcover",
        status: "reading",
        startedOn: "2026-11-01",
        progressUnit: "pages",
        progressValue: 90,
        progressTotal: 560,
        dailyLogs: [
          { ymd: "2026-11-10", pages: 30 },
          { ymd: "2026-11-11", pages: 60 },
        ],
        countsForGoals: true,
        createdAt: "2026-11-01T12:00:00.000Z",
        updatedAt: "2026-11-11T18:00:00.000Z",
      },
      {
        id: "r-2",
        userId: "u-1",
        workId: "w-2",
        editionId: "e-2",
        format: "paperback",
        status: "finished",
        startedOn: "2026-11-01",
        finishedOn: "2026-11-11",
        progressUnit: "pages",
        progressValue: 400,
        progressTotal: 400,
        countsForGoals: true,
        createdAt: "2026-11-01T12:00:00.000Z",
        updatedAt: "2026-11-11T20:00:00.000Z",
      },
    ];

    const ledger = deriveDailyReadingLedger(readings, worksById, editionsById);
    expect(ledger.get("2026-11-10")?.pages).toBe(30);
    expect(ledger.get("2026-11-10")?.sessionsCount).toBe(1);
    expect(ledger.get("2026-11-11")?.pages).toBe(460);
    expect(ledger.get("2026-11-11")?.sessionsCount).toBe(2);
    expect(ledger.get("2026-11-11")?.sessions.map((s) => s.title)).toEqual([
      "Grande Sertão: Veredas",
      "Dom Casmurro",
    ]);

    const period = computeActiveDaysMetrics(ledger, "2026-11-01", "2026-11-30");
    expect(period.activeDays).toBe(2);
    expect(period.totalPages).toBe(490);
    expect(period.totalSessions).toBe(3);
  });

  it("labels daily pace on active days and weekly average with explicit bases and formulas", () => {
    const daily = computeDailyPaceOnActiveDays({
      totalPages: 248,
      activeDays: 8,
      periodLabel: "novembro",
    });
    expect(daily.value).toBe(31);
    expect(daily.basisLabel).toBe("média nos dias ativos");
    expect(daily.formulaTooltip).toContain("248");
    expect(daily.formulaTooltip).toContain("8");

    const weeklyMonth = computeWeeklyAverage({
      totalPages: 248,
      elapsedDays: 20,
      scope: "month",
      periodLabel: "novembro",
    });
    // (248 / 20) * 7 = 86.8 -> 87
    expect(weeklyMonth.value).toBe(87);
    expect(weeklyMonth.basisLabel).toBe("média semanal do mês");
    expect(weeklyMonth.formulaTooltip).toContain("248");
    expect(weeklyMonth.formulaTooltip).toContain("20");

    const weeklyYear = computeWeeklyAverage({
      totalPages: 1000,
      elapsedDays: 324,
      scope: "year",
      periodLabel: "2026",
    });
    // (1000 / 324) * 7 = 21.6 -> 22
    expect(weeklyYear.value).toBe(22);
    expect(weeklyYear.basisLabel).toBe("média do ano");
    expect(weeklyYear.formulaTooltip).toContain("324");
  });

  it("computes reading forecast from active-day pace and returns null when pace is zero", () => {
    const noPace = computeReadingForecast({
      progressValue: 100,
      progressTotal: 400,
      progressUnit: "pages",
      dailyPacePages: 0,
      referenceDate: new Date("2026-11-20T12:00:00.000Z"),
    });
    expect(noPace).toBeNull();

    const forecast = computeReadingForecast({
      progressValue: 248,
      progressTotal: 560,
      progressUnit: "pages",
      dailyPacePages: 31,
      referenceDate: new Date("2026-11-20T12:00:00.000Z"),
    });
    expect(forecast).not.toBeNull();
    // remaining = 312; ceil(312 / 31) = 11 days
    expect(forecast?.remainingPages).toBe(312);
    expect(forecast?.daysNeeded).toBe(11);
    expect(forecast?.basisLabel).toBe("com base na média nos dias ativos");
    expect(forecast?.formulaTooltip).toContain("312");
    expect(forecast?.formulaTooltip).toContain("31");
  });

  it("computes goal pace metrics with explicit basis labels and formulas", () => {
    const pace = computeGoalPaceMetrics({
      completedValue: 10,
      targetValue: 24,
      elapsedDays: 181,
      remainingDays: 184,
      unitKind: "books",
      periodKind: "year",
    });
    expect(pace.remainingValue).toBe(14);
    expect(pace.requiredPerDay).toBeCloseTo(14 / 184, 4);
    expect(pace.requiredPerWeek).toBeCloseTo((14 / 184) * 7, 4);
    expect(pace.currentBasisLabel).toBe("média do ano");
    expect(pace.currentFormulaTooltip).toContain("181");
    expect(pace.requiredFormulaTooltip).toContain("184");
  });

  it("suppresses period comparison when fewer than 2 complete periods exist", () => {
    const ledgerSingle = new Map([
      [
        "2026-10-12",
        { ymd: "2026-10-12", pages: 120, seconds: 0, sessionsCount: 1, sessions: [] },
      ],
      [
        "2026-11-05",
        { ymd: "2026-11-05", pages: 90, seconds: 0, sessionsCount: 1, sessions: [] },
      ],
    ]);
    expect(
      computeCompletedMonthsComparison({
        ledger: ledgerSingle,
        currentYearMonth: "2026-11",
      })
    ).toBeNull();

    // Two complete consecutive months before 2026-11: 2026-09 and 2026-10
    const ledgerTwoComplete = new Map([
      [
        "2026-09-15",
        { ymd: "2026-09-15", pages: 200, seconds: 0, sessionsCount: 2, sessions: [] },
      ],
      [
        "2026-10-18",
        { ymd: "2026-10-18", pages: 250, seconds: 0, sessionsCount: 3, sessions: [] },
      ],
      [
        "2026-11-10",
        { ymd: "2026-11-10", pages: 100, seconds: 0, sessionsCount: 1, sessions: [] },
      ],
    ]);

    const cmp = computeCompletedMonthsComparison({
      ledger: ledgerTwoComplete,
      currentYearMonth: "2026-11",
    });
    expect(cmp).not.toBeNull();
    expect(cmp?.latestYearMonth).toBe("2026-10");
    expect(cmp?.previousYearMonth).toBe("2026-09");
    expect(cmp?.pagesDelta).toBe(50);
    expect(cmp?.pagesDeltaPercent).toBe(25);
    expect(cmp?.formulaTooltip).toContain("250");
    expect(cmp?.formulaTooltip).toContain("200");
  });

  it("computes 5 quantile intensity levels (0..4) with legend thresholds", () => {
    const demoSlices = [0, 0, 28, 28, 30, 30, 30, 32, 34, 36];
    const result = computeCalendarQuantileLevels(demoSlices);

    expect(result.classify(0)).toBe(0);
    expect(result.classify(28)).toBe(1);
    expect(result.classify(30)).toBe(2);
    expect(result.classify(32)).toBe(3);
    expect(result.classify(36)).toBe(4);
    expect(result.legend).toHaveLength(5);
    expect(result.legend[0]?.level).toBe(0);
    expect(result.legend[4]?.level).toBe(4);

    // Empty month: all zeros
    const empty = computeCalendarQuantileLevels([0, 0, 0]);
    expect(empty.classify(0)).toBe(0);
    expect(empty.hasActivity).toBe(false);
    expect(empty.legend).toHaveLength(5);
  });

  it("builds a complete calendar month grid aligned to Sunday-Saturday columns", () => {
    const grid = buildMonthCalendarGrid("2026-11", {
      "2026-11-01": {
        ymd: "2026-11-01",
        pages: 42,
        seconds: 0,
        sessionsCount: 1,
        sessions: [],
      },
    });
    // 2026-11-01 is a Sunday (weekday 0), November has 30 days
    expect(grid.leadingEmptyDays).toBe(0);
    expect(grid.days).toHaveLength(30);
    expect(grid.days[0]?.ymd).toBe("2026-11-01");
    expect(grid.days[0]?.pages).toBe(42);
    expect(grid.days[0]?.level).toBeGreaterThan(0);
    expect(grid.activeDaysCount).toBe(1);
    expect(grid.totalPages).toBe(42);
  });

  it("computes equivalent reading days/week at current pace and blocks overdue finish projections", () => {
    const pagesGoal = computeGoalPaceMetrics({
      completedValue: 1000,
      targetValue: 1500,
      elapsedDays: 324,
      remainingDays: 41,
      unitKind: "pages",
      periodKind: "year",
      activeDailyPacePages: 31,
    });
    // Remaining = 500 pages in 41 days -> ~12.2 pág./dia -> ~85.4 pág./semana -> /31 = ~2.8 dias/semana
    expect(pagesGoal.projectedFitsBeforeDeadline).toBe(false);
    expect(pagesGoal.requiredPerDayFormatted).toBe("12,2 pág./dia");
    expect(pagesGoal.requiredDaysPerWeekAtCurrentPace).toBeCloseTo(2.8, 1);
    expect(pagesGoal.requiredDaysPerWeekLabel).toContain("2,8");
    expect(pagesGoal.requiredDaysPerWeekFormulaTooltip).toContain("31");

    const freq = computeReadingFrequencyPerWeek({
      activeDays: 8,
      elapsedDays: 20,
      periodLabel: "novembro",
    });
    expect(freq.value).toBeCloseTo(2.8, 1);
    expect(freq.formatted).toBe("2,8 dias/semana");
  });

  it("groups batch activity events at the same timestamp and prioritizes reading & completions", () => {
    const batchAdded = Array.from({ length: 28 }, (_, i) => ({
      id: `add-${i}`,
      type: "added" as const,
      title: `Adicionou "Livro ${i + 1}"`,
      workTitle: `Livro ${i + 1}`,
      detail: "Obra catalogada no acervo pessoal.",
      timestamp: "2026-08-20T12:00:00.000Z",
      workId: `w-${i}`,
    }));

    const curated = curateDashboardActivityFeed(
      [
        ...batchAdded,
        {
          id: "prog-1",
          type: "progress",
          title: 'Leu "Grande Sertão: Veredas"',
          workTitle: "Grande Sertão: Veredas",
          detail: "Progresso registrado: 248 páginas.",
          timestamp: "2026-11-20T20:00:00.000Z",
          workId: "w-gs",
        },
        {
          id: "fin-1",
          type: "finished",
          title: 'Concluiu "O Avesso da Pele"',
          workTitle: "O Avesso da Pele",
          detail: "Leitura finalizada.",
          timestamp: "2026-07-18T18:00:00.000Z",
          workId: "w-ap",
        },
      ],
      5
    );

    expect(curated[0]?.type).toBe("progress");
    expect(curated[1]?.type).toBe("finished");
    expect(curated[2]?.title).toBe("Adicionou 28 livros");
    expect(curated[2]?.batchCount).toBe(28);
    expect(curated[2]?.href).toBe("/estantes");
    expect(curated).toHaveLength(3);
  });
});
