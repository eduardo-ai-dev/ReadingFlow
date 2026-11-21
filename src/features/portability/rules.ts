import { z } from "zod";
import type {
  BookFormat,
  Edition,
  ImportJob,
  ImportPendingItem,
  LibraryItem,
  Reading,
  ReadingGoal,
  ReadingStatus,
  Review,
  Shelf,
  UserSettings,
  WishlistItem,
  Work,
} from "@/lib/domain";
import { parseCsvText } from "@/server/security/csv";
import { sanitizePlainText } from "@/server/security/sanitize";
import { normalizeToIsbn13 } from "@/lib/isbn";
import {
  classifyBookDuplication,
  computeWorkFingerprint,
  estimateBookDimensions,
} from "@/features/catalog/rules";
import { inferShelfKindFromFormat } from "@/features/wishlist/rules";
import { isValidHalfStar } from "@/features/ratings/rules";
import { parsePersistedShelfLayout } from "@/features/shelves/arrange-shelves";
import { normalizeAmbientPreferences } from "@/features/reading/ambient-catalog";
import {
  normalizeDensityPreference,
  normalizeFxPreference,
  normalizeMotionPreference,
  normalizeThemePreference,
} from "@/lib/themes/themes.config";

export interface PortableLibraryState {
  works: Work[];
  editions: Edition[];
  items: LibraryItem[];
  readings: Reading[];
  reviews: Review[];
  goals: ReadingGoal[];
  wishlist: WishlistItem[];
  shelves: Shelf[];
  userSettings?: UserSettings;
}

function cleanGoodreadsIsbn(raw: string): string {
  return raw.replace(/^="?/, "").replace(/"?$/, "").trim();
}

function normalizeGoodreadsDate(raw: string): string | undefined {
  const cleaned = raw.trim().replace(/\//g, "-");
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }
  return undefined;
}

function parseFormat(raw?: string): BookFormat {
  const v = (raw ?? "").toLowerCase().trim();
  if (v === "hardcover" || v.includes("capa dura")) return "hardcover";
  if (v === "pocket" || v.includes("bolso")) return "pocket";
  if (v === "ebook" || v.includes("kindle") || v.includes("e-book"))
    return "ebook";
  if (v === "audiobook" || v.includes("audio")) return "audiobook";
  if (v === "box") return "box";
  return "paperback";
}

function parseReadingStatus(raw?: string): ReadingStatus | null {
  const v = (raw ?? "").toLowerCase().trim();
  if (!v || v === "to-read" || v === "not_started") return null;
  if (v === "currently-reading" || v === "reading" || v === "lendo")
    return "reading";
  if (v === "paused" || v === "pausado") return "paused";
  if (
    v === "read" ||
    v === "finished" ||
    v === "concluido" ||
    v === "concluído"
  )
    return "finished";
  if (v === "abandoned" || v === "dnf" || v === "abandonado")
    return "abandoned";
  return null;
}

