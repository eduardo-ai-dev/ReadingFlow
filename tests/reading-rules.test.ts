import { describe, expect, it } from "vitest";
import { formatDateInTimezone, getYearInTimezone } from "@/lib/dates";
import {
  canStartActiveReading,
  computeReadingPercent,
  convertReadingProgress,
  finishReadingRecord,
  formatFocusSessionSummaryPtBr,
  startRereadRecord,
  syncDailyLogsForProgressDelta,
} from "@/features/reading/rules";
import type { Reading } from "@/lib/domain";

describe("Timezone & Reading rules (RF-J01..J07, §8.2, §12.2, Cenários 6 e 7)", () => {
  it("resolves Dec 31 23:30 in America/Sao_Paulo (Jan 1 02:30 UTC) into 2025, not 2026", () => {
    const utcInstant = "2026-01-01T02:30:00.000Z";
    expect(formatDateInTimezone(utcInstant, "America/Sao_Paulo")).toBe(
      "2025-12-31"
    );
    expect(getYearInTimezone(utcInstant, "America/Sao_Paulo")).toBe(2025);
    expect(formatDateInTimezone(utcInstant, "UTC")).toBe("2026-01-01");
  });

  it("converts reading progress explicitly across pages, percent, and seconds", () => {
    expect(
      computeReadingPercent({
        progressUnit: "pages",
        progressValue: 125,
        progressTotal: 250,
      })
    ).toBe(50);

    expect(
      convertReadingProgress(
        { progressUnit: "percent", progressValue: 25 },
        "pages",
        { pages: 400 }
      )
    ).toEqual({
      progressUnit: "pages",
      progressValue: 100,
      progressTotal: 400,
    });

    expect(
      convertReadingProgress(
        { progressUnit: "seconds", progressValue: 3600, progressTotal: 7200 },
        "percent",
        { durationSeconds: 7200 }
      )
    ).toEqual({
      progressUnit: "percent",
      progressValue: 50,
      progressTotal: 100,
    });
  });

  it("prevents two active readings for the same work while allowing rereads after completion", () => {
    const firstReading: Reading = {
      id: "r-1",
      userId: "u-1",
      workId: "w-1",
      editionId: "e-1",
      format: "paperback",
      status: "reading",
      startedOn: "2025-05-01",
      progressUnit: "pages",
      progressValue: 80,
      progressTotal: 200,
      countsForGoals: true,
      createdAt: "2025-05-01T12:00:00.000Z",
      updatedAt: "2025-05-01T12:00:00.000Z",
    };

    expect(canStartActiveReading("w-1", [firstReading], 5)).toEqual({
      allowed: false,
      reason: "already_active_for_work",
    });

    const finished = finishReadingRecord(firstReading, {
      finishedOn: "2025-05-20",
      nowIso: "2025-05-20T22:00:00.000Z",
      timezone: "America/Sao_Paulo",
    });

    expect(finished.status).toBe("finished");
    expect(finished.finishedOn).toBe("2025-05-20");
    expect(finished.progressValue).toBe(200);

    // Scenario 6: Start reread in 2026 preserving 2025 reading intact
    expect(canStartActiveReading("w-1", [finished], 5)).toEqual({
      allowed: true,
    });

    const reread = startRereadRecord({
      newId: "r-2",
      userId: "u-1",
      workId: "w-1",
      editionId: "e-1",
      format: "paperback",
      progressUnit: "pages",
      progressTotal: 200,
      startedOn: "2026-03-10",
      nowIso: "2026-03-10T14:00:00.000Z",
    });

    expect(reread.id).toBe("r-2");
    expect(reread.status).toBe("reading");
    expect(reread.progressValue).toBe(0);
    expect(finished.finishedOn).toBe("2025-05-20");
  });

  it("synchronizes dailyLogs deltas coherently with progress updates", () => {
    const existing = [
      { ymd: "2026-11-14", pages: 28 },
      { ymd: "2026-11-15", pages: 30 },
    ];

    const updated = syncDailyLogsForProgressDelta({
      existingLogs: existing,
      previousYmd: "2026-11-15",
      todayYmd: "2026-11-15",
      previousPages: 58,
      nextPages: 80,
      previousSeconds: 0,
      nextSeconds: 0,
    });

    expect(updated).toEqual([
      { ymd: "2026-11-14", pages: 28 },
      { ymd: "2026-11-15", pages: 52 },
    ]);

    const adjustedDown = syncDailyLogsForProgressDelta({
      existingLogs: updated,
      previousYmd: "2026-11-15",
      todayYmd: "2026-11-15",
      previousPages: 80,
      nextPages: 70,
      previousSeconds: 0,
      nextSeconds: 0,
    });

    expect(adjustedDown).toEqual([
      { ymd: "2026-11-14", pages: 28 },
      { ymd: "2026-11-15", pages: 42 },
    ]);
  });

  it("formats motivational focus session summary with reading rate", () => {
    expect(
      formatFocusSessionSummaryPtBr({
        amount: 30,
        unit: "pages",
        elapsedSeconds: 900,
      })
    ).toBe("Leu 30 páginas em 15 minutos (ritmo: 2,0 pág/min)");

    expect(
      formatFocusSessionSummaryPtBr({
        amount: 10,
        unit: "pages",
        elapsedSeconds: 15,
      })
    ).toBe("Leu 10 páginas em 1 minuto (ritmo: 10,0 pág/min)");

    expect(
      formatFocusSessionSummaryPtBr({
        amount: 0,
        unit: "pages",
        elapsedSeconds: 300,
      })
    ).toContain("Informe quantas páginas");
  });
});
