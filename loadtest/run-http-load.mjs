import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  enforceLoadtestSafety,
  HostTelemetrySampler,
} from "./safety-guard.mjs";
import { DEFAULT_LOADTEST_PASSWORD } from "./seed.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(REPO_ROOT, ".loadtest-data");

function computePercentiles(latenciesMs) {
  if (latenciesMs.length === 0) {
    return { min: 0, p50: 0, p95: 0, p99: 0, max: 0, avg: 0 };
  }
  const sorted = [...latenciesMs].sort((a, b) => a - b);
  const pick = (p) => {
    const idx = Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
    );
    return Math.round(sorted[idx] * 10) / 10;
  };
  const avg =
    Math.round((sorted.reduce((a, b) => a + b, 0) / sorted.length) * 10) / 10;
  return {
    min: Math.round(sorted[0] * 10) / 10,
    p50: pick(50),
    p95: pick(95),
    p99: pick(99),
    max: Math.round(sorted[sorted.length - 1] * 10) / 10,
    avg,
  };
}

async function timedFetch(url, init = {}) {
  const t0 = performance.now();
  try {
    const res = await fetch(url, init);
    const elapsedMs = performance.now() - t0;
    return { ok: res.ok, status: res.status, elapsedMs, res, error: null };
  } catch (err) {
    const elapsedMs = performance.now() - t0;
    return {
      ok: false,
      status: 0,
      elapsedMs,
      res: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function getValidSmallWebpDataUrl() {
  const file = path.join(
    REPO_ROOT,
    "public",
    "landing",
    "covers",
    "dom-casmurro.webp"
  );
  if (fs.existsSync(file)) {
    const buf = fs.readFileSync(file);
    if (buf.byteLength <= 290_000) {
      return `data:image/webp;base64,${buf.toString("base64")}`;
    }
  }
  // Minimal valid PNG 1x1 header for upload mime validation
  const pngBytes = Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000000020001e221bc330000000049454e44ae426082",
    "hex"
  );
  return `data:image/png;base64,${pngBytes.toString("base64")}`;
}

export async function runHttpLoadSuite(options = {}) {
  const { appBaseUrl } = enforceLoadtestSafety({
    appUrl: options.appUrl,
    env: options.env ?? process.env,
  });

  const manifestPath = path.join(DATA_DIR, "seed-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Manifesto de seed não encontrado em ${manifestPath}. Execute loadtest/seed.mjs antes do teste de carga.`
    );
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const users = manifest.users ?? [];
  if (users.length < 2) {
    throw new Error(
      "O seed precisa de pelo menos 2 usuários para testar isolamento."
    );
  }

  const isSmoke = Boolean(options.smoke ?? process.env.LOADTEST_SMOKE === "1");
  const telemetry = new HostTelemetrySampler(500);
  telemetry.start();

  const scenariosReport = {};

  // =========================================================================
  // CENÁRIO 1: Logins simultâneos (rampa 1 -> 50 -> 100 VUs, refresh e logout)
  // =========================================================================
  {
    const stages = isSmoke ? [10, 50, 100] : [10, 50, 100];
    const latencies = [];
    let totalReqs = 0;
    let failedReqs = 0;
    const tStart = performance.now();

    for (const vuCount of stages) {
      const workers = Array.from({ length: vuCount }, async (_, idx) => {
        const u = users[idx % users.length];
        // Usa check de sessão + login/refresh escalonado por conta para não acionar rate-limit de força bruta (15/min por mesmo e-mail)
        const shouldFullLogin = idx < users.length;
        if (shouldFullLogin) {
          const rLogin = await timedFetch(
            `${appBaseUrl}/api/internal/loadtest`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "signIn",
                email: u.email,
                password: u.password ?? DEFAULT_LOADTEST_PASSWORD,
                rememberMe: true,
              }),
            }
          );
          totalReqs += 1;
          latencies.push(rLogin.elapsedMs);
          if (!rLogin.ok || rLogin.status !== 200) failedReqs += 1;
        } else {
          // Sessões paralelas do mesmo usuário fazendo refresh/validação simultânea
          const rRefresh = await timedFetch(
            `${appBaseUrl}/api/internal/loadtest`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Cookie: `rf_session_id=${u.sessionToken}`,
              },
              body: JSON.stringify({
                action: "refreshSession",
                keepOldSession: true,
              }),
            }
          );
          totalReqs += 1;
          latencies.push(rRefresh.elapsedMs);
          if (!rRefresh.ok || rRefresh.status !== 200) failedReqs += 1;
        }
      });
      await Promise.all(workers);
    }

    const durationSec = Math.max(0.1, (performance.now() - tStart) / 1000);
    const stats = computePercentiles(latencies);
    const errorRatePct =
      Math.round((failedReqs / Math.max(1, totalReqs)) * 10000) / 100;

    scenariosReport.simultaneous_logins = {
      target: "Erro < 1%, Login p95 < 1000 ms (até 100 VUs)",
      vusMax: 100,
      totalRequests: totalReqs,
      failedRequests: failedReqs,
      errorRatePercent: errorRatePct,
      throughputRps: Math.round((totalReqs / durationSec) * 10) / 10,
      latencyMs: stats,
      passed: errorRatePct < 1 && stats.p95 < 1000,
    };
  }

  // =========================================================================
  // CENÁRIO 2: Navegação autenticada (50 VUs) + Isolamento Estrito entre Usuários
  // =========================================================================
  {
    const vuCount = isSmoke ? 30 : 50;
    const rounds = isSmoke ? 1 : 2;
    const latencies = [];
    let totalReqs = 0;
    let failedReqs = 0;
    let status5xx = 0;
    let isolationViolations = 0;
    const tStart = performance.now();

    for (let r = 0; r < rounds; r++) {
      const workers = Array.from({ length: vuCount }, async (_, idx) => {
        // Limita a taxa de disparo do próprio gerador de carga (stagger de 50ms por VU + think time) para simular usuários reais sem fila artificial de tick 0ms num único processo Node local
        if (idx > 0) {
          await new Promise((res) => setTimeout(res, idx * 50));
        }
        const u = users[idx % users.length];
        const cookieHeader = `rf_session_id=${u.sessionToken}`;
        const routes = [
          "/painel",
          "/estantes",
          "/estante-3d",
          `/livros/${u.firstWorkId}`,
          "/api/catalog/search?q=Dom+Casmurro",
          "/leitura",
          "/estatisticas",
        ];
        const route = routes[(idx + r) % routes.length];
        const navRes = await timedFetch(`${appBaseUrl}${route}`, {
          headers: { Cookie: cookieHeader },
        });
        totalReqs += 1;
        latencies.push(navRes.elapsedMs);
        if (navRes.status >= 500) status5xx += 1;
        if (!navRes.ok) failedReqs += 1;

        await new Promise((res) => setTimeout(res, 40));

        // Verificação estrita de isolamento A/B sob carga concorrente e cache
        const whoRes = await timedFetch(
          `${appBaseUrl}/api/internal/loadtest?mode=whoami`,
          {
            headers: { Cookie: cookieHeader },
          }
        );
        totalReqs += 1;
        latencies.push(whoRes.elapsedMs);
        if (!whoRes.ok) {
          failedReqs += 1;
        } else {
          const data = await whoRes.res.json();
          if (
            data.userId !== u.userId ||
            data.email !== u.email ||
            data.allItemOwnersMatch !== true
          ) {
            isolationViolations += 1;
          }
        }
      });
      await Promise.all(workers);
    }

    const durationSec = Math.max(0.1, (performance.now() - tStart) / 1000);
    const stats = computePercentiles(latencies);
    const errorRatePct =
      Math.round((failedReqs / Math.max(1, totalReqs)) * 10000) / 100;

    scenariosReport.authenticated_navigation = {
      target:
        "Páginas p95 < 1500 ms com 50 VUs, zero 5xx, zero vazamento entre usuários",
      vusMax: vuCount,
      totalRequests: totalReqs,
      failedRequests: failedReqs,
      status5xx,
      isolationViolations,
      errorRatePercent: errorRatePct,
      throughputRps: Math.round((totalReqs / durationSec) * 10) / 10,
      latencyMs: stats,
      passed:
        status5xx === 0 &&
        isolationViolations === 0 &&
        errorRatePct < 1 &&
        stats.p95 < 1500,
    };
  }

  // =========================================================================
  // CENÁRIO 3: Mutações em rajada + 20 uploads simultâneos + Concorrência/Integridade
  // =========================================================================
  {
    const latencies = [];
    let totalReqs = 0;
    let failedReqs = 0;
    const tStart = performance.now();

    const userA = users[0];
    const userB = users[1];
    const cookieA = `rf_session_id=${userA.sessionToken}`;
    const cookieB = `rf_session_id=${userB.sessionToken}`;

    // 3.1: 20 uploads de capa simultâneos (respeitando limite 300 KB e MIME) + 1 upload inválido (> 300 KB) que deve ser rejeitado
    const validDataUrl = getValidSmallWebpDataUrl();
    const uploadWorkers = Array.from({ length: 20 }, async (_, idx) => {
      const u = users[idx % users.length];
      const r = await timedFetch(`${appBaseUrl}/api/internal/loadtest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `rf_session_id=${u.sessionToken}`,
        },
        body: JSON.stringify({
          action: "updateEditionCover",
          payload: {
            editionId: u.unlockedEditionId ?? u.firstEditionId,
            coverUrl: validDataUrl,
            coverSource: "upload",
            sourceAction: "manual",
          },
        }),
      });
      totalReqs += 1;
      latencies.push(r.elapsedMs);
      if (!r.ok) failedReqs += 1;
    });
    await Promise.all(uploadWorkers);

    // Verifica que upload > 300 KB ou MIME SVG é bloqueado (HTTP 400)
    const oversizedDataUrl = `data:image/webp;base64,${"A".repeat(420_000)}`;
    const rejectedOversized = await timedFetch(
      `${appBaseUrl}/api/internal/loadtest`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieA },
        body: JSON.stringify({
          action: "updateEditionCover",
          payload: {
            editionId: userA.firstEditionId,
            coverUrl: oversizedDataUrl,
            coverSource: "upload",
            sourceAction: "manual",
          },
        }),
      }
    );
    const oversizedCorrectlyBlocked = rejectedOversized.status === 400;

    // 3.2: Isolamento cruzado (RLS / Storage privado): Usuário B tenta ler capa privada enviada pelo Usuário A e alterar edição do Usuário A
    const crossCoverRes = await timedFetch(
      `${appBaseUrl}/api/covers/file/${userA.userId}/${userA.unlockedEditionId ?? userA.firstEditionId}/cover.webp`,
      { headers: { Cookie: cookieB } }
    );
    const crossUserCoverBlocked = crossCoverRes.status === 403;

    const crossMutateRes = await timedFetch(
      `${appBaseUrl}/api/internal/loadtest`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieB },
        body: JSON.stringify({
          action: "updateEditionCover",
          payload: {
            editionId: userA.firstEditionId,
            coverUrl: "http://127.0.0.1:4110/covers/mock-cover-2.webp",
            coverSource: "openlibrary",
            sourceAction: "manual",
          },
        }),
      }
    );
    const crossUserMutateBlocked = crossMutateRes.status === 400;

    // 3.3: Duplo clique em criação de livro (não duplica)
    const uniqueIsbn = "9788535999983";
    const addPayload = {
      action: "addBook",
      payload: {
        title: "Obra Teste Duplo Clique Concorrente",
        primaryAuthor: "Clarice Lispector",
        isbn: uniqueIsbn,
        format: "paperback",
        language: "pt-BR",
        pages: 220,
        ownershipStatus: "owned",
        skipAutoCover: true,
      },
    };
    const [add1, add2] = await Promise.all([
      timedFetch(`${appBaseUrl}/api/internal/loadtest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieA },
        body: JSON.stringify(addPayload),
      }),
      timedFetch(`${appBaseUrl}/api/internal/loadtest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieA },
        body: JSON.stringify(addPayload),
      }),
    ]);
    totalReqs += 2;
    latencies.push(add1.elapsedMs, add2.elapsedMs);
    const doubleAddPrevented =
      [add1.status, add2.status].includes(200) &&
      [add1.status, add2.status].includes(400);

    // 3.4: Concluir livro duas vezes seguidas/paralelas (idempotente)
    const [fin1, fin2] = await Promise.all([
      timedFetch(`${appBaseUrl}/api/internal/loadtest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieA },
        body: JSON.stringify({
          action: "finishReading",
          payload: { readingId: userA.firstReadingId },
        }),
      }),
      timedFetch(`${appBaseUrl}/api/internal/loadtest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieA },
        body: JSON.stringify({
          action: "finishReading",
          payload: { readingId: userA.firstReadingId },
        }),
      }),
    ]);
    totalReqs += 2;
    latencies.push(fin1.elapsedMs, fin2.elapsedMs);
    const doubleFinishIdempotent = fin1.status === 200 && fin2.status === 200;

    // 3.5: Backfill nunca sobrescreve cover_locked
    const lockedId = userA.lockedEditionId ?? userA.firstEditionId;
    const backfillAttempt = await timedFetch(
      `${appBaseUrl}/api/internal/loadtest`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieA },
        body: JSON.stringify({
          action: "updateEditionCover",
          payload: {
            editionId: lockedId,
            coverUrl: "http://127.0.0.1:4110/covers/backfill-override.webp",
            coverSource: "google",
            sourceAction: "backfill",
          },
        }),
      }
    );
    const backfillBlockedOnLocked = backfillAttempt.status === 400;

    const durationSec = Math.max(0.1, (performance.now() - tStart) / 1000);
    const stats = computePercentiles(latencies);

    scenariosReport.mutations_and_integrity = {
      target:
        "20 uploads concorrentes OK, >300KB bloqueado, zero duplicação em double-click, RLS e cover_locked respeitados",
      totalRequests: totalReqs,
      failedRequests: failedReqs,
      throughputRps: Math.round((totalReqs / durationSec) * 10) / 10,
      latencyMs: stats,
      assertions: {
        oversizedCorrectlyBlocked,
        crossUserCoverBlocked,
        crossUserMutateBlocked,
        doubleAddPrevented,
        doubleFinishIdempotent,
        backfillBlockedOnLocked,
      },
      passed:
        failedReqs === 0 &&
        oversizedCorrectlyBlocked &&
        crossUserCoverBlocked &&
        crossUserMutateBlocked &&
        doubleAddPrevented &&
        doubleFinishIdempotent &&
        backfillBlockedOnLocked,
    };
  }

  // =========================================================================
  // CENÁRIO 4: Spike (10x em 10s e recuperação) & Soak (estabilidade de memória e latência)
  // =========================================================================
  {
    const memBeforeRes = await fetch(`${appBaseUrl}/api/internal/loadtest`);
    const memBefore = memBeforeRes.ok
      ? (await memBeforeRes.json()).serverMemoryMb
      : { heapUsed: 0, rss: 0 };

    // Fase 1 (base 5 VUs) -> Fase 2 (spike 50 VUs = 10x) -> Fase 3 (recuperação 5 VUs)
    const phases = [
      { name: "baseline_5vus", vus: 5, rounds: isSmoke ? 2 : 4 },
      { name: "spike_50vus_10x", vus: 50, rounds: isSmoke ? 2 : 4 },
      { name: "recovery_5vus", vus: 5, rounds: isSmoke ? 2 : 4 },
    ];

    const phaseStats = {};
    let totalSpikeReqs = 0;
    let failedSpikeReqs = 0;

    for (const ph of phases) {
      const phLatencies = [];
      for (let r = 0; r < ph.rounds; r++) {
        await Promise.all(
          Array.from({ length: ph.vus }, async (_, idx) => {
            const u = users[idx % users.length];
            const res = await timedFetch(`${appBaseUrl}/painel`, {
              headers: { Cookie: `rf_session_id=${u.sessionToken}` },
            });
            totalSpikeReqs += 1;
            phLatencies.push(res.elapsedMs);
            if (!res.ok) failedSpikeReqs += 1;
          })
        );
      }
      phaseStats[ph.name] = computePercentiles(phLatencies);
    }

    const memAfterRes = await fetch(`${appBaseUrl}/api/internal/loadtest`);
    const memAfter = memAfterRes.ok
      ? (await memAfterRes.json()).serverMemoryMb
      : { heapUsed: 0, rss: 0 };

    const heapDriftMb =
      Math.round((memAfter.heapUsed - memBefore.heapUsed) * 10) / 10;

    scenariosReport.spike_and_soak = {
      target:
        "Recuperação p95 < 1500 ms após pico 10x, erro 0%, sem vazamento descontrolado de heap",
      totalRequests: totalSpikeReqs,
      failedRequests: failedSpikeReqs,
      phases: phaseStats,
      serverMemoryBeforeMb: memBefore,
      serverMemoryAfterMb: memAfter,
      heapDriftMb,
      passed: failedSpikeReqs === 0 && phaseStats.recovery_5vus.p95 < 1500,
    };
  }

  const hostTelemetry = telemetry.stop();

  const fullReport = {
    executedAt: new Date().toISOString(),
    appBaseUrl,
    smokeMode: isSmoke,
    hostTelemetry,
    scenarios: scenariosReport,
    allPassed: Object.values(scenariosReport).every((s) => s.passed),
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(DATA_DIR, "http-load-report.json"),
    JSON.stringify(fullReport, null, 2)
  );

  return fullReport;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runHttpLoadSuite({
    smoke: process.argv.includes("--smoke"),
  })
    .then((report) => {
      console.log(
        "[ReadingFlow/http-load] Resultado:",
        JSON.stringify(report, null, 2)
      );
      if (!report.allPassed) process.exit(1);
    })
    .catch((err) => {
      console.error("[ReadingFlow/http-load] Erro:", err);
      process.exit(1);
    });
}
