"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  requireAuthenticatedWorkspace,
  saveUndoSnapshot,
} from "@/server/store/memory-repository";
import {
  importCsvBatchSchema,
  restoreBackupSchema,
  rollbackImportSchema,
} from "@/features/portability/schema";
import {
  applyCsvImportBatch,
  restorePortableBackupJson,
  rollbackImportBatch,
} from "@/features/portability/rules";
import type { ImportJob } from "@/lib/domain";

export async function importCsvBatchAction(
  rawInput: unknown
): Promise<{ ok: true; job: ImportJob } | { ok: false; error: string }> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = importCsvBatchSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Arquivo CSV inválido.",
    };
  }

  saveUndoSnapshot(
    ws,
    `Importação CSV (${parsed.data.source === "goodreads" ? "Goodreads" : "Planilha"})`
  );

  const batchId = `imp-${crypto.randomUUID().slice(0, 8)}`;
  const nowIso = new Date().toISOString();

  const { nextState, job } = applyCsvImportBatch({
    csvText: parsed.data.csvText,
    source: parsed.data.source,
    userId: ws.profile.id,
    batchId,
    nowIso,
    state: {
      works: ws.works,
      editions: ws.editions,
      items: ws.items,
      readings: ws.readings,
      reviews: ws.reviews,
      goals: ws.goals,
      wishlist: ws.wishlist,
      shelves: ws.shelves,
    },
  });

  ws.works = nextState.works;
  ws.editions = nextState.editions;
  ws.items = nextState.items;
  ws.readings = nextState.readings;
  ws.reviews = nextState.reviews;
  ws.importJobs.unshift(job);

  revalidatePath("/", "layout");
  return { ok: true, job };
}

export async function rollbackImportBatchAction(
  rawInput: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = rollbackImportSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Lote de importação inválido." };
  }

  const job = ws.importJobs.find((j) => j.id === parsed.data.jobId);
  if (!job || job.status === "rolled_back") {
    return { ok: false, error: "Lote não encontrado ou já desfeito." };
  }

  const rolledBack = rollbackImportBatch(
    {
      works: ws.works,
      editions: ws.editions,
      items: ws.items,
      readings: ws.readings,
      reviews: ws.reviews,
      goals: ws.goals,
      wishlist: ws.wishlist,
      shelves: ws.shelves,
    },
    job
  );

  ws.works = rolledBack.works;
  ws.editions = rolledBack.editions;
  ws.items = rolledBack.items;
  ws.readings = rolledBack.readings;
  ws.reviews = rolledBack.reviews;
  job.status = "rolled_back";

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function restoreBackupJsonAction(
  rawInput: unknown
): Promise<{ ok: true; restoredWorks: number } | { ok: false; error: string }> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = restoreBackupSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Backup JSON inválido.",
    };
  }

  try {
    const restored = restorePortableBackupJson(
      parsed.data.rawJson,
      ws.profile.id
    );
    saveUndoSnapshot(ws, "Restauração de backup JSON");

    ws.works = restored.works;
    ws.editions = restored.editions;
    ws.shelves = restored.shelves.length > 0 ? restored.shelves : ws.shelves;
    ws.items = restored.items;
    ws.readings = restored.readings;
    ws.reviews = restored.reviews;
    ws.goals = restored.goals;
    ws.wishlist = restored.wishlist;

    revalidatePath("/", "layout");
    return { ok: true, restoredWorks: restored.works.length };
  } catch {
    return {
      ok: false,
      error:
        "Não foi possível ler o backup. Confira se o arquivo foi exportado pelo ReadingFlow (readingflow-backup-v1).",
    };
  }
}
