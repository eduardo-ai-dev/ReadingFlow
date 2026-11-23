"use server";

import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isDemoSessionAllowed } from "@/lib/auth-demo";
import {
  DEMO_SESSION_COOKIE_NAME,
  DEMO_USER_ID,
  SESSION_COOKIE_NAME,
  createDefaultShelves,
  createDefaultUserSettings,
  ensureWorkspaceSettings,
  getAuthenticatedWorkspace,
  getMemoryStore,
  invalidateUserWorkspaceCache,
  requireAuthenticatedWorkspace,
} from "@/server/store/memory-repository";
import {
  ambientPreferencesSchema,
  changePasswordSchema,
  deleteAccountSchema,
  onboardingSchema,
  requestMagicLinkSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  updateProfileSchema,
  updateThemePreferencesSchema,
  verifyMagicLinkSchema,
} from "@/features/auth/schema";
import {
  normalizeAmbientPreferences,
  type AmbientPreferences,
} from "@/features/reading/ambient-catalog";
import {
  DENSITY_COOKIE_NAME,
  FX_COOKIE_NAME,
  MOTION_COOKIE_NAME,
  THEME_COOKIE_NAME,
  normalizeDensityPreference,
  normalizeFxPreference,
  normalizeMotionPreference,
  normalizeThemePreference,
} from "@/lib/themes/themes.config";
import type {
  DensityPreference,
  FxPreference,
  MotionPreference,
  ThemePreference,
} from "@/lib/themes/themes.types";
import {
  CURRENT_TERMS_VERSION,
  isValidIanaTimezone,
} from "@/features/auth/rules";
import { sanitizePlainText } from "@/server/security/sanitize";
import {
  hashPasswordAsync,
  hashResetToken,
  isHashedPassword,
  verifyPasswordAsync,
} from "@/server/security/password";
import { getAuthSecurityConfig } from "@/server/security/auth-config";
import { logAuthEvent } from "@/server/security/auth-logger";
import { dispatchAuthEmail } from "@/server/security/auth-mailer";
import { verifyCaptchaTokenServer } from "@/server/security/captcha";
import { checkPwnedPasswordServer } from "@/server/security/pwned-passwords";
import {
  KNOWN_DEVICE_COOKIE_NAME,
  computeAccountHmac,
  equalizeAuthResponseTime,
  extractTrustedClientIp,
  hashAppSecretArgon2id,
  normalizeEmailForIdentity,
  signKnownDeviceCookie,
  verifyKnownDeviceCookie,
} from "@/server/security/secrets";
import {
  consumeOneTimeAuthSecret,
  evaluatePreAuthGate,
  issueOneTimeAuthSecret,
  recordAuthFailureAtomic,
  recordAuthSuccessAtomic,
  withAccountAuthLock,
} from "@/server/security/auth-throttle";
import { formatDateInTimezone } from "@/lib/dates";
import {
  ormCreateSession,
  ormDeleteSession,
  ormDeleteSessionsByUserId,
  ormCreateUser,
  ormInsertShelves,
  ormUpdateUser,
  ormDeleteUser,
} from "@/server/db/orm-repository";

const UNIFORM_INVALID_CREDENTIALS_ERROR = "E-mail ou senha incorretos.";
const UNIFORM_LOCKOUT_ERROR =
  "Muitas tentativas. Tente novamente em instantes.";
const UNIFORM_INSTRUCTIONS_SENT_MESSAGE =
  "Se o e-mail existir, enviaremos instruções.";
const UNIFORM_CAPTCHA_ERROR =
  "Confirme a verificação de segurança para continuar.";
const UNIFORM_PWNED_PASSWORD_ERROR =
  "Esta senha apareceu em vazamentos públicos conhecidos. Escolha outra senha.";

const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
const RECENT_SESSION_WINDOW_MS = 15 * 60 * 1000;

// Hash PBKDF2-SHA256 pré-formatado (zero CPU no startup do Worker) para equalizar custo quando e-mail não existe
const DUMMY_PASSWORD_HASH =
  "pbkdf2$sha256$100000$0102030405060708090a0b0c0d0e0f10$000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";

async function readSafeRequestContext(overrides?: {
  clientIp?: string;
  userAgent?: string | null;
  requestId?: string;
  knownDeviceCookie?: string | null;
}): Promise<{
  clientIp: string;
  userAgent: string | null;
  requestId: string;
  knownDeviceId: string | null;
}> {
  let hdrs: Awaited<ReturnType<typeof headers>> | null = null;
  try {
    if (typeof headers === "function") {
      hdrs = await headers();
    }
  } catch {
    hdrs = null;
  }

  let cookieDeviceVal = overrides?.knownDeviceCookie ?? null;
  if (cookieDeviceVal === null) {
    try {
      const cookieStore = await cookies();
      cookieDeviceVal =
        cookieStore.get(KNOWN_DEVICE_COOKIE_NAME)?.value ?? null;
    } catch {
      cookieDeviceVal = null;
    }
  }

  const clientIp = overrides?.clientIp ?? extractTrustedClientIp(hdrs);
  const userAgent =
    overrides?.userAgent !== undefined
      ? overrides.userAgent
      : (hdrs?.get("user-agent") ?? null);
  const requestId =
    overrides?.requestId ?? hdrs?.get("x-request-id") ?? crypto.randomUUID();
  const knownDeviceId = verifyKnownDeviceCookie(cookieDeviceVal);

  return { clientIp, userAgent, requestId, knownDeviceId };
}

