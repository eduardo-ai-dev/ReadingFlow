"use server";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  DEMO_SESSION_COOKIE_NAME,
  DEMO_USER_ID,
  SESSION_COOKIE_NAME,
  createDefaultShelves,
  getAuthenticatedWorkspace,
  getMemoryStore,
  requireAuthenticatedWorkspace,
} from "@/server/store/memory-repository";
import {
  deleteAccountSchema,
  onboardingSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  updateProfileSchema,
  updateThemePreferencesSchema,
} from "@/features/auth/schema";
import {
  DENSITY_COOKIE_NAME,
  MOTION_COOKIE_NAME,
  THEME_COOKIE_NAME,
  normalizeDensityPreference,
  normalizeMotionPreference,
  normalizeThemePreference,
} from "@/lib/themes/themes.config";
import type {
  DensityPreference,
  MotionPreference,
  ThemePreference,
} from "@/lib/themes/themes.types";
import {
  CURRENT_TERMS_VERSION,
  isValidIanaTimezone,
} from "@/features/auth/rules";
import {
  checkSlidingRateLimit,
  sanitizePlainText,
} from "@/server/security/sanitize";
import {
  ormCreateSession,
  ormDeleteSession,
  ormCreateUser,
  ormInsertShelves,
  ormUpdateUser,
  ormDeleteUser,
} from "@/server/db/orm-repository";

