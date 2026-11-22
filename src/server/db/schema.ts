import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

/**
 * readingflow · Drizzle ORM Schema
 * Tabelas relacionais estritas para SQLite/Postgres.
 * ZERO concatenação de strings: todas as queries utilizam os seletores tipados do Drizzle.
 */

export const usersTable = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  locale: text("locale").notNull().default("pt-BR"),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  theme: text("theme").notNull().default("editorial-light"),
  density: text("density").notNull().default("comfortable"),
  motion: text("motion").notNull().default("system"),
  defaultCurrency: text("default_currency").notNull().default("BRL"),
  threeD: text("three_d").notNull().default("auto"),
  goalsCountRereads: integer("goals_count_rereads", { mode: "boolean" })
    .notNull()
    .default(false),
  maxSimultaneousReadings: integer("max_simultaneous_readings")
    .notNull()
    .default(5),
  telemetryOptOut: integer("telemetry_opt_out", { mode: "boolean" })
    .notNull()
    .default(false),
  onboardingCompleted: integer("onboarding_completed", { mode: "boolean" })
    .notNull()
    .default(false),
  acceptedTermsVersion: text("accepted_terms_version").notNull().default("1.0"),
  acceptedTermsAt: text("accepted_terms_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const worksTable = sqliteTable("works", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  originalTitle: text("original_title"),
  originalLanguage: text("original_language").default("pt-BR"),
  contributorsJson: text("contributors_json").notNull().default("[]"),
  firstPublishedYear: integer("first_published_year"),
  primaryGenre: text("primary_genre"),
  description: text("description"),
  fingerprint: text("fingerprint").notNull().default(""),
  source: text("source").notNull().default("manual"),
  createdAt: text("created_at").notNull(),
});

export const editionsTable = sqliteTable("editions", {
  id: text("id").primaryKey(),
  workId: text("work_id").notNull(),
  userId: text("user_id").notNull(),
  isbn13: text("isbn13"),
  isbn10: text("isbn10"),
  title: text("title").notNull(),
  publisher: text("publisher"),
  format: text("format").notNull().default("paperback"),
  pages: integer("pages"),
  durationSeconds: integer("duration_seconds"),
  coverUrl: text("cover_url"),
  coverSource: text("cover_source"),
  coverLocked: integer("cover_locked", { mode: "boolean" })
    .notNull()
    .default(false),
  coverSelectedAt: text("cover_selected_at"),
  coverColor: text("cover_color"),
  coverAccentColor: text("spine_accent"),
  contributorsJson: text("contributors_json").notNull().default("[]"),
  language: text("language").default("pt-BR"),
  createdAt: text("created_at").notNull(),
});

export const shelvesTable = sqliteTable("shelves", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("physical"),
  sortMode: text("sort_mode").notNull().default("manual"),
  position: integer("position").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const libraryItemsTable = sqliteTable("library_items", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  editionId: text("edition_id").notNull(),
  shelfId: text("shelf_id").notNull(),
  shelfPosition: integer("shelf_position").notNull().default(0),
  status: text("status").notNull().default("owned"),
  pricePaid: real("price_paid"),
  currency: text("currency").notNull().default("BRL"),
  acquiredOn: text("acquired_on"),
  store: text("store"),
  condition: text("condition"),
  notes: text("notes"),
  favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const readingsTable = sqliteTable("readings", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  workId: text("work_id").notNull(),
  editionId: text("edition_id"),
  format: text("format").notNull().default("paperback"),
  status: text("status").notNull().default("reading"),
  startedOn: text("started_on"),
  finishedOn: text("finished_on"),
  progressUnit: text("progress_unit").notNull().default("pages"),
  progressValue: real("progress_value").notNull().default(0),
  progressTotal: real("progress_total"),
  countsForGoals: integer("counts_for_goals", { mode: "boolean" })
    .notNull()
    .default(true),
  abandonReason: text("abandon_reason"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const reviewsTable = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  workId: text("work_id").notNull(),
  rating: real("rating").notNull(),
  narrationRating: real("narration_rating"),
  body: text("body"),
  isPrivate: integer("is_private", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const goalsTable = sqliteTable("goals", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  kind: text("kind").notNull().default("books"),
  period: text("period").notNull().default("year"),
  startsOn: text("starts_on").notNull(),
  endsOn: text("ends_on").notNull(),
  targetValue: integer("target_value").notNull(),
  tolerancePercent: integer("tolerance_percent").notNull().default(5),
  countRereads: integer("count_rereads", { mode: "boolean" })
    .notNull()
    .default(false),
  paused: integer("paused", { mode: "boolean" }).notNull().default(false),
  pausedAt: text("paused_at"),
  createdAt: text("created_at").notNull(),
});

export const wishlistTable = sqliteTable("wishlist", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  workId: text("work_id").notNull(),
  editionId: text("edition_id"),
  priority: integer("priority").notNull().default(3),
  targetPrice: real("target_price"),
  currency: text("currency").notNull().default("BRL"),
  notes: text("notes"),
  status: text("status").notNull().default("wanted"),
  createdAt: text("created_at").notNull(),
});

export const sessionsTable = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull(),
  createdAt: text("created_at").notNull(),
});

export const userSettingsTable = sqliteTable("user_settings", {
  userId: text("user_id").primaryKey(),
  theme: text("theme").notNull().default("caderno"),
  density: text("density").notNull().default("comfortable"),
  motion: text("motion").notNull().default("system"),
  fx: text("fx").notNull().default("full"),
  shelfLayoutJson: text("shelf_layout_json").notNull().default("{}"),
  ambientPreferencesJson: text("ambient_preferences_json")
    .notNull()
    .default("{}"),
  focusDefaultMode: text("focus_default_mode").notNull().default("free"),
  updatedAt: text("updated_at").notNull(),
});
