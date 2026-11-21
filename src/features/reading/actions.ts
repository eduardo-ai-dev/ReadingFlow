"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  requireAuthenticatedWorkspace,
  saveUndoSnapshot,
} from "@/server/store/memory-repository";
import {
  abandonReadingSchema,
  finishReadingSchema,
  startReadingSchema,
  togglePauseReadingSchema,
  updateReadingProgressSchema,
} from "@/features/reading/schema";
import {
  canStartActiveReading,
  convertReadingProgress,
  finishReadingRecord,
  startRereadRecord,
  syncDailyLogsForProgressDelta,
} from "@/features/reading/rules";
import {
  resolveReadingAudioSecondsContribution,
  resolveReadingPagesContribution,
} from "@/features/goals/rules";
import { formatDateInTimezone } from "@/lib/dates";
import type { ProgressUnit } from "@/lib/domain";
import { sanitizePlainText } from "@/server/security/sanitize";

export async function startReadingAction(
  rawInput: unknown
): Promise<{ ok: true; readingId: string } | { ok: false; error: string }> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = startReadingSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos para iniciar leitura." };
  }

  const data = parsed.data;
  const work = ws.works.find((w) => w.id === data.workId);
  if (!work) {
    return { ok: false, error: "Obra não encontrada." };
  }

  const check = canStartActiveReading(
    work.id,
    ws.readings,
    ws.profile.maxSimultaneousReadings
  );
  if (!check.allowed) {
    return {
      ok: false,
      error:
        check.reason === "already_active_for_work"
          ? "Já existe uma leitura ativa ou pausada desta obra."
          : `Limite de ${ws.profile.maxSimultaneousReadings} leituras simultâneas atingido (ajuste em Configurações).`,
    };
  }

  const edition = data.editionId
    ? ws.editions.find((e) => e.id === data.editionId)
    : ws.editions.find((e) => e.workId === work.id);

  const format = data.format ?? edition?.format ?? "paperback";
  const progressUnit =
    format === "audiobook" ? "seconds" : edition?.pages ? "pages" : "percent";
  const progressTotal =
    progressUnit === "seconds"
      ? edition?.durationSeconds
      : progressUnit === "pages"
        ? edition?.pages
        : 100;

  const nowIso = new Date().toISOString();
  const startedOn =
    data.startedOn ?? formatDateInTimezone(nowIso, ws.profile.timezone);

  saveUndoSnapshot(ws, `Início de leitura de "${work.title}"`);

  const created = startRereadRecord({
    newId: `read-${crypto.randomUUID()}`,
    userId: ws.profile.id,
    workId: work.id,
    editionId: edition?.id,
    libraryItemId: data.libraryItemId,
    format,
    progressUnit,
    progressTotal,
    startedOn,
    nowIso,
  });
  created.countsForGoals = data.countsForGoals;

  ws.readings.push(created);
  revalidatePath("/", "layout");
  return { ok: true, readingId: created.id };
}

export async function updateReadingProgressAction(rawInput: unknown): Promise<
  | {
      ok: true;
      progressUnit: ProgressUnit;
      progressValue: number;
      progressTotal?: number;
    }
  | { ok: false; error: string }
> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = updateReadingProgressSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Progresso informado é inválido." };
  }

  const data = parsed.data;
  const reading = ws.readings.find((r) => r.id === data.readingId);
  if (!reading) {
    return { ok: false, error: "Registro de leitura não encontrado." };
  }

  const edition = reading.editionId
    ? ws.editions.find((e) => e.id === reading.editionId)
    : ws.editions.find((e) => e.workId === reading.workId);

  const editionsById = new Map(ws.editions.map((e) => [e.id, e]));
  const previousPages = resolveReadingPagesContribution(reading, editionsById);
  const previousSeconds = resolveReadingAudioSecondsContribution(
    reading,
    editionsById
  );
  const previousYmd =
    (reading.updatedAt
      ? formatDateInTimezone(reading.updatedAt, ws.profile.timezone)
      : undefined) ||
    reading.startedOn ||
    formatDateInTimezone(new Date(), ws.profile.timezone);

  if (
    data.convertFromPreviousUnit &&
    data.progressUnit !== reading.progressUnit
  ) {
    const converted = convertReadingProgress(
      {
        progressUnit: reading.progressUnit,
        progressValue: reading.progressValue,
        progressTotal: reading.progressTotal,
      },
      data.progressUnit,
      {
        pages: edition?.pages,
        durationSeconds: edition?.durationSeconds,
      }
    );
    reading.progressUnit = converted.progressUnit;
    reading.progressValue = converted.progressValue;
    reading.progressTotal = converted.progressTotal;
  } else {
    if (!Number.isInteger(data.progressValue)) {
      return {
        ok: false,
        error: "Informe um número inteiro sem casas decimais.",
      };
    }

    const resolvedTotal =
      data.progressTotal ??
      (data.progressUnit === "percent"
        ? 100
        : data.progressUnit === "pages"
          ? (edition?.pages ?? reading.progressTotal)
          : (edition?.durationSeconds ?? reading.progressTotal));

    if (data.progressUnit === "percent" && data.progressValue > 100) {
      return {
        ok: false,
        error: "A porcentagem não pode exceder 100%.",
      };
    }

    if (resolvedTotal && data.progressValue > resolvedTotal) {
      return {
        ok: false,
        error:
          data.progressUnit === "pages"
            ? `O número de páginas não pode exceder o total do livro (${resolvedTotal} pág.).`
            : `O tempo informado excede a duração total da obra (${Math.round(resolvedTotal / 60)} min).`,
      };
    }

    reading.progressUnit = data.progressUnit;
    reading.progressValue = data.progressValue;
    reading.progressTotal = resolvedTotal;
  }

  const nowIso = new Date().toISOString();
  const todayYmd = formatDateInTimezone(nowIso, ws.profile.timezone);
  const nextPages = resolveReadingPagesContribution(reading, editionsById);
  const nextSeconds = resolveReadingAudioSecondsContribution(
    reading,
    editionsById
  );
  reading.dailyLogs = syncDailyLogsForProgressDelta({
    existingLogs: reading.dailyLogs,
    previousYmd,
    todayYmd,
    previousPages,
    nextPages,
    previousSeconds,
    nextSeconds,
  });

  reading.updatedAt = nowIso;
  revalidatePath("/", "layout");
  return {
    ok: true,
    progressUnit: reading.progressUnit,
    progressValue: reading.progressValue,
    progressTotal: reading.progressTotal,
  };
}

