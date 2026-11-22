import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { value: cookieJar.get(name)! } : undefined,
    set: (name: string, value: string) => cookieJar.set(name, value),
    delete: (name: string) => cookieJar.delete(name),
  }),
  headers: async () => new Headers(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { signUpAction, undoLastAction } from "@/features/auth/actions";
import { addBookToLibraryAction } from "@/features/catalog/actions";
import {
  finishReadingAction,
  startReadingAction,
  updateReadingProgressAction,
} from "@/features/reading/actions";
import { removeLibraryItemAction } from "@/features/shelves/actions";
import { updateHapticsPreferenceAction } from "@/features/settings/actions";
import { getUserSettings } from "@/features/settings/queries";
import { requireAuthenticatedWorkspace } from "@/server/store/memory-repository";
import {
  isHapticsEnabled,
  setHapticsEnabledLocal,
  triggerLightHaptic,
} from "@/lib/feedback";

describe("Etapa 6 — Feedback, Desfazer (~5s), Cartão de conclusão e Haptics", () => {
  beforeEach(() => {
    cookieJar.clear();
  });

  it("desfazer progresso remove a sessão criada em dailyLogs e restaura as páginas anteriores; desfazer exclusão restaura o livro", async () => {
    const email = `etapa6-undo-${Date.now()}@readingflow.test`;
    const signUp = await signUpAction({
      email,
      password: "LeituraSerena#2026!Xy",
      confirmMinimumAge16: true,
      acceptTerms: true,
    });
    expect(signUp.ok).toBe(true);

    // 1. Adicionar livro de 560 páginas
    const added = await addBookToLibraryAction({
      title: "Grande Sertão: Teste",
      primaryAuthor: "João Guimarães Rosa",
      language: "pt-BR",
      format: "hardcover",
      pages: 560,
      skipAutoCover: true,
      addToWishlistOnly: false,
      startReadingImmediately: false,
      forceDuplicateCopy: false,
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;

    const ws0 = await requireAuthenticatedWorkspace();
    const item = ws0.items[0]!;
    expect(item).toBeDefined();

    // 2. Iniciar leitura e avançar para 248 páginas
    const started = await startReadingAction({
      workId: added.workId,
      editionId: added.editionId,
      libraryItemId: item.id,
      format: "hardcover",
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const baseProg = await updateReadingProgressAction({
      readingId: started.readingId,
      progressUnit: "pages",
      progressValue: 248,
    });
    expect(baseProg.ok).toBe(true);

    const wsBeforeDelta = await requireAuthenticatedWorkspace();
    const readingBefore = wsBeforeDelta.readings.find(
      (r) => r.id === started.readingId
    )!;
    const logsBefore = structuredClone(readingBefore.dailyLogs ?? []);

    // 3. Registrar +10 páginas -> 258 de 560
    const plus10 = await updateReadingProgressAction({
      readingId: started.readingId,
      progressUnit: "pages",
      progressValue: 258,
    });
    expect(plus10.ok).toBe(true);
    if (!plus10.ok) return;
    expect(plus10.undoId).toBeTruthy();
    expect(plus10.undoLabel).toBe("+10 páginas registradas: 258 de 560");
    expect(plus10.deltaPages).toBe(10);

    // 4. Desfazer progresso -> volta para 248 e remove a sessão adicionada
    const undoneProgress = await undoLastAction();
    expect(undoneProgress.ok).toBe(true);

    const wsAfterUndoProgress = await requireAuthenticatedWorkspace();
    const readingAfterUndo = wsAfterUndoProgress.readings.find(
      (r) => r.id === started.readingId
    )!;
    expect(readingAfterUndo.progressValue).toBe(248);
    expect(readingAfterUndo.dailyLogs ?? []).toEqual(logsBefore);

    // 5. Concluir livro -> retorna completionStats (dias, páginas por dia, título/autor)
    const finished = await finishReadingAction({
      readingId: started.readingId,
    });
    expect(finished.ok).toBe(true);
    if (!finished.ok) return;
    expect(finished.completionStats).toBeDefined();
    expect(finished.completionStats?.title).toBe("Grande Sertão: Teste");
    expect(finished.completionStats?.daysCount).toBeGreaterThanOrEqual(1);
    expect(finished.completionStats?.pagesTotal).toBe(560);
    expect(finished.completionStats?.pagesPerDay).toBeGreaterThan(0);

    // 6. Excluir exemplar -> retorna undoId/undoLabel e Desfazer restaura o livro na estante
    const removed = await removeLibraryItemAction({ itemId: item.id });
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.undoId).toBeTruthy();
    expect(removed.undoLabel).toContain("Grande Sertão: Teste");

    const wsAfterRemove = await requireAuthenticatedWorkspace();
    expect(wsAfterRemove.items.length).toBe(0);

    const undoneRemove = await undoLastAction();
    expect(undoneRemove.ok).toBe(true);

    const wsAfterRestore = await requireAuthenticatedWorkspace();
    expect(wsAfterRestore.items.length).toBe(1);
    expect(wsAfterRestore.items[0]?.id).toBe(item.id);
  });

  it("persiste preferência hapticsEnabled em user_settings e respeita desligamento e prefers-reduced-motion", async () => {
    const email = `etapa6-haptics-${Date.now()}@readingflow.test`;
    await signUpAction({
      email,
      password: "LeituraSerena#2026!Xy",
      confirmMinimumAge16: true,
      acceptTerms: true,
    });

    const initialSettings = await getUserSettings();
    expect(initialSettings.hapticsEnabled).toBe(true);

    const updated = await updateHapticsPreferenceAction({
      hapticsEnabled: false,
    });
    expect(updated.ok).toBe(true);
    const reloaded = await getUserSettings();
    expect(reloaded.hapticsEnabled).toBe(false);

    const vibrateMock = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", {
      value: vibrateMock,
      configurable: true,
    });
    Object.defineProperty(window, "matchMedia", {
      value: vi.fn().mockReturnValue({ matches: false }),
      configurable: true,
    });

    setHapticsEnabledLocal(true);
    expect(isHapticsEnabled()).toBe(true);
    expect(triggerLightHaptic()).toBe(true);
    expect(vibrateMock).toHaveBeenCalledWith(10);

    vibrateMock.mockClear();
    setHapticsEnabledLocal(false);
    expect(isHapticsEnabled()).toBe(false);
    expect(triggerLightHaptic()).toBe(false);
    expect(vibrateMock).not.toHaveBeenCalled();

    // Com prefers-reduced-motion: reduce, nunca vibra mesmo com haptics habilitado
    setHapticsEnabledLocal(true);
    Object.defineProperty(window, "matchMedia", {
      value: vi.fn().mockReturnValue({ matches: true }),
      configurable: true,
    });
    expect(triggerLightHaptic()).toBe(false);
    expect(vibrateMock).not.toHaveBeenCalled();
  });
});
