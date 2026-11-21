import { describe, expect, it, vi } from "vitest";
import {
  generatePasswordResetToken,
  hashPassword,
  hashResetToken,
  isHashedPassword,
  verifyPassword,
} from "@/server/security/password";

// Mocks mínimos para Next.js server actions em ambiente unitário
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
  requestPasswordResetAction,
  resetPasswordAction,
  signInWithEmailAction,
  signUpAction,
} from "@/features/auth/actions";
import { getMemoryStore } from "@/server/store/memory-repository";

describe("Segurança de autenticação — hash scrypt e recuperação com token único", () => {
  it("gera hashes scrypt únicos com sal e nunca armazena senha em texto puro", () => {
    const h1 = hashPassword("SenhaForte#2026");
    const h2 = hashPassword("SenhaForte#2026");

    expect(isHashedPassword(h1)).toBe(true);
    expect(h1).not.toContain("SenhaForte#2026");
    expect(h1).not.toBe(h2);
    expect(verifyPassword("SenhaForte#2026", h1)).toBe(true);
    expect(verifyPassword("SenhaErrada#2026", h1)).toBe(false);
  });

  it("impede takeover de conta sem token válido e revoga sessões após redefinição legítima", async () => {
    const email = `seguranca-${Date.now()}@teste.local`;
    const initialPass = "Inicial#2026";
    const hijackedPass = "Invasor#2026";
    const newPass = "Atualizada#2026";

    const signup = await signUpAction({
      email,
      password: initialPass,
      confirmMinimumAge16: true,
      acceptTerms: true,
    });
    expect(signup.ok).toBe(true);

    const store = getMemoryStore();
    const userId = store.userIdByEmail.get(email)!;
    const ws = store.usersById.get(userId)!;

    // Senha armazenada jamais é texto puro
    expect(ws.passwordHashSim).not.toBe(initialPass);
    expect(isHashedPassword(ws.passwordHashSim)).toBe(true);

    // Sessão ativa existente antes da tentativa de invasão
    const activeSessionToken = "sess-ativa-antes-reset";
    store.sessions.set(activeSessionToken, userId);

    // Tentativa não autenticada com token inválido falha e não altera a senha da vítima
    const forgedAttempt = await resetPasswordAction({
      email,
      token: "token-falso-1234567890abcdef",
      password: hijackedPass,
    });
    expect(forgedAttempt.ok).toBe(false);
    expect(verifyPassword(initialPass, ws.passwordHashSim)).toBe(true);
    expect(verifyPassword(hijackedPass, ws.passwordHashSim)).toBe(false);
    expect(store.sessions.has(activeSessionToken)).toBe(true);

    // Solicitação de redefinição sempre retorna mensagem neutra (sem enumerar e-mail)
    const reqRes = await requestPasswordResetAction({ email });
    expect(reqRes.ok).toBe(true);

    // Simula emissão de token conhecido para validar fluxo de uso único + revogação de sessão
    const { rawToken, tokenHash } = generatePasswordResetToken();
    store.passwordResetTokens.set(tokenHash, {
      userId,
      expiresAtMs: Date.now() + 60_000,
    });

    const validReset = await resetPasswordAction({
      email,
      token: rawToken,
      password: newPass,
    });
    expect(validReset.ok).toBe(true);
    expect(verifyPassword(newPass, ws.passwordHashSim)).toBe(true);
    expect(verifyPassword(initialPass, ws.passwordHashSim)).toBe(false);

    // Todas as sessões anteriores devem ter sido revogadas
    expect(store.sessions.has(activeSessionToken)).toBe(false);

    // Token não pode ser reutilizado (uso único)
    expect(store.passwordResetTokens.has(hashResetToken(rawToken))).toBe(false);
    const replayAttempt = await resetPasswordAction({
      email,
      token: rawToken,
      password: "Replay#2026",
    });
    expect(replayAttempt.ok).toBe(false);

    // Login funciona com a nova senha e rejeita a antiga
    const badLogin = await signInWithEmailAction({
      email,
      password: initialPass,
    });
    expect(badLogin.ok).toBe(false);

    const goodLogin = await signInWithEmailAction({
      email,
      password: newPass,
    });
    expect(goodLogin.ok).toBe(true);
  });
});