async function writeThemePreferenceCookies(prefs: {
  theme?: ThemePreference;
  density?: DensityPreference;
  motion?: MotionPreference;
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
}

async function createSessionCookie(
  userId: string,
  rememberMe = true
): Promise<void> {
  const token = crypto.randomBytes(24).toString("hex");
  const store = getMemoryStore();
  store.sessions.set(token, userId);
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

  // Sincroniza o cookie com as preferências salvas no perfil do usuário (valendo entre dispositivos)
  const ws = store.usersById.get(userId);
  if (ws) {
    await writeThemePreferenceCookies({
      theme: ws.profile.theme,
      density: ws.profile.density ?? "comfortable",
      motion: ws.profile.motion ?? "system",
    });
  }
}

export async function signInDemoAction(): Promise<{
  ok: true;
  redirectTo: string;
}> {
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

export async function signInWithEmailAction(rawInput: {
  email: string;
  password: string;
  rememberMe?: boolean;
}): Promise<
  { ok: true; needsOnboarding: boolean } | { ok: false; error: string }
> {
  const parsed = signInSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const rl = checkSlidingRateLimit(
    `login:${parsed.data.email.toLowerCase()}`,
    15
  );
  if (!rl.allowed) {
    return {
      ok: false,
      error: `Muitas tentativas. Aguarde ${rl.retryAfterSeconds}s e tente novamente.`,
    };
  }

  const store = getMemoryStore();
  const userId = store.userIdByEmail.get(parsed.data.email.toLowerCase());
  const ws = userId ? store.usersById.get(userId) : undefined;

  // Generic error message so we never reveal whether an email exists (§11.2)
  if (!ws || ws.passwordHashSim !== parsed.data.password) {
    return { ok: false, error: "E-mail ou senha incorretos." };
  }

  await createSessionCookie(ws.profile.id, rawInput.rememberMe ?? true);
  revalidatePath("/", "layout");
  return { ok: true, needsOnboarding: !ws.profile.onboardingCompleted };
}

export async function signUpAction(rawInput: {
  email: string;
  password: string;
  displayName?: string;
  confirmMinimumAge16?: boolean;
  acceptTerms?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = signUpSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const emailKey = parsed.data.email.toLowerCase().trim();
  const rl = checkSlidingRateLimit(`signup:${emailKey}`, 10);
  if (!rl.allowed) {
    return {
      ok: false,
      error: "Muitas tentativas de cadastro. Aguarde um minuto.",
    };
  }

  const store = getMemoryStore();
  if (store.userIdByEmail.has(emailKey)) {
    return {
      ok: false,
      error: "Não foi possível concluir o cadastro com este e-mail.",
    };
  }

  const userId = `user-${crypto.randomUUID()}`;
  const nowIso = new Date().toISOString();
  const cleanName = parsed.data.displayName
    ? sanitizePlainText(parsed.data.displayName, 60)
    : emailKey.split("@")[0] ?? "Leitor";

  const defaultShelves = createDefaultShelves(userId);
  store.usersById.set(userId, {
    profile: {
      id: userId,
      email: emailKey,
      displayName: cleanName,
      locale: "pt-BR",
      timezone: "America/Sao_Paulo",
      defaultCurrency: "BRL",
      theme: "light",
      threeD: "auto",
      goalsCountRereads: false,
      maxSimultaneousReadings: 5,
      telemetryOptOut: false,
      onboardingCompleted: false,
      preferredFormats: ["physical", "digital", "audio"],
      acceptedTermsVersion: CURRENT_TERMS_VERSION,
      acceptedTermsAt: nowIso,
    },
    passwordHashSim: parsed.data.password,
    works: [],
    editions: [],
    shelves: defaultShelves,
    items: [],
    wishlist: [],
    readings: [],
    reviews: [],
    goals: [],
    importJobs: [],
  });
  store.userIdByEmail.set(emailKey, userId);

  await ormCreateUser({
    id: userId,
    email: emailKey,
    displayName: cleanName,
    passwordHash: parsed.data.password,
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

  await createSessionCookie(userId);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function resetPasswordAction(rawInput: {
  email: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = resetPasswordSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const emailKey = parsed.data.email.toLowerCase().trim();
  const rl = checkSlidingRateLimit(`reset:${emailKey}`, 10);
  if (!rl.allowed) {
    return {
      ok: false,
      error: "Muitas tentativas. Aguarde um minuto e tente novamente.",
    };
  }

  const store = getMemoryStore();
  const userId = store.userIdByEmail.get(emailKey);
  const ws = userId ? store.usersById.get(userId) : undefined;
  if (ws) {
    ws.passwordHashSim = parsed.data.password;
  }

  return { ok: true };
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
    const year = new Date().getFullYear();
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

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateThemePreferencesAction(rawInput: {
  theme?: ThemePreference;
  density?: DensityPreference;
  motion?: MotionPreference;
}): Promise<
  | {
      ok: true;
      theme?: ThemePreference;
      density?: DensityPreference;
      motion?: MotionPreference;
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

  // Sempre persiste nos cookies para a primeira renderização sem flash
  await writeThemePreferenceCookies({
    theme: nextTheme,
    density: nextDensity,
    motion: nextMotion,
  });

  // Se houver usuário autenticado, persiste também no perfil (sincronizado entre dispositivos)
  const ws = await getAuthenticatedWorkspace();
  if (ws) {
    ws.profile = {
      ...ws.profile,
      ...(nextTheme ? { theme: nextTheme } : {}),
      ...(nextDensity ? { density: nextDensity } : {}),
      ...(nextMotion ? { motion: nextMotion } : {}),
    };

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
    persistedToProfile: Boolean(ws),
  };
}

export async function updateProfileAction(rawInput: {
  displayName?: string;
  timezone?: string;
  defaultCurrency?: "BRL" | "USD" | "EUR";
  theme?: ThemePreference;
  density?: DensityPreference;
  motion?: MotionPreference;
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

  if (normalizedTheme || normalizedDensity || normalizedMotion) {
    await writeThemePreferenceCookies({
      theme: normalizedTheme,
      density: normalizedDensity,
      motion: normalizedMotion,
    });
  }

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
    getMemoryStore().sessions.delete(token);
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

  const store = getMemoryStore();
  store.userIdByEmail.delete(ws.profile.email.toLowerCase());
  store.usersById.delete(ws.profile.id);

  for (const [token, uid] of store.sessions.entries()) {
    if (uid === ws.profile.id) {
      store.sessions.delete(token);
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

  revalidatePath("/", "layout");
  return { ok: true, message: `Desfeito: ${label}` };
}
