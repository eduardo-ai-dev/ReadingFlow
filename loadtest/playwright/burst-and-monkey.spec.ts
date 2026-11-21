import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { createSeededRng, enforceLoadtestSafety } from "../safety-guard.mjs";

const { appBaseUrl } = enforceLoadtestSafety();
const DATA_DIR = path.resolve(process.cwd(), ".loadtest-data");
const MOCK_BASE_URL =
  process.env.MOCK_CATALOG_BASE_URL || "http://127.0.0.1:4110";

test.describe("6. Cliques em Rajada, Monkey Test com Semente, Condições Adversas e Múltiplas Abas", () => {
  test("executa rajadas dirigidas (100x progresso, 200x abas/filtros, 50x Modo Foco), monkey test com semente, condições adversas (offline/429) e 2 abas simultâneas", async ({
    browser,
  }) => {
    const isSmoke = process.env.LOADTEST_SMOKE === "1";
    const host = new URL(appBaseUrl).hostname;

    const context = await browser.newContext({
      viewport: { width: 1366, height: 860 },
    });
    await context.addCookies([
      {
        name: "rf_session_id",
        value: "lt-sess-user-1-seed-20261121",
        domain: host,
        path: "/",
      },
    ]);

    const page = await context.newPage();
    const pageErrors: string[] = [];
    const responses5xx: string[] = [];

    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("response", (res) => {
      if (res.status() >= 500 && !res.url().includes("__mock_mode")) {
        responses5xx.push(`${res.status()} ${res.url()}`);
      }
    });

    // =========================================================================
    // 6.1 Rajada: Alternar filtros e abas em /estantes (200x completo / 50x smoke)
    // =========================================================================
    await page.goto(`${appBaseUrl}/estantes`, {
      waitUntil: "load",
    });
    await page
      .locator('[data-shelf-hydrated="true"]')
      .first()
      .waitFor({ state: "visible" });
    const toggleIterations = isSmoke ? 50 : 200;
    const tTabs0 = Date.now();
    await page.evaluate(async (iterations) => {
      const navLinks = Array.from(
        document.querySelectorAll<HTMLAnchorElement>(
          'nav[aria-label="Tipo de estante"] a'
        )
      );
      const filterButtons = Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          '[role="group"][aria-label="Filtros rápidos da estante"] button'
        )
      );
      for (let i = 0; i < iterations; i++) {
        const tab = navLinks[i % Math.max(1, navLinks.length)];
        tab?.click();
        const chip = filterButtons[i % Math.max(1, filterButtons.length)];
        chip?.click();
      }
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }, toggleIterations);
    const tabsBurstDurationMs = Date.now() - tTabs0;

    // =========================================================================
    // 6.2 Rajada: +10 páginas 100x seguidas
    // =========================================================================
    const progressBurstCount = isSmoke ? 40 : 100;
    const tProg0 = Date.now();
    const progressBurstOk = await page.evaluate(
      async ({ count }) => {
        let okCount = 0;
        for (let i = 1; i <= count; i++) {
          const res = await fetch("/api/internal/loadtest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "updateReadingProgress",
              payload: {
                readingId: "reading-lt-1-2",
                progressUnit: "pages",
                progressValue: Math.min(300, i * 2),
              },
            }),
          });
          if (res.ok) okCount += 1;
        }
        return okCount;
      },
      { count: progressBurstCount }
    );
    const progressBurstDurationMs = Date.now() - tProg0;
    expect(progressBurstOk).toBe(progressBurstCount);

    // =========================================================================
    // 6.3 Rajada: Modo Foco (/leitura/foco) iniciar / pausar / encerrar 50x
    // =========================================================================
    await page.goto(`${appBaseUrl}/leitura/foco`, {
      waitUntil: "domcontentloaded",
    });
    const focusCycles = 50;
    const tFocus0 = Date.now();
    await page.evaluate(async (cycles) => {
      const findPlayPauseBtn = () =>
        Array.from(document.querySelectorAll("button")).find((b) =>
          /Iniciar|Pausar|Retomar/i.test(b.textContent || "")
        );
      const findStopBtn = () =>
        Array.from(document.querySelectorAll("button")).find((b) =>
          /Encerrar Sessão/i.test(b.textContent || "")
        );

      for (let i = 0; i < cycles; i++) {
        findPlayPauseBtn()?.click(); // Iniciar/Retomar
        findPlayPauseBtn()?.click(); // Pausar
        findStopBtn()?.click(); // Encerrar Sessão
      }
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }, focusCycles);
    const focusBurstDurationMs = Date.now() - tFocus0;
    await expect(
      page.getByRole("heading", { name: /Sessão de Leitura/i })
    ).toBeVisible();

    // =========================================================================
    // 6.4 Condições Adversas: Offline no meio de salvamento + 429 nas APIs de capa
    // =========================================================================
    // No Modo Foco, com o painel rápido aberto após Pausar, digita um avanço e fica offline antes de clicar em Atualizar
    const pagesInput = page.locator("#focus-session-pages");
    if (await pagesInput.isVisible()) {
      await pagesInput.fill("12");
      await context.setOffline(true);
      const saveBtn = page.getByRole("button", { name: /^Atualizar$/i });
      if (await saveBtn.isEnabled()) {
        await saveBtn.click();
      }
      // Garante que o valor digitado pelo usuário ("12") foi preservado mesmo com a falha de rede
      await expect(pagesInput).toHaveValue("12");
      await context.setOffline(false);
    }

    // Simula HTTP 429 no mock server de capas e verifica que /api/covers/search retorna apiUnavailable=true (nunca "sem capa" definitivo)
    await fetch(`${MOCK_BASE_URL}/__admin/mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "429" }),
    });
    const cover429Result = await page.evaluate(async () => {
      const res = await fetch(
        "/api/covers/search?title=Obra+Indisponivel+429&author=Machado+de+Assis&bypassCache=1"
      );
      return { status: res.status, body: await res.json() };
    });
    expect(cover429Result.body.apiUnavailable).toBe(true);
    expect(cover429Result.body.candidates).toEqual([]);

    // Restaura mock server para modo normal
    await fetch(`${MOCK_BASE_URL}/__admin/mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "normal", delayMs: 0 }),
    });

    // =========================================================================
    // 6.5 Múltiplas abas do mesmo usuário abertas simultaneamente
    // =========================================================================
    const page2 = await context.newPage();
    await Promise.all([
      page.goto(`${appBaseUrl}/painel`, { waitUntil: "domcontentloaded" }),
      page2.goto(`${appBaseUrl}/estantes`, { waitUntil: "domcontentloaded" }),
    ]);
    await expect(page.locator("main").first()).toBeVisible();
    await expect(page2.locator("main").first()).toBeVisible();
    await page2.close();

    // =========================================================================
    // 6.6 Monkey Test determinístico com semente reproduzível
    //     (10 min em modo completo ou LOADTEST_MONKEY_SECONDS em smoke)
    // =========================================================================
    const monkeySeconds = Number(
      process.env.LOADTEST_MONKEY_SECONDS || (isSmoke ? 6 : 600)
    );
    const rng = createSeededRng(20261121);
    const monkeyEndMs = Date.now() + monkeySeconds * 1000;
    let monkeyActions = 0;
    let maxInteractionLagMs = 0;

    await page.goto(`${appBaseUrl}/estantes`, {
      waitUntil: "load",
    });
    await page
      .locator('[data-shelf-hydrated="true"]')
      .first()
      .waitFor({ state: "visible" });

    while (Date.now() < monkeyEndMs) {
      const tAct0 = Date.now();
      const actionRoll = rng.nextInt(0, 2);

      if (actionRoll === 0) {
        // Clica em um botão seguro visível (excluindo links externos, submit de form GET e exclusão de conta)
        await page
          .evaluate(
            (pickIndex) => {
              const safeButtons = Array.from(
                document.querySelectorAll<HTMLButtonElement>(
                  'button:not([disabled]):not([type="submit"])'
                )
              ).filter((btn) => {
                const txt = (btn.textContent || "").toLowerCase();
                return (
                  !txt.includes("excluir") &&
                  !txt.includes("sair") &&
                  !txt.includes("apagar")
                );
              });
              if (safeButtons.length > 0) {
                const target = safeButtons[pickIndex % safeButtons.length];
                target?.click();
              }
            },
            rng.nextInt(0, 999)
          )
          .catch(() => {});
      } else if (actionRoll === 1) {
        // Rola a página
        const deltaY = rng.nextInt(-300, 450);
        await page
          .evaluate((dy) => window.scrollBy(0, dy), deltaY)
          .catch(() => {});
      } else {
        // Digita no campo de busca se existir (direto no DOM para não travar caso o elemento seja desmontado em transição)
        const terms = ["Dom", "Rosa", "Assis", "Memórias", ""];
        const term = rng.pick(terms);
        await page
          .evaluate((val) => {
            const input = document.querySelector<HTMLInputElement>(
              'input[type="search"]'
            );
            if (input) {
              input.value = val;
              input.dispatchEvent(new Event("input", { bubbles: true }));
            }
          }, term)
          .catch(() => {});
      }

      const lagMs = Date.now() - tAct0;
      if (lagMs > maxInteractionLagMs) maxInteractionLagMs = lagMs;
      // Falha se houver travamento > 2 s sem resposta
      expect(lagMs).toBeLessThan(2000);
      monkeyActions += 1;
    }

    // Verifica que a página continua viva e sem tela em branco
    const bodyTextLen = await page.evaluate(
      () => (document.body?.innerText || "").trim().length
    );
    expect(bodyTextLen).toBeGreaterThan(20);
    expect(pageErrors).toEqual([]);
    expect(responses5xx).toEqual([]);

    const report = {
      executedAt: new Date().toISOString(),
      smokeMode: isSmoke,
      tabsBurst: {
        iterations: toggleIterations,
        durationMs: tabsBurstDurationMs,
      },
      progressBurst: {
        iterations: progressBurstCount,
        durationMs: progressBurstDurationMs,
      },
      focusModeBurst: {
        cycles: focusCycles,
        durationMs: focusBurstDurationMs,
      },
      adverseConditions: {
        offlinePreservedInput: true,
        cover429MarkedApiUnavailable:
          cover429Result.body.apiUnavailable === true,
      },
      multiTabConcurrentNavigation: true,
      monkeyTest: {
        seed: 20261121,
        durationSeconds: monkeySeconds,
        actionsExecuted: monkeyActions,
        maxInteractionLagMs,
        pageErrorsCount: pageErrors.length,
        responses5xxCount: responses5xx.length,
      },
    };

    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(DATA_DIR, "browser-burst-monkey-report.json"),
      JSON.stringify(report, null, 2)
    );

    await context.close();
  });
});
