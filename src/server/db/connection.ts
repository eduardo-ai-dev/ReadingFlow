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
  var __readingFlowDrizzle:
    ReturnType<typeof createDrizzleInstance> | undefined;
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
      cover_locked INTEGER NOT NULL DEFAULT 0,
      cover_selected_at TEXT,
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
      paused INTEGER NOT NULL DEFAULT 0,
      paused_at TEXT,
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

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      theme TEXT NOT NULL DEFAULT 'caderno',
      density TEXT NOT NULL DEFAULT 'comfortable',
      motion TEXT NOT NULL DEFAULT 'system',
      fx TEXT NOT NULL DEFAULT 'full',
      shelf_layout_json TEXT NOT NULL DEFAULT '{}',
      ambient_preferences_json TEXT NOT NULL DEFAULT '{}',
      focus_default_mode TEXT NOT NULL DEFAULT 'free',
      onboarding_guide_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL
    );

    -- Tabelas de segurança de autenticação (nunca armazenam e-mail em claro nem senhas)
    CREATE TABLE IF NOT EXISTS auth_login_attempts (
      scope_type TEXT NOT NULL,
      scope_key TEXT NOT NULL,
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      window_started_at_ms INTEGER NOT NULL DEFAULT 0,
      locked_until_ms INTEGER NOT NULL DEFAULT 0,
      lockout_level INTEGER NOT NULL DEFAULT 0,
      last_failure_at_ms INTEGER NOT NULL DEFAULT 0,
      last_success_at_ms INTEGER NOT NULL DEFAULT 0,
      alert_sent_at_ms INTEGER NOT NULL DEFAULT 0,
      updated_at_ms INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (scope_type, scope_key)
    );

    CREATE TABLE IF NOT EXISTS auth_attack_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_key TEXT NOT NULL,
      account_hmac TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_security_state (
      state_key TEXT PRIMARY KEY,
      value_int INTEGER NOT NULL DEFAULT 0,
      updated_at_ms INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS auth_secrets (
      id TEXT PRIMARY KEY,
      purpose TEXT NOT NULL,
      account_hmac TEXT NOT NULL,
      user_id TEXT NOT NULL,
      secret_hash TEXT NOT NULL,
      expires_at_ms INTEGER NOT NULL,
      created_at_ms INTEGER NOT NULL
    );

    -- Índices compostos cobrindo user_id + filtros/ordenação de Painel, Estantes, Busca e Métricas
    CREATE INDEX IF NOT EXISTS idx_works_user_created ON works (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_works_user_genre ON works (user_id, primary_genre);
    CREATE INDEX IF NOT EXISTS idx_editions_user_created ON editions (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_editions_work_id ON editions (work_id);
    CREATE INDEX IF NOT EXISTS idx_editions_user_format ON editions (user_id, format);
    CREATE INDEX IF NOT EXISTS idx_shelves_user_position ON shelves (user_id, position ASC);
    CREATE INDEX IF NOT EXISTS idx_library_items_user_shelf_pos ON library_items (user_id, shelf_id ASC, shelf_position ASC);
    CREATE INDEX IF NOT EXISTS idx_library_items_user_status ON library_items (user_id, status);
    CREATE INDEX IF NOT EXISTS idx_readings_user_updated ON readings (user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_readings_user_status_updated ON readings (user_id, status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_readings_user_status_finished ON readings (user_id, status, finished_on DESC);
    CREATE INDEX IF NOT EXISTS idx_readings_user_work ON readings (user_id, work_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_user_updated ON reviews (user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_reviews_user_work ON reviews (user_id, work_id);
    CREATE INDEX IF NOT EXISTS idx_goals_user_starts ON goals (user_id, starts_on ASC);
    CREATE INDEX IF NOT EXISTS idx_wishlist_user_status_priority ON wishlist (user_id, status, priority ASC);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
    CREATE INDEX IF NOT EXISTS idx_auth_attack_events_created ON auth_attack_events (created_at_ms DESC);
    CREATE INDEX IF NOT EXISTS idx_auth_secrets_purpose_account ON auth_secrets (purpose, account_hmac);
    CREATE INDEX IF NOT EXISTS idx_auth_secrets_expires ON auth_secrets (expires_at_ms);
  `);

  // Migração idempotente para bases SQLite locais já existentes
  const editionCols = sqlite
    .prepare("PRAGMA table_info(editions)")
    .all() as Array<{ name?: string }>;
  const colNames = new Set(editionCols.map((c) => c.name));
  if (!colNames.has("cover_source")) {
    sqlite.exec("ALTER TABLE editions ADD COLUMN cover_source TEXT");
  }
  if (!colNames.has("spine_accent")) {
    sqlite.exec("ALTER TABLE editions ADD COLUMN spine_accent TEXT");
  }
  if (!colNames.has("cover_locked")) {
    sqlite.exec(
      "ALTER TABLE editions ADD COLUMN cover_locked INTEGER NOT NULL DEFAULT 0"
    );
  }
  if (!colNames.has("cover_selected_at")) {
    sqlite.exec("ALTER TABLE editions ADD COLUMN cover_selected_at TEXT");
  }

  const userCols = sqlite.prepare("PRAGMA table_info(users)").all() as Array<{
    name?: string;
  }>;
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

  const goalCols = sqlite.prepare("PRAGMA table_info(goals)").all() as Array<{
    name?: string;
  }>;
  const goalColNames = new Set(goalCols.map((c) => c.name));
  if (!goalColNames.has("paused")) {
    sqlite.exec(
      "ALTER TABLE goals ADD COLUMN paused INTEGER NOT NULL DEFAULT 0"
    );
  }
  if (!goalColNames.has("paused_at")) {
    sqlite.exec("ALTER TABLE goals ADD COLUMN paused_at TEXT");
  }

  const settingsCols = sqlite
    .prepare("PRAGMA table_info(user_settings)")
    .all() as Array<{ name?: string }>;
  const settingsColNames = new Set(settingsCols.map((c) => c.name));
  if (!settingsColNames.has("onboarding_guide_json")) {
    sqlite.exec(
      "ALTER TABLE user_settings ADD COLUMN onboarding_guide_json TEXT NOT NULL DEFAULT '{}'"
    );
  }
}

function createDrizzleInstance(sqlite: DatabaseSync) {
  const stmtCache = new Map<string, ReturnType<DatabaseSync["prepare"]>>();

  return drizzle(
    async (sql, params, method) => {
      // Execução estritamente parametrizada com cache de Prepared Statements — ZERO concatenação de strings
      const cacheKey = `${method === "run" ? "r" : "a"}:${sql}`;
      let stmt = stmtCache.get(cacheKey);
      if (!stmt) {
        stmt = sqlite.prepare(sql);
        if (method !== "run") {
          stmt.setReturnArrays(true);
        }
        stmtCache.set(cacheKey, stmt);
      }

      if (method === "run") {
        stmt.run(...params);
        return { rows: [] };
      }
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
