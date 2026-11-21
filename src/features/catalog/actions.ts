"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  deleteEditionUploadedCovers,
  getCatalogPipelineForWorkspace,
  invalidateUserWorkspaceCache,
  requireAuthenticatedWorkspace,
  saveUndoSnapshot,
  saveUserUploadedCover,
} from "@/server/store/memory-repository";
import { canAutoUpdateEditionCover } from "@/features/catalog/cover-url";
import {
  addBookSchema,
  isbnLookupSchema,
  updateBookMetadataSchema,
  updateEditionCoverSchema,
} from "@/features/catalog/schema";
import {
  classifyBookDuplication,
  computeWorkFingerprint,
  estimateBookDimensions,
} from "@/features/catalog/rules";
import { inferShelfKindFromFormat } from "@/features/wishlist/rules";
import { canStartActiveReading } from "@/features/reading/rules";
import { formatDateInTimezone } from "@/lib/dates";
import { normalizeToIsbn13 } from "@/lib/isbn";
import { ptBR } from "@/lib/i18n/pt-BR";
import {
  checkSlidingRateLimit,
  sanitizeCoverInput,
  sanitizePlainText,
} from "@/server/security/sanitize";
import type { CatalogLookupResult } from "@/server/catalog/pipeline";
import { validateChosenCoverWithSharp } from "@/server/catalog/cover-search";
import { enrichEditionCoverMetadata } from "@/server/catalog/enrich-edition";
import { extractSpinePaletteFromCover } from "@/server/catalog/spine-color";
import {
  clampPaperHsl,
  deriveSpineAccentHex,
} from "@/features/catalog/spine-color-rules";
import { coverColor } from "@/lib/cover-color";
import type { BookCoverSource, Contributor, Edition } from "@/lib/domain";

function inferCoverSourceFromUrl(
  url: string,
  explicit?: BookCoverSource | null
): BookCoverSource {
  if (explicit) return explicit;
  if (url.startsWith("data:") || url.startsWith("/api/covers/file/")) {
    return "upload";
  }
  if (url.includes("openlibrary.org") || url.includes("archive.org")) {
    return "openlibrary";
  }
  if (url.includes("hardcover.app")) return "hardcover";
  if (url.includes("mzstatic.com")) return "apple";
  if (
    url.includes("brasilapi.com.br") ||
    url.includes("mercadoeditorial.org") ||
    url.includes("media-amazon.com") ||
    url.includes("mlstatic.com")
  ) {
    return "brasilapi";
  }
  return "google";
}

export async function lookupBookByIsbnAction(rawInput: {
  isbn: string;
}): Promise<
  { ok: true; result: CatalogLookupResult } | { ok: false; error: string }
> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = isbnLookupSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? ptBR.validation.invalidIsbn,
    };
  }

  const rl = checkSlidingRateLimit(`isbn:${ws.profile.id}`, 30);
  if (!rl.allowed) {
    return {
      ok: false,
      error: `Muitas consultas de ISBN. Aguarde ${rl.retryAfterSeconds}s.`,
    };
  }

  const normalized = normalizeToIsbn13(parsed.data.isbn);
  if (!normalized) {
    return { ok: false, error: ptBR.validation.invalidIsbn };
  }

  const pipeline = getCatalogPipelineForWorkspace(ws);
  const result = await pipeline.lookupByIsbn(normalized);
  if (result.status === "invalid_isbn") {
    return { ok: false, error: ptBR.validation.invalidIsbn };
  }

  return { ok: true, result };
}

export async function addBookToLibraryAction(rawInput: unknown): Promise<
  | {
      ok: true;
      workId: string;
      editionId: string;
      itemId?: string;
      wishlistItemId?: string;
      /* Metadados resolvidos no cadastro (capa, páginas, cor principal e acento da lombada) */
      coverUrl?: string;
      pages?: number;
      coverColor?: string;
      coverAccentColor?: string;
    }
  | {
      ok: false;
      error: string;
      duplicateWarning?: {
        kind: "exact" | "probable";
        existingWorkId: string;
      };
    }
> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = addBookSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados do livro inválidos.",
    };
  }

  const data = parsed.data;
  let normalizedIsbn: string | undefined;
  if (data.isbn && data.isbn.trim().length > 0) {
    const checked = normalizeToIsbn13(data.isbn);
    if (!checked) {
      return { ok: false, error: ptBR.validation.invalidIsbn };
    }
    normalizedIsbn = checked;
  }

  const cleanTitle = sanitizePlainText(data.title, 300);
  const cleanSubtitle = data.subtitle
    ? sanitizePlainText(data.subtitle, 300)
    : undefined;
  const cleanAuthor = sanitizePlainText(data.primaryAuthor, 200);
  const cleanTranslator = data.translator
    ? sanitizePlainText(data.translator, 200)
    : undefined;
  const cleanNarrator = data.narrator
    ? sanitizePlainText(data.narrator, 200)
    : undefined;
  const cleanPublisher = data.publisher
    ? sanitizePlainText(data.publisher, 200)
    : undefined;
  const cleanGenre = data.primaryGenre
    ? sanitizePlainText(data.primaryGenre, 100)
    : undefined;
  const cleanDescription = data.description
    ? sanitizePlainText(data.description, 4000)
    : undefined;
  const cleanStore = data.store
    ? sanitizePlainText(data.store, 160)
    : undefined;
  const cleanNotes = data.notes
    ? sanitizePlainText(data.notes, 2000)
    : undefined;
  const safeCoverUrl = sanitizeCoverInput(data.coverUrl);
  if (data.coverUrl?.startsWith("data:") && !safeCoverUrl) {
    return {
      ok: false,
      error:
        "A imagem de capa enviada é inválida. Use JPEG, PNG ou WebP de até 300 KB, ou remova a capa.",
    };
  }

  const dup = classifyBookDuplication(
    {
      isbn: normalizedIsbn,
      title: cleanTitle,
      primaryAuthor: cleanAuthor,
      language: data.language,
    },
    ws.editions,
    ws.works
  );

  if (
    (dup.kind === "exact" || dup.kind === "probable") &&
    !data.forceDuplicateCopy &&
    !data.addToWishlistOnly
  ) {
    const workEditionIds = new Set(
      ws.editions.filter((e) => e.workId === dup.workId).map((e) => e.id)
    );
    const alreadyOwned = ws.items.some((it) =>
      workEditionIds.has(it.editionId)
    );
    if (alreadyOwned) {
      return {
        ok: false,
        error:
          dup.kind === "exact"
            ? "Este ISBN já consta na sua estante. Confirme abaixo caso queira registrar outro exemplar."
            : "Uma obra muito semelhante já está na sua estante. Confirme caso seja outro exemplar ou edição.",
        duplicateWarning: {
          kind: dup.kind,
          existingWorkId: dup.workId,
        },
      };
    }
  }

  saveUndoSnapshot(ws, `Cadastro de "${cleanTitle}"`);

  const nowIso = new Date().toISOString();
  const contributors: Contributor[] = [{ name: cleanAuthor, role: "author" }];
  if (cleanTranslator) {
    contributors.push({ name: cleanTranslator, role: "translator" });
  }
  if (cleanNarrator) {
    contributors.push({ name: cleanNarrator, role: "narrator" });
  }

  let workId: string;
  if (dup.kind === "exact" || dup.kind === "probable") {
    workId = dup.workId;
  } else {
    workId = `work-${crypto.randomUUID()}`;
    ws.works.push({
      id: workId,
      ownerId: ws.profile.id,
      title: cleanTitle,
      firstPublishedYear: data.publishedYear,
      primaryGenre: cleanGenre,
      description: cleanDescription,
      contributors,
      fingerprint: computeWorkFingerprint(
        cleanTitle,
        cleanAuthor,
        data.language
      ),
      source: "manual",
      createdAt: nowIso,
    });
  }

  const dims = estimateBookDimensions(data.format, data.pages, {
    heightMm: data.heightMm,
    thicknessMm: data.thicknessMm,
  });

  let editionId: string;
  if (dup.kind === "exact") {
    editionId = dup.editionId;
  } else {
    editionId = `ed-${crypto.randomUUID()}`;
    let persistedCoverUrl = safeCoverUrl;
    if (safeCoverUrl?.startsWith("data:")) {
      const stored = saveUserUploadedCover(ws, editionId, safeCoverUrl);
      if (stored) {
        persistedCoverUrl = stored.routeUrl;
      }
    }
    const inferredCoverSource: BookCoverSource | null = !persistedCoverUrl
      ? null
      : inferCoverSourceFromUrl(persistedCoverUrl, data.coverSource);
    const hasExplicitCover = Boolean(persistedCoverUrl);
    const newEdition: Edition = {
      id: editionId,
      workId,
      ownerId: ws.profile.id,
      isbn13: normalizedIsbn,
      title: cleanTitle,
      subtitle: cleanSubtitle,
      publisher: cleanPublisher,
      language: data.language,
      format: data.format,
      pages: data.pages,
      durationSeconds: data.durationMinutes
        ? data.durationMinutes * 60
        : undefined,
      heightMm: dims.heightMm,
      thicknessMm: dims.thicknessMm,
      coverUrl: persistedCoverUrl,
      coverSource: inferredCoverSource,
      coverLocked: hasExplicitCover,
      coverSelectedAt: hasExplicitCover ? nowIso : undefined,
      contributors,
      source: "manual",
      createdAt: nowIso,
    };
    // Capa (se não dispensada nem escolhida pelo usuário), páginas e cores da lombada são resolvidas no cadastro.
    await enrichEditionCoverMetadata(newEdition, cleanAuthor, {
      skipCoverLookup: Boolean(
        hasExplicitCover || data.skipAutoCover || data.coverSource === null
      ),
    });
    ws.editions.push(newEdition);
  }

  invalidateUserWorkspaceCache(ws.profile.id);

  if (data.addToWishlistOnly) {
    const wishId = `wish-${crypto.randomUUID()}`;
    ws.wishlist.push({
      id: wishId,
      userId: ws.profile.id,
      workId,
      editionId,
      priority: data.priority ?? 3,
      targetPrice: data.targetPrice,
      currency: ws.profile.defaultCurrency,
      whereToBuy: cleanStore,
      notes: cleanNotes,
      status: "wanted",
      createdAt: nowIso,
    });

    revalidatePath("/", "layout");
    return { ok: true, workId, editionId, wishlistItemId: wishId };
  }

  const shelfKind = inferShelfKindFromFormat(data.format);
  const targetShelf =
    ws.shelves.find((s) => s.kind === shelfKind) ?? ws.shelves[0];

  if (!targetShelf) {
    return { ok: false, error: "Estante de destino não encontrada." };
  }

  const itemId = `item-${crypto.randomUUID()}`;
  ws.items.push({
    id: itemId,
    userId: ws.profile.id,
    editionId,
    shelfId: targetShelf.id,
    shelfPosition: ws.items.filter((i) => i.shelfId === targetShelf.id).length,
    status: data.ownershipStatus,
    acquiredOn:
      data.acquiredOn ?? formatDateInTimezone(nowIso, ws.profile.timezone),
    pricePaid: data.pricePaid,
    currency: ws.profile.defaultCurrency,
    store: cleanStore,
    condition: data.condition,
    notes: cleanNotes,
    createdAt: nowIso,
  });

  if (data.startReadingImmediately) {
    const check = canStartActiveReading(
      workId,
      ws.readings,
      ws.profile.maxSimultaneousReadings
    );
    if (check.allowed) {
      const unit =
        data.format === "audiobook"
          ? "seconds"
          : data.pages
            ? "pages"
            : "percent";
      const total =
        unit === "seconds"
          ? data.durationMinutes
            ? data.durationMinutes * 60
            : undefined
          : unit === "pages"
            ? data.pages
            : 100;
      ws.readings.push({
        id: `read-${crypto.randomUUID()}`,
        userId: ws.profile.id,
        workId,
        editionId,
        libraryItemId: itemId,
        format: data.format,
        status: "reading",
        startedOn: formatDateInTimezone(nowIso, ws.profile.timezone),
        progressUnit: unit,
        progressValue: 0,
        progressTotal: total,
        countsForGoals: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }
  }

  revalidatePath("/", "layout");
  const savedEdition = ws.editions.find((e) => e.id === editionId);
  return {
    ok: true,
    workId,
    editionId,
    itemId,
    coverUrl: savedEdition?.coverUrl,
    pages: savedEdition?.pages,
    coverColor: savedEdition?.coverColor,
    coverAccentColor: savedEdition?.coverAccentColor,
  };
}

export async function updateBookMetadataAction(
  rawInput: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = updateBookMetadataSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const data = parsed.data;
  const work = ws.works.find((w) => w.id === data.workId);
  const edition = ws.editions.find((e) => e.id === data.editionId);
  if (!work || !edition || edition.workId !== work.id) {
    return { ok: false, error: "Livro não encontrado no seu acervo." };
  }

  let nextIsbn13: string | undefined = edition.isbn13;
  if (data.isbn !== undefined) {
    const trimmedIsbn = data.isbn.trim();
    if (trimmedIsbn.length === 0) {
      nextIsbn13 = undefined;
    } else {
      const checked = normalizeToIsbn13(trimmedIsbn);
      if (!checked) {
        return { ok: false, error: ptBR.validation.invalidIsbn };
      }
      nextIsbn13 = checked;
    }
  }

  let nextCoverUrl: string | undefined = edition.coverUrl;
  if (data.coverUrl !== undefined) {
    if (data.coverUrl === "") {
      nextCoverUrl = undefined;
    } else {
      const safeCover = sanitizeCoverInput(data.coverUrl);
      if (!safeCover) {
        return {
          ok: false,
          error:
            "A imagem de capa é inválida. Use JPEG, PNG ou WebP de até 300 KB, ou remova a capa.",
        };
      }
      nextCoverUrl = safeCover;
    }
  }

  saveUndoSnapshot(ws, `Edição de "${work.title}"`);

  const cleanTitle = sanitizePlainText(data.title, 300);
  const cleanAuthor = sanitizePlainText(data.primaryAuthor, 200);

  work.title = cleanTitle;
  work.primaryGenre = data.primaryGenre
    ? sanitizePlainText(data.primaryGenre, 100)
    : undefined;
  work.description = data.description
    ? sanitizePlainText(data.description, 4000)
    : undefined;
  work.contributors = [
    { name: cleanAuthor, role: "author" },
    ...work.contributors.filter((c) => c.role !== "author"),
  ];
  work.fingerprint = computeWorkFingerprint(
    cleanTitle,
    cleanAuthor,
    edition.language
  );

  const dims = estimateBookDimensions(data.format, data.pages);
  edition.isbn13 = nextIsbn13;
  if (!nextIsbn13) edition.isbn10 = undefined;
  edition.title = cleanTitle;
  edition.publisher = data.publisher
    ? sanitizePlainText(data.publisher, 200)
    : undefined;
  edition.format = data.format;
  edition.pages = data.pages;
  edition.durationSeconds = data.durationMinutes
    ? data.durationMinutes * 60
    : edition.durationSeconds;
  const coverChanged = nextCoverUrl !== edition.coverUrl;
  edition.heightMm = dims.heightMm;
  edition.thicknessMm = dims.thicknessMm;
  if (coverChanged) {
    const rawForPalette = nextCoverUrl;
    let persistedCoverUrl = nextCoverUrl;
    if (nextCoverUrl?.startsWith("data:")) {
      deleteEditionUploadedCovers(ws, edition.id);
      const stored = saveUserUploadedCover(ws, edition.id, nextCoverUrl);
      if (stored) {
        persistedCoverUrl = stored.routeUrl;
      }
    } else if (!nextCoverUrl) {
      deleteEditionUploadedCovers(ws, edition.id);
    }

    edition.coverUrl = persistedCoverUrl;
    edition.coverSource = !persistedCoverUrl
      ? null
      : inferCoverSourceFromUrl(persistedCoverUrl, data.coverSource);
    edition.coverLocked = Boolean(persistedCoverUrl);
    edition.coverSelectedAt = persistedCoverUrl
      ? new Date().toISOString()
      : undefined;

    if (rawForPalette) {
      const palette = await extractSpinePaletteFromCover(
        rawForPalette,
        AbortSignal.timeout(4000)
      );
      if (palette) {
        edition.coverColor = clampPaperHsl(palette.spineColor);
        edition.coverAccentColor = clampPaperHsl(palette.spineAccent);
      }
    } else {
      const seed = edition.isbn13 ?? edition.workId ?? edition.id;
      edition.coverColor = clampPaperHsl(coverColor(seed));
      edition.coverAccentColor = deriveSpineAccentHex(edition.coverColor, seed);
    }
  }
  edition.contributors = work.contributors;

  if (typeof data.pages === "number" && data.pages > 0) {
    for (const reading of ws.readings) {
      if (
        reading.editionId === edition.id &&
        reading.progressUnit === "pages" &&
        (reading.status === "reading" || reading.status === "paused")
      ) {
        reading.progressTotal = data.pages;
        if (reading.progressValue > data.pages) {
          reading.progressValue = data.pages;
        }
      }
    }
  }

  if (data.itemId) {
    const item = ws.items.find(
      (it) => it.id === data.itemId && it.editionId === edition.id
    );
    if (item) {
      const targetKind = inferShelfKindFromFormat(data.format);
      const targetShelf = ws.shelves.find((s) => s.kind === targetKind);
      if (targetShelf) {
        item.shelfId = targetShelf.id;
      }
      item.acquiredOn = data.acquiredOn || undefined;
      item.pricePaid = data.pricePaid;
      item.store = data.store ? sanitizePlainText(data.store, 160) : undefined;
      item.notes = data.notes ? sanitizePlainText(data.notes, 2000) : undefined;
    }
  }

  invalidateUserWorkspaceCache(ws.profile.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Atualiza a capa escolhida pelo usuário ("Trocar capa", "Restaurar automática" ou "Buscar capas").
 * - `sourceAction === "backfill"`: NUNCA sobrescreve uma edição com `coverLocked === true`.
 * - `sourceAction === "manual"`: trava a capa (`coverLocked = true`) e armazena uploads em pasta privada do dono.
 * - `sourceAction === "unlock"`: destrava `coverLocked = false` para permitir nova busca automática.
 */
export async function updateEditionCoverAction(rawInput: unknown): Promise<
  | {
      ok: true;
      coverUrl: string | null;
      coverSource: BookCoverSource | null;
      coverLocked: boolean;
      coverSelectedAt: string | null;
      spineColor: string;
      spineAccent: string;
    }
  | { ok: false; error: string }
> {
  const ws = await requireAuthenticatedWorkspace();
  const parsed = updateEditionCoverSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados da capa inválidos.",
    };
  }

  const data = parsed.data;
  const edition = ws.editions.find((e) => e.id === data.editionId);
  if (!edition) {
    return { ok: false, error: "Edição não encontrada no seu acervo." };
  }
  if (edition.ownerId && edition.ownerId !== ws.profile.id) {
    return { ok: false, error: "Sem permissão para alterar esta edição." };
  }

  if (data.sourceAction === "backfill" && !canAutoUpdateEditionCover(edition)) {
    return {
      ok: false,
      error:
        "Esta capa está travada pela sua escolha manual. Use 'Restaurar automática' para destravar.",
    };
  }

  if (data.sourceAction === "unlock") {
    saveUndoSnapshot(ws, `Destravar capa automática de "${edition.title}"`);
    edition.coverLocked = false;
    edition.coverSelectedAt = undefined;
    if (data.coverUrl === null) {
      deleteEditionUploadedCovers(ws, edition.id);
      edition.coverUrl = undefined;
      edition.coverSource = null;
    }
    const seed = edition.isbn13 ?? edition.workId ?? edition.id;
    const spineColor = edition.coverColor ?? clampPaperHsl(coverColor(seed));
    const spineAccent =
      edition.coverAccentColor ?? deriveSpineAccentHex(spineColor, seed);
    invalidateUserWorkspaceCache(ws.profile.id);
    revalidatePath("/", "layout");
    return {
      ok: true,
      coverUrl: edition.coverUrl ?? null,
      coverSource: edition.coverSource ?? null,
      coverLocked: false,
      coverSelectedAt: null,
      spineColor,
      spineAccent,
    };
  }

  let validatedInput: string | undefined;
  let persistedCoverUrl: string | undefined;
  let resolvedSource: BookCoverSource | null = null;

  if (data.coverUrl && data.coverUrl.trim().length > 0) {
    const validated = sanitizeCoverInput(data.coverUrl);
    if (!validated) {
      return {
        ok: false,
        error:
          "A imagem de capa informada é inválida. Use uma edição válida ou envie JPEG, PNG ou WebP de até 300 KB.",
      };
    }
    if (!validated.startsWith("/api/covers/file/")) {
      const sharpCheck = await validateChosenCoverWithSharp(validated);
      if (!sharpCheck.ok) {
        return {
          ok: false,
          error:
            sharpCheck.error ??
            "A capa escolhida possui dimensão inválida. Escolha outra candidata ou cole um link válido.",
        };
      }
    }
    validatedInput = validated;
    persistedCoverUrl = validated;
    if (validated.startsWith("data:")) {
      deleteEditionUploadedCovers(ws, edition.id);
      const stored = saveUserUploadedCover(ws, edition.id, validated);
      if (stored) {
        persistedCoverUrl = stored.routeUrl;
      }
    }
    resolvedSource = inferCoverSourceFromUrl(
      persistedCoverUrl,
      data.coverSource
    );
  } else {
    deleteEditionUploadedCovers(ws, edition.id);
  }

  saveUndoSnapshot(ws, `Troca de capa de "${edition.title}"`);

  const nowIso = new Date().toISOString();
  const shouldLock =
    data.sourceAction === "manual" && Boolean(persistedCoverUrl);

  edition.coverUrl = persistedCoverUrl;
  edition.coverSource = resolvedSource;
  edition.coverLocked = shouldLock;
  edition.coverSelectedAt = shouldLock ? nowIso : undefined;

  if (
    data.pageCount &&
    data.pageCount > 0 &&
    (!edition.pages || edition.pages <= 0)
  ) {
    edition.pages = data.pageCount;
  }

  const seed = edition.isbn13 ?? edition.workId ?? edition.id;
  let spineColor = edition.coverColor;
  let spineAccent = edition.coverAccentColor;

  if (validatedInput && !validatedInput.startsWith("/api/covers/file/")) {
    const palette = await extractSpinePaletteFromCover(
      validatedInput,
      AbortSignal.timeout(4500)
    );
    if (palette) {
      spineColor = clampPaperHsl(palette.spineColor);
      spineAccent = clampPaperHsl(palette.spineAccent);
    }
  }

  if (!spineColor || !persistedCoverUrl) {
    spineColor = clampPaperHsl(coverColor(seed));
  }
  if (!spineAccent || !persistedCoverUrl) {
    spineAccent = deriveSpineAccentHex(spineColor, seed);
  }

  edition.coverColor = spineColor;
  edition.coverAccentColor = spineAccent;

  // Mantém consistência apenas em edições irmãs da mesma obra sem capa e não travadas
  if (persistedCoverUrl) {
    for (const sibling of ws.editions) {
      if (
        sibling.id !== edition.id &&
        sibling.workId === edition.workId &&
        !sibling.coverLocked &&
        !sibling.coverUrl?.trim()
      ) {
        sibling.coverUrl = persistedCoverUrl;
        sibling.coverSource = resolvedSource;
        sibling.coverColor = spineColor;
        sibling.coverAccentColor = spineAccent;
      }
    }
  }

  invalidateUserWorkspaceCache(ws.profile.id);
  revalidatePath("/", "layout");
  return {
    ok: true,
    coverUrl: persistedCoverUrl ?? null,
    coverSource: resolvedSource,
    coverLocked: Boolean(edition.coverLocked),
    coverSelectedAt: edition.coverSelectedAt ?? null,
    spineColor,
    spineAccent,
  };
}
