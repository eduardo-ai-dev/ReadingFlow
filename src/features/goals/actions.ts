"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { DEMO_READONLY_ERROR } from "@/lib/auth-demo";
import {
  invalidateUserWorkspaceCache,
  isDemoWorkspace,
  requireAuthenticatedWorkspace,
  saveUndoSnapshot,
} from "@/server/store/memory-repository";
import {
  createGoalSchema,
  deleteGoalSchema,
  togglePauseGoalSchema,
  updateGoalSchema,
} from "@/features/goals/schema";
import { sanitizePlainText } from "@/server/security/sanitize";

function lastDayOfMonth(year: number, month1Based: number): number {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
}

export async function createGoalAction(
  rawInput: unknown
): Promise<{ ok: true; goalId: string } | { ok: false; error: string }> {
  const ws = await requireAuthenticatedWorkspace();
  if (isDemoWorkspace(ws)) {
    return { ok: false, error: DEMO_READONLY_ERROR };
  }
  const parsed = createGoalSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados da meta inválidos.",
    };
  }

  const data = parsed.data;
  let startsOn: string;
  let endsOn: string;

  if (data.period === "month") {
    const m = data.month ?? 1;
    const mm = String(m).padStart(2, "0");
    const lastDay = String(lastDayOfMonth(data.year, m)).padStart(2, "0");
    startsOn = `${data.year}-${mm}-01`;
    endsOn = `${data.year}-${mm}-${lastDay}`;
  } else {
    startsOn = `${data.year}-01-01`;
    endsOn = `${data.year}-12-31`;
  }

  const goalId = `goal-${crypto.randomUUID()}`;
  ws.goals.push({
    id: goalId,
    userId: ws.profile.id,
    title: sanitizePlainText(data.title, 100),
    kind: data.kind,
    period: data.period,
    startsOn,
    endsOn,
    targetValue: data.targetValue,
    tolerancePercent: 5,
    countRereads: data.countRereads,
    paused: false,
    createdAt: new Date().toISOString(),
  });

  invalidateUserWorkspaceCache(ws.profile.id);
  revalidatePath("/", "layout");
  return { ok: true, goalId };
}

export async function updateGoalAction(
  rawInput: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ws = await requireAuthenticatedWorkspace();
  if (isDemoWorkspace(ws)) {
    return { ok: false, error: DEMO_READONLY_ERROR };
  }
  const parsed = updateGoalSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados de ajuste inválidos.",
    };
  }

  const { goalId, title, targetValue, endsOn } = parsed.data;
  const goal = ws.goals.find(
    (g) => g.id === goalId && g.userId === ws.profile.id
  );
  if (!goal) {
    return { ok: false, error: "Meta não encontrada nesta conta." };
  }

  if (endsOn && endsOn < goal.startsOn) {
    return {
      ok: false,
      error: "A data final não pode ser anterior ao início da meta.",
    };
  }

  saveUndoSnapshot(ws, `Ajuste da meta "${goal.title}"`);
  if (title !== undefined) {
    goal.title = sanitizePlainText(title, 100);
  }
  if (targetValue !== undefined) {
    goal.targetValue = targetValue;
  }
  if (endsOn !== undefined) {
    goal.endsOn = endsOn;
  }

  invalidateUserWorkspaceCache(ws.profile.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function togglePauseGoalAction(
  rawInput: unknown
): Promise<{ ok: true; paused: boolean } | { ok: false; error: string }> {
  const ws = await requireAuthenticatedWorkspace();
  if (isDemoWorkspace(ws)) {
    return { ok: false, error: DEMO_READONLY_ERROR };
  }
  const parsed = togglePauseGoalSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Meta inválida." };
  }

  const goal = ws.goals.find(
    (g) => g.id === parsed.data.goalId && g.userId === ws.profile.id
  );
  if (!goal) {
    return { ok: false, error: "Meta não encontrada nesta conta." };
  }

  saveUndoSnapshot(
    ws,
    parsed.data.paused
      ? `Pausa da meta "${goal.title}"`
      : `Retomada da meta "${goal.title}"`
  );
  goal.paused = parsed.data.paused;
  goal.pausedAt = parsed.data.paused ? new Date().toISOString() : undefined;

  invalidateUserWorkspaceCache(ws.profile.id);
  revalidatePath("/", "layout");
  return { ok: true, paused: goal.paused };
}

export async function deleteGoalAction(
  rawInput: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ws = await requireAuthenticatedWorkspace();
  if (isDemoWorkspace(ws)) {
    return { ok: false, error: DEMO_READONLY_ERROR };
  }
  const parsed = deleteGoalSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Meta inválida." };
  }

  saveUndoSnapshot(ws, "Remoção de meta de leitura");
  ws.goals = ws.goals.filter(
    (g) => !(g.id === parsed.data.goalId && g.userId === ws.profile.id)
  );

  invalidateUserWorkspaceCache(ws.profile.id);
  revalidatePath("/", "layout");
  return { ok: true };
}
