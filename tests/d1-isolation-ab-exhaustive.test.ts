import { describe, expect, it } from "vitest";
import {
  createUserRepository,
  hashSessionToken,
  ormCreateUser,
  ormFindSession,
} from "@/server/db/orm-repository";
import { getTestSqliteDatabase } from "@/server/db/connection";

describe("Isolamento D1 exaustivo A/B, capas em library_items e sessões por hash", () => {
  it("isola todos os métodos de repo(userId) entre Usuário A e Usuário B, armazena sessão apenas como hash e persiste capa por usuário em library_items", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const userAId = `iso-d1-a-${suffix}`;
    const userBId = `iso-d1-b-${suffix}`;

    const nowIso = new Date().toISOString();
    await ormCreateUser({
      id: userAId,
      email: `a-${suffix}@example.test`,
      displayName: "Leitora A",
      passwordHash:
        "pbkdf2$sha256$100000$00112233445566778899aabbccddeeff$0011",
      acceptedTermsAt: nowIso,
      createdAt: nowIso,
    });
    await ormCreateUser({
      id: userBId,
      email: `b-${suffix}@example.test`,
      displayName: "Leitor B",
      passwordHash:
        "pbkdf2$sha256$100000$00112233445566778899aabbccddeeff$0022",
      acceptedTermsAt: nowIso,
      createdAt: nowIso,
    });

    const repoA = createUserRepository(userAId);
    const repoB = createUserRepository(userBId);

    // Rejeita userId vazio ou 'global'
    expect(() => createUserRepository("")).toThrow();
    expect(() => createUserRepository("global")).toThrow();

    // Sessão salva apenas como token_hash (nunca o token bruto)
    const rawTokenA = `raw-secret-token-a-${suffix}`;
    await repoA.createSession(rawTokenA, 60_000);
    const sqlite = getTestSqliteDatabase()!;
    const rawSessionRow = sqlite
      .prepare("SELECT token_hash, user_id FROM sessions WHERE user_id = ?")
      .get(userAId) as { token_hash: string; user_id: string } | undefined;
    expect(rawSessionRow).toBeDefined();
    expect(rawSessionRow?.token_hash).toBe(hashSessionToken(rawTokenA));
    expect(rawSessionRow?.token_hash).not.toBe(rawTokenA);

    const foundSession = await ormFindSession(rawTokenA);
    expect(foundSession?.userId).toBe(userAId);

    // B não consegue apagar a sessão de A
    await repoB.deleteSession(rawTokenA);
    expect(await ormFindSession(rawTokenA)).not.toBeNull();

    // A cria obra, edição, estante, exemplar (com capa por usuário), leitura, avaliação, meta, desejo e settings
    const workAId = `work-a-${suffix}`;
    const edAId = `ed-a-${suffix}`;
    const shelfAId = `shelf-a-${suffix}`;
    const itemAId = `item-a-${suffix}`;
    const readAId = `read-a-${suffix}`;
    const goalAId = `goal-a-${suffix}`;
    const wishAId = `wish-a-${suffix}`;

    await repoA.insertWork({
      id: workAId,
      title: "Obra Privada A",
      originalLanguage: "pt-BR",
      contributors: [{ name: "Autora A", role: "author" }],
      fingerprint: `fp-${suffix}`,
      source: "manual",
      createdAt: nowIso,
    });
    await repoA.insertEdition({
      id: edAId,
      workId: workAId,
      title: "Obra Privada A",
      language: "pt-BR",
      format: "hardcover",
      pages: 320,
      contributors: [{ name: "Autora A", role: "author" }],
      source: "manual",
      createdAt: nowIso,
    });
    await repoA.insertShelves([
      {
        id: shelfAId,
        name: "Estante A",
        kind: "physical",
        sortMode: "manual",
        position: 0,
      },
    ]);
    await repoA.insertLibraryItem(
      {
        id: itemAId,
        editionId: edAId,
        shelfId: shelfAId,
        shelfPosition: 0,
        status: "owned",
        currency: "BRL",
        createdAt: nowIso,
      },
      {
        coverUrl: `/api/covers/file/${userAId}/${edAId}/capa.webp`,
        coverSource: "upload",
        coverLocked: true,
        coverSelectedAt: nowIso,
        spineColor: "#6E1E2A",
        spineAccent: "#D4AF7A",
      }
    );
    await repoA.insertReading({
      id: readAId,
      workId: workAId,
      editionId: edAId,
      format: "hardcover",
      status: "reading",
      progressUnit: "pages",
      progressValue: 120,
      progressTotal: 320,
      countsForGoals: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    await repoA.upsertReview({
      id: `rev-a-${suffix}`,
      workId: workAId,
      rating: 4.5,
      isPrivate: true,
      updatedAt: nowIso,
    });
    await repoA.insertGoal({
      id: goalAId,
      title: "Meta A",
      kind: "books",
      period: "year",
      startsOn: "2026-01-01",
      endsOn: "2026-12-31",
      targetValue: 20,
      tolerancePercent: 5,
      countRereads: false,
      createdAt: nowIso,
    });
    await repoA.insertWishlistItem({
      id: wishAId,
      workId: workAId,
      priority: 1,
      currency: "BRL",
      status: "wanted",
      createdAt: nowIso,
    });
    await repoA.upsertUserSettings({
      theme: "dark-academia",
      density: "compact",
      motion: "reduced",
      fx: "minimal",
      shelfLayoutJson: "{}",
      ambientPreferencesJson: "{}",
      focusDefaultMode: "pomodoro",
      updatedAt: nowIso,
    });

    // B NÃO enxerga nenhum registro de A
    expect(await repoB.getWorks()).toHaveLength(0);
    expect(await repoB.getWorkById(workAId)).toBeNull();
    expect(await repoB.getEditions()).toHaveLength(0);
    expect(await repoB.getShelves()).toHaveLength(0);
    expect(await repoB.getLibraryItems()).toHaveLength(0);
    expect(await repoB.getReadings()).toHaveLength(0);
    expect(await repoB.getReviews()).toHaveLength(0);
    expect(await repoB.getGoals()).toHaveLength(0);
    expect(await repoB.getWishlist()).toHaveLength(0);
    expect(await repoB.getUserSettings()).toBeNull();

    // B NÃO consegue alterar nem apagar nenhum registro de A usando os IDs de A
    await repoB.updateLibraryItemCover(itemAId, {
      coverUrl: "https://evil.example/hack.webp",
      spineColor: "#000000",
    });
    await repoB.updateReading(readAId, { progressValue: 999 });
    await repoB.updateGoal(goalAId, { targetValue: 999 });
    await repoB.deleteGoal(goalAId);
    await repoB.deleteWishlistItem(wishAId);

    // Dados de A permanecem 100% intactos e a capa de library_items é restaurada no loadWorkspace
    const wsA = await repoA.loadWorkspace();
    expect(wsA).not.toBeNull();
    expect(wsA!.editions[0]?.coverUrl).toBe(
      `/api/covers/file/${userAId}/${edAId}/capa.webp`
    );
    expect(wsA!.editions[0]?.coverLocked).toBe(true);
    expect(wsA!.editions[0]?.coverColor).toBe("#6E1E2A");
    expect(wsA!.readings[0]?.progressValue).toBe(120);
    expect(wsA!.goals[0]?.targetValue).toBe(20);
    expect(wsA!.wishlist).toHaveLength(1);

    // Exclusão de A remove todas as tabelas (batch) sem afetar B
    await repoA.deleteUser();
    expect(await repoA.getUser()).toBeNull();
    expect(await ormFindSession(rawTokenA)).toBeNull();
    expect(await repoB.getUser()).not.toBeNull();
    await repoB.deleteUser();
  });
});
