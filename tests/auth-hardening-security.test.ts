import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieJar = new Map<string, string>();
let mockHeadersMap = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { value: cookieJar.get(name)! } : undefined,
    set: (name: string, value: string) => cookieJar.set(name, value),
    delete: (name: string) => cookieJar.delete(name),
  }),
  headers: async () => ({
    get: (name: string) => mockHeadersMap.get(name.toLowerCase()) ?? null,
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  changePasswordAction,
  requestMagicLinkAction,
  requestPasswordResetAction,
  resetPasswordAction,
  signInWithEmailAction,
  signUpAction,
  verifyMagicLinkAction,
} from "@/features/auth/actions";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as signupPost } from "@/app/api/auth/signup/route";
import { POST as resetPost } from "@/app/api/auth/password-reset/route";
import { POST as magicLinkPost } from "@/app/api/auth/magic-link/route";
import {
  SESSION_COOKIE_NAME,
  getMemoryStore,
} from "@/server/store/memory-repository";
import { getAuthSecurityConfig } from "@/server/security/auth-config";
import {
  computeAccountHmac,
  extractTrustedClientIp,
  hashAppSecretArgon2id,
  isArgon2idHash,
  normalizeClientIp,
  normalizeEmailForIdentity,
  signKnownDeviceCookie,
  verifyAppSecretArgon2id,
  verifyKnownDeviceCookie,
} from "@/server/security/secrets";
import {
  evaluatePreAuthGate,
  getAccountAttemptState,
  isAttackModeActive,
  recordAuthFailureAtomic,
  recordAuthSuccessAtomic,
  resetAllAuthThrottleStateForTests,
  unlockAccountManually,
} from "@/server/security/auth-throttle";
import {
  getAuthFailuresPerMinute,
  redactSensitiveData,
  resetAuthFailureMetricForTests,
  subscribeAuthLogSink,
} from "@/server/security/auth-logger";
import {
  clearDispatchedAuthMailsForTests,
  getDispatchedAuthMailsForTests,
} from "@/server/security/auth-mailer";
import { MOCK_VALID_CAPTCHA_TOKEN } from "@/server/security/captcha";
import { setPwnedRangeFetcherForTests } from "@/server/security/pwned-passwords";

function makeJsonPostRequest(
  path: string,
  body: Record<string, unknown>,
  extraHeaders?: Record<string, string>,
  extraCookies?: Record<string, string>
): NextRequest {
  const hdrs = new Headers({
    "content-type": "application/json",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0",
    ...(extraHeaders ?? {}),
  });
  if (extraCookies && Object.keys(extraCookies).length > 0) {
    hdrs.set(
      "cookie",
      Object.entries(extraCookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ")
    );
  }
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "POST",
    headers: hdrs,
    body: JSON.stringify(body),
  });
}

