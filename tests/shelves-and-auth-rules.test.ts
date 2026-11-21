import { describe, expect, it } from "vitest";
import {
  CURRENT_TERMS_VERSION,
  evaluatePasswordStrength,
  hasAcceptedCurrentTerms,
  isValidIanaTimezone,
} from "@/features/auth/rules";
import { signUpSchema } from "@/features/auth/schema";
import {
  filterAndSortShelfItems,
  type EnrichedShelfItem,
} from "@/features/shelves/rules";

const sampleShelf = {
  id: "s1",
  userId: "u1",
  name: "Estante Física",
  kind: "physical" as const,
  sortMode: "manual" as const,
  position: 0,
};

function makeEntry(overrides: {
  id: string;
  title: string;
  author: string;
  pos: number;
  status: EnrichedShelfItem["effectiveReadingStatus"];
  genre?: string;
}): EnrichedShelfItem {
  return {
    item: {
      id: overrides.id,
      userId: "u1",
      editionId: `ed-${overrides.id}`,
      shelfId: "s1",
      shelfPosition: overrides.pos,
      status: "owned",
      currency: "BRL",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    edition: {
      id: `ed-${overrides.id}`,
      workId: `w-${overrides.id}`,
      ownerId: "u1",
      title: overrides.title,
      language: "pt-BR",
      format: "paperback",
      contributors: [{ name: overrides.author, role: "author" }],
      source: "manual",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    work: {
      id: `w-${overrides.id}`,
      ownerId: "u1",
      title: overrides.title,
      primaryGenre: overrides.genre,
      contributors: [{ name: overrides.author, role: "author" }],
      fingerprint: overrides.title.toLowerCase(),
      source: "manual",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    shelf: sampleShelf,
    effectiveReadingStatus: overrides.status,
    primaryAuthor: overrides.author,
  };
}

describe("auth/rules & shelves/rules", () => {
  it("validates IANA timezones and versioned terms acceptance", () => {
    expect(isValidIanaTimezone("America/Sao_Paulo")).toBe(true);
    expect(isValidIanaTimezone("Fuso/Inexistente")).toBe(false);
    expect(hasAcceptedCurrentTerms(CURRENT_TERMS_VERSION)).toBe(true);
    expect(hasAcceptedCurrentTerms("0.9")).toBe(false);
  });

  it("filters by accent/typo-tolerant query, reading status, and sorts by title or author", () => {
    const entries = [
      makeEntry({
        id: "1",
        title: "Grande Sertão: Veredas",
        author: "João Guimarães Rosa",
        pos: 1,
        status: "reading",
        genre: "Clássico",
      }),
      makeEntry({
        id: "2",
        title: "A Hora da Estrela",
        author: "Clarice Lispector",
        pos: 0,
        status: "finished",
        genre: "Romance",
      }),
    ];

    const byQuery = filterAndSortShelfItems(entries, {
      query: "guimaraes sertao",
    });
    expect(byQuery).toHaveLength(1);
    expect(byQuery[0]?.work.title).toBe("Grande Sertão: Veredas");

    const byTitle = filterAndSortShelfItems(entries, { sortMode: "title" });
    expect(byTitle.map((x) => x.work.title)).toEqual([
      "A Hora da Estrela",
      "Grande Sertão: Veredas",
    ]);

    const byStatus = filterAndSortShelfItems(entries, {
      readingStatus: "finished",
    });
    expect(byStatus).toHaveLength(1);
    expect(byStatus[0]?.primaryAuthor).toBe("Clarice Lispector");
  });

  it("evaluates password strength under NIST/OWASP policy (min 12 chars, <=72 UTF-8 bytes, spaces/Unicode allowed, blocks common passwords)", () => {
    const empty = evaluatePasswordStrength("");
    expect(empty.segments).toBe(0);
    expect(empty.isValid).toBe(false);

    const weak = evaluatePasswordStrength("abc");
    expect(weak.segments).toBe(1);
    expect(weak.colorHex).toBe("#722F3E");
    expect(weak.isValid).toBe(false);

    const common = evaluatePasswordStrength("123456789012");
    expect(common.segments).toBe(1);
    expect(common.isValid).toBe(false);

    const fair = evaluatePasswordStrength("livros bons"); // 11 chars
    expect(fair.segments).toBe(2);
    expect(fair.label).toBe("Curta");
    expect(fair.colorHex).toBe("#C8A46E");
    expect(fair.isValid).toBe(false);

    // 12+ caracteres sem regras artificiais de composição (aceita espaços e minúsculas)
    const good = evaluatePasswordStrength("café na estante");
    expect(good.segments).toBe(3);
    expect(good.label).toBe("Boa");
    expect(good.colorHex).toBe("#6B7F94");
    expect(good.isValid).toBe(true);

    // 16+ caracteres com Unicode até 72 bytes
    const strong = evaluatePasswordStrength("leitura serena à noite");
    expect(strong.segments).toBe(4);
    expect(strong.label).toBe("Forte");
    expect(strong.colorHex).toBe("#3B523E");
    expect(strong.isValid).toBe(true);

    // Excede 72 bytes UTF-8 com emojis multibyte (20 emojis * 4 bytes = 80 bytes)
    const tooManyBytes = evaluatePasswordStrength("📚".repeat(20));
    expect(tooManyBytes.isValid).toBe(false);
    expect(tooManyBytes.utf8Bytes).toBe(80);

    expect(
      signUpSchema.safeParse({
        email: "leitor@readingflow.local",
        password: "curta demais".slice(0, 10),
        confirmMinimumAge16: true,
        acceptTerms: true,
      }).success
    ).toBe(false);

    expect(
      signUpSchema.safeParse({
        email: "leitor@readingflow.local",
        password: "café na estante calma",
        confirmMinimumAge16: true,
        acceptTerms: true,
      }).success
    ).toBe(true);
  });
});
