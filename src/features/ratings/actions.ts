"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  requireAuthenticatedWorkspace,
  saveUndoSnapshot,
} from "@/server/store/memory-repository";
import {
  deleteReviewSchema,
  upsertReviewSchema,
} from "@/features/ratings/schema";
import { sanitizePlainText } from "@/server/security/sanitize";

export async function upsertReviewAction(
  rawInput: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = upsertReviewSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Avaliação inválida.",
    };
  }

  const data = parsed.data;
  const work = ws.works.find((w) => w.id === data.workId);
  if (!work) {
    return { ok: false, error: "Obra não encontrada." };
  }

  const nowIso = new Date().toISOString();
  const existing = ws.reviews.find((r) => r.workId === work.id);

  if (existing) {
    existing.rating = data.rating;
    existing.narrationRating = data.narrationRating;
    existing.body = data.body ? sanitizePlainText(data.body, 2000) : undefined;
    existing.updatedAt = nowIso;
  } else {
    ws.reviews.push({
      id: `rev-${crypto.randomUUID()}`,
      userId: ws.profile.id,
      workId: work.id,
      rating: data.rating,
      narrationRating: data.narrationRating,
      body: data.body ? sanitizePlainText(data.body, 2000) : undefined,
      isPrivate: true,
      updatedAt: nowIso,
    });
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteReviewAction(
  rawInput: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = deleteReviewSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Avaliação inválida." };
  }

  saveUndoSnapshot(ws, "Remoção de avaliação");
  ws.reviews = ws.reviews.filter((r) => r.workId !== parsed.data.workId);

  revalidatePath("/", "layout");
  return { ok: true };
}
