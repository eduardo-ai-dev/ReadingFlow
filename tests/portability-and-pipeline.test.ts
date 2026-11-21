import { describe, expect, it } from "vitest";
import {
  neutralizeCsvCell,
  serializeRowsToSafeCsv,
} from "@/server/security/csv";
import {
  applyCsvImportBatch,
  createPortableBackupJson,
  restorePortableBackupJson,
  rollbackImportBatch,
} from "@/features/portability/rules";
import { createCatalogLookupPipeline } from "@/server/catalog/pipeline";
import type { Shelf } from "@/lib/domain";

const defaultShelves: Shelf[] = [
  {
    id: "s-phys",
    userId: "u-1",
    name: "Estante Física",
    kind: "physical",
    sortMode: "manual",
    position: 0,
  },
  {
    id: "s-dig",
    userId: "u-1",
    name: "Estante Digital",
    kind: "digital",
    sortMode: "manual",
    position: 1,
  },
  {
    id: "s-aud",
    userId: "u-1",
    name: "Audiobooks",
    kind: "audio",
    sortMode: "manual",
    position: 2,
  },
];

describe("CSV Security, Idempotent Import/Export & Catalog Pipeline (§6.4, §11.2, §12.2, Cenários 1-3, 9, 10)", () => {
  it("neutralizes CSV formula injection prefixes (=, +, -, @)", () => {
    expect(neutralizeCsvCell("=CMD|' /C calc'!A0")).toBe("'=CMD|' /C calc'!A0");
    expect(neutralizeCsvCell("+SUM(A1:A2)")).toBe("'+SUM(A1:A2)");
    expect(neutralizeCsvCell("-10+20")).toBe("'-10+20");
    expect(neutralizeCsvCell("@IMPORTXML()")).toBe("'@IMPORTXML()");
    expect(neutralizeCsvCell("Dom Casmurro")).toBe("Dom Casmurro");

    const csv = serializeRowsToSafeCsv(
      ["titulo", "autor"],
      [["=Malicioso", "Machado de Assis"]]
    );
    expect(csv).toContain("'=Malicioso");
  });

  it("imports Goodreads CSV idempotently (zero duplicates on re-import) and supports full batch rollback", () => {
    const goodreadsCsv = [
      "Title,Author,ISBN13,Number of Pages,Exclusive Shelf,My Rating,Date Read",
      '"Quarto de Despejo","Carolina Maria de Jesus","=""9788508171279""",200,read,5,2026/03/14',
      '"Livro Incompleto","", "",120,to-read,0,',
    ].join("\n");

    const emptyState = {
      works: [],
      editions: [],
      items: [],
      readings: [],
      reviews: [],
      goals: [],
      wishlist: [],
      shelves: defaultShelves,
    };

    const firstRun = applyCsvImportBatch({
      csvText: goodreadsCsv,
      source: "goodreads",
      userId: "u-1",
      batchId: "batch-1",
      nowIso: "2026-11-08T15:00:00.000Z",
      state: emptyState,
    });

    expect(firstRun.job.importedRows).toBe(1);
    expect(firstRun.job.pendingReview).toHaveLength(1);
    expect(firstRun.nextState.works).toHaveLength(1);
    expect(firstRun.nextState.readings[0]?.status).toBe("finished");
    expect(firstRun.nextState.reviews[0]?.rating).toBe(5);

    // Scenario 9: Importing the exact same file again creates ZERO duplicates
    const secondRun = applyCsvImportBatch({
      csvText: goodreadsCsv,
      source: "goodreads",
      userId: "u-1",
      batchId: "batch-2",
      nowIso: "2026-11-08T15:05:00.000Z",
      state: firstRun.nextState,
    });

    expect(secondRun.job.importedRows).toBe(0);
    expect(secondRun.job.skippedDuplicates).toBe(1);
    expect(secondRun.nextState.works).toHaveLength(1);
    expect(secondRun.nextState.items).toHaveLength(1);

    // RF-K03: Rollback of batch-1 restores empty collection cleanly
    const rolledBack = rollbackImportBatch(firstRun.nextState, firstRun.job);
    expect(rolledBack.items).toHaveLength(0);
    expect(rolledBack.readings).toHaveLength(0);
    expect(rolledBack.reviews).toHaveLength(0);
  });

  it("supports lossless JSON export and re-import round-trip (Cenário 10)", () => {
    const csv = [
      "titulo,autor,isbn,formato,paginas,estado,nota,concluido_em",
      "A Hora da Estrela,Clarice Lispector,9788532530783,paperback,88,finished,4.5,2026-07-01",
    ].join("\n");

    const imported = applyCsvImportBatch({
      csvText: csv,
      source: "template",
      userId: "u-1",
      batchId: "batch-rt",
      nowIso: "2026-11-08T15:00:00.000Z",
      state: {
        works: [],
        editions: [],
        items: [],
        readings: [],
        reviews: [],
        goals: [
          {
            id: "g-1",
            userId: "u-1",
            title: "Meta 2026",
            kind: "books",
            period: "year",
            startsOn: "2026-01-01",
            endsOn: "2026-12-31",
            targetValue: 12,
            tolerancePercent: 5,
            countRereads: false,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        wishlist: [],
        shelves: defaultShelves,
      },
    });

    const jsonBackup = createPortableBackupJson({
      exportedAtIso: "2026-11-08T15:10:00.000Z",
      state: imported.nextState,
    });

    const restored = restorePortableBackupJson(jsonBackup, "u-2");
    expect(restored.works).toHaveLength(1);
    expect(restored.works[0]?.title).toBe("A Hora da Estrela");
    expect(restored.items).toHaveLength(1);
    expect(restored.readings[0]?.status).toBe("finished");
    expect(restored.reviews[0]?.rating).toBe(4.5);
    expect(restored.goals[0]?.targetValue).toBe(12);
  });

  it("runs the ISBN cascade pipeline: rejects invalid ISBN without calls, hits internal catalog, prioritizes BrasilAPI for 978-85, deduplicates concurrent calls, and falls back to manual on provider failure", async () => {
    let brasilApiCalls = 0;
    let googleCalls = 0;
    let openLibCalls = 0;

    const pipeline = createCatalogLookupPipeline({
      timeoutMs: 200,
      dailyQuotaPerProvider: 100,
      findInternalByIsbn13: async (isbn13) => {
        if (isbn13 === "9788563560278") {
          return {
            isbn13,
            title: "Memórias Póstumas de Brás Cubas",
            authors: ["Machado de Assis"],
            publisher: "Penguin-Companhia",
            pages: 368,
            language: "pt-BR",
            source: "manual",
          };
        }
        return null;
      },
      providers: {
        brasilapi: async (isbn13) => {
          brasilApiCalls += 1;
          await new Promise((r) => setTimeout(r, 15));
          if (isbn13 === "9786559210886") {
            return {
              isbn13,
              title: "Torto Arado",
              authors: ["Itamar Vieira Junior"],
              publisher: "Todavia",
              pages: 264,
              language: "pt-BR",
              source: "brasilapi",
            };
          }
          throw new Error("timeout");
        },
        google_books: async () => {
          googleCalls += 1;
          throw new Error("unavailable");
        },
        open_library: async () => {
          openLibCalls += 1;
          throw new Error("unavailable");
        },
      },
    });

    // Scenario 2: Invalid ISBN -> zero external calls
    const invalid = await pipeline.lookupByIsbn("9788563560279");
    expect(invalid.status).toBe("invalid_isbn");
    expect(brasilApiCalls + googleCalls + openLibCalls).toBe(0);

    // Scenario 1: Existing in internal catalog -> zero external calls
    const internalHit = await pipeline.lookupByIsbn("978-85-63560-27-8");
    expect(internalHit.status).toBe("found");
    expect(brasilApiCalls + googleCalls + openLibCalls).toBe(0);

    // Concurrent calls to same Brazilian ISBN -> deduplicated to 1 BrasilAPI call
    const [resA, resB] = await Promise.all([
      pipeline.lookupByIsbn("9786559210886"),
      pipeline.lookupByIsbn("978-65-5921-088-6"),
    ]);
    expect(resA.status).toBe("found");
    expect(resB.status).toBe("found");
    expect(brasilApiCalls).toBe(1);

    // Scenario 3: All providers fail -> graceful manual fallback with normalized ISBN-13
    const fallback = await pipeline.lookupByIsbn("9780140449136");
    expect(fallback).toEqual({
      status: "manual_fallback",
      isbn13: "9780140449136",
    });
  });
});