async function writeThemePreferenceCookies(prefs: {
  theme?: ThemePreference;
  density?: DensityPreference;
  motion?: MotionPreference;
  fx?: FxPreference;
}): Promise<void> {
  const cookieStore = await cookies();
  const baseOpts = {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
  if (prefs.theme) {
    cookieStore.set(
      THEME_COOKIE_NAME,
      normalizeThemePreference(prefs.theme),
      baseOpts
    );
  }
  if (prefs.density) {
    cookieStore.set(
      DENSITY_COOKIE_NAME,
      normalizeDensityPreference(prefs.density),
      baseOpts
    );
  }
  if (prefs.motion) {
    cookieStore.set(
      MOTION_COOKIE_NAME,
      normalizeMotionPreference(prefs.motion),
      baseOpts
    );
  }
  if (prefs.fx) {
    cookieStore.set(FX_COOKIE_NAME, normalizeFxPreference(prefs.fx), baseOpts);
  }
}

async function createSessionCookie(
  userId: string,
  rememberMe = true,
  existingKnownDeviceId?: string | null
): Promise<string> {
  const token = crypto.randomBytes(24).toString("hex");
  const store = getMemoryStore();
  store.sessions.set(token, userId);
  store.sessionCreatedAt.set(token, Date.now());
  await ormCreateSession(token, userId).catch(() => {});

  const cookieStore = await cookies();
  const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24;

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });

  // Emite ou renova cookie assinado de dispositivo conhecido apenas para contas reais
  if (userId !== DEMO_USER_ID) {
    const deviceCookie = signKnownDeviceCookie(
      existingKnownDeviceId ?? undefined
    );
    cookieStore.set(KNOWN_DEVICE_COOKIE_NAME, deviceCookie, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });
  }

  if (userId === DEMO_USER_ID) {
    cookieStore.set(DEMO_SESSION_COOKIE_NAME, "true", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge,
    });
  } else {
    cookieStore.delete(DEMO_SESSION_COOKIE_NAME);
  }

  // Sincroniza os cookies com as preferências salvas no perfil do usuário (valendo entre dispositivos)
  const ws = store.usersById.get(userId);
  if (ws) {
    const settings = ensureWorkspaceSettings(ws);
    await writeThemePreferenceCookies({
      theme: ws.profile.theme ?? settings.theme,
      density: ws.profile.density ?? settings.density,
      motion: ws.profile.motion ?? settings.motion,
      fx: ws.profile.fx ?? settings.fx,
    });
  }

  return token;
}

export async function signInDemoAction(): Promise<
  { ok: true; redirectTo: string } | { ok: false; error: string }
> {
  if (!isDemoSessionAllowed()) {
    return {
      ok: false,
      error: "Sessão demonstrativa desativada em produção.",
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          email: "demo@readingflow.local",
          password: process.env.DEMO_USER_PASSWORD ?? "demo1234",
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
    } catch {
      // Fallback automático para a sessão demonstrativa local via cookie rf_demo_session=true
    }
  }

  await createSessionCookie(DEMO_USER_ID, true);
  revalidatePath("/", "layout");
  return { ok: true, redirectTo: "/painel" };
}

export type SignInActionResult =
  | { ok: true; needsOnboarding: boolean }
  | {
      ok: false;
      error: string;
      statusCode?: number;
      retryAfterSeconds?: number;
      captchaRequired?: boolean;
    };

export async function signInWithEmailAction(
  rawInput: {
    email: string;
    password: string;
    rememberMe?: boolean;
    captchaToken?: string;
  },
  internalContext?: {
    clientIp?: string;
    userAgent?: string | null;
    requestId?: string;
    knownDeviceCookie?: string | null;
    skipCookieWrite?: boolean;
  }
): Promise<SignInActionResult> {
  const startedAtMs = performance.now();
  const ctx = await readSafeRequestContext(internalContext);

  const parsed = signInSchema.safeParse(rawInput);
  if (!parsed.success) {
    // Se falhar limite de 72 bytes UTF-8 ou validação de senha, retorna resposta uniforme sem vazar estado
    const firstIssue = parsed.error.issues[0];
    const isEmailFormatError = firstIssue?.path?.[0] === "email";
    if (!isEmailFormatError) {
      await verifyPasswordAsync("invalid-placeholder", DUMMY_PASSWORD_HASH);
      await equalizeAuthResponseTime(startedAtMs);
      return {
        ok: false,
        error: UNIFORM_INVALID_CREDENTIALS_ERROR,
        statusCode: 401,
      };
    }
    await equalizeAuthResponseTime(startedAtMs);
    return {
      ok: false,
      error: firstIssue?.message ?? "Informe um e-mail válido.",
      statusCode: 400,
    };
  }

  const normalizedEmail = normalizeEmailForIdentity(parsed.data.email);
  const accountHmac = computeAccountHmac(normalizedEmail);

  // Serializa tentativas simultâneas na MESMA conta (impede corrida TOCTOU de 100 palpites paralelos)
  const outcome = await withAccountAuthLock<SignInActionResult>(
    accountHmac,
    async () => {
      // 1. Gate atômico pré-autenticação (conta, IP, par, modo ataque, dispositivo conhecido)
      const gate = evaluatePreAuthGate({
        accountHmac,
        clientIp: ctx.clientIp,
        knownDeviceId: ctx.knownDeviceId,
      });

      if (!gate.allowed) {
        logAuthEvent({
          event: "lockout_blocked",
          requestId: ctx.requestId,
          accountHmac,
          clientIp: ctx.clientIp,
          userAgent: ctx.userAgent,
          internalReason: gate.blockedBy ?? "lockout_active",
          meta: {
            retry_after_seconds: gate.retryAfterSeconds,
            attack_mode: gate.attackModeActive,
          },
        });
        return {
          ok: false,
          error: UNIFORM_LOCKOUT_ERROR,
          statusCode: 429,
          retryAfterSeconds: gate.retryAfterSeconds,
        };
      }

      // 2. Verificação CAPTCHA quando exigida (modo ataque ou degrau pré-bloqueio para dispositivo desconhecido)
      if (gate.requiresCaptcha) {
        const captchaRes = await verifyCaptchaTokenServer({
          token: parsed.data.captchaToken,
          remoteIp: ctx.clientIp,
        });
        if (!captchaRes.ok) {
          logAuthEvent({
            event: "captcha_failed",
            requestId: ctx.requestId,
            accountHmac,
            clientIp: ctx.clientIp,
            userAgent: ctx.userAgent,
            internalReason: captchaRes.reason ?? "captcha_rejected",
            meta: { attack_mode: gate.attackModeActive },
          });
          return {
            ok: false,
            error: UNIFORM_CAPTCHA_ERROR,
            statusCode: 403,
            captchaRequired: true,
          };
        }
      }

      // 3. Verificação em tempo equalizado (sempre executa scrypt, mesmo para e-mails inexistentes)
      const store = getMemoryStore();
      const userId = store.userIdByEmail.get(normalizedEmail);
      const ws = userId ? store.usersById.get(userId) : undefined;

      const targetHash = ws ? ws.passwordHashSim : DUMMY_PASSWORD_HASH;
      const passwordValid = await verifyPasswordAsync(
        parsed.data.password,
        targetHash
      );

      // 4. Caso especial anti-enumeração: senha correta + e-mail não confirmado
      // Nunca revela que o e-mail não está confirmado; devolve a mesma mensagem e reenvia em background com rate limit.
      if (ws && passwordValid && ws.emailConfirmed === false) {
        logAuthEvent({
          event: "login_failed",
          requestId: ctx.requestId,
          accountHmac,
          clientIp: ctx.clientIp,
          userAgent: ctx.userAgent,
          internalReason: "email_not_confirmed",
        });
        await dispatchAuthEmail({
          kind: "email_confirmation",
          toEmail: ws.profile.email,
          accountHmac,
          requestId: ctx.requestId,
          clientIp: ctx.clientIp,
          userAgent: ctx.userAgent,
        });
        return {
          ok: false,
          error: UNIFORM_INVALID_CREDENTIALS_ERROR,
          statusCode: 401,
        };
      }

      // 5. Credenciais inválidas (e-mail inexistente OU senha incorreta) -> mesma lógica, mesmo contador, mesma mensagem
      if (!ws || !passwordValid) {
        const failure = recordAuthFailureAtomic({
          accountHmac,
          clientIp: ctx.clientIp,
          knownDeviceId: ctx.knownDeviceId,
        });

        logAuthEvent({
          event: "login_failed",
          requestId: ctx.requestId,
          accountHmac,
          clientIp: ctx.clientIp,
          userAgent: ctx.userAgent,
          internalReason: ws ? "invalid_password" : "account_not_found",
          meta: {
            lockout_started: failure.accountLockoutStarted,
            lockout_level: failure.accountLockoutLevel,
            attack_mode: failure.attackModeActive,
          },
        });

        if (failure.attackModeTriggeredNow) {
          logAuthEvent({
            event: "attack_mode_triggered",
            requestId: ctx.requestId,
            accountHmac,
            clientIp: ctx.clientIp,
            userAgent: ctx.userAgent,
            internalReason: "distributed_or_stuffing_threshold_exceeded",
          });
        }

        if (failure.accountLockoutStarted || failure.accountWasAlreadyLocked) {
          if (failure.accountLockoutStarted) {
            logAuthEvent({
              event: "lockout_started",
              requestId: ctx.requestId,
              accountHmac,
              clientIp: ctx.clientIp,
              userAgent: ctx.userAgent,
              internalReason: "consecutive_failures_threshold_reached",
              meta: {
                level: failure.accountLockoutLevel,
                retry_after_seconds: failure.accountRetryAfterSeconds,
              },
            });
            // Envia alerta ao dono no 1º bloqueio (somente se a conta existir, sem revelar na resposta)
            if (failure.shouldSendLockoutAlert && ws) {
              await dispatchAuthEmail({
                kind: "lockout_alert",
                toEmail: ws.profile.email,
                accountHmac,
                requestId: ctx.requestId,
                clientIp: ctx.clientIp,
                userAgent: ctx.userAgent,
              });
            }
          }
          return {
            ok: false,
            error: UNIFORM_LOCKOUT_ERROR,
            statusCode: 429,
            retryAfterSeconds: failure.accountRetryAfterSeconds,
          };
        }

        return {
          ok: false,
          error: UNIFORM_INVALID_CREDENTIALS_ERROR,
          statusCode: 401,
        };
      }

      // 6. Sucesso: zera contadores de falha e nível de bloqueio
      recordAuthSuccessAtomic({
        accountHmac,
        clientIp: ctx.clientIp,
        knownDeviceId: ctx.knownDeviceId,
      });

      // Migra registros legados sem hash para scrypt salgado no login bem-sucedido
      if (!isHashedPassword(ws.passwordHashSim)) {
        const upgraded = await hashPasswordAsync(parsed.data.password);
        ws.passwordHashSim = upgraded;
        await ormUpdateUser(ws.profile.id, { passwordHash: upgraded }).catch(
          () => {}
        );
      }

      if (!internalContext?.skipCookieWrite) {
        await createSessionCookie(
          ws.profile.id,
          rawInput.rememberMe ?? true,
          ctx.knownDeviceId
        );
        revalidatePath("/", "layout");
      }

      logAuthEvent({
        event: "login_success",
        requestId: ctx.requestId,
        accountHmac,
        clientIp: ctx.clientIp,
        userAgent: ctx.userAgent,
        internalReason: "credentials_verified",
        meta: { known_device: Boolean(ctx.knownDeviceId) },
      });

      return { ok: true, needsOnboarding: !ws.profile.onboardingCompleted };
    }
  );

  await equalizeAuthResponseTime(startedAtMs);
  return outcome;
}

