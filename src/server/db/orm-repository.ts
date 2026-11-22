import "server-only";
import { eq, and, desc, asc } from "drizzle-orm";
import { getDatabase, getOrmDb } from "./connection";
import {
  usersTable,
  worksTable,
  editionsTable,
  shelvesTable,
  libraryItemsTable,
  readingsTable,
  reviewsTable,
  goalsTable,
  wishlistTable,
  sessionsTable,
  userSettingsTable,
} from "./schema";
import type {
  Work,
  Edition,
  Shelf,
  LibraryItem,
  Reading,
  Review,
  ReadingGoal,
  WishlistItem,
  UserProfile,
  BookFormat,
  ShelfKind,
  OwnershipStatus,
  ReadingStatus,
  ProgressUnit,
  GoalKind,
  GoalPeriod,
  WishStatus,
  Contributor,
} from "@/lib/domain";

/**
 * readingflow · Repositório Central Orientado a ORM (Drizzle ORM)
 *
 * REGRA RIGOROSA:
 * - Toda e qualquer consulta é montada por meio de métodos e operadores tipados do ORM (select, insert, update, delete, eq, and).
 * - NENHUMA string de SQL é concatenada em hipótese alguma.
 */

// ============================================================================
// USUÁRIOS E SESSÕES
// ============================================================================

export async function ormFindUserByEmail(email: string) {
  const db = getOrmDb();
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()));
  return rows[0] ?? null;
}

export async function ormFindUserById(id: string) {
  const db = getOrmDb();
  const rows = await db.select().from(usersTable).where(eq(usersTable.id, id));
  return rows[0] ?? null;
}

export async function ormCreateUser(user: {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  locale?: string;
  timezone?: string;
  theme?: string;
  density?: string;
  motion?: string;
  defaultCurrency?: string;
  threeD?: string;
  goalsCountRereads?: boolean;
  maxSimultaneousReadings?: number;
  telemetryOptOut?: boolean;
  onboardingCompleted?: boolean;
  acceptedTermsVersion?: string;
  acceptedTermsAt: string;
  createdAt: string;
}) {
  const db = getOrmDb();
  await db.insert(usersTable).values(user);
}

export async function ormUpdateUser(
  id: string,
  partial: Partial<{
    displayName: string;
    passwordHash: string;
    locale: string;
    timezone: string;
    theme: string;
    density: string;
    motion: string;
    defaultCurrency: string;
    threeD: string;
    goalsCountRereads: boolean;
    maxSimultaneousReadings: number;
    telemetryOptOut: boolean;
    onboardingCompleted: boolean;
  }>
) {
  const db = getOrmDb();
  await db.update(usersTable).set(partial).where(eq(usersTable.id, id));
}

export async function ormDeleteUser(id: string) {
  const db = getOrmDb();
  await db.delete(userSettingsTable).where(eq(userSettingsTable.userId, id));
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, id));
  await db.delete(wishlistTable).where(eq(wishlistTable.userId, id));
  await db.delete(goalsTable).where(eq(goalsTable.userId, id));
  await db.delete(reviewsTable).where(eq(reviewsTable.userId, id));
  await db.delete(readingsTable).where(eq(readingsTable.userId, id));
  await db.delete(libraryItemsTable).where(eq(libraryItemsTable.userId, id));
  await db.delete(shelvesTable).where(eq(shelvesTable.userId, id));
  await db.delete(editionsTable).where(eq(editionsTable.userId, id));
  await db.delete(worksTable).where(eq(worksTable.userId, id));
  await db.delete(usersTable).where(eq(usersTable.id, id));
}

export async function ormCreateSession(token: string, userId: string) {
  const db = getOrmDb();
  await db.insert(sessionsTable).values({
    token,
    userId,
    createdAt: new Date().toISOString(),
  });
}

export async function ormFindSession(token: string) {
  const db = getOrmDb();
  const rows = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.token, token));
  return rows[0] ?? null;
}

export async function ormDeleteSession(token: string) {
  const db = getOrmDb();
  await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
}

export async function ormDeleteSessionsByUserId(userId: string) {
  const db = getOrmDb();
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
}

// ============================================================================
// OBRAS E EDIÇÕES
// ============================================================================

