import { describe, expect, it } from "vitest";
import {
  calculateContrastRatio,
  classifyBookDuplication,
  computeWorkFingerprint,
  deriveTypographicCover,
  estimateBookDimensions,
  matchesCatalogQuery,
} from "@/features/catalog/rules";
import type { Edition, Work } from "@/lib/domain";

const sampleWork: Work = {
  id: "work-1",
  ownerId: null,
  title: "Memórias Póstumas de Brás Cubas",
  contributors: [{ name: "Machado de Assis", role: "author" }],
  fingerprint: "memorias postumas de bras cubas::machado de assis::pt-br",
  source: "brasilapi",
  createdAt: "2026-11-01T00:00:00.000Z",
};

const sampleEdition: Edition = {
  id: "ed-1",
  workId: "work-1",
  ownerId: null,
  isbn13: "9788563560278",
  title: "Memórias Póstumas de Brás Cubas",
  language: "pt-BR",
  format: "paperback",
  pages: 368,
  contributors: [{ name: "Machado de Assis", role: "author" }],
  source: "brasilapi",
  createdAt: "2026-11-01T00:00:00.000Z",
};

describe("Catalog pure rules (RF07, RF-A15, RF-A16, §8.6, §8.7)", () => {
  it("normalizes accents, punctuation, and case in work fingerprints", () => {
    expect(
      computeWorkFingerprint(
        "Memórias Póstumas de Brás Cubas!",
        "Machado de Assis",
        "pt-BR"
      )
    ).toBe("memorias postumas de bras cubas::machado de assis::pt-br");
  });

  it("classifies duplication as exact on matching ISBN-13, probable on same fingerprint, and distinct otherwise", () => {
    const exact = classifyBookDuplication(
      {
        isbn: "978-85-63560-27-8",
        title: "Outro título qualquer",
        primaryAuthor: "Machado de Assis",
        language: "pt-BR",
      },
      [sampleEdition],
      [sampleWork]
    );
    expect(exact).toEqual({
      kind: "exact",
      editionId: "ed-1",
      workId: "work-1",
    });

    const probable = classifyBookDuplication(
      {
        title: "Memorias Postumas de Bras Cubas",
        primaryAuthor: "Machado de Assis",
        language: "pt-BR",
      },
      [sampleEdition],
      [sampleWork]
    );
    expect(probable.kind).toBe("probable");
    if (probable.kind === "probable") {
      expect(probable.workId).toBe("work-1");
    }

    const distinct = classifyBookDuplication(
      {
        title: "Grande Sertão: Veredas",
        primaryAuthor: "João Guimarães Rosa",
        language: "pt-BR",
      },
      [sampleEdition],
      [sampleWork]
    );
    expect(distinct).toEqual({ kind: "distinct" });
  });

  it("matches search queries tolerating missing accents and minor typos", () => {
    expect(
      matchesCatalogQuery("memorias bras", [
        "Memórias Póstumas de Brás Cubas",
        "Machado de Assis",
      ])
    ).toBe(true);

    expect(
      matchesCatalogQuery("machdo de asis", [
        "Memórias Póstumas de Brás Cubas",
        "Machado de Assis",
      ])
    ).toBe(true);

    expect(
      matchesCatalogQuery("clarice lispector", [
        "Memórias Póstumas de Brás Cubas",
        "Machado de Assis",
      ])
    ).toBe(false);
  });

  it("estimates book dimensions by format and page count and generates deterministic AA fallback covers", () => {
    // 2mm + 0.05 * 300 = 17mm; paperback height = 210mm
    expect(estimateBookDimensions("paperback", 300)).toEqual({
      heightMm: 210,
      thicknessMm: 17,
    });
    expect(estimateBookDimensions("pocket", 40)).toEqual({
      heightMm: 180,
      thicknessMm: 6,
    });

    const coverA = deriveTypographicCover("A Hora da Estrela");
    const coverB = deriveTypographicCover("A Hora da Estrela");
    expect(coverA).toEqual(coverB);
    expect(coverA.contrastRatio).toBeGreaterThanOrEqual(4.5);

    for (const sampleTitle of [
      "Torto Arado",
      "Dom Casmurro",
      "Grande Sertão: Veredas",
      "A Hora da Estrela",
      "O Avesso da Pele",
      "Noite na Taverna",
    ]) {
      const c = deriveTypographicCover(sampleTitle);
      expect(
        calculateContrastRatio(c.textColor, c.backgroundColor)
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        calculateContrastRatio(c.accentColor, c.backgroundColor)
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