export async function signUpAction(
  rawInput: {
    email: string;
    password: string;
    displayName?: string;
    confirmMinimumAge16?: boolean;
    acceptTerms?: boolean;
    captchaToken?: string;
  },
  internalContext?: {
    clientIp?: string;
    userAgent?: string | null;
    requestId?: string;
    uniformNoSession?: boolean;
  }
): Promise<
  | { ok: true; message: string; requiresConfirmation?: boolean }
  | {
      ok: false;
      error: string;
      statusCode?: number;
      retryAfterSeconds?: number;
    }
> {
  const startedAtMs = performance.now();
  const cfg = getAuthSecurityConfig();
  const ctx = await readSafeRequestContext(internalContext);

  const parsed = signUpSchema.safeParse(rawInput);
  if (!parsed.success) {
    await equalizeAuthResponseTime(startedAtMs);
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
      statusCode: 400,
    };
  }

  const emailKey = normalizeEmailForIdentity(parsed.data.email);
  const accountHmac = computeAccountHmac(emailKey);

  const gate = evaluatePreAuthGate({
    accountHmac,
    clientIp: ctx.clientIp,
    knownDeviceId: ctx.knownDeviceId,
  });
  if (!gate.allowed) {
    logAuthEvent({
      event: "lockout_blocked",
      requestId: ctx.requestId,
      accountHmac,
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
      internalReason: "signup_rate_limited",
    });
    await equalizeAuthResponseTime(startedAtMs);
    return {
      ok: false,
      error: UNIFORM_LOCKOUT_ERROR,
      statusCode: 429,
      retryAfterSeconds: gate.retryAfterSeconds,
    };
  }

  if (gate.requiresCaptcha) {
    const captchaRes = await verifyCaptchaTokenServer({
      token: parsed.data.captchaToken,
      remoteIp: ctx.clientIp,
    });
    if (!captchaRes.ok) {
      logAuthEvent({
        event: "captcha_failed",
        requestId: ctx.requestId,
        accountHmac,
        clientIp: ctx.clientIp,
        userAgent: ctx.userAgent,
        internalReason: captchaRes.reason ?? "signup_captcha_failed",
      });
      await equalizeAuthResponseTime(startedAtMs);
      return {
        ok: false,
        error: UNIFORM_CAPTCHA_ERROR,
        statusCode: 403,
      };
    }
  }

  // Verificação k-anonymity no Pwned Passwords (somente no servidor)
  const pwned = await checkPwnedPasswordServer(parsed.data.password);
  if (pwned.compromised) {
    logAuthEvent({
      event: "signup_requested",
      requestId: ctx.requestId,
      accountHmac,
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
      internalReason: "password_compromised_hibp",
    });
    await equalizeAuthResponseTime(startedAtMs);
    return {
      ok: false,
      error: UNIFORM_PWNED_PASSWORD_ERROR,
      statusCode: 400,
    };
  }

  const store = getMemoryStore();
  // Anti-enumeração: se o e-mail já existe, NÃO informa erro nem sobrescreve a conta.
  // Executa trabalho equivalente de hash, envia aviso silencioso ao dono e retorna resposta uniforme.
  if (store.userIdByEmail.has(emailKey)) {
    await hashPasswordAsync(parsed.data.password);
    await dispatchAuthEmail({
      kind: "signup_existing_account_notice",
      toEmail: emailKey,
      accountHmac,
      requestId: ctx.requestId,
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
    });
    logAuthEvent({
      event: "signup_requested",
      requestId: ctx.requestId,
      accountHmac,
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
      internalReason: "email_already_registered_suppressed",
    });
    await equalizeAuthResponseTime(startedAtMs);
    return {
      ok: true,
      requiresConfirmation: true,
      message: UNIFORM_INSTRUCTIONS_SENT_MESSAGE,
    };
  }

  const userId = `user-${crypto.randomUUID()}`;
  const nowIso = new Date().toISOString();
  const cleanName = parsed.data.displayName
    ? sanitizePlainText(parsed.data.displayName, 60)
    : (emailKey.split("@")[0] ?? "Leitor");

  const passwordHash = await hashPasswordAsync(parsed.data.password);
  const defaultShelves = createDefaultShelves(userId);
  const needsConfirmation =
    cfg.requireEmailConfirmation || Boolean(internalContext?.uniformNoSession);
  const newProfile = {
    id: userId,
    email: emailKey,
    displayName: cleanName,
    locale: "pt-BR" as const,
    timezone: "America/Sao_Paulo",
    defaultCurrency: "BRL" as const,
    theme: "light" as const,
    threeD: "auto" as const,
    goalsCountRereads: false,
    maxSimultaneousReadings: 5,
    telemetryOptOut: false,
    onboardingCompleted: false,
    preferredFormats: ["physical", "digital", "audio"] as Array<
      "physical" | "digital" | "audio"
    >,
    acceptedTermsVersion: CURRENT_TERMS_VERSION,
    acceptedTermsAt: nowIso,
  };
  store.usersById.set(userId, {
    profile: newProfile,
    passwordHashSim: passwordHash,
    emailConfirmed: !needsConfirmation,
    works: [],
    editions: [],
    shelves: defaultShelves,
    items: [],
    wishlist: [],
    readings: [],
    reviews: [],
    goals: [],
    importJobs: [],
    settings: createDefaultUserSettings(newProfile),
    uploadedCovers: {},
  });
  store.userIdByEmail.set(emailKey, userId);

  await ormCreateUser({
    id: userId,
    email: emailKey,
    displayName: cleanName,
    passwordHash,
    locale: "pt-BR",
    timezone: "America/Sao_Paulo",
    theme: "light",
    defaultCurrency: "BRL",
    threeD: "auto",
    goalsCountRereads: false,
    maxSimultaneousReadings: 5,
    telemetryOptOut: false,
    onboardingCompleted: false,
    acceptedTermsVersion: CURRENT_TERMS_VERSION,
    acceptedTermsAt: nowIso,
    createdAt: nowIso,
  }).catch(() => {});
  await ormInsertShelves(defaultShelves).catch(() => {});

  logAuthEvent({
    event: "signup_requested",
    requestId: ctx.requestId,
    accountHmac,
    clientIp: ctx.clientIp,
    userAgent: ctx.userAgent,
    internalReason: "account_created",
  });

  if (needsConfirmation) {
    await dispatchAuthEmail({
      kind: "email_confirmation",
      toEmail: emailKey,
      accountHmac,
      requestId: ctx.requestId,
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
    });
    await equalizeAuthResponseTime(startedAtMs);
    return {
      ok: true,
      requiresConfirmation: true,
      message: UNIFORM_INSTRUCTIONS_SENT_MESSAGE,
    };
  }

  await createSessionCookie(userId);
  revalidatePath("/", "layout");
  await equalizeAuthResponseTime(startedAtMs);
  return {
    ok: true,
    requiresConfirmation: false,
    message: UNIFORM_INSTRUCTIONS_SENT_MESSAGE,
  };
}