export function applyCsvImportBatch(params: {
  csvText: string;
  source: "template" | "goodreads";
  userId: string;
  batchId: string;
  nowIso: string;
  state: PortableLibraryState;
}): {
  nextState: PortableLibraryState;
  job: ImportJob;
} {
  const rows = parseCsvText(params.csvText);
  if (rows.length <= 1) {
    return {
      nextState: params.state,
      job: {
        id: params.batchId,
        userId: params.userId,
        source: params.source,
        status: "done",
        totalRows: 0,
        importedRows: 0,
        skippedDuplicates: 0,
        failedRows: 0,
        pendingReview: [],
        createdWorkIds: [],
        createdEditionIds: [],
        createdItemIds: [],
        createdReadingIds: [],
        createdReviewIds: [],
        createdAt: params.nowIso,
      },
    };
  }

  const header = (rows[0] ?? []).map((h) => h.toLowerCase().trim());
  const dataRows = rows.slice(1, 2001); // Technical cap: 2,000 rows per import (§16.3)

  const colIdx = (names: string[]) =>
    header.findIndex((col) => names.includes(col));

  const titleCol = colIdx(["title", "titulo", "título"]);
  const authorCol = colIdx(["author", "autor"]);
  const isbnCol = colIdx(["isbn13", "isbn"]);
  const formatCol = colIdx(["binding", "formato", "format"]);
  const pagesCol = colIdx(["number of pages", "paginas", "páginas", "pages"]);
  const statusCol = colIdx(["exclusive shelf", "estado", "status"]);
  const ratingCol = colIdx(["my rating", "nota", "rating"]);
  const dateReadCol = colIdx(["date read", "concluido_em", "finished_on"]);

  const works = [...params.state.works];
  const editions = [...params.state.editions];
  const items = [...params.state.items];
  const readings = [...params.state.readings];
  const reviews = [...params.state.reviews];

  const pendingReview: ImportPendingItem[] = [];
  const createdWorkIds: string[] = [];
  const createdEditionIds: string[] = [];
  const createdItemIds: string[] = [];
  const createdReadingIds: string[] = [];
  const createdReviewIds: string[] = [];

  let importedRows = 0;
  let skippedDuplicates = 0;
  let failedRows = 0;

  dataRows.forEach((row, idx) => {
    const rowNumber = idx + 2;
    const rawTitle = sanitizePlainText(
      titleCol >= 0 ? (row[titleCol] ?? "") : "",
      300
    );
    const rawAuthor = sanitizePlainText(
      authorCol >= 0 ? (row[authorCol] ?? "") : "",
      200
    );
    const rawIsbn =
      isbnCol >= 0 ? cleanGoodreadsIsbn(row[isbnCol] ?? "") : undefined;

    if (!rawTitle || !rawAuthor) {
      failedRows += 1;
      pendingReview.push({
        rowNumber,
        rawTitle: rawTitle || "(Sem título)",
        rawAuthor: rawAuthor || "(Sem autor)",
        rawIsbn,
        reason: "Título ou autor ausente; pendente de revisão manual.",
      });
      return;
    }

    const normalizedIsbn = rawIsbn ? normalizeToIsbn13(rawIsbn) : null;
    if (rawIsbn && !normalizedIsbn) {
      pendingReview.push({
        rowNumber,
        rawTitle,
        rawAuthor,
        rawIsbn,
        reason: "ISBN inválido ignorado; cadastrado como entrada sem ISBN.",
      });
    }

    const dup = classifyBookDuplication(
      {
        isbn: normalizedIsbn ?? undefined,
        title: rawTitle,
        primaryAuthor: rawAuthor,
        language: "pt-BR",
      },
      editions,
      works
    );

    if (dup.kind === "exact") {
      const alreadyOwned = items.some(
        (it) => it.editionId === dup.editionId && it.userId === params.userId
      );
      if (alreadyOwned) {
        skippedDuplicates += 1;
        return;
      }
    } else if (dup.kind === "probable") {
      const existingEdition = editions.find((ed) => ed.workId === dup.workId);
      if (
        existingEdition &&
        items.some(
          (it) =>
            it.editionId === existingEdition.id && it.userId === params.userId
        )
      ) {
        skippedDuplicates += 1;
        return;
      }
    }

    const format = parseFormat(formatCol >= 0 ? row[formatCol] : undefined);
    const parsedPages =
      pagesCol >= 0 ? Number.parseInt(row[pagesCol] ?? "", 10) : Number.NaN;
    const pages =
      Number.isFinite(parsedPages) && parsedPages > 0 ? parsedPages : undefined;
    const dims = estimateBookDimensions(format, pages);

    let workId: string;
    if (dup.kind === "exact" || dup.kind === "probable") {
      workId = dup.workId;
    } else {
      workId = `work-${params.batchId}-${rowNumber}`;
      works.push({
        id: workId,
        ownerId: params.userId,
        title: rawTitle,
        contributors: [{ name: rawAuthor, role: "author" }],
        fingerprint: computeWorkFingerprint(rawTitle, rawAuthor, "pt-BR"),
        source: "import",
        createdAt: params.nowIso,
      });
      createdWorkIds.push(workId);
    }

    let editionId: string;
    if (dup.kind === "exact") {
      editionId = dup.editionId;
    } else {
      editionId = `ed-${params.batchId}-${rowNumber}`;
      editions.push({
        id: editionId,
        workId,
        ownerId: params.userId,
        isbn13: normalizedIsbn ?? undefined,
        title: rawTitle,
        language: "pt-BR",
        format,
        pages,
        heightMm: dims.heightMm,
        thicknessMm: dims.thicknessMm,
        contributors: [{ name: rawAuthor, role: "author" }],
        source: "import",
        createdAt: params.nowIso,
      });
      createdEditionIds.push(editionId);
    }

    const shelfKind = inferShelfKindFromFormat(format);
    const shelf =
      params.state.shelves.find((s) => s.kind === shelfKind) ??
      params.state.shelves[0];

    if (shelf) {
      const itemId = `item-${params.batchId}-${rowNumber}`;
      items.push({
        id: itemId,
        userId: params.userId,
        editionId,
        shelfId: shelf.id,
        shelfPosition: items.length,
        status: "owned",
        currency: "BRL",
        importBatchId: params.batchId,
        createdAt: params.nowIso,
      });
      createdItemIds.push(itemId);
    }

    const readingStatus = parseReadingStatus(
      statusCol >= 0 ? row[statusCol] : undefined
    );
    if (readingStatus) {
      const finishedOn =
        readingStatus === "finished"
          ? (normalizeGoodreadsDate(
              dateReadCol >= 0 ? (row[dateReadCol] ?? "") : ""
            ) ?? params.nowIso.slice(0, 10))
          : undefined;
      const readingId = `read-${params.batchId}-${rowNumber}`;
      readings.push({
        id: readingId,
        userId: params.userId,
        workId,
        editionId,
        format,
        status: readingStatus,
        finishedOn,
        progressUnit: pages ? "pages" : "percent",
        progressValue: readingStatus === "finished" ? (pages ?? 100) : 0,
        progressTotal: pages ?? 100,
        countsForGoals: true,
        importBatchId: params.batchId,
        createdAt: params.nowIso,
        updatedAt: params.nowIso,
      });
      createdReadingIds.push(readingId);
    }

    const rawRating =
      ratingCol >= 0 ? Number.parseFloat(row[ratingCol] ?? "") : Number.NaN;
    if (
      isValidHalfStar(rawRating) &&
      !reviews.some(
        (rev) => rev.workId === workId && rev.userId === params.userId
      )
    ) {
      const reviewId = `rev-${params.batchId}-${rowNumber}`;
      reviews.push({
        id: reviewId,
        userId: params.userId,
        workId,
        rating: rawRating,
        isPrivate: true,
        importBatchId: params.batchId,
        updatedAt: params.nowIso,
      });
      createdReviewIds.push(reviewId);
    }

    importedRows += 1;
  });

  return {
    nextState: {
      ...params.state,
      works,
      editions,
      items,
      readings,
      reviews,
    },
    job: {
      id: params.batchId,
      userId: params.userId,
      source: params.source,
      status: "done",
      totalRows: dataRows.length,
      importedRows,
      skippedDuplicates,
      failedRows,
      pendingReview,
      createdWorkIds,
      createdEditionIds,
      createdItemIds,
      createdReadingIds,
      createdReviewIds,
      createdAt: params.nowIso,
    },
  };
}

