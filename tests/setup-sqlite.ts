import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import {
  registerTestDatabases,
  type D1DatabaseLike,
  type D1PreparedStatementLike,
} from "@/server/db/connection";

function createSqliteD1Adapter(sqlite: DatabaseSync): D1DatabaseLike {
  const objStmtCache = new Map<string, ReturnType<DatabaseSync["prepare"]>>();
  const rawStmtCache = new Map<string, ReturnType<DatabaseSync["prepare"]>>();

  const getObjStmt = (sql: string) => {
    let stmt = objStmtCache.get(sql);
    if (!stmt) {
      stmt = sqlite.prepare(sql);
      objStmtCache.set(sql, stmt);
    }
    return stmt;
  };

  const getRawStmt = (sql: string) => {
    let stmt = rawStmtCache.get(sql);
    if (!stmt) {
      stmt = sqlite.prepare(sql);
      stmt.setReturnArrays(true);
      rawStmtCache.set(sql, stmt);
    }
    return stmt;
  };

  const normalizeParams = (params: unknown[]): SQLInputValue[] =>
    params.map((value) => {
      if (value === undefined) return null;
      if (typeof value === "boolean") return value ? 1 : 0;
      return value as SQLInputValue;
    });

  const makeStatement = (
    sql: string,
    boundParams: unknown[] = []
  ): D1PreparedStatementLike => ({
    bind(...values: unknown[]) {
      return makeStatement(sql, values);
    },
    async first<T = Record<string, unknown>>(colName?: string) {
      const row = getObjStmt(sql).get(...normalizeParams(boundParams)) as
        Record<string, unknown> | undefined;
      if (!row) return null;
      if (colName) return (row[colName] as T) ?? null;
      return row as T;
    },
    async run<T = Record<string, unknown>>() {
      const res = getObjStmt(sql).run(...normalizeParams(boundParams));
      return {
        results: [] as T[],
        success: true,
        meta: { changes: Number(res.changes ?? 0) },
      };
    },
    async all<T = Record<string, unknown>>() {
      const rows = getObjStmt(sql).all(...normalizeParams(boundParams)) as T[];
      return {
        results: rows,
        success: true,
        meta: {},
      };
    },
    async raw<T = unknown[]>() {
      return getRawStmt(sql).all(...normalizeParams(boundParams)) as T[];
    },
  });

  return {
    prepare(sql: string) {
      return makeStatement(sql);
    },
    async batch<T = unknown>(statements: D1PreparedStatementLike[]) {
      const out: Array<{
        results: T[];
        success: boolean;
        meta: Record<string, unknown>;
      }> = [];
      for (const stmt of statements) {
        out.push(await stmt.all<T>());
      }
      return out;
    },
    async exec(sql: string) {
      const t0 = performance.now();
      sqlite.exec(sql);
      return { count: 1, duration: performance.now() - t0 };
    },
  };
}

const migrationPath = path.resolve(
  process.cwd(),
  "migrations",
  "0001_initial.sql"
);
const initialSql = fs.readFileSync(migrationPath, "utf8");

const sqlite = new DatabaseSync(":memory:");
sqlite.exec(initialSql);

registerTestDatabases(createSqliteD1Adapter(sqlite), sqlite);
