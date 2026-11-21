"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  requireAuthenticatedWorkspace,
  saveUndoSnapshot,
} from "@/server/store/memory-repository";
import { createGoalSchema, deleteGoalSchema } from "@/features/goals/schema";
import { sanitizePlainText } from "@/server/security/sanitize";

function lastDayOfMonth(year: number, month1Based: number): number {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
}

export async function createGoalAction(
  rawInput: unknown
): Promise<{ ok: true; goalId: string } | { ok: false; error: string }> {
  const ws = await requireAuthenticatedWorkspace();
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
    createdAt: new Date().toISOString(),
  });

  revalidatePath("/", "layout");
  return { ok: true, goalId };
}

export async function deleteGoalAction(
  rawInput: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = deleteGoalSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Meta inválida." };
  }

  saveUndoSnapshot(ws, "Remoção de meta de leitura");
  ws.goals = ws.goals.filter((g) => g.id !== parsed.data.goalId);

  revalidatePath("/", "layout");
  return { ok: true };
}
