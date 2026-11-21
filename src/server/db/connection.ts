import "server-only";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

/**
 * readingflow · Conexão com o Banco e Instância do ORM (Drizzle ORM)
 * Utiliza o driver nativo Node.js DatabaseSync (node:sqlite) integrado com Drizzle ORM.
 *
 * REGRA RIGOROSA:
 * - ZERO concatenação de strings para montar queries.
 * - Todos os parâmetros são fornecidos através de binds seguros (?, ?, ?).
 */

declare global {
  var __readingFlowSqliteDb: DatabaseSync | undefined;
  var __readingFlowDrizzle: ReturnType<typeof createDrizzleInstance> | undefined;
}

function initTables(sqlite: DatabaseSync) {
  // Inicialização DDL com separação estrita de tipos
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      locale TEXT NOT NULL DEFAULT 'pt-BR',
      timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
      theme TEXT NOT NULL DEFAULT 'editorial-light',
      density TEXT NOT NULL DEFAULT 'comfortable',
      motion TEXT NOT NULL DEFAULT 'system',
      default_currency TEXT NOT NULL DEFAULT 'BRL',
      three_d TEXT NOT NULL DEFAULT 'auto',
      goals_count_rereads INTEGER NOT NULL DEFAULT 0,
      max_simultaneous_readings INTEGER NOT NULL DEFAULT 5,
      telemetry_opt_out INTEGER NOT NULL DEFAULT 0,
      onboarding_completed INTEGER NOT NULL DEFAULT 0,
      accepted_terms_version TEXT NOT NULL DEFAULT '1.0',
      accepted_terms_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS works (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      original_title TEXT,
      original_language TEXT DEFAULT 'pt-BR',
      contributors_json TEXT NOT NULL DEFAULT '[]',
      first_published_year INTEGER,
      primary_genre TEXT,
      description TEXT,
      fingerprint TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS editions (
      id TEXT PRIMARY KEY,
      work_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      isbn13 TEXT,
      isbn10 TEXT,
      title TEXT NOT NULL,
      publisher TEXT,
      format TEXT NOT NULL DEFAULT 'paperback',
      pages INTEGER,
      duration_seconds INTEGER,
      cover_url TEXT,
      cover_source TEXT,
      cover_color TEXT,
      spine_accent TEXT,
      contributors_json TEXT NOT NULL DEFAULT '[]',
      language TEXT DEFAULT 'pt-BR',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shelves (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'physical',
      sort_mode TEXT NOT NULL DEFAULT 'manual',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS library_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      edition_id TEXT NOT NULL,
      shelf_id TEXT NOT NULL,
      shelf_position INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'owned',
      price_paid REAL,
      currency TEXT NOT NULL DEFAULT 'BRL',
      acquired_on TEXT,
      store TEXT,
      condition TEXT,
      notes TEXT,
      favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS readings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      work_id TEXT NOT NULL,
      edition_id TEXT,
      format TEXT NOT NULL DEFAULT 'paperback',
      status TEXT NOT NULL DEFAULT 'reading',
      started_on TEXT,
      finished_on TEXT,
      progress_unit TEXT NOT NULL DEFAULT 'pages',
      progress_value REAL NOT NULL DEFAULT 0,
      progress_total REAL,
      counts_for_goals INTEGER NOT NULL DEFAULT 1,
      abandon_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      work_id TEXT NOT NULL,
      rating REAL NOT NULL,
      narration_rating REAL,
      body TEXT,
      is_private INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'books',
      period TEXT NOT NULL DEFAULT 'year',
      starts_on TEXT NOT NULL,
      ends_on TEXT NOT NULL,
      target_value INTEGER NOT NULL,
      tolerance_percent INTEGER NOT NULL DEFAULT 5,
      count_rereads INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wishlist (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      work_id TEXT NOT NULL,
      edition_id TEXT,
      priority INTEGER NOT NULL DEFAULT 3,
      target_price REAL,
      currency TEXT NOT NULL DEFAULT 'BRL',
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'wanted',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Migração idempotente para bases SQLite locais já existentes
  const editionCols = sqlite.prepare("PRAGMA table_info(editions)").all() as Array<{ name?: string }>;
  const colNames = new Set(editionCols.map((c) => c.name));
  if (!colNames.has("cover_source")) {
    sqlite.exec("ALTER TABLE editions ADD COLUMN cover_source TEXT");
  }
  if (!colNames.has("spine_accent")) {
    sqlite.exec("ALTER TABLE editions ADD COLUMN spine_accent TEXT");
  }

  const userCols = sqlite
    .prepare("PRAGMA table_info(users)")
    .all() as Array<{ name?: string }>;
  const userColNames = new Set(userCols.map((c) => c.name));
  if (!userColNames.has("density")) {
    sqlite.exec(
      "ALTER TABLE users ADD COLUMN density TEXT NOT NULL DEFAULT 'comfortable'"
    );
  }
  if (!userColNames.has("motion")) {
    sqlite.exec(
      "ALTER TABLE users ADD COLUMN motion TEXT NOT NULL DEFAULT 'system'"
    );
  }
}

function createDrizzleInstance(sqlite: DatabaseSync) {
  return drizzle(
    async (sql, params, method) => {
      // Execução estritamente parametrizada — ZERO concatenação de strings
      const stmt = sqlite.prepare(sql);
      if (method === "run") {
        stmt.run(...params);
        return { rows: [] };
      }
      stmt.setReturnArrays(true);
      if (method === "get") {
        const row = stmt.get(...params) as unknown as unknown[] | undefined;
        return { rows: (row ?? undefined) as unknown[] };
      }
      const rows = stmt.all(...params) as unknown as unknown[][];
      return { rows };
    },
    { schema }
  );
}

export function getDatabase(): DatabaseSync {
  if (!globalThis.__readingFlowSqliteDb) {
    const sqlite = new DatabaseSync(":memory:");
    initTables(sqlite);
    globalThis.__readingFlowSqliteDb = sqlite;
  }
  return globalThis.__readingFlowSqliteDb;
}

export function getOrmDb() {
  if (!globalThis.__readingFlowDrizzle) {
    const sqlite = getDatabase();
    globalThis.__readingFlowDrizzle = createDrizzleInstance(sqlite);
  }
  return globalThis.__readingFlowDrizzle;
}
