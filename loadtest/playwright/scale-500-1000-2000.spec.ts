import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { enforceLoadtestSafety } from "../safety-guard.mjs";

const { appBaseUrl } = enforceLoadtestSafety();
const DATA_DIR = path.resolve(process.cwd(), ".loadtest-data");

test.describe("5. Navegador: Escala 500, 1000 e 2000 livros (Playwright + DevTools CDP)", () => {
  test("mede FCP/conteúdo, hidratação, nós DOM, memória JS Heap, FPS de rolagem, INP de hover/filtro e drag-and-drop (1x e 4x CPU slowdown)", async ({
    browser,
  }) => {
    const scales =
      process.env.LOADTEST_SMOKE === "1" ? [500, 2000] : [500, 1000, 2000];
    const scaleMetrics: Record<string, unknown> = {};

    for (const bookCount of scales) {
      for (const cpuThrottleRate of [1, 4]) {
        const context = await browser.newContext({
          viewport: { width: 1440, height: 900 },
        });
        const host = new URL(appBaseUrl).hostname;
        await context.addCookies([
          {
            name: "rf_session_id",
            value: `lt-sess-user-${bookCount}-seed-20261121`,
            domain: host,
            path: "/",
          },
        ]);

        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        await cdp.send("Performance.enable");
        if (cpuThrottleRate > 1) {
          await cdp.send("Emulation.setCPUThrottlingRate", {
            rate: cpuThrottleRate,
          });
        }

        const pageErrors: string[] = [];
        page.on("pageerror", (err) => pageErrors.push(err.message));

        // 1. Carregamento de /estante-3d com 500, 1000 ou 2000 livros (tempo até conteúdo + tempo até hidratação completa)
        const tNav0 = Date.now();
        const res = await page.goto(`${appBaseUrl}/estante-3d`, {
          waitUntil: "domcontentloaded",
        });
        expect(res?.status()).toBe(200);
        await page
          .locator("[data-total-books]")
          .first()
          .waitFor({ state: "visible" });
        const timeToContentMs = Date.now() - tNav0;

        await page
          .locator('[data-shelf-hydrated="true"]')
          .first()
          .waitFor({ state: "visible" });
        const hydrationMs = Date.now() - tNav0;

        // 2. Verifica virtualização de fileiras, lazy-loading das capas e contagem de nós no DOM
        const domAudit = await page.evaluate(() => {
          const totalDomNodes = document.querySelectorAll("*").length;
          const shelfRows = Array.from(
            document.querySelectorAll("[data-shelf-row]")
          );
          const mountedRows = shelfRows.filter(
            (el) => el.getAttribute("data-shelf-row-mounted") === "true"
          );
          const virtualizedRows = shelfRows.filter(
            (el) => el.getAttribute("data-shelf-virtualized") === "true"
          );
          const coverImages = Array.from(
            document.querySelectorAll(".rf-book-cover-2d img")
          );
          const lazyImages = coverImages.filter(
            (img) => img.getAttribute("loading") === "lazy"
          );
          const navEntry = performance.getEntriesByType("navigation")[0] as
            PerformanceNavigationTiming | undefined;

          return {
            totalDomNodes,
            totalRows: shelfRows.length,
            mountedRowsCount: mountedRows.length,
            virtualizedRowsCount: virtualizedRows.length,
            coverImagesCount: coverImages.length,
            lazyImagesCount: lazyImages.length,
            domInteractiveMs: Math.round(navEntry?.domInteractive ?? 0),
          };
        });

        // A virtualização mantém apenas as primeiras fileiras montadas inicialmente (< totalRows)
        expect(domAudit.totalRows).toBeGreaterThan(5);
        expect(domAudit.mountedRowsCount).toBeLessThan(domAudit.totalRows);
        expect(domAudit.virtualizedRowsCount).toBe(domAudit.totalRows);

        // 3. Mede latência de hover sobre lombadas e filtro rápido (INP < 200ms)
        const hoverLatencyMs = await page.evaluate(async () => {
          const buttons = Array.from(
            document.querySelectorAll<HTMLButtonElement>("button.rf-book-prism")
          ).slice(0, 12);
          const t0 = performance.now();
          for (const btn of buttons) {
            btn.dispatchEvent(
              new MouseEvent("mouseover", { bubbles: true, cancelable: true })
            );
          }
          await new Promise((r) => requestAnimationFrame(() => r(null)));
          return (
            Math.round(
              ((performance.now() - t0) / Math.max(1, buttons.length)) * 100
            ) / 100
          );
        });
        expect(hoverLatencyMs).toBeLessThan(50);

        const filterInPMs = await page.evaluate(async () => {
          const group = document.querySelector(
            '[role="group"][aria-label*="Filtros rápidos"]'
          );
          const buttons = group
            ? Array.from(group.querySelectorAll<HTMLButtonElement>("button"))
            : [];
          const targetBtn = buttons[1] ?? buttons[0];
          if (!targetBtn) return 0;
          const t0 = performance.now();
          targetBtn.click();
          await new Promise((r) => requestAnimationFrame(() => r(null)));
          return Math.round((performance.now() - t0) * 100) / 100;
        });
        expect(filterInPMs).toBeLessThan(200);

        // 4. Mede FPS durante rolagem contínua pela estante
        const scrollMetrics = await page.evaluate(async () => {
          return new Promise<{
            fps: number;
            frames: number;
            durationMs: number;
          }>((resolve) => {
            let frames = 0;
            const start = performance.now();
            const durationTarget = 450;

            function step(now: number) {
              frames += 1;
              window.scrollBy(0, 48);
              if (now - start < durationTarget) {
                requestAnimationFrame(step);
              } else {
                const elapsed = Math.max(1, now - start);
                const fps = Math.round((frames / elapsed) * 1000 * 10) / 10;
                window.scrollTo(0, 0);
                resolve({
                  fps,
                  frames,
                  durationMs: Math.round(elapsed),
                });
              }
            }
            requestAnimationFrame(step);
          });
        });

        // 5. Com 500 livros (1x CPU), testa também paginação/windowing em /estantes e drag-and-drop na prateleira
        let dragDropLatencyMs: number | null = null;
        let list2dWindowedCount: number | null = null;
        if (bookCount === 500 && cpuThrottleRate === 1) {
          // reset filter to 'all'
          const allFilterBtn = page
            .getByRole("group", { name: /Filtros rápidos da estante/i })
            .locator("button")
            .first();
          if (await allFilterBtn.isVisible()) {
            await allFilterBtn.click();
          }

          const firstBook = page.locator("button.rf-book-prism").first();
          await firstBook.focus();
          const tDrag0 = Date.now();
          await page.keyboard.press("Alt+ArrowRight");
          dragDropLatencyMs = Date.now() - tDrag0;

          // Verifica windowing de 60 itens em /estantes (Lista/Grade 2D)
          await page.goto(`${appBaseUrl}/estantes`, {
            waitUntil: "domcontentloaded",
          });
          list2dWindowedCount = await page.locator(".interactive-card").count();
          expect(list2dWindowedCount).toBeLessThanOrEqual(60);
        }

        // 6. Coleta memória JS Heap via CDP
        const cdpPerf = await cdp.send("Performance.getMetrics");
        const heapUsedBytes =
          cdpPerf.metrics.find((m) => m.name === "JSHeapUsedSize")?.value ?? 0;
        const jsHeapUsedMb =
          Math.round((heapUsedBytes / (1024 * 1024)) * 10) / 10;

        expect(pageErrors).toEqual([]);
        if (cpuThrottleRate === 1 && bookCount === 500) {
          expect(timeToContentMs).toBeLessThan(2000);
        }

        scaleMetrics[`books_${bookCount}_cpu_${cpuThrottleRate}x`] = {
          bookCount,
          cpuThrottleRate,
          timeToContentMs,
          hydrationMs,
          domInteractiveMs: domAudit.domInteractiveMs,
          totalDomNodes: domAudit.totalDomNodes,
          totalShelfRows: domAudit.totalRows,
          mountedShelfRowsInitial: domAudit.mountedRowsCount,
          jsHeapUsedMb,
          scrollFps: scrollMetrics.fps,
          hoverAvgLatencyMs: hoverLatencyMs,
          filterLatencyMs: filterInPMs,
          dragDropLatencyMs,
          list2dWindowedCount,
        };

        await context.close();
      }
    }

    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(DATA_DIR, "browser-scale-report.json"),
      JSON.stringify(scaleMetrics, null, 2)
    );
  });
});
