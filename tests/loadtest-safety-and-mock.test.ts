import { describe, expect, it } from "vitest";
import {
  enforceLoadtestSafety,
  HostTelemetrySampler,
  isAllowedLoadtestHostname,
  isLoadtestUserEmail,
} from "../loadtest/safety-guard.mjs";
import { startMockCatalogServer } from "../loadtest/mock-server.mjs";
import { generateDeterministicUserWorkspace } from "../loadtest/seed.mjs";

describe("Loadtest Safety Guard, Mock Third-Party Server & Deterministic Seed", () => {
  it("bloqueia execução sem LOADTEST_ALLOW=1 ou contra domínios fora da allowlist", () => {
    expect(() =>
      enforceLoadtestSafety({
        env: { LOADTEST_ALLOW: "0" },
        throwOnly: true,
      })
    ).toThrow(/LOADTEST_ALLOW=1/i);

    expect(() =>
      enforceLoadtestSafety({
        env: { LOADTEST_ALLOW: "1" },
        appUrl: "https://readingflow.com.br",
        supabaseUrl: "http://127.0.0.1:54321",
        throwOnly: true,
      })
    ).toThrow(/SAFETY ABORT/i);

    expect(() =>
      enforceLoadtestSafety({
        env: { LOADTEST_ALLOW: "1" },
        appUrl: "http://127.0.0.1:3000",
        supabaseUrl: "https://prod-project.supabase.co",
        throwOnly: true,
      })
    ).toThrow(/SAFETY ABORT/i);

    const allowed = enforceLoadtestSafety({
      env: {
        LOADTEST_ALLOW: "1",
        LOADTEST_STAGING_HOST: "staging.readingflow.internal",
      },
      appUrl: "http://127.0.0.1:3000",
      supabaseUrl: "https://staging.readingflow.internal:54321",
      throwOnly: true,
    });
    expect(allowed.appBaseUrl).toBe("http://127.0.0.1:3000");
    expect(isAllowedLoadtestHostname("localhost")).toBe(true);
    expect(isAllowedLoadtestHostname("127.0.0.1")).toBe(true);
    expect(isAllowedLoadtestHostname("app.readingflow.test")).toBe(true);
    expect(isAllowedLoadtestHostname("readingflow.com")).toBe(false);

    expect(isLoadtestUserEmail("loadtest+1@example.test")).toBe(true);
    expect(isLoadtestUserEmail("loadtest+100@example.test")).toBe(true);
    expect(isLoadtestUserEmail("usuario.real@gmail.com")).toBe(false);
  });

  it("gera dados determinísticos com semente reproduzível, 10-60 prateleiras, ~10 sessões por livro lido e cover_locked", () => {
    const runA = generateDeterministicUserWorkspace({
      userIndex: 1,
      bookCount: 500,
      seed: 20261121,
    });
    const runB = generateDeterministicUserWorkspace({
      userIndex: 1,
      bookCount: 500,
      seed: 20261121,
    });

    expect(runA.workspace.profile.email).toBe("loadtest+1@example.test");
    expect(runA.workspace.works.length).toBe(500);
    expect(runA.workspace.editions.length).toBe(500);
    expect(runA.workspace.items.length).toBe(500);
    expect(runA.workspace.works[0]?.title).toBe(runB.workspace.works[0]?.title);
    expect(runA.workspace.editions[42]?.isbn13).toBe(
      runB.workspace.editions[42]?.isbn13
    );

    const customShelvesCount =
      runA.workspace.settings?.shelfLayout.customShelves.length ?? 0;
    expect(customShelvesCount).toBeGreaterThanOrEqual(10);
    expect(customShelvesCount).toBeLessThanOrEqual(60);

    const lockedCount = runA.workspace.editions.filter(
      (e: { coverLocked?: boolean }) => e.coverLocked
    ).length;
    expect(lockedCount).toBeGreaterThan(20);
    expect(lockedCount).toBeLessThan(450);

    const finishedReadings = runA.workspace.readings.filter(
      (r: { status: string }) => r.status === "finished"
    );
    expect(finishedReadings.length).toBeGreaterThan(50);
    for (const r of finishedReadings) {
      expect(r.dailyLogs?.length ?? 0).toBeGreaterThanOrEqual(8);
      expect(r.dailyLogs?.length ?? 0).toBeLessThanOrEqual(12);
    }
  });

  it("responde localmente para Google Books, Open Library, Hardcover, Apple e BrasilAPI incluindo modo 429 e vazio", async () => {
    const mock = await startMockCatalogServer({
      port: 0,
      env: { LOADTEST_ALLOW: "1" },
    });

    try {
      const gbRes = await fetch(
        `${mock.baseUrl}/proxy/www.googleapis.com/books/v1/volumes?q=intitle:%22Dom%20Casmurro%22`
      );
      expect(gbRes.status).toBe(200);
      const gbJson = (await gbRes.json()) as { items?: unknown[] };
      expect(Array.isArray(gbJson.items)).toBe(true);
      expect(gbJson.items?.length).toBeGreaterThan(0);

      const olRes = await fetch(
        `${mock.baseUrl}/proxy/openlibrary.org/search.json?q=Dom+Casmurro`
      );
      expect(olRes.status).toBe(200);
      const olJson = (await olRes.json()) as { docs?: unknown[] };
      expect(olJson.docs?.length).toBeGreaterThan(0);

      const hcRes = await fetch(
        `${mock.baseUrl}/proxy/api.hardcover.app/v1/graphql`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: "query {}",
            variables: { title: "Dom Casmurro" },
          }),
        }
      );
      expect(hcRes.status).toBe(200);

      const appleRes = await fetch(
        `${mock.baseUrl}/proxy/itunes.apple.com/search?term=Dom+Casmurro`
      );
      expect(appleRes.status).toBe(200);

      const coverRes = await fetch(`${mock.baseUrl}/covers/mock-cover-1.webp`);
      expect(coverRes.status).toBe(200);
      expect(coverRes.headers.get("content-type")).toBe("image/webp");

      // Simula HTTP 429
      mock.setMode("429");
      const rateLimitedRes = await fetch(
        `${mock.baseUrl}/proxy/www.googleapis.com/books/v1/volumes?q=Dom+Casmurro`
      );
      expect(rateLimitedRes.status).toBe(429);

      // Simula resposta vazia
      mock.setMode("empty");
      const emptyRes = await fetch(
        `${mock.baseUrl}/proxy/www.googleapis.com/books/v1/volumes?q=Dom+Casmurro`
      );
      expect(emptyRes.status).toBe(200);
      const emptyJson = (await emptyRes.json()) as { items?: unknown[] };
      expect(emptyJson.items).toEqual([]);
    } finally {
      await mock.close();
    }

    const sampler = new HostTelemetrySampler(50);
    sampler.start();
    await new Promise((r) => setTimeout(r, 70));
    const summary = sampler.stop();
    expect(summary.sampleCount).toBeGreaterThanOrEqual(1);
    expect(summary.systemTotalMemMb).toBeGreaterThan(100);
  });
});
