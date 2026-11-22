import { describe, expect, it } from "vitest";
import {
  MIN_ACTIVITY_DAYS_FOR_GOAL_PROJECTION,
  computeActivityHistorySpanDays,
  evaluateReadingGoal,
} from "@/features/goals/rules";
import type { Edition, Reading, ReadingGoal } from "@/lib/domain";

const PUNITIVE_TERMS = ["atrasada", "atrasado", "falhou", "perdeu"];

function assertNoPunitiveCopy(text: string | null | undefined) {
  const lower = (text ?? "").toLowerCase();
  for (const term of PUNITIVE_TERMS) {
    expect(lower).not.toContain(term);
  }
}

describe("Metas sem culpa — classificação por viabilidade (Etapa 4A)", () => {
  const demoEditions = new Map<string, Edition>([
    [
      "ed-1",
      {
        id: "ed-1",
        workId: "w-1",
        ownerId: null,
        title: "Dom Casmurro",
        language: "pt-BR",
        format: "paperback",
        pages: 400,
        contributors: [{ name: "Machado de Assis", role: "author" }],
        source: "manual",
        createdAt: "2026-01-10T12:00:00.000Z",
      },
    ],
    [
      "ed-2",
      {
        id: "ed-2",
        workId: "w-2",
        ownerId: null,
        title: "Torto Arado",
        language: "pt-BR",
        format: "hardcover",
        pages: 264,
        contributors: [{ name: "Itamar Vieira Junior", role: "author" }],
        source: "manual",
        createdAt: "2026-02-05T12:00:00.000Z",
      },
    ],
    [
      "ed-3",
      {
        id: "ed-3",
        workId: "w-3",
        ownerId: null,
        title: "A Hora da Estrela",
        language: "pt-BR",
        format: "ebook",
        pages: 88,
        contributors: [{ name: "Clarice Lispector", role: "author" }],
        source: "manual",
        createdAt: "2026-03-12T12:00:00.000Z",
      },
    ],
    [
      "ed-4",
      {
        id: "ed-4",
        workId: "w-4",
        ownerId: null,
        title: "O Avesso da Pele",
        language: "pt-BR",
        format: "audiobook",
        durationSeconds: 21600,
        contributors: [{ name: "Jeferson Tenório", role: "author" }],
        source: "manual",
        createdAt: "2026-05-15T12:00:00.000Z",
      },
    ],
    [
      "ed-5",
      {
        id: "ed-5",
        workId: "w-5",
        ownerId: null,
        title: "Grande Sertão: Veredas",
        language: "pt-BR",
        format: "hardcover",
        pages: 560,
        contributors: [{ name: "João Guimarães Rosa", role: "author" }],
        source: "manual",
        createdAt: "2026-04-01T12:00:00.000Z",
      },
    ],
  ]);

  const demoReadings: Reading[] = [
    {
      id: "r-1",
      userId: "u-demo",
      workId: "w-1",
      editionId: "ed-1",
      format: "paperback",
      status: "finished",
      startedOn: "2026-01-15",
      finishedOn: "2026-02-02",
      progressUnit: "pages",
      progressValue: 400,
      progressTotal: 400,
      countsForGoals: true,
      createdAt: "2026-01-15T12:00:00.000Z",
      updatedAt: "2026-02-02T20:00:00.000Z",
    },
    {
      id: "r-2",
      userId: "u-demo",
      workId: "w-2",
      editionId: "ed-2",
      format: "hardcover",
      status: "finished",
      startedOn: "2026-02-15",
      finishedOn: "2026-03-01",
      progressUnit: "pages",
      progressValue: 264,
      progressTotal: 264,
      countsForGoals: true,
      createdAt: "2026-02-15T12:00:00.000Z",
      updatedAt: "2026-03-01T20:00:00.000Z",
    },
    {
      id: "r-3",
      userId: "u-demo",
      workId: "w-3",
      editionId: "ed-3",
      format: "ebook",
      status: "finished",
      startedOn: "2026-04-10",
      finishedOn: "2026-04-12",
      progressUnit: "percent",
      progressValue: 100,
      progressTotal: 100,
      countsForGoals: true,
      createdAt: "2026-04-10T12:00:00.000Z",
      updatedAt: "2026-04-12T20:00:00.000Z",
    },
    {
      id: "r-4",
      userId: "u-demo",
      workId: "w-4",
      editionId: "ed-4",
      format: "audiobook",
      status: "finished",
      startedOn: "2026-07-05",
      finishedOn: "2026-07-18",
      progressUnit: "seconds",
      progressValue: 21600,
      progressTotal: 21600,
      countsForGoals: true,
      createdAt: "2026-07-05T12:00:00.000Z",
      updatedAt: "2026-07-18T20:00:00.000Z",
    },
    {
      id: "r-5",
      userId: "u-demo",
      workId: "w-5",
      editionId: "ed-5",
      format: "hardcover",
      status: "reading",
      startedOn: "2026-11-01",
      progressUnit: "pages",
      progressValue: 248,
      progressTotal: 560,
      dailyLogs: [
        { ymd: "2026-11-13", pages: 28 },
        { ymd: "2026-11-14", pages: 32 },
        { ymd: "2026-11-15", pages: 30 },
        { ymd: "2026-11-16", pages: 36 },
        { ymd: "2026-11-17", pages: 28 },
        { ymd: "2026-11-18", pages: 34 },
        { ymd: "2026-11-19", pages: 30 },
        { ymd: "2026-11-20", pages: 30 },
      ],
      countsForGoals: true,
      createdAt: "2026-11-01T12:00:00.000Z",
      updatedAt: "2026-11-20T20:00:00.000Z",
    },
  ];

  it("caso de verificação 1: meta de páginas (500 pág. em 41 dias, ~12 pág./dia, ~2,8 dias/sem == frequência 2,8 dias/sem) sai 'on_track' (No ritmo)", () => {
    const pagesGoal: ReadingGoal = {
      id: "goal-2026-pages",
      userId: "u-demo",
      title: "Páginas no ano",
      kind: "pages",
      period: "year",
      startsOn: "2026-01-01",
      endsOn: "2026-12-31",
      targetValue: 1500,
      tolerancePercent: 5,
      countRereads: true,
      createdAt: "2026-01-01T08:00:00.000Z",
    };

    const evaluation = evaluateReadingGoal({
      goal: pagesGoal,
      readings: demoReadings,
      editionsById: demoEditions,
      todayYmd: "2026-11-20", // 41 dias restantes
      activeDailyPacePages: 31, // 248 / 8
      readingFrequencyPerWeek: 2.8, // (8 / 20) * 7
    });

    expect(evaluation.completedValue).toBe(1000);
    expect(evaluation.remainingValue).toBe(500);
    expect(evaluation.remainingDays).toBe(41);
    expect(evaluation.paceStatus).toBe("on_track");
    expect(evaluation.progressHeadlinePtBr).toBe("1.000 de 1.500 páginas, 67%");
    expect(evaluation.concreteActionPtBr).toContain(
      "Faltam 500 páginas em 41 dias"
    );
    expect(evaluation.concreteActionPtBr).toContain("~12 pág./dia");
    expect(evaluation.concreteActionPtBr).toContain(
      "2,8 dias de leitura por semana"
    );
    expect(evaluation.realisticAlternativePtBr).toBeNull();
    assertNoPunitiveCopy(evaluation.concreteActionPtBr);
    assertNoPunitiveCopy(evaluation.neutralMessagePtBr);
  });

  it("caso de verificação 2: meta de livros (4 de 6 = 67%, faltam 2 livros em 41 dias, ~0,1 livro/sem) sai 'ambitious' com alternativa realista 'No seu ritmo, 5 livros até 31/12.'", () => {
    const booksGoal: ReadingGoal = {
      id: "goal-2026-books",
      userId: "u-demo",
      title: "Leituras de 2026",
      kind: "books",
      period: "year",
      startsOn: "2026-01-01",
      endsOn: "2026-12-31",
      targetValue: 6,
      tolerancePercent: 5,
      countRereads: false,
      createdAt: "2026-01-01T08:00:00.000Z",
    };

    const evaluation = evaluateReadingGoal({
      goal: booksGoal,
      readings: demoReadings,
      editionsById: demoEditions,
      todayYmd: "2026-11-20",
      activeDailyPacePages: 31,
      readingFrequencyPerWeek: 2.8,
    });

    expect(evaluation.completedValue).toBe(4);
    expect(evaluation.progressPercent).toBe(67);
    expect(evaluation.remainingValue).toBe(2);
    expect(evaluation.remainingDays).toBe(41);
    expect(evaluation.paceStatus).toBe("ambitious");
    expect(evaluation.progressHeadlinePtBr).toBe("4 de 6 livros, 67%");
    expect(evaluation.concreteActionPtBr).toContain(
      "Faltam 2 livros em 41 dias"
    );
    expect(evaluation.suggestedTargetValue).toBe(5);
    expect(evaluation.realisticAlternativePtBr).toBe(
      "No seu ritmo, 5 livros até 31/12."
    );
    assertNoPunitiveCopy(evaluation.concreteActionPtBr);
    assertNoPunitiveCopy(evaluation.realisticAlternativePtBr);
    assertNoPunitiveCopy(evaluation.neutralMessagePtBr);
  });

  it("classifica como 'achievable' (Dá para alcançar) quando necessário fica entre 1x e 1,5x o ritmo atual", () => {
    const pagesGoal: ReadingGoal = {
      id: "goal-achievable",
      userId: "u-demo",
      title: "Páginas no ano",
      kind: "pages",
      period: "year",
      startsOn: "2026-01-01",
      endsOn: "2026-12-31",
      targetValue: 1650, // faltam 650 pág. em 41 dias -> ~111 pág./sem vs 86,8 pág./sem (1,28x <= 1,5x)
      tolerancePercent: 5,
      countRereads: true,
      createdAt: "2026-01-01T08:00:00.000Z",
    };

    const evaluation = evaluateReadingGoal({
      goal: pagesGoal,
      readings: demoReadings,
      editionsById: demoEditions,
      todayYmd: "2026-11-20",
      activeDailyPacePages: 31,
      readingFrequencyPerWeek: 2.8,
    });

    expect(evaluation.paceStatus).toBe("achievable");
    assertNoPunitiveCopy(evaluation.concreteActionPtBr);
    assertNoPunitiveCopy(evaluation.neutralMessagePtBr);
  });

  it("mostra 'collecting_data' sem projeção quando há menos de 14 dias de atividade", () => {
    const goal: ReadingGoal = {
      id: "goal-new-user",
      userId: "u-new",
      title: "Meta Anual",
      kind: "pages",
      period: "year",
      startsOn: "2026-01-01",
      endsOn: "2026-12-31",
      targetValue: 1200,
      tolerancePercent: 5,
      countRereads: false,
      createdAt: "2026-11-15T08:00:00.000Z",
    };

    const recentReadings: Reading[] = [
      {
        id: "r-recent",
        userId: "u-new",
        workId: "w-1",
        editionId: "ed-1",
        format: "paperback",
        status: "reading",
        startedOn: "2026-11-15",
        progressUnit: "pages",
        progressValue: 60,
        progressTotal: 400,
        dailyLogs: [
          { ymd: "2026-11-15", pages: 30 },
          { ymd: "2026-11-18", pages: 30 },
        ],
        countsForGoals: true,
        createdAt: "2026-11-15T12:00:00.000Z",
        updatedAt: "2026-11-18T12:00:00.000Z",
      },
    ];

    const spanDays = computeActivityHistorySpanDays(
      recentReadings,
      demoEditions,
      "2026-11-20"
    );
    expect(spanDays).toBeLessThan(MIN_ACTIVITY_DAYS_FOR_GOAL_PROJECTION);

    const evaluation = evaluateReadingGoal({
      goal,
      readings: recentReadings,
      editionsById: demoEditions,
      todayYmd: "2026-11-20",
      activeDailyPacePages: 30,
      readingFrequencyPerWeek: 2.3,
    });

    expect(evaluation.paceStatus).toBe("collecting_data");
    expect(evaluation.hasEnoughData).toBe(false);
    expect(evaluation.projectedDaysToFinish).toBeNull();
    expect(evaluation.projectedFitsBeforeDeadline).toBe(false);
    expect(evaluation.realisticAlternativePtBr).toBeNull();
    expect(evaluation.concreteActionPtBr).toContain("Ainda coletando dados");
  });

  it("permite pausar meta sem penalidade e retorna status 'paused'", () => {
    const pausedGoal: ReadingGoal = {
      id: "goal-paused",
      userId: "u-demo",
      title: "Leituras de 2026",
      kind: "books",
      period: "year",
      startsOn: "2026-01-01",
      endsOn: "2026-12-31",
      targetValue: 6,
      tolerancePercent: 5,
      countRereads: false,
      paused: true,
      pausedAt: "2026-11-20T12:00:00.000Z",
      createdAt: "2026-01-01T08:00:00.000Z",
    };

    const evaluation = evaluateReadingGoal({
      goal: pausedGoal,
      readings: demoReadings,
      editionsById: demoEditions,
      todayYmd: "2026-11-20",
    });

    expect(evaluation.paceStatus).toBe("paused");
    expect(evaluation.projectedDaysToFinish).toBeNull();
    expect(evaluation.concreteActionPtBr).toContain("sem penalidade");
    assertNoPunitiveCopy(evaluation.concreteActionPtBr);
  });
});
