import { describe, expect, it } from "vitest";
import {
  ormCreateUser,
  ormFindUserByEmail,
  ormFindUserById,
  ormUpdateUser,
  ormInsertWork,
  ormGetWorks,
  ormGetWorkById,
  ormInsertEdition,
  ormGetEditions,
  ormInsertShelves,
  ormGetShelves,
  ormInsertLibraryItem,
  ormGetLibraryItems,
  ormInsertReading,
  ormGetReadings,
  ormUpdateReading,
  ormUpsertReview,
  ormGetReviews,
  ormInsertGoal,
  ormGetGoals,
  ormInsertWishlistItem,
  ormGetWishlist,
  ormDeleteWishlistItem,
  ormDeleteUser,
} from "@/server/db/orm-repository";

describe("Drizzle ORM Repository (Consultas Parametrizadas sem Concatenação)", () => {
  const testUserId = `test-user-${Date.now()}`;
  const testEmail = `test-${Date.now()}@readingflow.local`;

  it("cria e busca usuário através do ORM sem concatenação de strings", async () => {
    await ormCreateUser({
      id: testUserId,
      email: testEmail,
      displayName: "Leitor de Teste",
      passwordHash: "hash-seguro-123",
      locale: "pt-BR",
      timezone: "America/Sao_Paulo",
      theme: "light",
      defaultCurrency: "BRL",
      threeD: "auto",
      goalsCountRereads: false,
      maxSimultaneousReadings: 5,
      telemetryOptOut: false,
      onboardingCompleted: true,
      acceptedTermsVersion: "1.0",
      acceptedTermsAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    const userByEmail = await ormFindUserByEmail(testEmail);
    expect(userByEmail).not.toBeNull();
    expect(userByEmail?.id).toBe(testUserId);
    expect(userByEmail?.displayName).toBe("Leitor de Teste");

    const userById = await ormFindUserById(testUserId);
    expect(userById).not.toBeNull();
    expect(userById?.email).toBe(testEmail);

    await ormUpdateUser(testUserId, {
      displayName: "Leitor Atualizado",
      theme: "dark",
    });

    const updated = await ormFindUserById(testUserId);
    expect(updated?.displayName).toBe("Leitor Atualizado");
    expect(updated?.theme).toBe("dark");
  });

  it("insere e recupera obras e edições com binds tipados", async () => {
    const workId = `work-${Date.now()}`;
    await ormInsertWork({
      id: workId,
      ownerId: testUserId,
      title: "Memórias Póstumas de Brás Cubas",
      originalLanguage: "pt-BR",
      firstPublishedYear: 1881,
      primaryGenre: "Clássico",
      description: "Um defunto autor narra sua vida com ironia fina.",
      contributors: [{ name: "Machado de Assis", role: "author" }],
      fingerprint: "memorias-postumas-machado",
      source: "manual",
      createdAt: new Date().toISOString(),
    });

    const works = await ormGetWorks(testUserId);
    expect(works.length).toBeGreaterThanOrEqual(1);
    const foundWork = works.find((w) => w.id === workId);
    expect(foundWork?.title).toBe("Memórias Póstumas de Brás Cubas");
    expect(foundWork?.contributors[0]?.name).toBe("Machado de Assis");

    const singleWork = await ormGetWorkById(workId, testUserId);
    expect(singleWork?.id).toBe(workId);

    const editionId = `ed-${Date.now()}`;
    await ormInsertEdition({
      id: editionId,
      workId,
      ownerId: testUserId,
      isbn13: "9788572328678",
      title: "Memórias Póstumas de Brás Cubas",
      publisher: "Martin Claret",
      language: "pt-BR",
      format: "paperback",
      pages: 256,
      contributors: [{ name: "Machado de Assis", role: "author" }],
      source: "manual",
      createdAt: new Date().toISOString(),
    });

    const editions = await ormGetEditions(testUserId);
    const foundEd = editions.find((e) => e.id === editionId);
    expect(foundEd?.isbn13).toBe("9788572328678");
    expect(foundEd?.pages).toBe(256);
  });

  it("insere estantes e exemplares da biblioteca", async () => {
    const shelfId = `shelf-${Date.now()}`;
    await ormInsertShelves([
      {
        id: shelfId,
        userId: testUserId,
        name: "Estante Principal",
        kind: "physical",
        sortMode: "manual",
        position: 0,
      },
    ]);

    const shelves = await ormGetShelves(testUserId);
    expect(shelves.some((s) => s.id === shelfId)).toBe(true);

    const itemId = `item-${Date.now()}`;
    await ormInsertLibraryItem({
      id: itemId,
      userId: testUserId,
      editionId: "ed-sample",
      shelfId,
      shelfPosition: 0,
      status: "owned",
      currency: "BRL",
      pricePaid: 39.9,
      createdAt: new Date().toISOString(),
    });

    const items = await ormGetLibraryItems(testUserId);
    expect(items.some((i) => i.id === itemId)).toBe(true);
  });

  it("gerencia leituras, avaliações, metas e lista de desejos", async () => {
    const readingId = `read-${Date.now()}`;
    await ormInsertReading({
      id: readingId,
      userId: testUserId,
      workId: "work-sample",
      format: "paperback",
      status: "reading",
      progressUnit: "pages",
      progressValue: 50,
      progressTotal: 200,
      countsForGoals: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await ormUpdateReading(readingId, testUserId, {
      progressValue: 100,
      status: "reading",
    });

    const readings = await ormGetReadings(testUserId);
    const foundReading = readings.find((r) => r.id === readingId);
    expect(foundReading?.progressValue).toBe(100);

    // Avaliação (Review)
    const reviewId = `rev-${Date.now()}`;
    await ormUpsertReview({
      id: reviewId,
      userId: testUserId,
      workId: "work-sample",
      rating: 4.5,
      isPrivate: true,
      updatedAt: new Date().toISOString(),
    });

    const reviews = await ormGetReviews(testUserId);
    expect(reviews.some((r) => r.workId === "work-sample" && r.rating === 4.5)).toBe(true);

    // Metas (Goals)
    const goalId = `goal-${Date.now()}`;
    await ormInsertGoal({
      id: goalId,
      userId: testUserId,
      title: "Meta 2026",
      kind: "books",
      period: "year",
      startsOn: "2026-01-01",
      endsOn: "2026-12-31",
      targetValue: 24,
      tolerancePercent: 5,
      countRereads: false,
      createdAt: new Date().toISOString(),
    });

    const goals = await ormGetGoals(testUserId);
    expect(goals.some((g) => g.id === goalId)).toBe(true);

    // Wishlist
    const wishId = `wish-${Date.now()}`;
    await ormInsertWishlistItem({
      id: wishId,
      userId: testUserId,
      workId: "work-wish",
      priority: 5,
      targetPrice: 45,
      currency: "BRL",
      status: "wanted",
      createdAt: new Date().toISOString(),
    });

    const wishlist = await ormGetWishlist(testUserId);
    expect(wishlist.some((w) => w.id === wishId)).toBe(true);

    await ormDeleteWishlistItem(wishId, testUserId);
    const wishlistAfterDelete = await ormGetWishlist(testUserId);
    expect(wishlistAfterDelete.some((w) => w.id === wishId)).toBe(false);

    // Exclusão completa em cascata
    await ormDeleteUser(testUserId);
    const userAfterDelete = await ormFindUserById(testUserId);
    expect(userAfterDelete).toBeNull();
  });
});

