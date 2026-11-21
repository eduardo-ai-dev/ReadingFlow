import { expect, test } from "@playwright/test";

const FOUR_THEMES = [
  { id: "caderno", canvasHex: "#F4EFE6", navBgRgb: "rgb(20, 21, 20)" },
  { id: "dark-academia", canvasHex: "#141514", navBgRgb: "rgb(15, 16, 15)" },
  { id: "escandinavo", canvasHex: "#F5F6F4", navBgRgb: "rgb(252, 252, 251)" },
  { id: "gotico", canvasHex: "#0F0D10", navBgRgb: "rgb(10, 8, 11)" },
] as const;

test.describe("Sistema de Temas (Fases 1–3) — 4 temas curados, sem flash e rotas de referência", () => {
  test("troca os 4 temas ao vivo no seletor de /configuracoes, persiste após F5 sem flash", async ({
    page,
    context,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    await context.addCookies([
      { name: "rf_demo_session", value: "true", url: "http://localhost:3000" },
      { name: "rf_theme", value: "caderno", url: "http://localhost:3000" },
    ]);

    await page.goto("/configuracoes", { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "caderno");

    // 4 cards de tema visíveis sem opções avançadas
    for (const theme of FOUR_THEMES) {
      await expect(page.locator(`[data-theme-card="${theme.id}"]`)).toBeVisible();
    }

    // Troca instantânea para Escandinavo (navegação clara + títulos sans)
    await page.locator('[data-theme-card="escandinavo"]').click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "escandinavo");
    const escNavBg = await page
      .locator("header")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(escNavBg).toBe("rgb(252, 252, 251)");

    // Troca instantânea para Gótico e valida persistência após F5 sem flash
    await page.locator('[data-theme-card="gotico"]').click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "gotico");
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "gotico");

    // Restaura Caderno
    await page.locator('[data-theme-card="caderno"]').click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "caderno");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors.filter((e) => /hydration|mismatch/i.test(e))).toEqual([]);
  });

  test("captura e valida as 4 telas de referência (painel, estante-3d, explorar, evolucao) nos 4 temas em 1440px e 390px", async ({
    page,
    context,
  }, testInfo) => {
    // Executa apenas no projeto desktop-chrome pois alterna explicitamente entre 1440px e 390px
    test.skip(testInfo.project.name !== "desktop-chrome");
    test.setTimeout(90_000);

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    await context.addCookies([
      { name: "rf_demo_session", value: "true", url: "http://localhost:3000" },
      { name: "rf_theme", value: "caderno", url: "http://localhost:3000" },
    ]);

    const routes = [
      { path: "/painel", slug: "painel" },
      { path: "/estante-3d", slug: "estante-3d" },
      { path: "/explorar", slug: "explorar" },
      { path: "/evolucao", slug: "evolucao" },
    ] as const;

    const viewports = [
      { label: "1440", width: 1440, height: 900 },
      { label: "390", width: 390, height: 844 },
    ] as const;

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const route of routes) {
        await page.goto(route.path, { waitUntil: "networkidle" });

        // Sem overflow horizontal em nenhuma largura
        const hasOverflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth
        );
        expect(hasOverflow, `${route.path} @ ${vp.label}px`).toBe(false);

        for (const theme of FOUR_THEMES) {
          await page.evaluate((id) => {
            const root = document.documentElement;
            root.setAttribute("data-theme-switching", "true");
            root.setAttribute("data-theme", id);
            void root.offsetWidth;
          }, theme.id);
          await page.evaluate(() => {
            document.documentElement.removeAttribute("data-theme-switching");
          });

          const canvasVar = await page.evaluate(() =>
            getComputedStyle(document.documentElement)
              .getPropertyValue("--rf-surface-canvas")
              .trim()
              .toUpperCase()
          );
          expect(canvasVar).toBe(theme.canvasHex);

          const headerBg = await page
            .locator("header")
            .first()
            .evaluate((el) => getComputedStyle(el).backgroundColor);
          expect(headerBg).toBe(theme.navBgRgb);

          await page.screenshot({
            path: `test-results/theme-refs/fase3-${route.slug}-${theme.id}-${vp.label}.png`,
          });
        }
      }
    }

    expect(pageErrors).toEqual([]);
    expect(consoleErrors.filter((e) => /hydration|mismatch/i.test(e))).toEqual([]);
  });
});
