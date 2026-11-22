"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  ensureWorkspaceSettings,
  invalidateUserWorkspaceCache,
  requireAuthenticatedWorkspace,
  saveUndoSnapshot,
} from "@/server/store/memory-repository";
import {
  EMPTY_PERSISTED_SHELF_LAYOUT,
  parsePersistedShelfLayout,
  type PersistedShelfLayout,
} from "@/features/shelves/arrange-shelves";
import {
  clampPaperHsl,
  deriveSpineAccentHex,
} from "@/features/catalog/spine-color-rules";
import {
  normalizeAmbientPreferences,
  type AmbientPreferences,
} from "@/features/reading/ambient-catalog";
import type { OnboardingGuideState, UserSettings } from "@/lib/domain";

const saveShelfCustomizationSchema = z.object({
  layout: z.unknown().nullable(),
  orderedItemIds: z.array(z.string().min(1)).max(5000).optional(),
  colorOverridesByItemId: z
    .record(z.string().min(1), z.string().regex(/^#[0-9A-Fa-f]{6}$/))
    .optional(),
});

/**
 * Operação ÚNICA de salvamento da personalização da Estante 3D vinculada à conta:
 * persiste `shelfLayout` em `user_settings`, reordena exemplares próprios e aplica
 * cores manuais de lombada na mesma operação, invalidando o cache do usuário.
 */
export async function saveShelfCustomizationAction(
  rawInput: unknown
): Promise<
  | { ok: true; layout: PersistedShelfLayout; updatedAt: string }
  | { ok: false; error: string }
> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = saveShelfCustomizationSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Configuração da estante inválida. Verifique os dados enviados.",
    };
  }

  const normalizedLayout: PersistedShelfLayout =
    parsed.data.layout === null
      ? structuredClone(EMPTY_PERSISTED_SHELF_LAYOUT)
      : parsePersistedShelfLayout(JSON.stringify(parsed.data.layout));

  saveUndoSnapshot(ws, "Personalização da Estante 3D");

  // 1. Reordenação atômica restrita aos exemplares da conta autenticada (deduplicada para jamais perder ou duplicar exemplares)
  if (parsed.data.orderedItemIds && parsed.data.orderedItemIds.length > 0) {
    const uniqueOrderedIds = Array.from(new Set(parsed.data.orderedItemIds));
    const ownedItemsById = new Map(
      ws.items
        .filter((it) => it.userId === ws.profile.id)
        .map((it) => [it.id, it])
    );
    const validOrdered = uniqueOrderedIds
      .map((id) => ownedItemsById.get(id))
      .filter((it): it is NonNullable<typeof it> => Boolean(it));

    if (validOrdered.length > 0) {
      const reorderedSet = new Set(validOrdered.map((it) => it.id));
      let cursor = 0;
      ws.items = ws.items.map((it) => {
        if (!reorderedSet.has(it.id)) return it;
        return validOrdered[cursor++] ?? it;
      });
      for (let i = 0; i < ws.items.length; i += 1) {
        ws.items[i]!.shelfPosition = i;
      }
    }
  }

  // 2. Cores manuais de lombada restritas às edições próprias da conta
  if (parsed.data.colorOverridesByItemId) {
    for (const [itemId, rawHex] of Object.entries(
      parsed.data.colorOverridesByItemId
    )) {
      const item = ws.items.find(
        (it) => it.id === itemId && it.userId === ws.profile.id
      );
      if (!item) continue;
      const edition = ws.editions.find(
        (e) =>
          e.id === item.editionId &&
          (e.ownerId === null || e.ownerId === ws.profile.id)
      );
      if (!edition) continue;
      const clamped = clampPaperHsl(rawHex);
      edition.coverColor = clamped;
      edition.coverAccentColor = deriveSpineAccentHex(
        clamped,
        edition.isbn13 ?? edition.workId ?? edition.id
      );
    }
  }

  // 3. Persiste o layout completo em user_settings da conta
  const settings = ensureWorkspaceSettings(ws);
  const updatedAt = new Date().toISOString();
  settings.shelfLayout = normalizedLayout;
  settings.updatedAt = updatedAt;

  invalidateUserWorkspaceCache(ws.profile.id);
  revalidatePath("/estante-3d");
  revalidatePath("/estante-3d/arrumar");
  revalidatePath("/painel");

  return {
    ok: true,
    layout: structuredClone(normalizedLayout),
    updatedAt,
  };
}