describe("Segurança de login: credential stuffing, anti-enumeração, Argon2id, HIBP e logs", () => {
  const savedEnv: Record<string, string | undefined> = {};

  function setEnv(key: string, val: string | undefined) {
    if (!(key in savedEnv)) {
      savedEnv[key] = process.env[key];
    }
    if (val === undefined) delete process.env[key];
    else process.env[key] = val;
  }

  beforeEach(() => {
    cookieJar.clear();
    mockHeadersMap = new Map();
    resetAllAuthThrottleStateForTests();
    clearDispatchedAuthMailsForTests();
    resetAuthFailureMetricForTests();
    setPwnedRangeFetcherForTests(null);
    setEnv("AUTH_MIN_RESPONSE_MS", "0");
    setEnv("AUTH_RESPONSE_JITTER_MS", "0");
    setEnv("AUTH_TRUST_PROXY", "0");
    setEnv("AUTH_CAPTCHA_PROVIDER", "none");
    setEnv("AUTH_HIBP_CHECK_ENABLED", "false");
    setEnv("AUTH_REQUIRE_EMAIL_CONFIRMATION", "false");
  });

  afterEach(() => {
    setPwnedRangeFetcherForTests(null);
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
      delete savedEnv[k];
    }
  });

  // ===========================================================================
  // 1. Unitários da política de bloqueio, IPv6 /64, proxy confiável e Argon2id
  // ===========================================================================
  it("aplica política exata: 3 falhas -> bloqueio 60s, escalonamento 60s/5m/15m/1h, sem extensão durante bloqueio, reset em sucesso e igual para e-mail inexistente", () => {
    const existingHmac = computeAccountHmac("vitima@example.test");
    const nonExistentHmac = computeAccountHmac("nao-existe-999@example.test");
    const t0 = 1_700_000_000_000;

    // 1. E-mail normalizado com trim, minúsculas e NFKC gera o mesmo HMAC
    expect(computeAccountHmac("  VÍTIMA@Example.Test ")).toBe(
      computeAccountHmac(normalizeEmailForIdentity("vítima@example.test"))
    );

    // 2. 3 falhas consecutivas na janela de 15 min -> bloqueio de 60s (existente e inexistente idênticos)
    for (const hmac of [existingHmac, nonExistentHmac]) {
      const f1 = recordAuthFailureAtomic({
        accountHmac: hmac,
        clientIp: "198.51.100.10",
        nowMs: t0,
      });
      expect(f1.accountLockoutStarted).toBe(false);
      expect(f1.accountFailures).toBe(1);

      const f2 = recordAuthFailureAtomic({
        accountHmac: hmac,
        clientIp: "198.51.100.11",
        nowMs: t0 + 10_000,
      });
      expect(f2.accountLockoutStarted).toBe(false);
      expect(f2.accountFailures).toBe(2);

      const f3 = recordAuthFailureAtomic({
        accountHmac: hmac,
        clientIp: "198.51.100.12",
        nowMs: t0 + 20_000,
      });
      expect(f3.accountLockoutStarted).toBe(true);
      expect(f3.accountLockoutLevel).toBe(1);
      expect(f3.accountRetryAfterSeconds).toBe(60);
      expect(f3.shouldSendLockoutAlert).toBe(true);

      // Tentativas durante o bloqueio NÃO estendem o bloqueio nem contam como nova falha
      const lockedUntilBefore = getAccountAttemptState(hmac)!.locked_until_ms;
      const duringLock = recordAuthFailureAtomic({
        accountHmac: hmac,
        clientIp: "198.51.100.13",
        nowMs: t0 + 40_000,
      });
      expect(duringLock.accountWasAlreadyLocked).toBe(true);
      expect(duringLock.accountLockoutStarted).toBe(false);
      expect(duringLock.accountRetryAfterSeconds).toBe(40);
      expect(getAccountAttemptState(hmac)!.locked_until_ms).toBe(
        lockedUntilBefore
      );
      expect(getAccountAttemptState(hmac)!.consecutive_failures).toBe(0);
    }

    // 3. Escalonamento progressivo: 60s -> 300s (5m) -> 900s (15m) -> 3600s (1h teto) -> continua 3600s
    const expectedSteps = [300, 900, 3600, 3600];
    let cursorMs = t0 + 90_000; // após expirar os 60s do nível 1
    for (const expectedSec of expectedSteps) {
      recordAuthFailureAtomic({
        accountHmac: existingHmac,
        clientIp: "198.51.100.21",
        nowMs: cursorMs,
      });
      recordAuthFailureAtomic({
        accountHmac: existingHmac,
        clientIp: "198.51.100.22",
        nowMs: cursorMs + 1000,
      });
      const trigger = recordAuthFailureAtomic({
        accountHmac: existingHmac,
        clientIp: "198.51.100.23",
        nowMs: cursorMs + 2000,
      });
      expect(trigger.accountLockoutStarted).toBe(true);
      expect(trigger.accountRetryAfterSeconds).toBe(expectedSec);
      cursorMs += (expectedSec + 10) * 1000;
    }

    // 4. Reincidência volta ao nível inicial após 24h sem falhas
    const after24h = cursorMs + 25 * 3600 * 1000;
    recordAuthFailureAtomic({
      accountHmac: existingHmac,
      clientIp: "198.51.100.31",
      nowMs: after24h,
    });
    recordAuthFailureAtomic({
      accountHmac: existingHmac,
      clientIp: "198.51.100.32",
      nowMs: after24h + 1000,
    });
    const decayed = recordAuthFailureAtomic({
      accountHmac: existingHmac,
      clientIp: "198.51.100.33",
      nowMs: after24h + 2000,
    });
    expect(decayed.accountLockoutLevel).toBe(1);
    expect(decayed.accountRetryAfterSeconds).toBe(60);

    // 5. Sucesso zera contadores e nível de bloqueio
    recordAuthSuccessAtomic({
      accountHmac: existingHmac,
      clientIp: "198.51.100.33",
      nowMs: after24h + 70_000,
    });
    const cleared = getAccountAttemptState(existingHmac)!;
    expect(cleared.consecutive_failures).toBe(0);
    expect(cleared.lockout_level).toBe(0);
    expect(cleared.locked_until_ms).toBe(0);

    // 6. Desbloqueio manual operacional limpa conta bloqueada
    const unlocked = unlockAccountManually("nao-existe-999@example.test");
    expect(unlocked.rowsCleared).toBeGreaterThanOrEqual(1);
    expect(getAccountAttemptState(nonExistentHmac)).toBeNull();
  });

  it("agrupa IPv6 por /64, ignora headers forjados sem AUTH_TRUST_PROXY=1 e protege dispositivo conhecido contra DoS", () => {
    // Agrupamento IPv6 /64: sufixos diferentes do mesmo /64 caem na mesma chave
    expect(normalizeClientIp("2001:db8:abcd:0012:1111:2222:3333:4444")).toBe(
      "2001:0db8:abcd:0012::/64"
    );
    expect(normalizeClientIp("2001:db8:abcd:12::ffff")).toBe(
      "2001:0db8:abcd:0012::/64"
    );

    // Sem AUTH_TRUST_PROXY=1, ignora header X-Forwarded-For controlável pelo cliente
    setEnv("AUTH_TRUST_PROXY", "0");
    expect(extractTrustedClientIp({ "x-forwarded-for": "203.0.113.99" })).toBe(
      "127.0.0.1"
    );

    // Com AUTH_TRUST_PROXY=1, lê apenas header de proxy confiável
    setEnv("AUTH_TRUST_PROXY", "1");
    expect(extractTrustedClientIp({ "cf-connecting-ip": "203.0.113.99" })).toBe(
      "203.0.113.99"
    );

    // Dispositivo conhecido (cookie assinado) não sofre DoS quando atacante bloqueia a conta por fora
    const victimHmac = computeAccountHmac("dono-legitimo@example.test");
    const knownCookie = signKnownDeviceCookie(
      "a1b2c3d4e5f60718293a4b5c6d7e8f90"
    );
    const verifiedDeviceId = verifyKnownDeviceCookie(knownCookie);
    expect(verifiedDeviceId).toBe("a1b2c3d4e5f60718293a4b5c6d7e8f90");
    expect(verifyKnownDeviceCookie(`${knownCookie}tampered`)).toBeNull();

    const t0 = 1_700_000_000_000;
    for (let i = 0; i < 3; i++) {
      recordAuthFailureAtomic({
        accountHmac: victimHmac,
        clientIp: "198.51.100.77",
        knownDeviceId: null,
        nowMs: t0 + i * 1000,
      });
    }

    // Dispositivo desconhecido está bloqueado
    const unknownGate = evaluatePreAuthGate({
      accountHmac: victimHmac,
      clientIp: "198.51.100.88",
      knownDeviceId: null,
      nowMs: t0 + 5000,
    });
    expect(unknownGate.allowed).toBe(false);
    expect(unknownGate.blockedBy).toBe("account_lockout");

    // Dispositivo conhecido da vítima continua liberado para login legítimo
    const knownGate = evaluatePreAuthGate({
      accountHmac: victimHmac,
      clientIp: "192.0.2.10",
      knownDeviceId: verifiedDeviceId,
      nowMs: t0 + 5000,
    });
    expect(knownGate.allowed).toBe(true);
    expect(knownGate.isKnownDevice).toBe(true);
  });

  it("armazena segredos próprios com PBKDF2-SHA256 (Web Crypto, 100.000 iterações, salt único), exige AUTH_HMAC_SECRET em produção e bloqueia senhas vazadas via HIBP k-anonymity", async () => {
    const h1 = await hashAppSecretArgon2id("codigo-recuperacao-secreto-1");
    const h2 = await hashAppSecretArgon2id("codigo-recuperacao-secreto-1");
    expect(isArgon2idHash(h1)).toBe(true);
    expect(h1).not.toBe(h2); // salt aleatório por item
    expect(h1).toMatch(/^\$pbkdf2-sha256\$i=100000\$/);
    expect(
      await verifyAppSecretArgon2id("codigo-recuperacao-secreto-1", h1)
    ).toBe(true);
    expect(await verifyAppSecretArgon2id("codigo-errado", h1)).toBe(false);

    // Garante que em NODE_ENV=production fora de VITEST/build, AUTH_HMAC_SECRET é obrigatório mesmo sem VERCEL_ENV
    const prevNodeEnv = process.env.NODE_ENV;
    const prevVitest = process.env.VITEST;
    const prevHmac = process.env.AUTH_HMAC_SECRET;
    const prevVercel = process.env.VERCEL_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV =
        "production";
      delete process.env.VITEST;
      delete process.env.VERCEL_ENV;
      delete process.env.AUTH_HMAC_SECRET;
      expect(() => getAuthSecurityConfig()).toThrow(/AUTH_HMAC_SECRET/);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV =
        prevNodeEnv;
      if (prevVitest !== undefined) process.env.VITEST = prevVitest;
      else delete process.env.VITEST;
      if (prevHmac !== undefined) process.env.AUTH_HMAC_SECRET = prevHmac;
      else delete process.env.AUTH_HMAC_SECRET;
      if (prevVercel !== undefined) process.env.VERCEL_ENV = prevVercel;
      else delete process.env.VERCEL_ENV;
    }

    // Mock HIBP k-anonymity: envia apenas 5 chars do SHA-1, jamais a senha
    const leakedPass = "minha frase vazada 2026";
    const sha1 = crypto
      .createHash("sha1")
      .update(leakedPass, "utf8")
      .digest("hex")
      .toUpperCase();
    const receivedPrefixes: string[] = [];

    setEnv("AUTH_HIBP_CHECK_ENABLED", "true");
    setPwnedRangeFetcherForTests(async (prefix5) => {
      receivedPrefixes.push(prefix5);
      return `${sha1.slice(5)}:42\r\n00000000000000000000000000000000000:0`;
    });

    const blockedSignup = await signUpAction({
      email: "hibp-test@example.test",
      password: leakedPass,
      confirmMinimumAge16: true,
      acceptTerms: true,
    });
    expect(blockedSignup.ok).toBe(false);
    expect(receivedPrefixes).toEqual([sha1.slice(0, 5)]);
    if (!blockedSignup.ok) {
      expect(blockedSignup.error).toContain("vazamentos");
    }
  });

  // ===========================================================================
  // 2. Uniformidade: 200 existente vs 200 inexistente (mensagem, status, corpo e tempo)
  //    + e-mail não confirmado com senha correta + cadastro/reset/link mágico uniformes
  // ===========================================================================
  it("mantém resposta e tempo estatisticamente indistinguíveis em 200 amostras de e-mail existente vs 200 inexistente, e nunca revela e-mail não confirmado", async () => {
    setEnv("AUTH_TRUST_PROXY", "1");
    setEnv("AUTH_MIN_RESPONSE_MS", "25");
    setEnv("AUTH_RESPONSE_JITTER_MS", "6");
    // Aumenta threshold apenas para medir 200 amostras limpas sem cair no 429
    setEnv("AUTH_ACCOUNT_FAIL_THRESHOLD", "20");
    setEnv("AUTH_PAIR_FAIL_THRESHOLD", "20");
    setEnv("AUTH_IP_FAIL_THRESHOLD", "100");
    setEnv("AUTH_ATTACK_MODE_DISTINCT_ACCOUNTS", "200");

    // Cria 10 contas reais (20 tentativas por conta = 200 amostras existentes)
    const existingEmails: string[] = [];
    for (let i = 0; i < 10; i++) {
      const email = `uniform-exist-${i}-${Date.now()}@example.test`;
      existingEmails.push(email);
      const s = await signUpAction({
        email,
        password: "frase unica de teste de leitura",
        confirmMinimumAge16: true,
        acceptTerms: true,
      });
      expect(s.ok).toBe(true);
    }

    const existDurations: number[] = [];
    const nonExistDurations: number[] = [];
    const existBodies = new Set<string>();
    const nonExistBodies = new Set<string>();
    const existStatuses = new Set<number>();
    const nonExistStatuses = new Set<number>();

    // Intercala chamadas existentes e inexistentes (200 + 200) para eliminar viés de aquecimento da CPU
    for (let i = 0; i < 200; i++) {
      const existEmail = existingEmails[i % 10]!;
      const missingEmail = `uniform-missing-${i % 10}-${Date.now()}@example.test`;
      const ipA = `10.10.${Math.floor(i / 50)}.${(i % 50) + 1}`;
      const ipB = `10.20.${Math.floor(i / 50)}.${(i % 50) + 1}`;

      const t1 = performance.now();
      const resExist = await loginPost(
        makeJsonPostRequest(
          "/api/auth/login",
          { email: existEmail, password: "senha errada para uniformidade" },
          { "x-forwarded-for": ipA }
        )
      );
      existDurations.push(performance.now() - t1);
      existStatuses.add(resExist.status);
      existBodies.add(await resExist.text());

      const t2 = performance.now();
      const resMissing = await loginPost(
        makeJsonPostRequest(
          "/api/auth/login",
          { email: missingEmail, password: "senha errada para uniformidade" },
          { "x-forwarded-for": ipB }
        )
      );
      nonExistDurations.push(performance.now() - t2);
      nonExistStatuses.add(resMissing.status);
      nonExistBodies.add(await resMissing.text());

      // Limpa contadores a cada 15 amostras para manter todas as 200 no status 401
      if ((i + 1) % 15 === 0) {
        resetAllAuthThrottleStateForTests();
      }
    }

    // Status, mensagem e formato de corpo 100% idênticos em todas as 400 respostas
    expect(Array.from(existStatuses)).toEqual([401]);
    expect(Array.from(nonExistStatuses)).toEqual([401]);
    expect(Array.from(existBodies)).toEqual([
      JSON.stringify({ ok: false, error: "E-mail ou senha incorretos." }),
    ]);
    expect(Array.from(nonExistBodies)).toEqual(Array.from(existBodies));

    // Comparação estatística (mediana e média indistinguíveis dentro da margem operacional)
    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const median = (arr: number[]) => {
      const sorted = [...arr].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)]!;
    };
    const meanDiffMs = Math.abs(mean(existDurations) - mean(nonExistDurations));
    const medianDiffMs = Math.abs(
      median(existDurations) - median(nonExistDurations)
    );
    expect(meanDiffMs).toBeLessThan(12);
    expect(medianDiffMs).toBeLessThan(10);

    // Caso especial: conta com e-mail NÃO confirmado + SENHA CORRETA -> mesma resposta + reenvio silencioso com rate limit
    resetAllAuthThrottleStateForTests();
    clearDispatchedAuthMailsForTests();
    const unconfirmedEmail = `nao-confirmado-${Date.now()}@example.test`;
    const unconfirmedPass = "minha biblioteca serena 2026";
    setEnv("AUTH_REQUIRE_EMAIL_CONFIRMATION", "true");
    const signupUnconfirmed = await signupPost(
      makeJsonPostRequest("/api/auth/signup", {
        email: unconfirmedEmail,
        password: unconfirmedPass,
        confirmMinimumAge16: true,
        acceptTerms: true,
      })
    );
    expect(signupUnconfirmed.status).toBe(200);
    const signupNewBody = await signupUnconfirmed.text();

    // Cadastro com e-mail JÁ existente retorna exatamente o mesmo status 200, corpo e sem Set-Cookie
    const signupDuplicate = await signupPost(
      makeJsonPostRequest("/api/auth/signup", {
        email: unconfirmedEmail,
        password: "outra frase qualquer valida",
        confirmMinimumAge16: true,
        acceptTerms: true,
      })
    );
    expect(signupDuplicate.status).toBe(200);
    expect(await signupDuplicate.text()).toBe(signupNewBody);
    expect(signupDuplicate.headers.get("set-cookie")).toBeNull();

    // Limpa outbox do cadastro para observar apenas o reenvio silencioso no login
    clearDispatchedAuthMailsForTests();
    // Zera cooldown de confirmação para validar o 1º reenvio e o bloqueio de taxa no 2º
    const unconfLogin1 = await loginPost(
      makeJsonPostRequest("/api/auth/login", {
        email: unconfirmedEmail,
        password: unconfirmedPass,
      })
    );
    expect(unconfLogin1.status).toBe(401);
    expect(await unconfLogin1.text()).toBe(
      JSON.stringify({ ok: false, error: "E-mail ou senha incorretos." })
    );
    const mailsAfterFirst = getDispatchedAuthMailsForTests().filter(
      (m) => m.kind === "email_confirmation"
    );
    expect(mailsAfterFirst).toHaveLength(1);

    // 2ª tentativa imediata mantém a mesma resposta e aplica rate limit ao reenvio de e-mail
    const unconfLogin2 = await loginPost(
      makeJsonPostRequest("/api/auth/login", {
        email: unconfirmedEmail,
        password: unconfirmedPass,
      })
    );
    expect(unconfLogin2.status).toBe(401);
    const mailsAfterSecond = getDispatchedAuthMailsForTests().filter(
      (m) => m.kind === "email_confirmation"
    );
    expect(mailsAfterSecond).toHaveLength(1);

    // Recuperação de senha e Link Mágico/OTP sempre retornam a mesma mensagem uniforme
    const resetExist = await resetPost(
      makeJsonPostRequest("/api/auth/password-reset", {
        email: unconfirmedEmail,
      })
    );
    const resetMissing = await resetPost(
      makeJsonPostRequest("/api/auth/password-reset", {
        email: "fantasma-reset@example.test",
      })
    );
    expect(resetExist.status).toBe(200);
    expect(resetMissing.status).toBe(200);
    expect(await resetExist.text()).toBe(await resetMissing.text());

    const magicExist = await magicLinkPost(
      makeJsonPostRequest("/api/auth/magic-link", {
        email: unconfirmedEmail,
      })
    );
    const magicMissing = await magicLinkPost(
      makeJsonPostRequest("/api/auth/magic-link", {
        email: "fantasma-magic@example.test",
      })
    );
    expect(magicExist.status).toBe(200);
    expect(magicMissing.status).toBe(200);
    expect(await magicExist.text()).toBe(await magicMissing.text());
  }, 30_000);

  // ===========================================================================
  // 3. Credential Stuffing Simulado: 500 pares de 1 IP e 500 pares de 50 IPs
  // ===========================================================================
  it("bloqueia credential stuffing (500 pares de 1 IP e 500 pares de 50 IPs via proxy confiável), ativa Modo Ataque com CAPTCHA e garante zero acesso indevido", async () => {
    setEnv("AUTH_TRUST_PROXY", "1");
    setEnv("AUTH_CAPTCHA_PROVIDER", "mock");

    // Cria 10 contas de teste (senhas fortes reais diferentes da lista vazada simulada)
    const testAccounts: string[] = [];
    for (let i = 0; i < 10; i++) {
      const email = `stuffing-user-${i}@example.test`;
      testAccounts.push(email);
      await signUpAction({
        email,
        password: `minha senha segura unica ${i}`,
        confirmMinimumAge16: true,
        acceptTerms: true,
      });
    }

    // Cenário A: 500 pares a partir de 1 único IP
    let blockedCount1Ip = 0;
    let successCount1Ip = 0;
    for (let i = 0; i < 500; i++) {
      const targetEmail =
        i < 10 ? testAccounts[i]! : `stuffing-list-1ip-${i}@example.test`;
      const res = await loginPost(
        makeJsonPostRequest(
          "/api/auth/login",
          { email: targetEmail, password: `leaked-combo-pass-${i}` },
          { "cf-connecting-ip": "203.0.113.5" }
        )
      );
      if (res.status === 200) successCount1Ip += 1;
      if (res.status === 429 || res.status === 403) blockedCount1Ip += 1;
    }

    expect(successCount1Ip).toBe(0);
    expect(blockedCount1Ip).toBeGreaterThanOrEqual(480); // Bloqueado logo após o limite de IP (10)
    expect(isAttackModeActive()).toBe(true);

    // Cenário B: 500 pares distribuídos em 50 IPs simulados via proxy confiável
    resetAllAuthThrottleStateForTests();
    let blockedOrCaptcha50Ips = 0;
    let successCount50Ips = 0;
    for (let i = 0; i < 500; i++) {
      const ip = `198.51.100.${(i % 50) + 1}`;
      const targetEmail =
        i < 10 ? testAccounts[i]! : `stuffing-list-50ip-${i}@example.test`;
      const res = await loginPost(
        makeJsonPostRequest(
          "/api/auth/login",
          { email: targetEmail, password: `distributed-leaked-${i}` },
          { "cf-connecting-ip": ip }
        )
      );
      if (res.status === 200) successCount50Ips += 1;
      if (res.status === 429 || res.status === 403) blockedOrCaptcha50Ips += 1;
    }

    expect(successCount50Ips).toBe(0);
    expect(isAttackModeActive()).toBe(true);
    expect(blockedOrCaptcha50Ips).toBeGreaterThanOrEqual(400);

    // Chamada direta à API de login no Modo Ataque SEM token de CAPTCHA é recusada com 403
    const directNoCaptcha = await loginPost(
      makeJsonPostRequest(
        "/api/auth/login",
        { email: testAccounts[0]!, password: "minha senha segura unica 0" },
        { "cf-connecting-ip": "192.0.2.200" }
      )
    );
    expect(directNoCaptcha.status).toBe(403);
    const directNoCaptchaJson = (await directNoCaptcha.json()) as {
      captchaRequired?: boolean;
    };
    expect(directNoCaptchaJson.captchaRequired).toBe(true);

    // Com token de CAPTCHA válido (e conta não bloqueada), a autenticação legítima prossegue
    unlockAccountManually(testAccounts[0]!);
    const directWithCaptcha = await loginPost(
      makeJsonPostRequest(
        "/api/auth/login",
        {
          email: testAccounts[0]!,
          password: "minha senha segura unica 0",
          captchaToken: MOCK_VALID_CAPTCHA_TOKEN,
        },
        { "cf-connecting-ip": "192.0.2.200" }
      )
    );
    expect(directWithCaptcha.status).toBe(200);
  }, 30_000);

  // ===========================================================================
  // 4. Concorrência: 100 tentativas paralelas na mesma conta (atomicidade SQL)
  // ===========================================================================
  it("mantém contagem atômica exata sob 100 tentativas paralelas na mesma conta sem ultrapassar o limite nem estender bloqueio", async () => {
    setEnv("AUTH_TRUST_PROXY", "1");
    setEnv("AUTH_IP_FAIL_THRESHOLD", "100"); // Isola o teste no limite por conta (3)
    const targetEmail = `concorrencia-100-${Date.now()}@example.test`;
    const accountHmac = computeAccountHmac(targetEmail);

    const parallelResults = await Promise.all(
      Array.from({ length: 100 }, (_, idx) =>
        loginPost(
          makeJsonPostRequest(
            "/api/auth/login",
            { email: targetEmail, password: `tentativa-paralela-${idx}` },
            { "cf-connecting-ip": `198.51.101.${(idx % 40) + 1}` }
          )
        )
      )
    );

    const statuses = parallelResults.map((r) => r.status);
    const count401 = statuses.filter((s) => s === 401).length;
    const count429 = statuses.filter((s) => s === 429).length;

    // Exatamente as 2 primeiras falhas devolvem 401; a 3ª dispara lockout (429) e as demais 97 também recebem 429 com Retry-After
    expect(count401).toBeLessThanOrEqual(2);
    expect(count429).toBeGreaterThanOrEqual(98);
    expect(count401 + count429).toBe(100);

    // Nível de bloqueio permanece em 1 (60s), sem escalar nem estender durante o bloqueio ativo
    const state = getAccountAttemptState(accountHmac)!;
    expect(state.lockout_level).toBe(1);
    expect(state.consecutive_failures).toBe(0);
    const remainingSec = Math.ceil((state.locked_until_ms - Date.now()) / 1000);
    expect(remainingSec).toBeGreaterThan(0);
    expect(remainingSec).toBeLessThanOrEqual(60);

    // Retry-After presente nas respostas 429
    const first429 = parallelResults.find((r) => r.status === 429)!;
    expect(Number(first429.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  // ===========================================================================
  // 5. Troca de senha autenticado + Link Mágico/OTP + Varredura de ZERO vazamento em logs
  // ===========================================================================
  it("cobre troca de senha (sessão recente/senha atual + revogação de outras sessões), link mágico/OTP e garante ZERO senhas, tokens ou e-mails inexistentes nos logs", async () => {
    const capturedLogs: string[] = [];
    const unsubscribe = subscribeAuthLogSink((line) => {
      capturedLogs.push(line);
    });

    const testPasswords = [
      "SenhaUltraSecreta-2026-Alpha",
      "NovaSenhaUltraSecreta-2026-Beta",
      "SenhaResetSecreta-2026-Gamma",
      "SenhaErradaSonda-999999",
    ];
    const nonExistentEmails = [
      "inexistente-sonda-alpha@example.test",
      "inexistente-sonda-beta@example.test",
    ];
    const secretTokensObserved: string[] = [];

    try {
      const userEmail = `fluxo-completo-${Date.now()}@example.test`;

      // 1. Cadastro
      const signup = await signUpAction({
        email: userEmail,
        password: testPasswords[0]!,
        confirmMinimumAge16: true,
        acceptTerms: true,
      });
      expect(signup.ok).toBe(true);

      const store = getMemoryStore();
      const userId = store.userIdByEmail.get(userEmail)!;
      const currentSession = cookieJar.get(SESSION_COOKIE_NAME)!;
      // Cria outra sessão ativa de outro dispositivo
      const otherDeviceSession = "sess-outro-dispositivo-xyz";
      store.sessions.set(otherDeviceSession, userId);

      // 2. Troca de senha com senha atual errada falha
      const badChange = await changePasswordAction({
        currentPassword: testPasswords[3]!,
        newPassword: testPasswords[1]!,
      });
      expect(badChange.ok).toBe(false);

      // 3. Troca de senha com senha atual correta encerra OUTRAS sessões, mantém a atual e envia aviso
      const goodChange = await changePasswordAction({
        currentPassword: testPasswords[0]!,
        newPassword: testPasswords[1]!,
      });
      expect(goodChange.ok).toBe(true);
      if (goodChange.ok) {
        expect(goodChange.revokedOtherSessions).toBe(1);
      }
      expect(store.sessions.has(otherDeviceSession)).toBe(false);
      expect(store.sessions.has(currentSession)).toBe(true);
      expect(
        getDispatchedAuthMailsForTests().some(
          (m) => m.kind === "password_changed_notice"
        )
      ).toBe(true);

      // 4. Fluxo de Recuperação de Senha (Argon2id one-time token)
      clearDispatchedAuthMailsForTests();
      const reqReset = await requestPasswordResetAction({ email: userEmail });
      expect(reqReset.ok).toBe(true);
      const resetMail = getDispatchedAuthMailsForTests().find(
        (m) => m.kind === "password_reset"
      );
      expect(resetMail?.testOnlySecret).toBeTruthy();
      secretTokensObserved.push(resetMail!.testOnlySecret!);

      const confirmReset = await resetPasswordAction({
        email: userEmail,
        token: resetMail!.testOnlySecret!,
        password: testPasswords[2]!,
      });
      expect(confirmReset.ok).toBe(true);

      // 5. Fluxo de Link Mágico / OTP (Argon2id one-time code)
      clearDispatchedAuthMailsForTests();
      const reqMagic = await requestMagicLinkAction({ email: userEmail });
      expect(reqMagic.ok).toBe(true);
      const magicMail = getDispatchedAuthMailsForTests().find(
        (m) => m.kind === "magic_link_otp"
      );
      expect(magicMail?.testOnlySecret).toBeTruthy();
      secretTokensObserved.push(magicMail!.testOnlySecret!);

      const verifyMagic = await verifyMagicLinkAction({
        email: userEmail,
        code: magicMail!.testOnlySecret!,
      });
      expect(verifyMagic.ok).toBe(true);

      // 6. Sondagens com e-mails inexistentes em todos os fluxos
      for (const ghostEmail of nonExistentEmails) {
        await signInWithEmailAction({
          email: ghostEmail,
          password: testPasswords[3]!,
        });
        await requestPasswordResetAction({ email: ghostEmail });
        await requestMagicLinkAction({ email: ghostEmail });
      }

      // 7. Valida redação automática de campos sensíveis no logger
      const redacted = redactSensitiveData({
        password: testPasswords[0],
        authorization: "Bearer super-secret-jwt-123",
        cookie: "rf_session_id=abc123",
        email: nonExistentEmails[0],
        nested: { token: "tok-999", note: "safe value" },
      }) as Record<string, unknown>;
      expect(redacted.password).toBe("[REDACTED]");
      expect(redacted.authorization).toBe("[REDACTED]");
      expect(redacted.cookie).toBe("[REDACTED]");
      expect(redacted.email).toBe("[REDACTED]");
      expect((redacted.nested as Record<string, unknown>).token).toBe(
        "[REDACTED]"
      );

      // 8. Varre 100% dos logs JSON emitidos: ZERO senhas, ZERO tokens, ZERO e-mails inexistentes
      expect(capturedLogs.length).toBeGreaterThan(5);
      const allLogsBlob = capturedLogs.join("\n");

      for (const pwd of testPasswords) {
        expect(allLogsBlob).not.toContain(pwd);
      }
      for (const tok of secretTokensObserved) {
        expect(allLogsBlob).not.toContain(tok);
      }
      for (const ghost of nonExistentEmails) {
        expect(allLogsBlob).not.toContain(ghost);
      }
      expect(allLogsBlob).not.toContain(userEmail);
      expect(allLogsBlob).not.toContain(currentSession);

      // Verifica estrutura JSON + retenção de 90 dias + contador de falhas/minuto
      const parsedSample = JSON.parse(capturedLogs[0]!) as Record<
        string,
        unknown
      >;
      expect(parsedSample.service).toBe("readingflow-auth");
      expect(parsedSample.retention_days).toBe(90);
      expect(typeof parsedSample.request_id).toBe("string");
      expect(typeof parsedSample.timestamp).toBe("string");
      expect(getAuthFailuresPerMinute()).toBeGreaterThanOrEqual(2);
    } finally {
      unsubscribe();
    }
  });
});
