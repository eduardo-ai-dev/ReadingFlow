import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getTestSqliteDatabase } from "@/server/db/connection";
import { ormSeedWorkspace } from "@/server/db/orm-repository";
import { generateDeterministicUserWorkspace } from "../loadtest/seed.mjs";

describe("Regressão de Banco de Dados #2 — Índices Compostos, EXPLAIN QUERY PLAN (1000 e 2000 livros) e RLS (select auth.uid())", () => {
  it("usa SEARCH ... USING INDEX (sem full table SCAN) e responde em < 200 ms para 1.000 e 2.000 livros por usuário", async () => {
    const user1000 = generateDeterministicUserWorkspace({
      userIndex: 1000,
      bookCount: 1000,
      seed: 20261121,
    });
    const user2000 = generateDeterministicUserWorkspace({
      userIndex: 2000,
      bookCount: 2000,
      seed: 20261121,
    });

    const tSeed1000 = performance.now();
    await ormSeedWorkspace(user1000.workspace);
    const seed1000Ms = performance.now() - tSeed1000;

    const tSeed2000 = performance.now();
    await ormSeedWorkspace(user2000.workspace);
    const seed2000Ms = performance.now() - tSeed2000;

    const sqlite = getTestSqliteDatabase();
    if (!sqlite) {
      throw new Error("Adaptador SQLite de teste não registrado.");
    }
    sqlite.exec("ANALYZE;");

    const uid = user2000.workspace.profile.id;
    const screenQueries = [
      {
        name: "dashboard_active_readings",
        sql: "SELECT * FROM readings WHERE user_id = ? AND status IN ('reading', 'paused') ORDER BY updated_at DESC",
        params: [uid],
      },
      {
        name: "shelves_items_ordered",
        sql: "SELECT * FROM library_items WHERE user_id = ? ORDER BY shelf_id ASC, shelf_position ASC",
        params: [uid],
      },
      {
        name: "catalog_works_by_user",
        sql: "SELECT * FROM works WHERE user_id = ? ORDER BY created_at DESC",
        params: [uid],
      },
      {
        name: "metrics_finished_readings",
        sql: "SELECT * FROM readings WHERE user_id = ? AND status = 'finished' ORDER BY finished_on DESC",
        params: [uid],
      },
    ];

    for (const q of screenQueries) {
      const planRows = sqlite
        .prepare(`EXPLAIN QUERY PLAN ${q.sql}`)
        .all(...q.params) as Array<{ detail?: string }>;
      const planText = planRows.map((r) => String(r.detail ?? "")).join(" | ");

      expect(planText).toMatch(/SEARCH .* USING INDEX/i);
      expect(planText).not.toMatch(/^SCAN /i);

      const t0 = performance.now();
      const rows = sqlite.prepare(q.sql).all(...q.params);
      const durationMs = performance.now() - t0;

      expect(rows.length).toBeGreaterThan(0);
      expect(durationMs).toBeLessThan(200);
    }

    expect(seed1000Ms).toBeLessThan(1200);
    expect(seed2000Ms).toBeLessThan(2000);
  });

  it("garante que a migração SQL utiliza (select auth.uid()) nas políticas RLS e cria índices compostos em user_id/owner_id", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "20261121140000_rls_select_auth_uid_and_stress_indexes.sql"
    );
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, "utf8");

    expect(sql).toContain("((select auth.uid()))::text");
    expect(sql).toContain("idx_works_owner_created_desc");
    expect(sql).toContain("idx_editions_owner_format");
    expect(sql).toContain("idx_editions_work_id");
    expect(sql).toContain("idx_readings_user_status_updated");
    expect(sql).toContain("idx_library_items_user_status");
  });
});