export async function requestPasswordResetAction(
  rawInput: {
    email: string;
    captchaToken?: string;
  },
  internalContext?: {
    clientIp?: string;
    userAgent?: string | null;
    requestId?: string;
  }
): Promise<
  | { ok: true; message: string }
  | {
      ok: false;
      error: string;
      statusCode?: number;
      retryAfterSeconds?: number;
    }
> {
  const startedAtMs = performance.now();
  const ctx = await readSafeRequestContext(internalContext);

  const parsed = requestPasswordResetSchema.safeParse(rawInput);
  if (!parsed.success) {
    await equalizeAuthResponseTime(startedAtMs);
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Informe um e-mail válido.",
      statusCode: 400,
    };
  }

  const emailKey = normalizeEmailForIdentity(parsed.data.email);
  const accountHmac = computeAccountHmac(emailKey);

  const gate = evaluatePreAuthGate({
    accountHmac,
    clientIp: ctx.clientIp,
    knownDeviceId: ctx.knownDeviceId,
  });
  if (!gate.allowed) {
    logAuthEvent({
      event: "lockout_blocked",
      requestId: ctx.requestId,
      accountHmac,
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
      internalReason: "password_reset_rate_limited",
    });
    await equalizeAuthResponseTime(startedAtMs);
    return {
      ok: false,
      error: UNIFORM_LOCKOUT_ERROR,
      statusCode: 429,
      retryAfterSeconds: gate.retryAfterSeconds,
    };
  }

  const store = getMemoryStore();
  const userId = store.userIdByEmail.get(emailKey);
  if (userId && store.usersById.has(userId)) {
    // Segredo de recuperação armazenado com Argon2id + sal aleatório (nunca logado em texto puro)
    const issued = await issueOneTimeAuthSecret({
      purpose: "password_reset",
      accountHmac,
      userId,
      ttlMs: PASSWORD_RESET_TTL_MS,
    });
    await dispatchAuthEmail({
      kind: "password_reset",
      toEmail: emailKey,
      accountHmac,
      requestId: ctx.requestId,
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
      secretCodeForDelivery: issued.rawSecret,
    });
    logAuthEvent({
      event: "password_reset_requested",
      requestId: ctx.requestId,
      accountHmac,
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
      internalReason: "reset_token_issued",
    });
  } else {
    // Executa derivação Argon2id dummy para manter custo de CPU e latência indistinguíveis
    await hashAppSecretArgon2id(crypto.randomBytes(24).toString("hex"));
    logAuthEvent({
      event: "password_reset_requested",
      requestId: ctx.requestId,
      accountHmac,
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
      internalReason: "account_not_found_suppressed",
    });
  }

  await equalizeAuthResponseTime(startedAtMs);
  return {
    ok: true,
    message: UNIFORM_INSTRUCTIONS_SENT_MESSAGE,
  };
}