const importLegacyLocalSchema = z.object({
  shelfLayoutRaw: z.string().max(400_000).optional(),
  ambientPreferences: z.unknown().optional(),
});

/**
 * Importação única de dados antigos que estavam apenas em `localStorage` para a conta autenticada.
 */
export async function importLegacyLocalSettingsAction(
  rawInput: unknown
): Promise<
  { ok: true; settings: UserSettings } | { ok: false; error: string }
> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = importLegacyLocalSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Dados locais legados inválidos." };
  }

  const settings = ensureWorkspaceSettings(ws);
  let changed = false;

  if (parsed.data.shelfLayoutRaw) {
    const importedLayout = parsePersistedShelfLayout(
      parsed.data.shelfLayoutRaw
    );
    settings.shelfLayout = importedLayout;
    changed = true;
  }

  if (parsed.data.ambientPreferences) {
    const normalized = normalizeAmbientPreferences(
      parsed.data.ambientPreferences as Partial<AmbientPreferences>
    );
    settings.ambientPreferences = normalized;
    ws.profile.focusAmbientPreferences = normalized;
    changed = true;
  }

  if (changed) {
    settings.updatedAt = new Date().toISOString();
    invalidateUserWorkspaceCache(ws.profile.id);
    revalidatePath("/", "layout");
  }

  return { ok: true, settings: structuredClone(settings) };
}

const updateOnboardingGuideSchema = z.object({
  action: z.enum(["dismiss", "reopen", "complete_step"]),
  stepId: z.enum(["first_book", "annual_goal", "focus_corner"]).optional(),
});

/**
 * Persiste o estado do guia de primeiros passos em `user_settings` da conta autenticada.
 */
export async function updateOnboardingGuideAction(
  rawInput: unknown
): Promise<
  | { ok: true; onboardingGuide: OnboardingGuideState }
  | { ok: false; error: string }
> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = updateOnboardingGuideSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Ação de primeiros passos inválida.",
    };
  }

  const settings = ensureWorkspaceSettings(ws);
  const current: OnboardingGuideState = settings.onboardingGuide ?? {
    dismissed: false,
    reopened: false,
    completedSteps: [],
  };
  const nowIso = new Date().toISOString();

  if (parsed.data.action === "dismiss") {
    settings.onboardingGuide = {
      ...current,
      dismissed: true,
      reopened: false,
      dismissedAt: nowIso,
      updatedAt: nowIso,
    };
  } else if (parsed.data.action === "reopen") {
    settings.onboardingGuide = {
      ...current,
      dismissed: false,
      reopened: true,
      updatedAt: nowIso,
    };
  } else if (parsed.data.action === "complete_step" && parsed.data.stepId) {
    const nextSteps = Array.from(
      new Set([...current.completedSteps, parsed.data.stepId])
    );
    settings.onboardingGuide = {
      ...current,
      completedSteps: nextSteps,
      updatedAt: nowIso,
    };
  }

  settings.updatedAt = nowIso;
  invalidateUserWorkspaceCache(ws.profile.id);
  revalidatePath("/painel");
  revalidatePath("/configuracoes");

  return {
    ok: true,
    onboardingGuide: structuredClone(settings.onboardingGuide!),
  };
}

const updateHapticsSchema = z.object({
  hapticsEnabled: z.boolean(),
});

/**
 * Persiste preferência de feedback tátil leve no celular (`hapticsEnabled`) em `user_settings`.
 */
export async function updateHapticsPreferenceAction(
  rawInput: unknown
): Promise<
  { ok: true; hapticsEnabled: boolean } | { ok: false; error: string }
> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = updateHapticsSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Preferência de vibração inválida." };
  }

  const settings = ensureWorkspaceSettings(ws);
  settings.hapticsEnabled = parsed.data.hapticsEnabled;
  settings.updatedAt = new Date().toISOString();
  invalidateUserWorkspaceCache(ws.profile.id);
  revalidatePath("/configuracoes");

  return { ok: true, hapticsEnabled: settings.hapticsEnabled };
}