export async function ormGetWorks(userId: string): Promise<Work[]> {
  const db = getOrmDb();
  const rows = await db
    .select()
    .from(worksTable)
    .where(eq(worksTable.userId, userId))
    .orderBy(desc(worksTable.createdAt));

  return rows.map((r) => ({
    id: r.id,
    ownerId: r.userId,
    title: r.title,
    originalTitle: r.originalTitle ?? undefined,
    originalLanguage: r.originalLanguage ?? "pt-BR",
    contributors: JSON.parse(r.contributorsJson || "[]") as Contributor[],
    firstPublishedYear: r.firstPublishedYear ?? undefined,
    primaryGenre: r.primaryGenre ?? undefined,
    description: r.description ?? undefined,
    fingerprint: r.fingerprint,
    source: (r.source as Work["source"]) ?? "manual",
    createdAt: r.createdAt,
  }));
}

export async function ormGetWorkById(
  workId: string,
  userId: string
): Promise<Work | null> {
  const db = getOrmDb();
  const rows = await db
    .select()
    .from(worksTable)
    .where(and(eq(worksTable.id, workId), eq(worksTable.userId, userId)));

  const r = rows[0];
  if (!r) return null;

  return {
    id: r.id,
    ownerId: r.userId,
    title: r.title,
    originalTitle: r.originalTitle ?? undefined,
    originalLanguage: r.originalLanguage ?? "pt-BR",
    contributors: JSON.parse(r.contributorsJson || "[]") as Contributor[],
    firstPublishedYear: r.firstPublishedYear ?? undefined,
    primaryGenre: r.primaryGenre ?? undefined,
    description: r.description ?? undefined,
    fingerprint: r.fingerprint,
    source: (r.source as Work["source"]) ?? "manual",
    createdAt: r.createdAt,
  };
}

export async function ormInsertWork(work: Work): Promise<void> {
  const db = getOrmDb();
  await db.insert(worksTable).values({
    id: work.id,
    userId: work.ownerId ?? "global",
    title: work.title,
    originalTitle: work.originalTitle,
    originalLanguage: work.originalLanguage,
    contributorsJson: JSON.stringify(work.contributors),
    firstPublishedYear: work.firstPublishedYear,
    primaryGenre: work.primaryGenre,
    description: work.description,
    fingerprint: work.fingerprint,
    source: work.source,
    createdAt: work.createdAt,
  });
}

export async function ormGetEditions(userId: string): Promise<Edition[]> {
  const db = getOrmDb();
  const rows = await db
    .select()
    .from(editionsTable)
    .where(eq(editionsTable.userId, userId))
    .orderBy(desc(editionsTable.createdAt));

  return rows.map((r) => ({
    id: r.id,
    workId: r.workId,
    ownerId: r.userId,
    isbn13: r.isbn13 ?? undefined,
    isbn10: r.isbn10 ?? undefined,
    title: r.title,
    publisher: r.publisher ?? undefined,
    language: r.language ?? "pt-BR",
    format: r.format as BookFormat,
    pages: r.pages ?? undefined,
    durationSeconds: r.durationSeconds ?? undefined,
    coverUrl: r.coverUrl ?? undefined,
    coverSource: (r.coverSource as Edition["coverSource"]) ?? null,
    coverLocked: Boolean(r.coverLocked),
    coverSelectedAt: r.coverSelectedAt ?? undefined,
    coverColor: r.coverColor ?? undefined,
    coverAccentColor: r.coverAccentColor ?? undefined,
    contributors: JSON.parse(r.contributorsJson || "[]") as Contributor[],
    source: "manual",
    createdAt: r.createdAt,
  }));
}

export async function ormInsertEdition(edition: Edition): Promise<void> {
  const db = getOrmDb();
  await db.insert(editionsTable).values({
    id: edition.id,
    workId: edition.workId,
    userId: edition.ownerId ?? "global",
    isbn13: edition.isbn13,
    isbn10: edition.isbn10,
    title: edition.title,
    publisher: edition.publisher,
    format: edition.format,
    pages: edition.pages,
    durationSeconds: edition.durationSeconds,
    coverUrl: edition.coverUrl,
    coverSource: edition.coverSource ?? null,
    coverLocked: Boolean(edition.coverLocked),
    coverSelectedAt: edition.coverSelectedAt ?? null,
    coverColor: edition.coverColor,
    coverAccentColor: edition.coverAccentColor,
    contributorsJson: JSON.stringify(edition.contributors),
    language: edition.language,
    createdAt: edition.createdAt,
  });
}

// ============================================================================
// ESTANTES E EXEMPLARES
// ============================================================================

export async function ormGetShelves(userId: string): Promise<Shelf[]> {
  const db = getOrmDb();
  const rows = await db
    .select()
    .from(shelvesTable)
    .where(eq(shelvesTable.userId, userId))
    .orderBy(asc(shelvesTable.position));

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    name: r.name,
    kind: r.kind as ShelfKind,
    sortMode: r.sortMode as Shelf["sortMode"],
    position: r.position,
  }));
}

