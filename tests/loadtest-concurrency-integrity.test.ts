import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMemoryStore,
  SESSION_COOKIE_NAME,
} from "@/server/store/memory-repository";
import {
  hashPasswordAsync,
  verifyPasswordAsync,
} from "@/server/security/password";
import {
  addBookToLibraryAction,
  updateEditionCoverAction,
} from "@/features/catalog/actions";
import { finishReadingAction } from "@/features/reading/actions";
import { reorderShelfBooksAction } from "@/features/shelves/actions";
import { saveShelfCustomizationAction } from "@/features/settings/actions";
import {
  parsePersistedShelfLayout,
  reconcileShelfLayoutIntegrity,
  EMPTY_PERSISTED_SHELF_LAYOUT,
} from "@/features/shelves/arrange-shelves";
import { generateDeterministicUserWorkspace } from "../loadtest/seed.mjs";

const activeSessionState = vi.hoisted(() => ({
  token: "conc-sess-1",
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      if (name === SESSION_COOKIE_NAME) {
        return { value: activeSessionState.token };
      }
      return undefined;
    },
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

describe("Regressão de Concorrência e Integridade #3 — Logins Paralelos, Double-Submit, Double-Finish, Trava de Capa e Prateleiras", () => {
  beforeEach(() => {
    const store = getMemoryStore();
    const { workspace } = generateDeterministicUserWorkspace({
      userIndex: 301,
      bookCount: 25,
      seed: 20261121,
    });
    store.usersById.set(workspace.profile.id, workspace);
    store.userIdByEmail.set(workspace.profile.email, workspace.profile.id);
    activeSessionState.token = "conc-sess-301";
    store.sessions.set(activeSessionState.token, workspace.profile.id);
  });

  it("verifica 50 logins scrypt simultâneos de forma assíncrona sem bloquear o event loop", async () => {
    const hash = await hashPasswordAsync("SenhaForte#2026");

    let timerTicksDuringHash = 0;
    const ticker = setInterval(() => {
      timerTicksDuringHash += 1;
    }, 5);

    try {
      const results = await Promise.all(
        Array.from({ length: 50 }, (_, idx) =>
          verifyPasswordAsync(
            idx === 49 ? "SenhaErrada" : "SenhaForte#2026",
            hash
          )
        )
      );

      expect(results.slice(0, 49).every(Boolean)).toBe(true);
      expect(results[49]).toBe(false);
      // Como crypto.scrypt roda no pool de threads do libuv, o event loop continua executando timers
      expect(timerTicksDuringHash).toBeGreaterThanOrEqual(1);
    } finally {
      clearInterval(ticker);
    }
  });

  it("impede duplicação de obra/edição/exemplar quando addBookToLibraryAction recebe duplo clique simultâneo", async () => {
    const store = getMemoryStore();
    const ws = store.usersById.get("user-loadtest-301")!;
    const initialWorksCount = ws.works.length;
    const initialItemsCount = ws.items.length;

    const payload = {
      title: "Obra Inédita Contra Duplo Clique",
      primaryAuthor: "Machado de Assis",
      isbn: "9788535910667",
      format: "paperback",
      language: "pt-BR",
      pages: 256,
      ownershipStatus: "owned",
      skipAutoCover: true,
    };

    const [resA, resB] = await Promise.all([
      addBookToLibraryAction(payload),
      addBookToLibraryAction(payload),
    ]);

    const successes = [resA, resB].filter((r) => r.ok);
    const rejections = [resA, resB].filter((r) => !r.ok);

    expect(successes.length).toBe(1);
    expect(rejections.length).toBe(1);
    expect(ws.works.length).toBe(initialWorksCount + 1);
    expect(ws.items.length).toBe(initialItemsCount + 1);
  });

  it("torna finishReadingAction idempotente sob duplo clique, sem duplicar dailyLogs nem sobrescrever snapshot de undo", async () => {
    const store = getMemoryStore();
    const ws = store.usersById.get("user-loadtest-301")!;
    const activeReading = ws.readings.find((r) => r.status === "reading")!;
    expect(activeReading).toBeDefined();

    const logsBefore = activeReading.dailyLogs?.length ?? 0;

    const [finA, finB] = await Promise.all([
      finishReadingAction({ readingId: activeReading.id }),
      finishReadingAction({ readingId: activeReading.id }),
    ]);

    expect(finA.ok).toBe(true);
    expect(finB.ok).toBe(true);
    const updatedReading = ws.readings.find((r) => r.id === activeReading.id)!;
    expect(updatedReading.status).toBe("finished");
    // O segundo clique não pode adicionar um dailyLog extra nem destruir o snapshot anterior
    const logsAfterFirst = updatedReading.dailyLogs?.length ?? 0;
    expect(logsAfterFirst).toBeLessThanOrEqual(logsBefore + 1);
    const undoSnapReading = ws.lastUndoAction?.restoreSnapshot.readings.find(
      (r) => r.id === activeReading.id
    );
    expect(undoSnapReading?.status).toBe("reading");

    const thirdCall = await finishReadingAction({
      readingId: activeReading.id,
    });
    expect(thirdCall.ok).toBe(true);
    const afterThird = ws.readings.find((r) => r.id === activeReading.id)!;
    expect(afterThird.dailyLogs?.length ?? 0).toBe(logsAfterFirst);
  });

  it("garante que backfill nunca sobrescreve capa travada manualmente (coverLocked = true) em outra aba", async () => {
    const store = getMemoryStore();
    const ws = store.usersById.get("user-loadtest-301")!;
    const targetEdition = ws.editions[0]!;

    // Aba 1 trava manualmente uma capa
    targetEdition.coverUrl = "https://covers.openlibrary.org/b/id/901001-L.jpg";
    targetEdition.coverSource = "openlibrary";
    targetEdition.coverLocked = true;
    targetEdition.coverSelectedAt = new Date().toISOString();

    // Aba 2 (ou job de backfill em paralelo) tenta aplicar capa automática
    const backfillRes = await updateEditionCoverAction({
      editionId: targetEdition.id,
      coverUrl: "https://covers.openlibrary.org/b/id/999999-L.jpg",
      coverSource: "google",
      sourceAction: "backfill",
    });

    expect(backfillRes.ok).toBe(false);
    expect(targetEdition.coverLocked).toBe(true);
    expect(targetEdition.coverUrl).toBe(
      "https://covers.openlibrary.org/b/id/901001-L.jpg"
    );
    expect(targetEdition.coverSource).toBe("openlibrary");
  });

  it("reconcilia edições concorrentes de prateleiras sem perder livros, sem livro em duas prateleiras e com posições 0..N-1 contíguas", async () => {
    const store = getMemoryStore();
    const ws = store.usersById.get("user-loadtest-301")!;
    const totalBooksBefore = ws.items.length;
    const allIdsBefore = new Set(ws.items.map((it) => it.id));

    // 1. Submete reorderShelfBooksAction com IDs duplicados (simulando conflito de duas abas)
    const firstThree = ws.items.slice(0, 3).map((it) => it.id);
    const reorderRes = await reorderShelfBooksAction({
      itemIds: [firstThree[2]!, firstThree[0]!, firstThree[2]!, firstThree[1]!],
    });
    expect(reorderRes.ok).toBe(true);
    expect(ws.items.length).toBe(totalBooksBefore);
    expect(new Set(ws.items.map((it) => it.id)).size).toBe(allIdsBefore.size);
    expect(ws.items.map((it) => it.shelfPosition)).toEqual(
      Array.from({ length: totalBooksBefore }, (_, i) => i)
    );

    // 2. Reconcilia layout onde um livro foi colocado em duas prateleiras ao mesmo tempo
    const dirtyLayout = parsePersistedShelfLayout(
      JSON.stringify({
        ...EMPTY_PERSISTED_SHELF_LAYOUT,
        shelfOrder: ["ala-1", "ala-2", "ala-1"],
        customShelves: [
          { key: "ala-1", title: "Ala 1" },
          { key: "ala-2", title: "Ala 2" },
          { key: "ala-1", title: "Ala 1 Duplicada" },
        ],
        bookShelfMap: {
          "book-1": "ala-2",
          "book-2": "ala-1",
        },
        customOrderByShelf: {
          "ala-1": ["book-1", "book-2", "book-2", "book-3"],
          "ala-2": ["book-1", "book-3", "book-4"],
        },
      })
    );

    const reconciled = reconcileShelfLayoutIntegrity(dirtyLayout);
    expect(reconciled.shelfOrder).toEqual(["ala-1", "ala-2"]);
    expect(reconciled.customShelves.length).toBe(2);
    // book-1 pertence a ala-2 em bookShelfMap -> removido de ala-1, presente apenas em ala-2
    expect(reconciled.customOrderByShelf["ala-1"]).toEqual([
      "book-2",
      "book-3",
    ]);
    // book-3 já foi alocado em ala-1 -> removido de ala-2 para não ficar em duas prateleiras
    expect(reconciled.customOrderByShelf["ala-2"]).toEqual([
      "book-1",
      "book-4",
    ]);

    const saveRes = await saveShelfCustomizationAction({
      layout: dirtyLayout,
      orderedItemIds: [firstThree[1]!, firstThree[1]!, firstThree[0]!],
    });
    expect(saveRes.ok).toBe(true);
    expect(ws.items.length).toBe(totalBooksBefore);
    expect(new Set(ws.items.map((it) => it.id)).size).toBe(totalBooksBefore);
    expect(ws.items.map((it) => it.shelfPosition)).toEqual(
      Array.from({ length: totalBooksBefore }, (_, i) => i)
    );
  });
});
