import { describe, expect, it } from "vitest";
import type { Edition, Reading, Work } from "@/lib/domain";
import {
  computeReadingForecast,
  deriveDailyReadingLedger,
} from "@/lib/reading-metrics";
import { computePagesReadInPeriod } from "@/features/goals/rules";
import { computeLibraryStatistics } from "@/features/stats/rules";
import {
  formatFullDatePtBr,
  formatRelativeTimePtBr,
  formatShortDatePtBr,
} from "@/lib/formatters";
import { getWeekdayOfYmd, shiftYmdDays } from "@/lib/dates";

const SAMPLE_WORK: Work = {
  id: "w-1",
  ownerId: "u-1",
  title: "Grande Sertão: Veredas",
  contributors: [{ name: "João Guimarães Rosa", role: "author" }],
  fingerprint: "fp-1",
  source: "manual",
  createdAt: "2026-11-01T12:00:00.000Z",
};

const SAMPLE_EDITION: Edition = {
  id: "ed-1",
  workId: "w-1",
  ownerId: "u-1",
  title: "Grande Sertão: Veredas",
  language: "pt-BR",
  format: "hardcover",
  pages: 500,
  contributors: [{ name: "João Guimarães Rosa", role: "author" }],
  source: "manual",
  createdAt: "2026-11-01T12:00:00.000Z",
};

describe("Datas e fusos horários — leituras noturnas após 21h em America/Sao_Paulo", () => {
  it("registra leitura feita às 22h30 BRT (01h30 UTC do dia seguinte) no dia local correto", () => {
    // 20/11/2026 22:30 America/Sao_Paulo === 21/11/2026 01:30:00Z
    const lateNightIso = "2026-11-21T01:30:00.000Z";
    const reading: Reading = {
      id: "r-late",
      userId: "u-1",
      workId: "w-1",
      editionId: "ed-1",
      format: "hardcover",
      status: "reading",
      startedOn: "2026-11-20",
      progressUnit: "pages",
      progressValue: 45,
      progressTotal: 500,
      countsForGoals: true,
      createdAt: lateNightIso,
      updatedAt: lateNightIso,
    };

    const worksById = new Map([[SAMPLE_WORK.id, SAMPLE_WORK]]);
    const editionsById = new Map([[SAMPLE_EDITION.id, SAMPLE_EDITION]]);

    const ledger = deriveDailyReadingLedger(
      [reading],
      worksById,
      editionsById,
      "America/Sao_Paulo"
    );
    expect(ledger.has("2026-11-20")).toBe(true);
    expect(ledger.has("2026-11-21")).toBe(false);
    expect(ledger.get("2026-11-20")?.pages).toBe(45);

    const pagesDay20 = computePagesReadInPeriod({
      readings: [reading],
      editionsById,
      startsOn: "2026-11-20",
      endsOn: "2026-11-20",
      countRereads: false,
      timeZone: "America/Sao_Paulo",
    });
    expect(pagesDay20).toBe(45);

    const pagesDay21 = computePagesReadInPeriod({
      readings: [reading],
      editionsById,
      startsOn: "2026-11-21",
      endsOn: "2026-11-21",
      countRereads: false,
      timeZone: "America/Sao_Paulo",
    });
    expect(pagesDay21).toBe(0);
  });

  it("mantém leitura de réveillon (31/12 23h30 BRT = 01/01 02h30 UTC) no ano de 2026", () => {
    const newYearsEveIso = "2027-01-01T02:30:00.000Z";
    const reading: Reading = {
      id: "r-nye",
      userId: "u-1",
      workId: "w-1",
      editionId: "ed-1",
      format: "hardcover",
      status: "reading",
      startedOn: "2026-12-31",
      progressUnit: "pages",
      progressValue: 60,
      progressTotal: 500,
      countsForGoals: true,
      createdAt: newYearsEveIso,
      updatedAt: newYearsEveIso,
    };

    const stats2026 = computeLibraryStatistics({
      works: [SAMPLE_WORK],
      editions: [SAMPLE_EDITION],
      items: [],
      readings: [reading],
      reviews: [],
      countRereads: false,
      periodStartYmd: "2026-01-01",
      periodEndYmd: "2026-12-31",
      timeZone: "America/Sao_Paulo",
    });

    expect(stats2026.pagesRead).toBe(60);
    expect(stats2026.yearlyHistory).toEqual([
      { year: 2026, booksRead: 0, pagesRead: 60, hoursListened: 0 },
    ]);
  });

  it("calcula previsão de término e formatadores de data no fuso America/Sao_Paulo sem deslocar +1 dia após 21h", () => {
    // 20/11/2026 22:30 BRT -> 21/11/2026 01:30 UTC
    const lateNightDate = new Date("2026-11-21T01:30:00.000Z");

    expect(formatFullDatePtBr(lateNightDate, "America/Sao_Paulo")).toContain(
      "20 de novembro de 2026"
    );
    expect(formatShortDatePtBr(lateNightDate, "America/Sao_Paulo")).toBe(
      "20/11/2026"
    );
    // String somente-data nunca recua para 19/11 por causa do offset -03:00
    expect(formatShortDatePtBr("2026-11-20", "America/Sao_Paulo")).toBe(
      "20/11/2026"
    );
    expect(
      formatRelativeTimePtBr("2026-11-20", lateNightDate, "America/Sao_Paulo")
    ).toBe("Hoje");

    // 100 páginas restantes a 50 pág./dia = 2 dias a partir de 20/11 -> 22 de novembro (não 23!)
    const forecast = computeReadingForecast({
      progressValue: 400,
      progressTotal: 500,
      progressUnit: "pages",
      dailyPacePages: 50,
      referenceDate: lateNightDate,
      timeZone: "America/Sao_Paulo",
    });
    expect(forecast?.daysNeeded).toBe(2);
    expect(forecast?.projectedDatePtBr).toContain("22 de novembro");
  });

  it("desloca datas civis e calcula dia da semana sem erro de virada de mês ou ano", () => {
    expect(shiftYmdDays("2026-11-20", -20)).toBe("2026-10-31");
    expect(shiftYmdDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(getWeekdayOfYmd("2026-11-20")).toBe(5); // sexta-feira
  });
});
