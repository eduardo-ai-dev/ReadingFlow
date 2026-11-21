import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import sharp from "sharp";

const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { value: cookieJar.get(name)! } : undefined,
    set: (name: string, value: string) => cookieJar.set(name, value),
    delete: (name: string) => cookieJar.delete(name),
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  deleteMyAccountAction,
  signInWithEmailAction,
  signOutAction,
  signUpAction,
  updateAmbientPreferencesAction,
  updateThemePreferencesAction,
} from "@/features/auth/actions";
import {
  addBookToLibraryAction,
  updateEditionCoverAction,
} from "@/features/catalog/actions";
import { removeLibraryItemAction } from "@/features/shelves/actions";
import {
  importLegacyLocalSettingsAction,
  saveShelfCustomizationAction,
} from "@/features/settings/actions";
import { getUserSettings } from "@/features/settings/queries";
import { restoreBackupJsonAction } from "@/features/portability/actions";
import { GET as getPrivateCoverRoute } from "@/app/api/covers/file/[userId]/[editionId]/[fileName]/route";
import { GET as getExportRoute } from "@/app/api/export/route";
import {
  SESSION_COOKIE_NAME,
  assertOwnedWorkspaceEntities,
  cachedWorkspaceQuery,
  getMemoryStore,
  invalidateUserWorkspaceCache,
} from "@/server/store/memory-repository";
import { DEFAULT_SHELF_THEME_CONFIG } from "@/features/shelves/arrange-shelves";

// Imagem WebP real 120x180 gerada com sharp para simular upload de capa válido
let sampleCoverDataUrl = "";

beforeAll(async () => {
  const buf = await sharp({
    create: {
      width: 120,
      height: 180,
      channels: 3,
      background: { r: 110, g: 30, b: 42 },
    },
  })
    .webp({ quality: 80 })
    .toBuffer();
  sampleCoverDataUrl = `data:image/webp;base64,${buf.toString("base64")}`;
});