export async function resetPasswordAction(
  rawInput: {
    email: string;
    token: string;
    password: string;
  },
  internalContext?: {
    clientIp?: string;
    userAgent?: string | null;
    requestId?: string;
  }
): Promise<
  | { ok: true }
  | {
      ok: false;
      error: string;
      statusCode?: number;
      retryAfterSeconds?: number;
    }
> {
  const startedAtMs = performance.now();
  const ctx = await readSafeRequestContext(internalContext);

  const parsed = resetPasswordSchema.safeParse(rawInput);
  if (!parsed.success) {
    await equalizeAuthResponseTime(startedAtMs);
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
      statusCode: 400,
    };
  }

  const emailKey = normalizeEmailForIdentity(parsed.data.email);
  const accountHmac = computeAccountHmac(emailKey);

  const gate = evaluatePreAuthGate({
    accountHmac,
    clientIp: ctx.clientIp,
    knownDeviceId: ctx.knownDeviceId,
  });
  if (!gate.allowed) {
    logAuthEvent({
      event: "lockout_blocked",
      requestId: ctx.requestId,
      accountHmac,
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
      internalReason: "reset_confirm_rate_limited",
    });
    await equalizeAuthResponseTime(startedAtMs);
    return {
      ok: false,
      error: UNIFORM_LOCKOUT_ERROR,
      statusCode: 429,
      retryAfterSeconds: gate.retryAfterSeconds,
    };
  }

  const pwned = await checkPwnedPasswordServer(parsed.data.password);
  if (pwned.compromised) {
    await equalizeAuthResponseTime(startedAtMs);
    return {
      ok: false,
      error: UNIFORM_PWNED_PASSWORD_ERROR,
      statusCode: 400,
    };
  }

  const store = getMemoryStore();
  const userId = store.userIdByEmail.get(emailKey);
  const ws = userId ? store.usersById.get(userId) : undefined;

  // 1. Verifica token Argon2id em auth_secrets
  const argonCheck = await consumeOneTimeAuthSecret({
    purpose: "password_reset",
    accountHmac,
    rawSecret: parsed.data.token,
  });

  // 2. Fallback legado compatível apenas para registros antigos em memória já emitidos
  let legacyMatched = false;
  if (!argonCheck.valid && ws) {
    const legacyHash = hashResetToken(parsed.data.token);
    const legacyRecord = store.passwordResetTokens.get(legacyHash);
    if (
      legacyRecord &&
      legacyRecord.userId === ws.profile.id &&
      legacyRecord.expiresAtMs > Date.now()
    ) {
      store.passwordResetTokens.delete(legacyHash);
      legacyMatched = true;
    } else if (legacyRecord && legacyRecord.expiresAtMs <= Date.now()) {
      store.passwordResetTokens.delete(legacyHash);
    }
  }

  if (
    !ws ||
    (!legacyMatched &&
      (!argonCheck.valid || argonCheck.userId !== ws.profile.id))
  ) {
    recordAuthFailureAtomic({
      accountHmac,
      clientIp: ctx.clientIp,
      knownDeviceId: ctx.knownDeviceId,
    });
    logAuthEvent({
      event: "login_failed",
      requestId: ctx.requestId,
      accountHmac,
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
      internalReason: "invalid_or_expired_reset_token",
    });
    await equalizeAuthResponseTime(startedAtMs);
    return {
      ok: false,
      error:
        "Código de verificação inválido ou expirado. Solicite um novo código.",
      statusCode: 400,
    };
  }

  const nextHash = await hashPasswordAsync(parsed.data.password);
  ws.passwordHashSim = nextHash;

  // Revoga todas as sessões ativas do usuário após redefinição de senha
  for (const [sessionToken, uid] of store.sessions.entries()) {
    if (uid === ws.profile.id) {
      store.sessions.delete(sessionToken);
      store.sessionCreatedAt.delete(sessionToken);
    }
  }

  await ormUpdateUser(ws.profile.id, { passwordHash: nextHash }).catch(
    () => {}
  );
  await ormDeleteSessionsByUserId(ws.profile.id).catch(() => {});

  recordAuthSuccessAtomic({
    accountHmac,
    clientIp: ctx.clientIp,
    knownDeviceId: ctx.knownDeviceId,
  });

  await dispatchAuthEmail({
    kind: "password_changed_notice",
    toEmail: ws.profile.email,
    accountHmac,
    requestId: ctx.requestId,
    clientIp: ctx.clientIp,
    userAgent: ctx.userAgent,
  });

  logAuthEvent({
    event: "password_reset_completed",
    requestId: ctx.requestId,
    accountHmac,
    clientIp: ctx.clientIp,
    userAgent: ctx.userAgent,
    internalReason: "password_updated_all_sessions_revoked",
  });

  await equalizeAuthResponseTime(startedAtMs);
  return { ok: true };
}

/**
 * Troca de senha autenticado:
 * - Exige senha atual OU sessão recente (<= 15 minutos).
 * - Valida política de >= 12 caracteres, <= 72 bytes UTF-8, sem senhas comuns e HIBP k-anonymity.
 * - Encerra todas as OUTRAS sessões do usuário e envia aviso por e-mail.
 */
export async function changePasswordAction(
  rawInput: {
    currentPassword?: string;
    newPassword: string;
  },
  internalContext?: {
    clientIp?: string;
    userAgent?: string | null;
    requestId?: string;
  }
): Promise<
  | { ok: true; revokedOtherSessions: number }
  | { ok: false; error: string; statusCode?: number }