export async function ormInsertShelves(shelves: Shelf[]): Promise<void> {
  const db = getOrmDb();
  for (const s of shelves) {
    await db.insert(shelvesTable).values({
      id: s.id,
      userId: s.userId,
      name: s.name,
      kind: s.kind,
      sortMode: s.sortMode,
      position: s.position,
      createdAt: new Date().toISOString(),
    });
  }
}

export async function ormGetLibraryItems(
  userId: string
): Promise<LibraryItem[]> {
  const db = getOrmDb();
  const rows = await db
    .select()
    .from(libraryItemsTable)
    .where(eq(libraryItemsTable.userId, userId))
    .orderBy(asc(libraryItemsTable.shelfPosition));

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    editionId: r.editionId,
    shelfId: r.shelfId,
    shelfPosition: r.shelfPosition,
    status: r.status as OwnershipStatus,
    pricePaid: r.pricePaid ?? undefined,
    currency: r.currency,
    acquiredOn: r.acquiredOn ?? undefined,
    store: r.store ?? undefined,
    condition: (r.condition as LibraryItem["condition"]) ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.createdAt,
  }));
}

export async function ormInsertLibraryItem(item: LibraryItem): Promise<void> {
  const db = getOrmDb();
  await db.insert(libraryItemsTable).values({
    id: item.id,
    userId: item.userId,
    editionId: item.editionId,
    shelfId: item.shelfId,
    shelfPosition: item.shelfPosition,
    status: item.status,
    pricePaid: item.pricePaid,
    currency: item.currency,
    acquiredOn: item.acquiredOn,
    store: item.store,
    condition: item.condition,
    notes: item.notes,
    favorite: false,
    createdAt: item.createdAt,
  });
}

// ============================================================================
// LEITURAS
// ============================================================================

export async function ormGetReadings(userId: string): Promise<Reading[]> {
  const db = getOrmDb();
  const rows = await db
    .select()
    .from(readingsTable)
    .where(eq(readingsTable.userId, userId))
    .orderBy(desc(readingsTable.updatedAt));

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    workId: r.workId,
    editionId: r.editionId ?? undefined,
    format: r.format as BookFormat,
    status: r.status as ReadingStatus,
    startedOn: r.startedOn ?? undefined,
    finishedOn: r.finishedOn ?? undefined,
    progressUnit: r.progressUnit as ProgressUnit,
    progressValue: r.progressValue,
    progressTotal: r.progressTotal ?? undefined,
    countsForGoals: r.countsForGoals,
    abandonReason: r.abandonReason ?? undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function ormInsertReading(reading: Reading): Promise<void> {
  const db = getOrmDb();
  await db.insert(readingsTable).values({
    id: reading.id,
    userId: reading.userId,
    workId: reading.workId,
    editionId: reading.editionId,
    format: reading.format,
    status: reading.status,
    startedOn: reading.startedOn,
    finishedOn: reading.finishedOn,
    progressUnit: reading.progressUnit,
    progressValue: reading.progressValue,
    progressTotal: reading.progressTotal,
    countsForGoals: reading.countsForGoals,
    abandonReason: reading.abandonReason,
    createdAt: reading.createdAt ?? reading.updatedAt,
    updatedAt: reading.updatedAt,
  });
}

export async function ormUpdateReading(
  readingId: string,
  userId: string,
  data: Partial<Reading>
): Promise<void> {
  const db = getOrmDb();
  await db
    .update(readingsTable)
    .set({
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.progressValue !== undefined
        ? { progressValue: data.progressValue }
        : {}),
      ...(data.progressUnit !== undefined
        ? { progressUnit: data.progressUnit }
        : {}),
      ...(data.progressTotal !== undefined
        ? { progressTotal: data.progressTotal }
        : {}),
      ...(data.startedOn !== undefined ? { startedOn: data.startedOn } : {}),
      ...(data.finishedOn !== undefined ? { finishedOn: data.finishedOn } : {}),
      ...(data.abandonReason !== undefined
        ? { abandonReason: data.abandonReason }
        : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(eq(readingsTable.id, readingId), eq(readingsTable.userId, userId))
    );
}

// ============================================================================
// AVALIAÇÕES (REVIEWS)
// ============================================================================

export async function ormGetReviews(userId: string): Promise<Review[]> {
  const db = getOrmDb();
  const rows = await db
    .select()
    .from(reviewsTable)
    .where(eq(reviewsTable.userId, userId))
    .orderBy(desc(reviewsTable.updatedAt));

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    workId: r.workId,
    rating: r.rating,
    narrationRating: r.narrationRating ?? undefined,
    body: r.body ?? undefined,
    isPrivate: r.isPrivate,
    updatedAt: r.updatedAt,
  }));
}