async function createUser(prefix: string) {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@teste.local`;
  const password = "SenhaForte!2026";
  cookieJar.clear();
  const res = await signUpAction({
    displayName: `Leitor ${prefix}`,
    email,
    password,
    acceptTerms: true,
    confirmMinimumAge16: true,
  });
  expect(res.ok).toBe(true);
  const store = getMemoryStore();
  const userId = store.userIdByEmail.get(email)!;
  const ws = store.usersById.get(userId)!;
  const sessionCookie = cookieJar.get(SESSION_COOKIE_NAME)!;
  return { email, password, userId, ws, sessionCookie };
}

function useSessionCookie(sessionCookie: string | null) {
  cookieJar.clear();
  if (sessionCookie) {
    cookieJar.set(SESSION_COOKIE_NAME, sessionCookie);
  }
}

describe("Persistência por usuário, isolamento A/B, cover_locked, user_settings e portabilidade", () => {
  beforeEach(() => {
    cookieJar.clear();
  });

  it("inicia conta nova vazia, isola capas privadas (401/403/200/304), bloqueia edição cruzada e isola cache por usuário", async () => {
    const userA = await createUser("iso-a");

    // Usuário novo começa 100% vazio (sem livros de seed)
    expect(userA.ws.works).toHaveLength(0);
    expect(userA.ws.items).toHaveLength(0);
    expect(userA.ws.wishlist).toHaveLength(0);

    // Usuário A adiciona livro com upload de capa -> salvo em armazenamento privado com coverLocked=true
    const created = await addBookToLibraryAction({
      title: "Grande Sertão: Veredas",
      primaryAuthor: "João Guimarães Rosa",
      format: "hardcover",
      pages: 560,
      coverUrl: sampleCoverDataUrl,
      coverSource: "upload",
      skipAutoCover: true,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const editionA = userA.ws.editions.find((e) => e.id === created.editionId)!;
    expect(editionA.coverLocked).toBe(true);
    expect(editionA.coverSelectedAt).toBeTruthy();
    expect(editionA.coverUrl).toMatch(
      new RegExp(`^/api/covers/file/${userA.userId}/${editionA.id}/`)
    );

    const parts = editionA.coverUrl!.split("/");
    const routeParams = {
      params: Promise.resolve({
        userId: parts[4]!,
        editionId: parts[5]!,
        fileName: parts[6]!,
      }),
    };

    // 1. Dono A acessa a capa -> 200 com Cache-Control private + ETag
    useSessionCookie(userA.sessionCookie);
    const resOwner = await getPrivateCoverRoute(
      new NextRequest(`http://localhost:3000${editionA.coverUrl}`),
      routeParams
    );
    expect(resOwner.status).toBe(200);
    expect(resOwner.headers.get("cache-control")).toContain("private");
    const etag = resOwner.headers.get("etag");
    expect(etag).toBeTruthy();

    // 2. Segunda requisição do dono com If-None-Match -> 304 Not Modified
    const res304 = await getPrivateCoverRoute(
      new NextRequest(`http://localhost:3000${editionA.coverUrl}`, {
        headers: { "if-none-match": etag! },
      }),
      routeParams
    );
    expect(res304.status).toBe(304);

    // 3. Visitante sem sessão -> 401
    useSessionCookie(null);
    const resAnon = await getPrivateCoverRoute(
      new NextRequest(`http://localhost:3000${editionA.coverUrl}`),
      routeParams
    );
    expect(resAnon.status).toBe(401);

    // 4. Usuário B (também começa vazio) tenta acessar a capa de A -> 403
    const userB = await createUser("iso-b");
    expect(userB.ws.works).toHaveLength(0);
    expect(userB.ws.items).toHaveLength(0);

    useSessionCookie(userB.sessionCookie);
    const resOtherUser = await getPrivateCoverRoute(
      new NextRequest(`http://localhost:3000${editionA.coverUrl}`),
      routeParams
    );
    expect(resOtherUser.status).toBe(403);

    // 5. Usuário B tenta alterar capa da edição de A -> negado
    const hijackCover = await updateEditionCoverAction({
      editionId: editionA.id,
      coverUrl: "https://covers.openlibrary.org/b/id/999999-L.jpg",
      coverSource: "openlibrary",
      sourceAction: "manual",
    });
    expect(hijackCover.ok).toBe(false);
    expect(editionA.coverUrl).toContain(userA.userId);

    // 6. Validação composta de propriedade impede vincular livro/estante de A em B
    expect(
      assertOwnedWorkspaceEntities(userB.ws, {
        workId: created.workId,
        editionId: created.editionId,
      }).ok
    ).toBe(false);
    expect(
      assertOwnedWorkspaceEntities(userB.ws, {
        shelfId: userA.ws.shelves[0]!.id,
      }).ok
    ).toBe(false);

    // 7. Cache de queries é isolado por userId e invalidado individualmente
    let computeA = 0;
    let computeB = 0;
    const valA1 = cachedWorkspaceQuery(userA.ws, "test:count", () => {
      computeA += 1;
      return `A:${userA.ws.works.length}`;
    });
    const valB1 = cachedWorkspaceQuery(userB.ws, "test:count", () => {
      computeB += 1;
      return `B:${userB.ws.works.length}`;
    });
    expect(valA1).toBe("A:1");
    expect(valB1).toBe("B:0");
    // Segunda leitura usa cache
    expect(
      cachedWorkspaceQuery(userA.ws, "test:count", () => {
        computeA += 1;
        return "SHOULD_NOT_RUN";
      })
    ).toBe("A:1");
    expect(computeA).toBe(1);
    expect(computeB).toBe(1);

    // Invalidar A recalcula apenas A, mantendo cache de B intacto
    invalidateUserWorkspaceCache(userA.userId);
    cachedWorkspaceQuery(userA.ws, "test:count", () => {
      computeA += 1;
      return "A:refreshed";
    });
    cachedWorkspaceQuery(userB.ws, "test:count", () => {
      computeB += 1;
      return "B:should-not-run";
    });
    expect(computeA).toBe(2);
    expect(computeB).toBe(1);
  });

  it("torna a capa escolhida permanente (cover_locked), bloqueia backfill automático, permite restaurar automática e limpa upload ao excluir", async () => {
    const userA = await createUser("cover-lock");
    useSessionCookie(userA.sessionCookie);

    const created = await addBookToLibraryAction({
      title: "Dom Casmurro",
      primaryAuthor: "Machado de Assis",
      format: "paperback",
      pages: 256,
      skipAutoCover: true,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const edition = userA.ws.editions.find((e) => e.id === created.editionId)!;
    expect(edition.coverLocked).toBeFalsy();

    // 1. Usuário escolhe uma capa manualmente (upload) -> trava cover_locked
    const manualRes = await updateEditionCoverAction({
      editionId: edition.id,
      coverUrl: sampleCoverDataUrl,
      coverSource: "upload",
      sourceAction: "manual",
    });
    expect(manualRes.ok).toBe(true);
    expect(edition.coverLocked).toBe(true);
    expect(edition.coverSelectedAt).toBeTruthy();
    const chosenUrl = edition.coverUrl!;
    expect(chosenUrl).toMatch(/^\/api\/covers\/file\//);
    expect(Object.keys(userA.ws.uploadedCovers ?? {})).toHaveLength(1);

    // 2. Backfill automático tenta sobrescrever a capa -> bloqueado, mantém capa escolhida
    const backfillRes = await updateEditionCoverAction({
      editionId: edition.id,
      coverUrl: "https://covers.openlibrary.org/b/id/12345-L.jpg",
      coverSource: "openlibrary",
      sourceAction: "backfill",
    });
    expect(backfillRes.ok).toBe(false);
    expect(edition.coverUrl).toBe(chosenUrl);
    expect(edition.coverLocked).toBe(true);

    // 3. Usuário clica em "Restaurar automática" (sourceAction: "unlock") -> destrava
    const unlockRes = await updateEditionCoverAction({
      editionId: edition.id,
      coverUrl: edition.coverUrl ?? null,
      coverSource: null,
      sourceAction: "unlock",
    });
    expect(unlockRes.ok).toBe(true);
    expect(edition.coverLocked).toBe(false);

    // 4. Agora o backfill automático pode atualizar (usando data URL válido para não depender de rede no teste unitário)
    const backfillAfterUnlock = await updateEditionCoverAction({
      editionId: edition.id,
      coverUrl: sampleCoverDataUrl,
      coverSource: "openlibrary",
      sourceAction: "backfill",
    });
    expect(backfillAfterUnlock.ok).toBe(true);
    expect(edition.coverLocked).toBe(false);

    // 5. Reaplica upload manual e remove exemplar -> arquivo privado é removido
    const reupload = await updateEditionCoverAction({
      editionId: edition.id,
      coverUrl: sampleCoverDataUrl,
      coverSource: "upload",
      sourceAction: "manual",
    });
    expect(reupload.ok).toBe(true);
    expect(Object.keys(userA.ws.uploadedCovers ?? {})).toHaveLength(1);

    const removed = await removeLibraryItemAction({ itemId: created.itemId! });
    expect(removed.ok).toBe(true);
    expect(Object.keys(userA.ws.uploadedCovers ?? {})).toHaveLength(0);
  });

  it("persiste arrumação 3D, tema e sons ambiente em user_settings entre logout/login, exporta JSON/CSV completo, restaura e exclui em cascata", async () => {
    const userA = await createUser("persist-settings");
    useSessionCookie(userA.sessionCookie);

    const book1 = await addBookToLibraryAction({
      title: "Vidas Secas",
      primaryAuthor: "Graciliano Ramos",
      format: "paperback",
      pages: 176,
      coverUrl: "https://covers.openlibrary.org/b/id/8231996-L.jpg",
      coverSource: "openlibrary",
      skipAutoCover: true,
    });
    const book2 = await addBookToLibraryAction({
      title: "A Hora da Estrela",
      primaryAuthor: "Clarice Lispector",
      format: "hardcover",
      pages: 96,
      skipAutoCover: true,
    });
    expect(book1.ok && book2.ok).toBe(true);
    if (!book1.ok || !book2.ok) return;

    // Salva arrumação 3D, ordem e cor de lombada em uma única operação na conta
    const saveLayoutRes = await saveShelfCustomizationAction({
      layout: {
        shelfOrder: ["favoritos"],
        customShelves: [{ key: "favoritos", title: "Meus Favoritos" }],
        bookShelfMap: { [book1.itemId!]: "favoritos" },
        shelfMeta: {
          favoritos: { title: "Meus Favoritos", displayAsTitle: true },
        },
        customOrderByShelf: { favoritos: [book2.itemId!, book1.itemId!] },
        featuredCoverIds: [book1.itemId!],
        bookColorOverrides: { [book2.itemId!]: "#6E1E2A" },
        themeConfig: {
          ...DEFAULT_SHELF_THEME_CONFIG,
          presetId: "bordo",
          material: "bordo",
          ledWarm3000K: true,
        },
      },
      orderedItemIds: [book2.itemId!, book1.itemId!],
      colorOverridesByItemId: { [book2.itemId!]: "#6E1E2A" },
    });
    expect(saveLayoutRes.ok).toBe(true);

    // Atualiza tema e sons ambiente na conta
    const themeRes = await updateThemePreferencesAction({
      theme: "dark-academia",
      density: "compact",
      fx: "min",
    });
    expect(themeRes.ok).toBe(true);

    const ambientRes = await updateAmbientPreferencesAction({
      selectedIds: ["chuva-suave", "lareira"],
      volumes: { "chuva-suave": 0.75, lareira: 0.5 },
      masterVolume: 0.8,
      continueAcrossPages: true,
    });
    expect(ambientRes.ok).toBe(true);

    // Simula logout completo e login em outro dispositivo (cookies totalmente limpos)
    await signOutAction();
    cookieJar.clear();

    const relogin = await signInWithEmailAction({
      email: userA.email,
      password: userA.password,
    });
    expect(relogin.ok).toBe(true);

    const reloadedSettings = await getUserSettings();
    expect(reloadedSettings.theme).toBe("dark-academia");
    expect(reloadedSettings.density).toBe("compact");
    expect(reloadedSettings.fx).toBe("min");
    expect(reloadedSettings.ambientPreferences.selectedIds).toEqual([
      "chuva-suave",
      "lareira",
    ]);
    expect(reloadedSettings.shelfLayout.themeConfig?.material).toBe("bordo");
    expect(reloadedSettings.shelfLayout.themeConfig?.ledWarm3000K).toBe(true);
    expect(reloadedSettings.shelfLayout.customShelves[0]?.title).toBe(
      "Meus Favoritos"
    );

    // Exportação JSON completa inclui coverLocked, coverSelectedAt e userSettings (com Cache-Control: private, no-store)
    const jsonResp = await getExportRoute(
      new NextRequest("http://localhost:3000/api/export?format=json")
    );
    expect(jsonResp.status).toBe(200);
    expect(jsonResp.headers.get("cache-control")).toBe("private, no-store");
    const backupText = await jsonResp.text();
    const backup = JSON.parse(backupText) as {
      data: {
        editions: Array<{ coverLocked?: boolean; coverSelectedAt?: string }>;
        userSettings?: {
          theme: string;
          shelfLayout: { themeConfig?: { material?: string } };
        };
      };
    };
    expect(backup.data.editions.some((e) => e.coverLocked === true)).toBe(true);
    expect(backup.data.userSettings?.theme).toBe("dark-academia");
    expect(backup.data.userSettings?.shelfLayout.themeConfig?.material).toBe(
      "bordo"
    );

    // Exportação CSV inclui colunas de capa travada
    const csvResp = await getExportRoute(
      new NextRequest("http://localhost:3000/api/export?format=csv")
    );
    expect(csvResp.status).toBe(200);
    const csvText = await csvResp.text();
    expect(csvText).toContain("capa_url");
    expect(csvText).toContain("capa_travada");
    expect(csvText).toContain("sim");

    // Importação única de dados legados do localStorage funciona
    const importLegacy = await importLegacyLocalSettingsAction({
      shelfLayoutRaw: JSON.stringify({
        customShelves: [{ key: "legado", title: "Estante Legada" }],
      }),
    });
    expect(importLegacy.ok).toBe(true);
    if (importLegacy.ok) {
      expect(importLegacy.settings.shelfLayout.customShelves[0]?.title).toBe(
        "Estante Legada"
      );
    }

    // Restauração do JSON em uma conta limpa (userC) reatribui tudo para userC
    const userC = await createUser("restore-target");
    useSessionCookie(userC.sessionCookie);
    const restored = await restoreBackupJsonAction({ rawJson: backupText });
    expect(restored.ok).toBe(true);
    expect(userC.ws.works).toHaveLength(2);
    expect(userC.ws.editions.some((e) => e.coverLocked === true)).toBe(true);
    expect(userC.ws.settings?.userId).toBe(userC.userId);
    expect(userC.ws.settings?.theme).toBe("dark-academia");
    expect(userC.ws.settings?.shelfLayout.themeConfig?.material).toBe("bordo");

    // Exclusão de conta apaga tudo em cascata (usuário, e-mail, capas privadas e sessões)
    const deleted = await deleteMyAccountAction({
      confirmationPhrase: "EXCLUIR MINHA CONTA",
    });
    expect(deleted.ok).toBe(true);
    const store = getMemoryStore();
    expect(store.usersById.has(userC.userId)).toBe(false);
    expect(store.userIdByEmail.has(userC.email)).toBe(false);
  });
});
