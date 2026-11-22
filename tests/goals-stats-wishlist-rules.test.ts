import { describe, expect, it } from "vitest";
import { evaluateReadingGoal } from "@/features/goals/rules";
import { computeLibraryStatistics } from "@/features/stats/rules";
import {
  buildAutomaticRanking,
  isValidHalfStar,
} from "@/features/ratings/rules";
import {
  applyWishlistPurchase,
  detectWishlistOwnershipOverlap,
  inferShelfKindFromFormat,
} from "@/features/wishlist/rules";
import type {
  Edition,
  LibraryItem,
  Reading,
  ReadingGoal,
  Review,
  Shelf,
  WishlistItem,
  Work,
} from "@/lib/domain";

describe("Goals, Statistics, Ratings & Wishlist pure rules (§8.1, §8.3, §8.4, §12.2)", () => {
  it("matches the exact worked example in Spec §8.4 (24 books in 2026, 10 read on June 30)", () => {
    const goal: ReadingGoal = {
      id: "g-2026",
      userId: "u-1",
      title: "Meta Anual 2026",
      kind: "books",
      period: "year",
      startsOn: "2026-01-01",
      endsOn: "2026-12-31",
      targetValue: 24,
      tolerancePercent: 5,
      countRereads: false,
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    const readings: Reading[] = Array.from({ length: 10 }, (_, idx) => ({
      id: `r-${idx}`,
      userId: "u-1",
      workId: `w-${idx}`,
      format: "paperback",
      status: "finished",
      finishedOn: "2026-04-10",
      progressUnit: "pages",
      progressValue: 200,
      progressTotal: 200,
      countsForGoals: true,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-10T00:00:00.000Z",
    }));

    // Add a reread of w-0 in 2026: must NOT count when countRereads = false
    readings.push({
      id: "r-reread",
      userId: "u-1",
      workId: "w-0",
      format: "paperback",
      status: "finished",
      finishedOn: "2026-06-15",
      progressUnit: "pages",
      progressValue: 200,
      progressTotal: 200,
      countsForGoals: true,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-15T00:00:00.000Z",
    });

    const evaluation = evaluateReadingGoal({
      goal,
      readings,
      editionsById: new Map(),
      todayYmd: "2026-06-30",
    });

    expect(evaluation.completedValue).toBe(10);
    expect(evaluation.expectedByToday).toBeCloseTo(11.9, 1);
    // 10 livros em 181 dias (~0,39/sem) vs 14 livros em 184 dias (~0,53/sem, razão 1,38x <= 1,5x)
    expect(evaluation.paceStatus).toBe("achievable");
    expect(evaluation.requiredPerDay).toBeCloseTo(0.076, 3);
    expect(evaluation.requiredPerWeek).toBeCloseTo(0.53, 2);
    expect(evaluation.projectedFitsBeforeDeadline).toBe(false);
    expect(evaluation.neutralMessagePtBr).toContain("Ritmo atual:");
    // Projeção de 254 dias ultrapassa os 184 dias restantes: nunca dizer "termina em N dias"
    expect(evaluation.neutralMessagePtBr).not.toContain("termina em");
    expect(evaluation.neutralMessagePtBr).toContain("184 dias");
    expect(evaluation.neutralMessagePtBr.toLowerCase()).not.toContain(
      "atrasada"
    );
    expect(evaluation.neutralMessagePtBr.toLowerCase()).not.toContain("falhou");
    expect(evaluation.neutralMessagePtBr.toLowerCase()).not.toContain("perdeu");

    // Enabling rereads counts the 11th finished reading
    const withRereads = evaluateReadingGoal({
      goal: { ...goal, countRereads: true },
      readings,
      editionsById: new Map(),
      todayYmd: "2026-06-30",
    });
    expect(withRereads.completedValue).toBe(11);
  });

  it("counts 1 unique work, 2 items, separate pages vs audio hours when the same work is read in print and audiobook (§8.3)", () => {
    const works: Work[] = [
      {
        id: "w-1",
        ownerId: null,
        title: "Dom Casmurro",
        contributors: [{ name: "Machado de Assis", role: "author" }],
        fingerprint: "dom casmurro::machado de assis::pt-br",
        source: "brasilapi",
        createdAt: "2025-01-01T00:00:00.000Z",
      },
      {
        id: "w-2",
        ownerId: null,
        title: "Vidas Secas",
        contributors: [{ name: "Graciliano Ramos", role: "author" }],
        fingerprint: "vidas secas::graciliano ramos::pt-br",
        source: "brasilapi",
        createdAt: "2025-01-01T00:00:00.000Z",
      },
    ];

    const editions: Edition[] = [
      {
        id: "e-print",
        workId: "w-1",
        ownerId: null,
        title: "Dom Casmurro",
        language: "pt-BR",
        format: "hardcover",
        pages: 280,
        contributors: [{ name: "Machado de Assis", role: "author" }],
        source: "brasilapi",
        createdAt: "2025-01-01T00:00:00.000Z",
      },
      {
        id: "e-audio",
        workId: "w-1",
        ownerId: null,
        title: "Dom Casmurro (Audiobook)",
        language: "pt-BR",
        format: "audiobook",
        durationSeconds: 25200, // 7 hours
        contributors: [
          { name: "Machado de Assis", role: "author" },
          { name: "Paulo Betti", role: "narrator" },
        ],
        source: "manual",
        createdAt: "2025-01-01T00:00:00.000Z",
      },
      {
        id: "e-unread",
        workId: "w-2",
        ownerId: null,
        title: "Vidas Secas",
        language: "pt-BR",
        format: "paperback",
        pages: 176,
        contributors: [{ name: "Graciliano Ramos", role: "author" }],
        source: "brasilapi",
        createdAt: "2025-01-01T00:00:00.000Z",
      },
    ];

    const items: LibraryItem[] = [
      {
        id: "li-1",
        userId: "u-1",
        editionId: "e-print",
        shelfId: "s-phys",
        shelfPosition: 0,
        status: "owned",
        currency: "BRL",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "li-2",
        userId: "u-1",
        editionId: "e-audio",
        shelfId: "s-aud",
        shelfPosition: 0,
        status: "owned",
        currency: "BRL",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "li-3",
        userId: "u-1",
        editionId: "e-unread",
        shelfId: "s-phys",
        shelfPosition: 1,
        status: "owned",
        currency: "BRL",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    const readings: Reading[] = [
      {
        id: "r-print",
        userId: "u-1",
        workId: "w-1",
        editionId: "e-print",
        format: "hardcover",
        status: "finished",
        finishedOn: "2026-02-10",
        progressUnit: "pages",
        progressValue: 280,
        progressTotal: 280,
        countsForGoals: true,
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-10T00:00:00.000Z",
      },
      {
        id: "r-audio",
        userId: "u-1",
        workId: "w-1",
        editionId: "e-audio",
        format: "audiobook",
        status: "finished",
        finishedOn: "2026-08-15",
        progressUnit: "seconds",
        progressValue: 25200,
        progressTotal: 25200,
        countsForGoals: true,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-15T00:00:00.000Z",
      },
    ];

    const reviews: Review[] = [
      {
        id: "rev-1",
        userId: "u-1",
        workId: "w-1",
        rating: 4.5,
        narrationRating: 5,
        isPrivate: true,
        updatedAt: "2026-08-15T00:00:00.000Z",
      },
    ];

    const stats = computeLibraryStatistics({
      works,
      editions,
      items,
      readings,
      reviews,
      countRereads: true,
      periodStartYmd: "2026-01-01",
      periodEndYmd: "2026-12-31",
    });

    expect(stats.uniqueOwnedWorks).toBe(2); // w-1 and w-2
    expect(stats.totalOwnedItems).toBe(3);
    expect(stats.finishedReadingsCount).toBe(2);
    expect(stats.pagesRead).toBe(280); // audiobook does NOT add pages
    expect(stats.hoursListened).toBe(7);
    expect(stats.unreadOwnedItems).toBe(1); // only w-2
    expect(stats.averageRating).toBe(4.5);
  });

  it("validates half-star ratings and orders the automatic general ranking", () => {
    expect(isValidHalfStar(4.5)).toBe(true);
    expect(isValidHalfStar(0.5)).toBe(true);
    expect(isValidHalfStar(4.3)).toBe(false);
    expect(isValidHalfStar(0)).toBe(false);
    expect(isValidHalfStar(5.5)).toBe(false);

    const ranking = buildAutomaticRanking(
      [
        {
          id: "rev-a",
          userId: "u-1",
          workId: "w-b",
          rating: 4.5,
          isPrivate: true,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "rev-b",
          userId: "u-1",
          workId: "w-a",
          rating: 5.0,
          isPrivate: true,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      new Map([
        [
          "w-a",
          {
            id: "w-a",
            ownerId: null,
            title: "Grande Sertão: Veredas",
            contributors: [{ name: "João Guimarães Rosa", role: "author" }],
            fingerprint: "grande sertao veredas::joao guimaraes rosa::pt-br",
            source: "manual",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        [
          "w-b",
          {
            id: "w-b",
            ownerId: null,
            title: "Capitães da Areia",
            contributors: [{ name: "Jorge Amado", role: "author" }],
            fingerprint: "capitaes da areia::jorge amado::pt-br",
            source: "manual",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      ])
    );

    expect(ranking.map((r) => r.work.id)).toEqual(["w-a", "w-b"]);
  });

  it("performs atomic wishlist purchase into the matching shelf and rejects duplicate purchase", () => {
    expect(inferShelfKindFromFormat("ebook")).toBe("digital");
    expect(inferShelfKindFromFormat("audiobook")).toBe("audio");
    expect(inferShelfKindFromFormat("hardcover")).toBe("physical");

    const shelves: Shelf[] = [
      {
        id: "s-phys",
        userId: "u-1",
        name: "Estante Física",
        kind: "physical",
        sortMode: "manual",
        position: 0,
      },
    ];

    const wish: WishlistItem = {
      id: "wish-1",
      userId: "u-1",
      workId: "w-1",
      editionId: "e-1",
      priority: 5,
      targetPrice: 59.9,
      currency: "BRL",
      status: "wanted",
      createdAt: "2026-05-01T00:00:00.000Z",
    };

    const result = applyWishlistPurchase({
      wish,
      editionId: "e-1",
      format: "hardcover",
      shelves,
      newItemId: "li-99",
      pricePaid: 49.9,
      acquiredOn: "2026-05-12",
      store: "Livraria da Travessa",
      nowIso: "2026-05-12T15:00:00.000Z",
    });

    expect(result.updatedWish.status).toBe("purchased");
    expect(result.updatedWish.libraryItemId).toBe("li-99");
    expect(result.createdItem.shelfId).toBe("s-phys");
    expect(result.createdItem.pricePaid).toBe(49.9);

    // Repeated purchase of an already purchased wish must fail atomically (§12.2)
    expect(() =>
      applyWishlistPurchase({
        wish: result.updatedWish,
        editionId: "e-1",
        format: "hardcover",
        shelves,
        newItemId: "li-100",
        nowIso: "2026-05-12T15:05:00.000Z",
      })
    ).toThrow(/já resolvido/i);

    const overlap = detectWishlistOwnershipOverlap(
      "w-1",
      "e-1",
      [result.createdItem],
      [
        {
          id: "e-1",
          workId: "w-1",
          ownerId: null,
          title: "Torto Arado",
          language: "pt-BR",
          format: "hardcover",
          contributors: [{ name: "Itamar Vieira Junior", role: "author" }],
          source: "brasilapi",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ]
    );
    expect(overlap).toEqual({
      ownsWork: true,
      ownsExactEdition: true,
    });
  });
});