> {
  const startedAtMs = performance.now();
  const ctx = await readSafeRequestContext(internalContext);
  const ws = await requireAuthenticatedWorkspace();

  const parsed = changePasswordSchema.safeParse(rawInput);
  if (!parsed.success) {
    await equalizeAuthResponseTime(startedAtMs);
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
      statusCode: 400,
    };
  }

  const cookieStore = await cookies();
  const currentSessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const store = getMemoryStore();
  const accountHmac = computeAccountHmac(ws.profile.email);

  const sessionCreatedMs = currentSessionToken
    ? (store.sessionCreatedAt.get(currentSessionToken) ?? 0)
    : 0;
  const hasRecentSession =
    sessionCreatedMs > 0 &&
    Date.now() - sessionCreatedMs <= RECENT_SESSION_WINDOW_MS;

  if (parsed.data.currentPassword) {
    const validCurrent = await verifyPasswordAsync(
      parsed.data.currentPassword,
      ws.passwordHashSim
    );
    if (!validCurrent) {
      logAuthEvent({
        event: "login_failed",
        requestId: ctx.requestId,
        accountHmac,
        clientIp: ctx.clientIp,
        userAgent: ctx.userAgent,
        internalReason: "change_password_invalid_current",
      });
      await equalizeAuthResponseTime(startedAtMs);
      return {
        ok: false,
        error: "Senha atual incorreta.",
        statusCode: 401,
      };
    }
  } else if (!hasRecentSession) {
    await equalizeAuthResponseTime(startedAtMs);
    return {
      ok: false,
      error:
        "Para trocar sua senha, informe sua senha atual ou faça login novamente.",
      statusCode: 401,
    };
  }

  const pwned = await checkPwnedPasswordServer(parsed.data.newPassword);
  if (pwned.compromised) {
    await equalizeAuthResponseTime(startedAtMs);
    return {
      ok: false,
      error: UNIFORM_PWNED_PASSWORD_ERROR,
      statusCode: 400,
    };
  }

  const nextHash = await hashPasswordAsync(parsed.data.newPassword);
  ws.passwordHashSim = nextHash;

  // Encerra todas as OUTRAS sessões do usuário, mantendo apenas a sessão atual
  let revokedOtherSessions = 0;
  for (const [sessionToken, uid] of Array.from(store.sessions.entries())) {
    if (uid === ws.profile.id && sessionToken !== currentSessionToken) {
      store.sessions.delete(sessionToken);
      store.sessionCreatedAt.delete(sessionToken);
      await ormDeleteSession(sessionToken).catch(() => {});
      revokedOtherSessions += 1;
    }
  }

  await ormUpdateUser(ws.profile.id, { passwordHash: nextHash }).catch(
    () => {}
  );

  await dispatchAuthEmail({
    kind: "password_changed_notice",
    toEmail: ws.profile.email,
    accountHmac,
    requestId: ctx.requestId,
    clientIp: ctx.clientIp,
    userAgent: ctx.userAgent,
  });

  logAuthEvent({
    event: "password_changed",
    requestId: ctx.requestId,
    accountHmac,
    clientIp: ctx.clientIp,
    userAgent: ctx.userAgent,
    internalReason: "password_changed_other_sessions_revoked",
    meta: { revoked_other_sessions: revokedOtherSessions },
  });

  await equalizeAuthResponseTime(startedAtMs);
  return { ok: true, revokedOtherSessions };
}

/**
 * Fluxo uniforme de Link Mágico / OTP:
 * Sempre retorna a mesma resposta ("Se o e-mail existir, enviaremos instruções.")
 * com tempo equalizado e código armazenado em Argon2id.
 */
export async function requestMagicLinkAction(
  rawInput: {
    email: string;
    captchaToken?: string;
  },
  internalContext?: {
    clientIp?: string;
    userAgent?: string | null;
    requestId?: string;
  }
): Promise<
  | { ok: true; message: string }
  | {
      ok: false;
      error: string;
      statusCode?: number;
      retryAfterSeconds?: number;
    }
> {
  const startedAtMs = performance.now();
  const ctx = await readSafeRequestContext(internalContext);

  const parsed = requestMagicLinkSchema.safeParse(rawInput);
  if (!parsed.success) {
    await equalizeAuthResponseTime(startedAtMs);
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Informe um e-mail válido.",
      statusCode: 400,
    };
  }

  const emailKey = normalizeEmailForIdentity(parsed.data.email);
  const accountHmac = computeAccountHmac(emailKey);

  const gate = evaluatePreAuthGate({
    accountHmac,
    clientIp: ctx.clientIp,
    knownDeviceId: ctx.knownDeviceId,
  });
  if (!gate.allowed) {
    logAuthEvent({
      event: "lockout_blocked",
      requestId: ctx.requestId,
      accountHmac,
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
      internalReason: "magic_link_rate_limited",
    });
    await equalizeAuthResponseTime(startedAtMs);
    return {
      ok: false,
      error: UNIFORM_LOCKOUT_ERROR,
      statusCode: 429,
      retryAfterSeconds: gate.retryAfterSeconds,
    };
  }

  const store = getMemoryStore();
  const userId = store.userIdByEmail.get(emailKey);
  if (userId && store.usersById.has(userId)) {
    const issued = await issueOneTimeAuthSecret({
      purpose: "magic_link_otp",
      accountHmac,
      userId,
      ttlMs: MAGIC_LINK_TTL_MS,
    });
    await dispatchAuthEmail({
      kind: "magic_link_otp",
      toEmail: emailKey,
      accountHmac,
      requestId: ctx.requestId,
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
      secretCodeForDelivery: issued.rawSecret,
    });
    logAuthEvent({
      event: "magic_link_requested",
      requestId: ctx.requestId,
      accountHmac,
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
      internalReason: "magic_link_otp_issued",
    });
  } else {
    await hashAppSecretArgon2id(crypto.randomBytes(24).toString("hex"));
    logAuthEvent({
      event: "magic_link_requested",
      requestId: ctx.requestId,
      accountHmac,
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
      internalReason: "account_not_found_suppressed",
    });
  }

  await equalizeAuthResponseTime(startedAtMs);
  return {
    ok: true,
    message: UNIFORM_INSTRUCTIONS_SENT_MESSAGE,
  };
}

