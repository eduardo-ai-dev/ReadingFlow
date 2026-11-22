import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * readingflow · Conexão com o Banco (Cloudflare D1 + Drizzle ORM)
 *
 * - Em produção / preview / `wrangler dev`: usa o binding `env.DB` (Cloudflare D1)
 *   obtido via `getCloudflareContext()`.
 * - Em testes unitários (Vitest): usa o adaptador D1 em memória registrado por
 *   `tests/setup-sqlite.ts` (fora de `src/`), garantindo ZERO import de `node:sqlite`
 *   no bundle do Worker.
 * - Em `next dev` / `next start` fora do Wrangler: usa fallback leve em memória
 *   enquanto o repositório de sessão cuida do estado local de desenvolvimento.
 *
 * REGRA RIGOROSA:
 * - ZERO concatenação de strings para montar queries.
 * - Todos os parâmetros são fornecidos através de binds seguros (?, ?, ?).
 */

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<{
    results: T[];
    success: boolean;
    meta: Record<string, unknown>;
  }>;
  all<T = Record<string, unknown>>(): Promise<{
    results: T[];
    success: boolean;
    meta: Record<string, unknown>;
  }>;
  raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[]>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
  batch<T = unknown>(
    statements: D1PreparedStatementLike[]
  ): Promise<
    Array<{
      results: T[];
      success: boolean;
      meta: Record<string, unknown>;
    }>
  >;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

/** Interface estrutural mínima usada apenas pelo adaptador síncrono registrado nos testes Vitest. */
export interface SyncSqliteStatementLike {
  run(...params: unknown[]): { changes?: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  setReturnArrays?(enabled: boolean): void;
}

export interface SyncSqliteLike {
  exec(sql: string): void;
  prepare(sql: string): SyncSqliteStatementLike;
}

declare global {
  interface CloudflareEnv {
    DB?: D1DatabaseLike;
  }

  var __readingFlowTestD1: D1DatabaseLike | undefined;
  var __readingFlowTestSqlite: SyncSqliteLike | undefined;
  var __readingFlowNoopD1: D1DatabaseLike | undefined;
}

const drizzleCache = new WeakMap<object, DrizzleD1Database<typeof schema>>();

function createNoopD1(): D1DatabaseLike {
  const makeStmt = (): D1PreparedStatementLike => {
    const stmt: D1PreparedStatementLike = {
      bind: () => stmt,
      first: async () => null,
      run: async () => ({ results: [], success: true, meta: { changes: 0 } }),
      all: async () => ({ results: [], success: true, meta: {} }),
      raw: async () => [],
    };
    return stmt;
  };
  return {
    prepare: () => makeStmt(),
    batch: async (stmts) =>
      stmts.map(() => ({ results: [], success: true, meta: { changes: 0 } })),
    exec: async () => ({ count: 0, duration: 0 }),
  };
}

/** Registra adaptadores locais em memória exclusivamente a partir do setup do Vitest (`tests/setup-sqlite.ts`). */
export function registerTestDatabases(
  d1Adapter: D1DatabaseLike,
  rawSqlite?: SyncSqliteLike
): void {
  globalThis.__readingFlowTestD1 = d1Adapter;
  if (rawSqlite) {
    globalThis.__readingFlowTestSqlite = rawSqlite;
  }
}

/** Retorna o driver SQLite síncrono APENAS quando registrado no ambiente de testes Vitest. */
export function getTestSqliteDatabase(): SyncSqliteLike | null {
  return globalThis.__readingFlowTestSqlite ?? null;
}

/**
 * Resolve o binding `DB` do Cloudflare D1 no contexto ativo do Worker.
 * Retorna `null` fora do runtime Cloudflare (ex.: `next dev` local ou Vitest).
 */
export function getCloudflareD1Binding(): D1DatabaseLike | null {
  try {
    const ctx = getCloudflareContext({ async: false });
    const db = (ctx?.env as { DB?: D1DatabaseLike } | undefined)?.DB;
    if (db && typeof db.prepare === "function") {
      return db;
    }
  } catch {
    // Fora do contexto OpenNext/Cloudflare (ex.: next dev, next build ou Vitest)
  }
  return null;
}

/**
 * Retorna a instância ativa do banco D1 (binding Cloudflare em produção/preview,
 * adaptador D1 em memória no Vitest, ou shim no-op fora do Wrangler).
 */
export function getD1Database(): D1DatabaseLike {
  const cfDb = getCloudflareD1Binding();
  if (cfDb) return cfDb;

  if (globalThis.__readingFlowTestD1) {
    return globalThis.__readingFlowTestD1;
  }

  if (!globalThis.__readingFlowNoopD1) {
    globalThis.__readingFlowNoopD1 = createNoopD1();
  }
  return globalThis.__readingFlowNoopD1;
}

/**
 * Instância tipada do Drizzle ORM sobre Cloudflare D1 (`drizzle-orm/d1`).
 * Cacheada por referência de binding via WeakMap (segura por request em Workers).
 */
export function getOrmDb(): DrizzleD1Database<typeof schema> {
  const d1 = getD1Database();
  let cached = drizzleCache.get(d1);
  if (!cached) {
    cached = drizzle(d1 as unknown as Parameters<typeof drizzle>[0], {
      schema,
    });
    drizzleCache.set(d1, cached);
  }
  return cached;
}