export async function ormUpsertReview(review: Review): Promise<void> {
  const db = getOrmDb();
  const existing = await db
    .select()
    .from(reviewsTable)
    .where(
      and(
        eq(reviewsTable.workId, review.workId),
        eq(reviewsTable.userId, review.userId)
      )
    );

  if (existing.length > 0) {
    await db
      .update(reviewsTable)
      .set({
        rating: review.rating,
        narrationRating: review.narrationRating,
        body: review.body,
        isPrivate: review.isPrivate,
        updatedAt: review.updatedAt,
      })
      .where(
        and(
          eq(reviewsTable.workId, review.workId),
          eq(reviewsTable.userId, review.userId)
        )
      );
  } else {
    await db.insert(reviewsTable).values({
      id: review.id,
      userId: review.userId,
      workId: review.workId,
      rating: review.rating,
      narrationRating: review.narrationRating,
      body: review.body,
      isPrivate: review.isPrivate,
      createdAt: review.updatedAt,
      updatedAt: review.updatedAt,
    });
  }
}

// ============================================================================
// METAS (GOALS)
// ============================================================================

export async function ormGetGoals(userId: string): Promise<ReadingGoal[]> {
  const db = getOrmDb();
  const rows = await db
    .select()
    .from(goalsTable)
    .where(eq(goalsTable.userId, userId))
    .orderBy(asc(goalsTable.startsOn));

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    title: r.title,
    kind: r.kind as GoalKind,
    period: r.period as GoalPeriod,
    startsOn: r.startsOn,
    endsOn: r.endsOn,
    targetValue: r.targetValue,
    tolerancePercent: r.tolerancePercent,
    countRereads: r.countRereads,
    paused: r.paused,
    pausedAt: r.pausedAt ?? undefined,
    createdAt: r.createdAt,
  }));
}

export async function ormInsertGoal(goal: ReadingGoal): Promise<void> {
  const db = getOrmDb();
  await db.insert(goalsTable).values({
    id: goal.id,
    userId: goal.userId,
    title: goal.title,
    kind: goal.kind,
    period: goal.period,
    startsOn: goal.startsOn,
    endsOn: goal.endsOn,
    targetValue: goal.targetValue,
    tolerancePercent: goal.tolerancePercent,
    countRereads: goal.countRereads,
    paused: Boolean(goal.paused),
    pausedAt: goal.pausedAt ?? null,
    createdAt: goal.createdAt,
  });
}

export async function ormUpdateGoal(
  goalId: string,
  userId: string,
  data: Partial<
    Pick<
      ReadingGoal,
      "title" | "targetValue" | "endsOn" | "paused" | "pausedAt"
    >
  >
): Promise<void> {
  const db = getOrmDb();
  await db
    .update(goalsTable)
    .set({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.targetValue !== undefined
        ? { targetValue: data.targetValue }
        : {}),
      ...(data.endsOn !== undefined ? { endsOn: data.endsOn } : {}),
      ...(data.paused !== undefined ? { paused: data.paused } : {}),
      ...(data.pausedAt !== undefined ? { pausedAt: data.pausedAt } : {}),
    })
    .where(and(eq(goalsTable.id, goalId), eq(goalsTable.userId, userId)));
}

export async function ormDeleteGoal(
  goalId: string,
  userId: string
): Promise<void> {
  const db = getOrmDb();
  await db
    .delete(goalsTable)
    .where(and(eq(goalsTable.id, goalId), eq(goalsTable.userId, userId)));
}

// ============================================================================
// LISTA DE DESEJOS (WISHLIST)
// ============================================================================

export async function ormGetWishlist(userId: string): Promise<WishlistItem[]> {
  const db = getOrmDb();
  const rows = await db
    .select()
    .from(wishlistTable)
    .where(eq(wishlistTable.userId, userId))
    .orderBy(desc(wishlistTable.priority));

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    workId: r.workId,
    editionId: r.editionId ?? undefined,
    priority: r.priority as WishlistItem["priority"],
    targetPrice: r.targetPrice ?? undefined,
    currency: r.currency,
    notes: r.notes ?? undefined,
    status: r.status as WishStatus,
    createdAt: r.createdAt,
  }));
}

