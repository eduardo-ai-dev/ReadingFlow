import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * readingflow · Conexão com o Banco (Cloudflare D1 + Drizzle ORM)
 *
 * - Em Cloudflare Workers (produção / preview / `wrangler dev`): exige o binding
 *   único `env.DB` obtido via `getCloudflareContext()`. Se o binding faltar em
 *   runtime Workers, falha explicitamente (nunca cai silenciosamente em memória).
 * - Em testes unitários (Vitest): usa o adaptador D1 em memória registrado por
 *   `tests/setup-sqlite.ts` (fora de `src/`), garantindo ZERO import de `node:sqlite`
 *   no bundle do Worker.
 * - Fora do Workers em desenvolvimento local (`next dev` / `next start` local):
 *   usa shim no-op apenas para não travar a renderização sem Wrangler.
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
  var __readingFlowD1AccessCount: number | undefined;
}

const drizzleCache = new WeakMap<object, DrizzleD1Database<typeof schema>>();
const instrumentedCache = new WeakMap<object, D1DatabaseLike>();

/** Contador de acessos ao D1 (instrumentação para provar D1 = 0 no modo demonstração). */
export function getD1AccessCount(): number {
  return globalThis.__readingFlowD1AccessCount ?? 0;
}

export function resetD1AccessCount(): void {
  globalThis.__readingFlowD1AccessCount = 0;
}

function recordD1Access(): void {
  globalThis.__readingFlowD1AccessCount =
    (globalThis.__readingFlowD1AccessCount ?? 0) + 1;
}

function wrapWithAccessCounter(d1: D1DatabaseLike): D1DatabaseLike {
  const existing = instrumentedCache.get(d1);
  if (existing) return existing;

  const wrapStmt = (
    stmt: D1PreparedStatementLike
  ): D1PreparedStatementLike => ({
    bind: (...values: unknown[]) => wrapStmt(stmt.bind(...values)),
    first: async <T = Record<string, unknown>>(colName?: string) => {
      recordD1Access();
      return colName !== undefined ? stmt.first<T>(colName) : stmt.first<T>();
    },
    run: async <T = Record<string, unknown>>() => {
      recordD1Access();
      return stmt.run<T>();
    },
    all: async <T = Record<string, unknown>>() => {
      recordD1Access();
      return stmt.all<T>();
    },
    raw: async <T = unknown[]>(options?: { columnNames?: boolean }) => {
      recordD1Access();
      return options !== undefined ? stmt.raw<T>(options) : stmt.raw<T>();
    },
  });

  const wrapped: D1DatabaseLike = {
    prepare: (query: string) => wrapStmt(d1.prepare(query)),
    batch: async <T = unknown>(statements: D1PreparedStatementLike[]) => {
      recordD1Access();
      // Drizzle e D1 nativo esperam os statements reais no batch; quando os statements
      // vierem do prepare() do próprio d1, já funcionam nativamente se não re-embrulhados.
      return d1.batch<T>(statements);
    },
    exec: async (query: string) => {
      recordD1Access();
      return d1.exec(query);
    },
  };

  instrumentedCache.set(d1, wrapped);
  return wrapped;
}

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

/** Detecta se o processo está rodando no runtime Cloudflare Workers (`workerd`). */
export function isCloudflareWorkersRuntime(): boolean {
  if (
    typeof navigator !== "undefined" &&
    navigator.userAgent === "Cloudflare-Workers"
  ) {
    return true;
  }
  try {
    const ctx = getCloudflareContext({ async: false });
    return Boolean(ctx && typeof ctx === "object" && "env" in ctx);
  } catch {
    return false;
  }
}

/** Registra adaptadores locais em memória exclusivamente a partir do setup do Vitest (`tests/setup-sqlite.ts`). */
export function registerTestDatabases(
  d1Adapter: D1DatabaseLike,
  rawSqlite?: SyncSqliteLike
): void {
  globalThis.__readingFlowTestD1 = wrapWithAccessCounter(d1Adapter);
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
 * Retorna a instância ativa do banco D1:
 * - Em Workers: obrigatoriamente o binding `DB`; falha explicitamente se ausente.
 * - Em Vitest: adaptador D1 em memória com contador de acessos.
 * - Em dev local fora do Wrangler: shim no-op leve.
 */
export function getD1Database(): D1DatabaseLike {
  const cfDb = getCloudflareD1Binding();
  if (cfDb) {
    // Em runtime real do Cloudflare Workers, preservamos o objeto D1 nativo para compatibilidade
    // total com `d1.batch([...])` (que exige D1PreparedStatement nativo do workerd), contabilizando
    // o acesso no ponto de entrada.
    recordD1Access();
    return cfDb;
  }

  if (globalThis.__readingFlowTestD1) {
    return globalThis.__readingFlowTestD1;
  }

  if (isCloudflareWorkersRuntime()) {
    throw new Error(
      'Binding Cloudflare D1 "DB" ausente no ambiente Workers. Verifique d1_databases em wrangler.jsonc.'
    );
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