export async function verifyMagicLinkAction(
  rawInput: {
    email: string;
    code: string;
  },
  internalContext?: {
    clientIp?: string;
    userAgent?: string | null;
    requestId?: string;
  }
): Promise<SignInActionResult> {
  const startedAtMs = performance.now();
  const ctx = await readSafeRequestContext(internalContext);

  const parsed = verifyMagicLinkSchema.safeParse(rawInput);
  if (!parsed.success) {
    await equalizeAuthResponseTime(startedAtMs);
    return {
      ok: false,
      error: UNIFORM_INVALID_CREDENTIALS_ERROR,
      statusCode: 401,
    };
  }

  const emailKey = normalizeEmailForIdentity(parsed.data.email);
  const accountHmac = computeAccountHmac(emailKey);

  const gate = evaluatePreAuthGate({
    accountHmac,
    clientIp: ctx.clientIp,
    knownDeviceId: ctx.knownDeviceId,
  });
  if (!gate.allowed) {
    await equalizeAuthResponseTime(startedAtMs);
    return {
      ok: false,
      error: UNIFORM_LOCKOUT_ERROR,
      statusCode: 429,
      retryAfterSeconds: gate.retryAfterSeconds,
    };
  }

  const store = getMemoryStore();
  const userId = store.userIdByEmail.get(emailKey);
  const ws = userId ? store.usersById.get(userId) : undefined;

  const check = await consumeOneTimeAuthSecret({
    purpose: "magic_link_otp",
    accountHmac,
    rawSecret: parsed.data.code,
  });

  if (!ws || !check.valid || check.userId !== ws.profile.id) {
    const failure = recordAuthFailureAtomic({
      accountHmac,
      clientIp: ctx.clientIp,
      knownDeviceId: ctx.knownDeviceId,
    });
    logAuthEvent({
      event: "login_failed",
      requestId: ctx.requestId,
      accountHmac,
      clientIp: ctx.clientIp,
      userAgent: ctx.userAgent,
      internalReason: "invalid_magic_link_otp",
    });
    await equalizeAuthResponseTime(startedAtMs);
    if (failure.accountLockoutStarted) {
      return {
        ok: false,
        error: UNIFORM_LOCKOUT_ERROR,
        statusCode: 429,
        retryAfterSeconds: failure.accountRetryAfterSeconds,
      };
    }
    return {
      ok: false,
      error: UNIFORM_INVALID_CREDENTIALS_ERROR,
      statusCode: 401,
    };
  }

  ws.emailConfirmed = true;
  recordAuthSuccessAtomic({
    accountHmac,
    clientIp: ctx.clientIp,
    knownDeviceId: ctx.knownDeviceId,
  });
  await createSessionCookie(ws.profile.id, true, ctx.knownDeviceId);
  revalidatePath("/", "layout");

  logAuthEvent({
    event: "login_success",
    requestId: ctx.requestId,
    accountHmac,
    clientIp: ctx.clientIp,
    userAgent: ctx.userAgent,
    internalReason: "magic_link_otp_verified",
  });

  await equalizeAuthResponseTime(startedAtMs);
  return { ok: true, needsOnboarding: !ws.profile.onboardingCompleted };
}

export async function completeOnboardingAction(rawInput: {
  goal: "organize" | "read_more" | "track_formats";
  preferredFormats: Array<"physical" | "digital" | "audio">;
  annualTargetBooks?: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = onboardingSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  ws.profile.onboardingGoal = parsed.data.goal;
  ws.profile.preferredFormats = parsed.data.preferredFormats;
  ws.profile.onboardingCompleted = true;

  if (parsed.data.annualTargetBooks && ws.goals.length === 0) {
    const year = Number(
      formatDateInTimezone(new Date(), ws.profile.timezone).slice(0, 4)
    );
    ws.goals.push({
      id: `goal-${crypto.randomUUID()}`,
      userId: ws.profile.id,
      title: `Meta Anual ${year}`,
      kind: "books",
      period: "year",
      startsOn: `${year}-01-01`,
      endsOn: `${year}-12-31`,
      targetValue: parsed.data.annualTargetBooks,
      tolerancePercent: 5,
      countRereads: ws.profile.goalsCountRereads,
      createdAt: new Date().toISOString(),
    });
  }

  await ormUpdateUser(ws.profile.id, { onboardingCompleted: true }).catch(
    () => {}
  );

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateThemePreferencesAction(rawInput: {
  theme?: ThemePreference;
  density?: DensityPreference;
  motion?: MotionPreference;
  fx?: FxPreference;
}): Promise<
  | {
      ok: true;
      theme?: ThemePreference;
      density?: DensityPreference;
      motion?: MotionPreference;
      fx?: FxPreference;
      persistedToProfile: boolean;
    }
  | { ok: false; error: string }
> {
  const parsed = updateThemePreferencesSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "Preferências de tema inválidas.",
    };
  }

  const nextTheme = parsed.data.theme
    ? normalizeThemePreference(parsed.data.theme)
    : undefined;
  const nextDensity = parsed.data.density
    ? normalizeDensityPreference(parsed.data.density)
    : undefined;
  const nextMotion = parsed.data.motion
    ? normalizeMotionPreference(parsed.data.motion)
    : undefined;
  const nextFx = parsed.data.fx
    ? normalizeFxPreference(parsed.data.fx)
    : undefined;

  await writeThemePreferenceCookies({
    theme: nextTheme,
    density: nextDensity,
    motion: nextMotion,
    fx: nextFx,
  });

  const ws = await getAuthenticatedWorkspace();
  if (ws) {
    ws.profile = {
      ...ws.profile,
      ...(nextTheme ? { theme: nextTheme } : {}),
      ...(nextDensity ? { density: nextDensity } : {}),
      ...(nextMotion ? { motion: nextMotion } : {}),
      ...(nextFx ? { fx: nextFx } : {}),
    };
    const settings = ensureWorkspaceSettings(ws);
    if (nextTheme) settings.theme = nextTheme;
    if (nextDensity) settings.density = nextDensity;
    if (nextMotion) settings.motion = nextMotion;
    if (nextFx) settings.fx = nextFx;
    settings.updatedAt = new Date().toISOString();
    invalidateUserWorkspaceCache(ws.profile.id);

    await ormUpdateUser(ws.profile.id, {
      ...(nextTheme ? { theme: nextTheme } : {}),
      ...(nextDensity ? { density: nextDensity } : {}),
      ...(nextMotion ? { motion: nextMotion } : {}),
    }).catch(() => {});
  }

  return {
    ok: true,
    theme: nextTheme,
    density: nextDensity,
    motion: nextMotion,
    fx: nextFx,
    persistedToProfile: Boolean(ws),
  };
}

export async function updateAmbientPreferencesAction(
  rawInput: AmbientPreferences
): Promise<
  { ok: true; persistedToProfile: boolean } | { ok: false; error: string }
