import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const cookieJar = new Map<string, string>();
let mockClientIp = "203.0.113.10";

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { value: cookieJar.get(name)! } : undefined,
    set: (name: string, value: string) => cookieJar.set(name, value),
    delete: (name: string) => cookieJar.delete(name),
  }),
  headers: async () =>
    new Headers({
      "cf-connecting-ip": mockClientIp,
      "user-agent": "Vitest/1.0",
    }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { DEMO_READONLY_ERROR, DEMO_SESSION_COOKIE_NAME } from "@/lib/auth-demo";
import {
  resetDemoRateLimitForTests,
  signDemoSessionToken,
  verifyDemoSessionToken,
} from "@/server/demo/demo-token";
import { getD1AccessCount, resetD1AccessCount } from "@/server/db/connection";
import {
  DEMO_USER_ID,
  SESSION_COOKIE_NAME,
  getAuthenticatedWorkspace,
} from "@/server/store/memory-repository";
import {
  changePasswordAction,
  deleteMyAccountAction,
  signInDemoAction,
  signOutAction,
  updateProfileAction,
} from "@/features/auth/actions";
import { addBookToLibraryAction } from "@/features/catalog/actions";
import { createGoalAction } from "@/features/goals/actions";
import { updateReadingProgressAction } from "@/features/reading/actions";
import { upsertReviewAction } from "@/features/ratings/actions";
import { addWishlistItemAction } from "@/features/wishlist/actions";
import { GET as getExportRoute } from "@/app/api/export/route";
import { GET as getCoversSearchRoute } from "@/app/api/covers/search/route";
import { GET as getCatalogSearchRoute } from "@/app/api/catalog/search/route";

describe("Demonstração segura somente leitura e stateless (zero D1)", () => {
  beforeEach(() => {
    cookieJar.clear();
    resetDemoRateLimitForTests();
    resetD1AccessCount();
    mockClientIp = "203.0.113.10";
    delete process.env.DEMO_ENABLED;
  });

  it("emite cookie HMAC válido (sem PII), rejeita valor legado 'true', adulterado ou expirado", () => {
    const now = 1_760_000_000_000;
    const { token } = signDemoSessionToken(now, 7200);
    expect(token).toMatch(/^demo=1\.\d+\.[0-9a-f]{64}$/);

    // Válido dentro da janela
    expect(verifyDemoSessionToken(token, now + 60_000).valid).toBe(true);
    // Expirado após 2 h
    expect(verifyDemoSessionToken(token, now + 7201 * 1000).valid).toBe(false);
    // Cookie legado não assinado rejeitado
    expect(verifyDemoSessionToken("true", now).valid).toBe(false);
    // Adulterado rejeitado
    const tampered = `${token.slice(0, -2)}ff`;
    expect(verifyDemoSessionToken(tampered, now).valid).toBe(false);
    // Desligado por DEMO_ENABLED=false rejeitado
    expect(
      verifyDemoSessionToken(token, now, {
        NODE_ENV: "production",
        DEMO_ENABLED: "false",
      }).valid
    ).toBe(false);
  });

  it("executa todo o ciclo da demo com EXATAMENTE 0 acessos ao D1 e bloqueia todas as mutações", async () => {
    resetD1AccessCount();

    const entered = await signInDemoAction();
    expect(entered.ok).toBe(true);
    expect(cookieJar.has(DEMO_SESSION_COOKIE_NAME)).toBe(true);
    expect(cookieJar.has(SESSION_COOKIE_NAME)).toBe(false);

    const ws = await getAuthenticatedWorkspace();
    expect(ws).not.toBeNull();
    expect(ws?.profile.id).toBe(DEMO_USER_ID);
    expect(ws?.passwordHashSim).toBe("");
    expect(ws?.works.length).toBeGreaterThan(0);

    // Todas as mutações são bloqueadas com mensagem amigável
    const mutations = await Promise.all([
      addBookToLibraryAction({
        title: "Livro Teste",
        primaryAuthor: "Autor",
        format: "paperback",
      }),
      updateReadingProgressAction({
        readingId: "read-grande-sertao",
        progressUnit: "pages",
        progressValue: 300,
      }),
      createGoalAction({
        title: "Meta 2026",
        kind: "books",
        period: "year",
        startsOn: "2026-01-01",
        endsOn: "2026-12-31",
        targetValue: 12,
      }),
      upsertReviewAction({
        workId: ws!.works[0]!.id,
        rating: 5,
      }),
      addWishlistItemAction({
        title: "Livro Desejado",
        primaryAuthor: "Autor",
        priority: 3,
      }),
      updateProfileAction({ displayName: "Tentativa" }),
      changePasswordAction({ newPassword: "NovaSenhaSegura!2026" }),
      deleteMyAccountAction({ confirmationPhrase: "EXCLUIR MINHA CONTA" }),
    ]);

    for (const res of mutations) {
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe(DEMO_READONLY_ERROR);
      }
    }

    // Rotas API de export e busca de terceiros também retornam 403 na demo
    const exportRes = await getExportRoute(
      new NextRequest("https://example.test/api/export?format=json")
    );
    expect(exportRes.status).toBe(403);

    const coverSearchRes = await getCoversSearchRoute(
      new NextRequest("https://example.test/api/covers/search?title=Dom")
    );
    expect(coverSearchRes.status).toBe(403);

    const catalogSearchRes = await getCatalogSearchRoute(
      new NextRequest("https://example.test/api/catalog/search?q=Dom")
    );
    expect(catalogSearchRes.status).toBe(403);

    // Sair limpa o cookie da demo sem tocar no D1
    await signOutAction();
    expect(cookieJar.has(DEMO_SESSION_COOKIE_NAME)).toBe(false);
    expect(await getAuthenticatedWorkspace()).toBeNull();

    // Instrumentação obrigatória: ZERO acessos ao D1 em todo o ciclo da demo
    expect(getD1AccessCount()).toBe(0);
  });

  it("aplica rate limit por IP na criação do cookie demo e respeita DEMO_ENABLED=false", async () => {
    process.env.DEMO_ENABLED = "false";
    const blockedByFlag = await signInDemoAction();
    expect(blockedByFlag.ok).toBe(false);
    delete process.env.DEMO_ENABLED;

    mockClientIp = "198.51.100.77";
    for (let i = 0; i < 20; i++) {
      const okRes = await signInDemoAction();
      expect(okRes.ok).toBe(true);
    }
    const limited = await signInDemoAction();
    expect(limited.ok).toBe(false);
    if (!limited.ok) {
      expect(limited.error).toMatch(/Muitas tentativas/i);
    }
    expect(getD1AccessCount()).toBe(0);
  });
});
