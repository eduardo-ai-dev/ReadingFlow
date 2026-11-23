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

import { updateReadingProgressAction } from "@/features/reading/actions";
import {
  SESSION_COOKIE_NAME,
  getDemoWorkspaceSnapshot,
  getMemoryStore,
} from "@/server/store/memory-repository";

const TEST_USER_ID = "user-test-progress";

describe("Validação estrita e conversão de unidade em updateReadingProgressAction", () => {
  beforeEach(async () => {
    cookieJar.clear();
    const store = getMemoryStore();
    const ws = getDemoWorkspaceSnapshot();
    ws.profile.id = TEST_USER_ID;
    ws.profile.email = "progress@teste.local";
    for (const r of ws.readings) r.userId = TEST_USER_ID;
    store.usersById.set(TEST_USER_ID, ws);
    store.sessions.set("tok-progress", TEST_USER_ID);
    cookieJar.set(SESSION_COOKIE_NAME, "tok-progress");

    const r = ws.readings.find((item) => item.id === "read-grande-sertao")!;
    r.progressUnit = "pages";
    r.progressValue = 248;
    r.progressTotal = 560;
  });

  it("rejeita negativo, decimal, páginas > total e porcentagem > 100 sem clamp silencioso", async () => {
    const neg = await updateReadingProgressAction({
      readingId: "read-grande-sertao",
      progressUnit: "pages",
      progressValue: -5,
    });
    expect(neg.ok).toBe(false);

    const dec = await updateReadingProgressAction({
      readingId: "read-grande-sertao",
      progressUnit: "pages",
      progressValue: 12.5,
    });
    expect(dec.ok).toBe(false);

    const overPages = await updateReadingProgressAction({
      readingId: "read-grande-sertao",
      progressUnit: "pages",
      progressValue: 999,
    });
    expect(overPages.ok).toBe(false);

    const overPct = await updateReadingProgressAction({
      readingId: "read-grande-sertao",
      progressUnit: "percent",
      progressValue: 120,
    });
    expect(overPct.ok).toBe(false);

    // Valor original preservado intacto
    const ws = getMemoryStore().usersById.get(TEST_USER_ID)!;
    const r = ws.readings.find((item) => item.id === "read-grande-sertao")!;
    expect(r.progressValue).toBe(248);
    expect(r.progressUnit).toBe("pages");
  });

  it("retorna valor convertido ao alternar de páginas para porcentagem e vice-versa", async () => {
    const toPercent = await updateReadingProgressAction({
      readingId: "read-grande-sertao",
      progressUnit: "percent",
      progressValue: 248,
      convertFromPreviousUnit: true,
    });
    expect(toPercent.ok).toBe(true);
    if (toPercent.ok) {
      expect(toPercent.progressUnit).toBe("percent");
      expect(toPercent.progressValue).toBe(44); // round(248 / 560 * 100)
      expect(toPercent.progressTotal).toBe(100);
    }

    const backToPages = await updateReadingProgressAction({
      readingId: "read-grande-sertao",
      progressUnit: "pages",
      progressValue: 44,
      convertFromPreviousUnit: true,
    });
    expect(backToPages.ok).toBe(true);
    if (backToPages.ok) {
      expect(backToPages.progressUnit).toBe("pages");
      expect(backToPages.progressValue).toBe(246); // round(0.44 * 560)
      expect(backToPages.progressTotal).toBe(560);
    }
  });
});
