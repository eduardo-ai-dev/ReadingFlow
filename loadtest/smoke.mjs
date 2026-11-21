import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { enforceLoadtestSafety } from "./safety-guard.mjs";
import { startMockCatalogServer } from "./mock-server.mjs";
import { runLoadtestSeed } from "./seed.mjs";
import { runHttpLoadSuite } from "./run-http-load.mjs";
import { runLoadtestCleanup } from "./cleanup.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(REPO_ROOT, ".loadtest-data");

async function waitForServerReady(baseUrl, timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/session`, {
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) return true;
    } catch {
      // aguarda inicialização
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function runPlaywrightSpecs(env) {
  return new Promise((resolve, reject) => {
    const pwCli = path.join(
      REPO_ROOT,
      "node_modules",
      "@playwright",
      "test",
      "cli.js"
    );
    const child = spawn(
      process.execPath,
      [pwCli, "test", "-c", "loadtest/playwright.config.ts"],
      {
        cwd: REPO_ROOT,
        env,
        stdio: "inherit",
      }
    );
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Playwright loadtest falhou com código ${code}`));
    });
  });
}

async function main() {
  const tSuite0 = performance.now();
  const appPort = Number(process.env.LOADTEST_PORT || 3105);
  const appUrl = process.env.LOADTEST_BASE_URL || `http://127.0.0.1:${appPort}`;

  const { appBaseUrl } = enforceLoadtestSafety({ appUrl });
  const skipBrowser = process.argv.includes("--no-browser");
  const keepData = process.argv.includes("--keep-data");

  console.log(
    `[ReadingFlow/loadtest:smoke] Iniciando suíte rápida de regressão de carga em ${appBaseUrl}...`
  );

  const mockServer = await startMockCatalogServer({
    port: Number(process.env.LOADTEST_MOCK_PORT || 4110),
  });
  process.env.MOCK_CATALOG_BASE_URL = mockServer.baseUrl;

  let spawnedNext = null;
  try {
    const alreadyUp = await waitForServerReady(appBaseUrl, 1200);
    if (!alreadyUp) {
      const nextBuildIdPath = path.join(REPO_ROOT, ".next", "BUILD_ID");
      if (!fs.existsSync(nextBuildIdPath)) {
        throw new Error(
          "Build de produção (.next/BUILD_ID) não encontrado. Execute `npm run build` antes de `npm run loadtest:smoke`."
        );
      }
      const nextBin = path.join(
        REPO_ROOT,
        "node_modules",
        "next",
        "dist",
        "bin",
        "next"
      );
      const parsedPort = new URL(appBaseUrl).port || String(appPort);
      spawnedNext = spawn(
        process.execPath,
        [nextBin, "start", "-p", parsedPort],
        {
          cwd: REPO_ROOT,
          env: {
            ...process.env,
            NODE_ENV: "production",
            LOADTEST_ALLOW: "1",
            MOCK_CATALOG_BASE_URL: mockServer.baseUrl,
            UV_THREADPOOL_SIZE: "16",
          },
          stdio: "pipe",
        }
      );

      const ready = await waitForServerReady(appBaseUrl, 25_000);
      if (!ready) {
        throw new Error(
          `Não foi possível inicializar next start em ${appBaseUrl} dentro de 25s.`
        );
      }
    }

    // 1. Seed determinístico (10 usuários x 500 livros + escalas 1000 e 2000 livros para o navegador e SQLite EXPLAIN)
    const seedManifest = await runLoadtestSeed({
      appUrl: appBaseUrl,
      scale: "smoke",
      mockBaseUrl: mockServer.baseUrl,
      extraScaleUsers: [
        { userIndex: 500, books: 500 },
        { userIndex: 1000, books: 1000 },
        { userIndex: 2000, books: 2000 },
      ],
    });

    // 2. Carga HTTP & Banco (Logins 100 VUs, Navegação 30-50 VUs, Mutações em rajada, 20 uploads, Spike 10x)
    const httpReport = await runHttpLoadSuite({
      appUrl: appBaseUrl,
      smoke: true,
    });

    // 3. Testes de navegador em escala (500/2000 livros, 1x e 4x CPU) + Rajadas, Modo Foco 50x, Condições Adversas e Monkey
    let browserScaleReport = null;
    let browserBurstReport = null;
    if (!skipBrowser) {
      await runPlaywrightSpecs({
        ...process.env,
        LOADTEST_ALLOW: "1",
        LOADTEST_SMOKE: "1",
        LOADTEST_BASE_URL: appBaseUrl,
        MOCK_CATALOG_BASE_URL: mockServer.baseUrl,
      });

      const scalePath = path.join(DATA_DIR, "browser-scale-report.json");
      const burstPath = path.join(DATA_DIR, "browser-burst-monkey-report.json");
      if (fs.existsSync(scalePath)) {
        browserScaleReport = JSON.parse(fs.readFileSync(scalePath, "utf8"));
      }
      if (fs.existsSync(burstPath)) {
        browserBurstReport = JSON.parse(fs.readFileSync(burstPath, "utf8"));
      }
    }

    const totalDurationSec =
      Math.round(((performance.now() - tSuite0) / 1000) * 10) / 10;

    const combinedSummary = {
      executedAt: new Date().toISOString(),
      totalDurationSeconds: totalDurationSec,
      appBaseUrl,
      mockServerStats: mockServer.getState().stats,
      seedDiagnostics: seedManifest.diagnostics,
      httpLoad: httpReport,
      browserScale: browserScaleReport,
      browserBurstAndMonkey: browserBurstReport,
    };

    fs.writeFileSync(
      path.join(REPO_ROOT, "loadtest", "latest-results.json"),
      JSON.stringify(combinedSummary, null, 2)
    );

    if (!keepData) {
      await runLoadtestCleanup({ appUrl: appBaseUrl });
    }

    console.log(
      `[ReadingFlow/loadtest:smoke] Suíte concluída com SUCESSO em ${totalDurationSec}s.`
    );
    if (!httpReport.allPassed) {
      process.exitCode = 1;
    }
  } finally {
    if (spawnedNext && !spawnedNext.killed) {
      spawnedNext.kill();
    }
    await mockServer.close();
  }
}

main().catch((err) => {
  console.error("[ReadingFlow/loadtest:smoke] Falha:", err);
  process.exit(1);
});