> {
  const parsed = ambientPreferencesSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ??
        "Preferências de som ambiente inválidas.",
    };
  }

  const normalized = normalizeAmbientPreferences(parsed.data);
  const ws = await getAuthenticatedWorkspace();
  if (ws) {
    ws.profile = {
      ...ws.profile,
      focusAmbientPreferences: normalized,
    };
    const settings = ensureWorkspaceSettings(ws);
    settings.ambientPreferences = normalized;
    settings.updatedAt = new Date().toISOString();
    invalidateUserWorkspaceCache(ws.profile.id);
  }
  return { ok: true, persistedToProfile: Boolean(ws) };
}

export async function updateProfileAction(rawInput: {
  displayName?: string;
  timezone?: string;
  defaultCurrency?: "BRL" | "USD" | "EUR";
  theme?: ThemePreference;
  density?: DensityPreference;
  motion?: MotionPreference;
  fx?: FxPreference;
  threeD?: "auto" | "on" | "off";
  goalsCountRereads?: boolean;
  maxSimultaneousReadings?: number;
  telemetryOptOut?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = updateProfileSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  if (parsed.data.timezone && !isValidIanaTimezone(parsed.data.timezone)) {
    return { ok: false, error: "Fuso horário inválido." };
  }

  const normalizedTheme = parsed.data.theme
    ? normalizeThemePreference(parsed.data.theme)
    : undefined;
  const normalizedDensity = parsed.data.density
    ? normalizeDensityPreference(parsed.data.density)
    : undefined;
  const normalizedMotion = parsed.data.motion
    ? normalizeMotionPreference(parsed.data.motion)
    : undefined;
  const normalizedFx = parsed.data.fx
    ? normalizeFxPreference(parsed.data.fx)
    : undefined;

  ws.profile = {
    ...ws.profile,
    ...(parsed.data.displayName
      ? { displayName: sanitizePlainText(parsed.data.displayName, 60) }
      : {}),
    ...(parsed.data.timezone ? { timezone: parsed.data.timezone } : {}),
    ...(parsed.data.defaultCurrency
      ? { defaultCurrency: parsed.data.defaultCurrency }
      : {}),
    ...(normalizedTheme ? { theme: normalizedTheme } : {}),
    ...(normalizedDensity ? { density: normalizedDensity } : {}),
    ...(normalizedMotion ? { motion: normalizedMotion } : {}),
    ...(normalizedFx ? { fx: normalizedFx } : {}),
    ...(parsed.data.threeD ? { threeD: parsed.data.threeD } : {}),
    ...(parsed.data.goalsCountRereads !== undefined
      ? { goalsCountRereads: parsed.data.goalsCountRereads }
      : {}),
    ...(parsed.data.maxSimultaneousReadings !== undefined
      ? { maxSimultaneousReadings: parsed.data.maxSimultaneousReadings }
      : {}),
    ...(parsed.data.telemetryOptOut !== undefined
      ? { telemetryOptOut: parsed.data.telemetryOptOut }
      : {}),
  };

  if (
    normalizedTheme ||
    normalizedDensity ||
    normalizedMotion ||
    normalizedFx
  ) {
    const settings = ensureWorkspaceSettings(ws);
    if (normalizedTheme) settings.theme = normalizedTheme;
    if (normalizedDensity) settings.density = normalizedDensity;
    if (normalizedMotion) settings.motion = normalizedMotion;
    if (normalizedFx) settings.fx = normalizedFx;
    settings.updatedAt = new Date().toISOString();

    await writeThemePreferenceCookies({
      theme: normalizedTheme,
      density: normalizedDensity,
      motion: normalizedMotion,
      fx: normalizedFx,
    });
  }

  invalidateUserWorkspaceCache(ws.profile.id);

  await ormUpdateUser(ws.profile.id, {
    displayName: ws.profile.displayName,
    timezone: ws.profile.timezone,
    theme: ws.profile.theme,
    density: ws.profile.density ?? "comfortable",
    motion: ws.profile.motion ?? "system",
    defaultCurrency: ws.profile.defaultCurrency,
    threeD: ws.profile.threeD,
    goalsCountRereads: ws.profile.goalsCountRereads,
    maxSimultaneousReadings: ws.profile.maxSimultaneousReadings,
    telemetryOptOut: ws.profile.telemetryOptOut,
  }).catch(() => {});

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function signOutAction(): Promise<{ ok: true }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const store = getMemoryStore();
    store.sessions.delete(token);
    store.sessionCreatedAt.delete(token);
    await ormDeleteSession(token).catch(() => {});
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(DEMO_SESSION_COOKIE_NAME);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteMyAccountAction(rawInput: {
  confirmationPhrase: string;
}): Promise<
  { ok: true; retentionNotice: string } | { ok: false; error: string }
> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = deleteAccountSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ??
        'Digite "EXCLUIR MINHA CONTA" para confirmar.',
    };
  }

  await ormDeleteUser(ws.profile.id).catch(() => {});

  if (ws.uploadedCovers) {
    ws.uploadedCovers = {};
  }
  invalidateUserWorkspaceCache(ws.profile.id);

  const store = getMemoryStore();
  store.userIdByEmail.delete(ws.profile.email.toLowerCase());
  store.usersById.delete(ws.profile.id);

  for (const [token, uid] of store.sessions.entries()) {
    if (uid === ws.profile.id) {
      store.sessions.delete(token);
      store.sessionCreatedAt.delete(token);
    }
  }

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(DEMO_SESSION_COOKIE_NAME);
  revalidatePath("/", "layout");

  return {
    ok: true,
    retentionNotice:
      "Conta e acervo removidos imediatamente. Cópias de segurança criptografadas expiram em até 30 dias.",
  };
}

export async function undoLastAction(): Promise<
  { ok: true; message: string } | { ok: false; error: string }
> {
  const ws = await requireAuthenticatedWorkspace();
  if (!ws.lastUndoAction) {
    return {
      ok: false,
      error: "Nenhuma ação recente disponível para desfazer.",
    };
  }
  const label = ws.lastUndoAction.label;
  const snap = ws.lastUndoAction.restoreSnapshot;
  ws.works = snap.works;
  ws.editions = snap.editions;
  ws.shelves = snap.shelves;
  ws.items = snap.items;
  ws.wishlist = snap.wishlist;
  ws.readings = snap.readings;
  ws.reviews = snap.reviews;
  ws.goals = snap.goals;
  ws.importJobs = snap.importJobs;
  ws.lastUndoAction = undefined;
  invalidateUserWorkspaceCache(ws.profile.id);

  revalidatePath("/", "layout");
  return { ok: true, message: `Desfeito: ${label}` };
}
