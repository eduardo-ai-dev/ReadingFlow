import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FOCUS_POMODORO_SECONDS,
  computeElapsedFocusSeconds,
  parsePersistedFocusSession,
} from "@/features/reading/focus-session-storage";

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

import { updateReadingProgressAction } from "@/features/reading/actions";
import {
  SESSION_COOKIE_NAME,
  getDemoWorkspaceSnapshot,
  getMemoryStore,
} from "@/server/store/memory-repository";

const TEST_USER_ID = "user-test-focus";

describe("Canto de Foco — persistência do cronômetro e salvamento das anotações da sessão", () => {
  beforeEach(async () => {
    cookieJar.clear();
    const store = getMemoryStore();
    const ws = getDemoWorkspaceSnapshot();
    ws.profile.id = TEST_USER_ID;
    ws.profile.email = "focus@teste.local";
    for (const r of ws.readings) r.userId = TEST_USER_ID;
    store.usersById.set(TEST_USER_ID, ws);
    store.sessions.set("tok-focus", TEST_USER_ID);
    cookieJar.set(SESSION_COOKIE_NAME, "tok-focus");

    const r = ws.readings.find((item) => item.id === "read-grande-sertao")!;
    r.progressUnit = "pages";
    r.progressValue = 248;
    r.progressTotal = 560;
    r.notes = undefined;
  });

  it("calcula tempo decorrido pelo relógio de parede após recarregamento ou aba em segundo plano", () => {
    const startMs = 1_700_000_000_000;
    const afterReloadMs = startMs + 125_000; // +2m05s

    const elapsed = computeElapsedFocusSeconds(
      {
        accumulatedSeconds: 30,
        startedAtMs: startMs,
        isRunning: true,
        focusMode: "free",
      },
      afterReloadMs
    );
    expect(elapsed).toBe(155);

    // No Pomodoro, limita ao teto de 25 minutos mesmo após 40 minutos em segundo plano
    const pomodoroElapsed = computeElapsedFocusSeconds(
      {
        accumulatedSeconds: 0,
        startedAtMs: startMs,
        isRunning: true,
        focusMode: "pomodoro",
      },
      startMs + 40 * 60 * 1000
    );
    expect(pomodoroElapsed).toBe(FOCUS_POMODORO_SECONDS);
  });

  it("ignora JSON corrompido ao restaurar estado salvo do localStorage", () => {
    expect(parsePersistedFocusSession("{invalid json")).toBeNull();
    expect(
      parsePersistedFocusSession(JSON.stringify({ readingId: "" }))
    ).toBeNull();
    const valid = parsePersistedFocusSession(
      JSON.stringify({
        readingId: "read-1",
        focusMode: "free",
        accumulatedSeconds: 42,
        startedAtMs: null,
        isRunning: false,
        hasStarted: true,
        sessionNotes: "Trecho marcante do capítulo 3",
        updatedAtMs: 123,
      })
    );
    expect(valid?.accumulatedSeconds).toBe(42);
    expect(valid?.sessionNotes).toBe("Trecho marcante do capítulo 3");
  });

  it("persiste anotações rápidas da sessão de foco junto com o avanço de páginas", async () => {
    const res = await updateReadingProgressAction({
      readingId: "read-grande-sertao",
      progressUnit: "pages",
      progressValue: 268,
      progressTotal: 560,
      sessionNotes: "Passagem sobre o sertão <script>alert(1)</script>",
    });
    expect(res.ok).toBe(true);

    const ws = getMemoryStore().usersById.get(TEST_USER_ID)!;
    const r = ws.readings.find((item) => item.id === "read-grande-sertao")!;
    expect(r.progressValue).toBe(268);
    expect(r.notes).toContain("Passagem sobre o sertão");
  });
});