export async function togglePauseReadingAction(
  rawInput: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = togglePauseReadingSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Leitura inválida." };
  }

  const reading = ws.readings.find((r) => r.id === parsed.data.readingId);
  if (!reading) {
    return { ok: false, error: "Leitura não encontrada." };
  }

  if (reading.status === "reading") {
    reading.status = "paused";
  } else if (reading.status === "paused") {
    reading.status = "reading";
  }
  reading.updatedAt = new Date().toISOString();

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function finishReadingAction(
  rawInput: unknown
): Promise<
  { ok: true; undoId: string; label: string } | { ok: false; error: string }
> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = finishReadingSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Dados de conclusão inválidos." };
  }

  const idx = ws.readings.findIndex((r) => r.id === parsed.data.readingId);
  const reading = idx >= 0 ? ws.readings[idx] : undefined;
  if (!reading) {
    return { ok: false, error: "Leitura não encontrada." };
  }

  const work = ws.works.find((w) => w.id === reading.workId);
  const prevProgressText =
    reading.progressUnit === "pages"
      ? `pág. ${reading.progressValue}${reading.progressTotal ? `/${reading.progressTotal}` : ""}`
      : reading.progressUnit === "seconds"
        ? `${Math.round(reading.progressValue / 60)} min`
        : `${reading.progressValue}%`;

  const undoLabel = work
    ? `Livro "${work.title}" concluído (anterior: Lendo agora · ${prevProgressText})`
    : `Leitura concluída (anterior: Lendo agora · ${prevProgressText})`;

  saveUndoSnapshot(ws, undoLabel);
  const undoId = ws.lastUndoAction?.id ?? `undo-${Date.now()}`;

  try {
    const nowIso = new Date().toISOString();
    const editionsById = new Map(ws.editions.map((e) => [e.id, e]));
    const previousPages = resolveReadingPagesContribution(
      reading,
      editionsById
    );
    const previousSeconds = resolveReadingAudioSecondsContribution(
      reading,
      editionsById
    );
    const previousYmd =
      (reading.updatedAt
        ? formatDateInTimezone(reading.updatedAt, ws.profile.timezone)
        : undefined) ||
      reading.startedOn ||
      formatDateInTimezone(nowIso, ws.profile.timezone);

    const finished = finishReadingRecord(reading, {
      finishedOn: parsed.data.finishedOn,
      nowIso,
      timezone: ws.profile.timezone,
    });
    const nextPages = resolveReadingPagesContribution(finished, editionsById);
    const nextSeconds = resolveReadingAudioSecondsContribution(
      finished,
      editionsById
    );
    finished.dailyLogs = syncDailyLogsForProgressDelta({
      existingLogs: reading.dailyLogs,
      previousYmd,
      todayYmd:
        finished.finishedOn ??
        formatDateInTimezone(nowIso, ws.profile.timezone),
      previousPages,
      nextPages,
      previousSeconds,
      nextSeconds,
    });

    ws.readings[idx] = finished;
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Não foi possível concluir a leitura.",
    };
  }

  revalidatePath("/", "layout");
  return { ok: true, undoId, label: undoLabel };
}

export async function abandonReadingAction(
  rawInput: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = abandonReadingSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Dados de abandono inválidos." };
  }

  const reading = ws.readings.find((r) => r.id === parsed.data.readingId);
  if (!reading) {
    return { ok: false, error: "Leitura não encontrada." };
  }

  const work = ws.works.find((w) => w.id === reading.workId);
  saveUndoSnapshot(
    ws,
    `Abandono de leitura${work ? ` de "${work.title}"` : ""}`
  );

  reading.status = "abandoned";
  reading.abandonReason = parsed.data.abandonReason
    ? sanitizePlainText(parsed.data.abandonReason, 500)
    : undefined;
  reading.updatedAt = new Date().toISOString();

  revalidatePath("/", "layout");
  return { ok: true };
}
