import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { signUpAction } from "@/features/auth/actions";
import {
  addBookToLibraryAction,
  updateBookMetadataAction,
} from "@/features/catalog/actions";
import { removeLibraryItemAction } from "@/features/shelves/actions";
import { getMemoryStore } from "@/server/store/memory-repository";

async function createTestUserWorkspace() {
  const email = `crud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@teste.local`;
  const signup = await signUpAction({
    displayName: "Leitor CRUD",
    email,
    password: "SenhaForte!2026",
    acceptTerms: true,
    confirmMinimumAge16: true,
  });
  expect(signup.ok).toBe(true);
  const store = getMemoryStore();
  const userId = store.userIdByEmail.get(email)!;
  return store.usersById.get(userId)!;
}

describe("Integridade do CRUD de catálogo, lista de desejos e remoção de exemplar", () => {
  beforeEach(() => {
    cookieJar.clear();
  });

  it("salva targetPrice ao adicionar diretamente na lista de desejos sem criar exemplar", async () => {
    const ws = await createTestUserWorkspace();

    const res = await addBookToLibraryAction({
      title: "O Tempo e o Vento",
      primaryAuthor: "Erico Verissimo",
      format: "hardcover",
      pages: 640,
      targetPrice: 89.9,
      store: "Livraria Cultura",
      addToWishlistOnly: true,
      skipAutoCover: true,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.wishlistItemId).toBeTruthy();
    expect(res.itemId).toBeUndefined();

    const wish = ws.wishlist.find((w) => w.id === res.wishlistItemId);
    expect(wish).toBeDefined();
    expect(wish?.targetPrice).toBe(89.9);
    expect(ws.items).toHaveLength(0);
  });

  it("bloqueia duplicidade sem forceDuplicateCopy, sincroniza progressTotal ao editar páginas e limpa libraryItemId ao remover exemplar", async () => {
    const ws = await createTestUserWorkspace();

    const first = await addBookToLibraryAction({
      title: "Memórias Póstumas de Brás Cubas",
      primaryAuthor: "Machado de Assis",
      format: "paperback",
      pages: 300,
      startReadingImmediately: true,
      skipAutoCover: true,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    // Tentativa duplicada sem forceDuplicateCopy retorna aviso e não duplica item
    const dup = await addBookToLibraryAction({
      title: "Memórias Póstumas de Brás Cubas",
      primaryAuthor: "Machado de Assis",
      format: "paperback",
      pages: 300,
      skipAutoCover: true,
    });
    expect(dup.ok).toBe(false);
    if (!dup.ok) {
      expect(dup.duplicateWarning?.existingWorkId).toBe(first.workId);
    }
    expect(ws.items).toHaveLength(1);

    // Segunda obra para testar validação de vínculo workId/editionId
    const second = await addBookToLibraryAction({
      title: "Quincas Borba",
      primaryAuthor: "Machado de Assis",
      format: "paperback",
      pages: 280,
      skipAutoCover: true,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    // Rejeita edição trocada entre obras diferentes
    const mismatched = await updateBookMetadataAction({
      workId: first.workId,
      editionId: second.editionId,
      title: "Título Cruzado",
      primaryAuthor: "Machado de Assis",
      format: "paperback",
      pages: 200,
    });
    expect(mismatched.ok).toBe(false);

    // Simula leitura avançada na página 250 e atualiza total da edição para 220 páginas
    const activeReading = ws.readings.find((r) => r.workId === first.workId)!;
    activeReading.progressValue = 250;

    const updated = await updateBookMetadataAction({
      workId: first.workId,
      editionId: first.editionId,
      itemId: first.itemId,
      title: "Memórias Póstumas de Brás Cubas (Ed. Revisada)",
      primaryAuthor: "Machado de Assis",
      format: "hardcover",
      pages: 220,
    });
    expect(updated.ok).toBe(true);
    expect(activeReading.progressTotal).toBe(220);
    expect(activeReading.progressValue).toBe(220);

    // Remover exemplar preserva histórico de leitura mas zera libraryItemId órfão
    expect(activeReading.libraryItemId).toBe(first.itemId);
    const removed = await removeLibraryItemAction({ itemId: first.itemId! });
    expect(removed.ok).toBe(true);
    expect(ws.items.find((i) => i.id === first.itemId)).toBeUndefined();
    expect(ws.readings.find((r) => r.id === activeReading.id)).toBeDefined();
    expect(activeReading.libraryItemId).toBeUndefined();
  });
});