export function rollbackImportBatch(
  state: PortableLibraryState,
  job: ImportJob
): PortableLibraryState {
  const workSet = new Set(job.createdWorkIds);
  const editionSet = new Set(job.createdEditionIds);
  const itemSet = new Set(job.createdItemIds);
  const readingSet = new Set(job.createdReadingIds);
  const reviewSet = new Set(job.createdReviewIds);

  return {
    ...state,
    items: state.items.filter((x) => !itemSet.has(x.id)),
    readings: state.readings.filter((x) => !readingSet.has(x.id)),
    reviews: state.reviews.filter((x) => !reviewSet.has(x.id)),
    editions: state.editions.filter((x) => !editionSet.has(x.id)),
    works: state.works.filter((x) => !workSet.has(x.id)),
  };
}

const portableBackupSchema = z.object({
  schemaVersion: z.literal("readingflow-backup-v1"),
  exportedAt: z.string(),
  data: z.object({
    works: z.array(z.any()),
    editions: z.array(z.any()),
    items: z.array(z.any()),
    readings: z.array(z.any()),
    reviews: z.array(z.any()),
    goals: z.array(z.any()),
    wishlist: z.array(z.any()),
    shelves: z.array(z.any()),
    userSettings: z.any().optional(),
  }),
});

export function createPortableBackupJson(params: {
  exportedAtIso: string;
  state: PortableLibraryState;
}): string {
  return JSON.stringify(
    {
      schemaVersion: "readingflow-backup-v1",
      exportedAt: params.exportedAtIso,
      data: params.state,
    },
    null,
    2
  );
}

export function restorePortableBackupJson(
  rawJson: string,
  targetUserId: string
): PortableLibraryState {
  const parsed = portableBackupSchema.parse(JSON.parse(rawJson));
  const data = parsed.data as PortableLibraryState;

  let restoredSettings: UserSettings | undefined;
  if (data.userSettings && typeof data.userSettings === "object") {
    const rawSettings = data.userSettings as Partial<UserSettings>;
    restoredSettings = {
      userId: targetUserId,
      theme: normalizeThemePreference(rawSettings.theme),
      density: normalizeDensityPreference(rawSettings.density),
      motion: normalizeMotionPreference(rawSettings.motion),
      fx: normalizeFxPreference(rawSettings.fx),
      shelfLayout: parsePersistedShelfLayout(
        rawSettings.shelfLayout ? JSON.stringify(rawSettings.shelfLayout) : null
      ),
      ambientPreferences: normalizeAmbientPreferences(
        rawSettings.ambientPreferences
      ),
      focusDefaultMode:
        rawSettings.focusDefaultMode === "pomodoro" ||
        rawSettings.focusDefaultMode === "target_50"
          ? rawSettings.focusDefaultMode
          : "free",
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    works: data.works.map((w) => ({
      ...w,
      ownerId: w.ownerId ? targetUserId : null,
    })),
    editions: data.editions.map((e) => ({
      ...e,
      ownerId: e.ownerId ? targetUserId : null,
      coverLocked:
        typeof e.coverLocked === "boolean" ? e.coverLocked : undefined,
      coverSelectedAt:
        typeof e.coverSelectedAt === "string" ? e.coverSelectedAt : undefined,
    })),
    shelves: data.shelves.map((s) => ({ ...s, userId: targetUserId })),
    items: data.items.map((i) => ({ ...i, userId: targetUserId })),
    readings: data.readings.map((r) => ({ ...r, userId: targetUserId })),
    reviews: data.reviews.map((rev) => ({ ...rev, userId: targetUserId })),
    goals: data.goals.map((g) => ({ ...g, userId: targetUserId })),
    wishlist: data.wishlist.map((w) => ({ ...w, userId: targetUserId })),
    ...(restoredSettings ? { userSettings: restoredSettings } : {}),
  };
}
