import "server-only";
import {
  getCloudflareD1Binding,
  getD1Database,
  isCloudflareWorkersRuntime,
} from "./connection";

export interface DatabaseHealthReport {
  ok: boolean;
  runtime: "cloudflare-workers" | "node";
  db: "d1" | "local" | "missing_binding" | "schema_missing" | "error";
  schemaVersion?: string;
  foreignKeys?: boolean;
  error?: string;
}

export async function checkDatabaseHealth(): Promise<DatabaseHealthReport> {
  const inWorkers = isCloudflareWorkersRuntime();
  const runtime = inWorkers ? "cloudflare-workers" : "node";

  try {
    const cfBinding = getCloudflareD1Binding();
    if (inWorkers && !cfBinding) {
      return {
        ok: false,
        runtime,
        db: "missing_binding",
        error: 'Binding D1 "DB" não encontrado no Worker.',
      };
    }

    const d1 = getD1Database();
    const [migrationRow, fkRow, tableCheck] = await Promise.all([
      d1
        .prepare("SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 1")
        .first<{ name?: string }>()
        .catch(() => null),
      d1
        .prepare("PRAGMA foreign_keys")
        .first<{ foreign_keys?: number }>()
        .catch(() => null),
      d1
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('users', 'sessions', 'library_items')"
        )
        .all<{ name: string }>()
        .catch(() => ({ results: [] as Array<{ name: string }> })),
    ]);

    const coreTables = new Set((tableCheck?.results ?? []).map((r) => r.name));
    const hasCoreSchema =
      coreTables.has("users") &&
      coreTables.has("sessions") &&
      coreTables.has("library_items");

    if (inWorkers && !hasCoreSchema) {
      return {
        ok: false,
        runtime,
        db: "schema_missing",
        error: "Schema D1 incompleto. Aplique as migrações antes do deploy.",
      };
    }

    return {
      ok: true,
      runtime,
      db: cfBinding ? "d1" : "local",
      schemaVersion: migrationRow?.name ?? (hasCoreSchema ? "applied" : "none"),
      foreignKeys: fkRow?.foreign_keys === 1,
    };
  } catch {
    return {
      ok: false,
      runtime,
      db: "error",
      error: "Falha ao verificar integridade do banco D1.",
    };
  }
}