export async function ormInsertWishlistItem(item: WishlistItem): Promise<void> {
  const db = getOrmDb();
  await db.insert(wishlistTable).values({
    id: item.id,
    userId: item.userId,
    workId: item.workId,
    editionId: item.editionId,
    priority: item.priority,
    targetPrice: item.targetPrice,
    currency: item.currency,
    notes: item.notes,
    status: item.status,
    createdAt: item.createdAt,
  });
}

export async function ormDeleteWishlistItem(
  wishId: string,
  userId: string
): Promise<void> {
  const db = getOrmDb();
  await db
    .delete(wishlistTable)
    .where(and(eq(wishlistTable.id, wishId), eq(wishlistTable.userId, userId)));
}

export async function ormGetUserSettings(userId: string) {
  const db = getOrmDb();
  const rows = await db
    .select()
    .from(userSettingsTable)
    .where(eq(userSettingsTable.userId, userId));
  return rows[0] ?? null;
}

export async function ormUpsertUserSettings(settings: {
  userId: string;
  theme: string;
  density: string;
  motion: string;
  fx: string;
  shelfLayoutJson: string;
  ambientPreferencesJson: string;
  focusDefaultMode: string;
  onboardingGuideJson?: string;
  updatedAt: string;
}) {
  const db = getOrmDb();
  const existing = await ormGetUserSettings(settings.userId);
  if (existing) {
    await db
      .update(userSettingsTable)
      .set({
        theme: settings.theme,
        density: settings.density,
        motion: settings.motion,
        fx: settings.fx,
        shelfLayoutJson: settings.shelfLayoutJson,
        ambientPreferencesJson: settings.ambientPreferencesJson,
        focusDefaultMode: settings.focusDefaultMode,
        ...(settings.onboardingGuideJson !== undefined
          ? { onboardingGuideJson: settings.onboardingGuideJson }
          : {}),
        updatedAt: settings.updatedAt,
      })
      .where(eq(userSettingsTable.userId, settings.userId));
  } else {
    await db.insert(userSettingsTable).values({
      ...settings,
      onboardingGuideJson: settings.onboardingGuideJson ?? "{}",
    });
  }
}

// ============================================================================
// CARGA INICIAL E SINCRONIZAÇÃO DE WORKSPACE
// ============================================================================

export async function ormSeedWorkspace(ws: {
  profile: UserProfile;
  passwordHashSim: string;
  works: Work[];
  editions: Edition[];
  shelves: Shelf[];
  items: LibraryItem[];
  wishlist: WishlistItem[];
  readings: Reading[];
  reviews: Review[];
  goals: ReadingGoal[];
}): Promise<void> {
  const existing = await ormFindUserById(ws.profile.id);
  if (existing) {
    return;
  }

  const sqlite = getDatabase();
  sqlite.exec("BEGIN IMMEDIATE;");
  try {
    await ormCreateUser({
      id: ws.profile.id,
      email: ws.profile.email,
      displayName: ws.profile.displayName,
      passwordHash: ws.passwordHashSim,
      locale: ws.profile.locale,
      timezone: ws.profile.timezone,
      theme: ws.profile.theme,
      defaultCurrency: ws.profile.defaultCurrency,
      threeD: ws.profile.threeD,
      goalsCountRereads: ws.profile.goalsCountRereads,
      maxSimultaneousReadings: ws.profile.maxSimultaneousReadings,
      telemetryOptOut: ws.profile.telemetryOptOut,
      onboardingCompleted: ws.profile.onboardingCompleted,
      acceptedTermsVersion: ws.profile.acceptedTermsVersion,
      acceptedTermsAt: ws.profile.acceptedTermsAt,
      createdAt: new Date().toISOString(),
    });

    for (const w of ws.works) {
      await ormInsertWork(w);
    }
    for (const ed of ws.editions) {
      await ormInsertEdition(ed);
    }
    await ormInsertShelves(ws.shelves);
    for (const it of ws.items) {
      await ormInsertLibraryItem(it);
    }
    for (const r of ws.readings) {
      await ormInsertReading(r);
    }
    for (const rev of ws.reviews) {
      await ormUpsertReview(rev);
    }
    for (const g of ws.goals) {
      await ormInsertGoal(g);
    }
    for (const wish of ws.wishlist) {
      await ormInsertWishlistItem(wish);
    }
    sqlite.exec("COMMIT;");
  } catch (err) {
    try {
      sqlite.exec("ROLLBACK;");
    } catch {
      // ignora se a transação já foi desfeita
    }
    throw err;
  }
}
