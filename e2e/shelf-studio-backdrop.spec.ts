import { expect, test } from "@playwright/test";

const ARTIFACT_DIR =
  "C:/Users/PICHAU/.gemini/antigravity/brain/f3a01bfd-1980-4513-8d2a-383b0097cea7/scratch";

test.describe("LibraryBackdrop widescreen + Estúdio de Personalização da Estante", () => {
  test("renderiza laterais arquitetônicas no widescreen e sincroniza estúdio 2 colunas com /estante-3d", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: "rf_demo_session", value: "true", url: "http://localhost:3000" },
      { name: "rf_theme", value: "caderno", url: "http://localhost:3000" },
    ]);

    await page.setViewportSize({ width: 1600, height: 900 });

    // 2. Painel em widescreen: verifica <LibraryBackdrop /> visível atrás do conteúdo central
    await page.goto("/painel", { waitUntil: "networkidle" });
    const backdrop = page.locator('[data-rf-library-backdrop="app"]');
    await expect(backdrop).toBeVisible();
    const hasOverflowPainel = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    );
    expect(hasOverflowPainel).toBe(false);
    await page.screenshot({
      path: `${ARTIFACT_DIR}/verify-painel-widescreen.png`,
      fullPage: false,
    });

    // 3. Estúdio /estante-3d/arrumar em widescreen (2 colunas)
    await page.goto("/estante-3d/arrumar", { waitUntil: "networkidle" });
    await expect(page.locator('[data-rf-library-backdrop="app"]')).toBeVisible();

    // Aplica preset "Vitrine Iluminada" (1 clique)
    await page.getByRole("button", { name: /Vitrine Iluminada/i }).click();
    const bookcase = page.locator('[data-shelf-mode="edit"]');
    await expect(bookcase).toHaveAttribute(
      "data-shelf-material-v2",
      "carvalho"
    );
    await expect(bookcase).toHaveAttribute("data-shelf-brackets", "dourado");
    await expect(bookcase).toHaveAttribute(
      "data-shelf-backdrop",
      "verde_biblioteca"
    );
    await expect(bookcase).toHaveAttribute("data-shelf-led", "on");
    await expect(bookcase).toHaveAttribute("data-shelf-spotlights", "on");
    await expect(bookcase).toHaveAttribute("data-shelf-density", "vitrine");

    // Adiciona objetos decorativos na aba "Objetos"
    await page.getByRole("tab", { name: /Objetos/i }).click();
    await page.getByRole("button", { name: /Planta em Vaso/i }).click();
    await page.getByRole("button", { name: /Vela Aromática/i }).click();
    await expect(page.locator('[data-shelf-decor="planta"]').first()).toBeVisible();
    await expect(page.locator('[data-shelf-decor="vela"]').first()).toBeVisible();

    // Seleciona um livro na estante e coloca em "Capa de Frente"
    const firstBookBtn = bookcase.locator("button.rf-book-prism").first();
    await firstBookBtn.click();
    await page.getByRole("radio", { name: /Capa de Frente/i }).click();
    await expect(
      bookcase.locator('[data-book-display="capa_frente"]').first()
    ).toBeVisible();

    // Volta para aba Estilo para screenshot do painel completo do estúdio
    await page.getByRole("tab", { name: /Estilo/i }).click();
    await page.waitForTimeout(250);

    // Garante que todos os objetos decorativos permaneçam dentro dos limites da estante
    const bookcaseBox = await bookcase.boundingBox();
    const velaBox = await bookcase.locator('[data-shelf-decor="vela"]').first().boundingBox();
    expect(bookcaseBox).not.toBeNull();
    expect(velaBox).not.toBeNull();
    expect(velaBox!.x + velaBox!.width).toBeLessThanOrEqual(
      bookcaseBox!.x + bookcaseBox!.width
    );

    await page.screenshot({
      path: `${ARTIFACT_DIR}/verify-studio-widescreen.png`,
      fullPage: false,
    });

    // Salva alterações
    await page.getByRole("button", { name: /Salvar/i }).click();
    await page.waitForTimeout(500);

    // 4. Vai para /estante-3d e verifica 100% de sincronização
    await page.goto("/estante-3d", { waitUntil: "networkidle" });
    const viewBookcase = page.locator('[data-shelf-mode="view"]');
    await expect(viewBookcase).toHaveAttribute(
      "data-shelf-material-v2",
      "carvalho"
    );
    await expect(viewBookcase).toHaveAttribute("data-shelf-brackets", "dourado");
    await expect(viewBookcase).toHaveAttribute(
      "data-shelf-backdrop",
      "verde_biblioteca"
    );
    await expect(viewBookcase).toHaveAttribute("data-shelf-led", "on");
    await expect(viewBookcase).toHaveAttribute("data-shelf-spotlights", "on");
    await expect(viewBookcase).toHaveAttribute("data-shelf-density", "vitrine");
    await expect(
      viewBookcase.locator('[data-shelf-decor="planta"]').first()
    ).toBeVisible();
    await expect(
      viewBookcase.locator('[data-shelf-decor="vela"]').first()
    ).toBeVisible();
    await expect(
      viewBookcase.locator('[data-book-display="capa_frente"]').first()
    ).toBeVisible();

    await page.screenshot({
      path: `${ARTIFACT_DIR}/verify-estante3d-synced-widescreen.png`,
      fullPage: false,
    });

    // 5. Mobile 390px: backdrop oculto e zero overflow horizontal
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/estante-3d/arrumar", { waitUntil: "networkidle" });
    await expect(page.locator('[data-rf-library-backdrop="app"]')).toBeHidden();
    const hasOverflowMobile = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    );
    expect(hasOverflowMobile).toBe(false);
    await page.screenshot({
      path: `${ARTIFACT_DIR}/verify-studio-mobile.png`,
      fullPage: false,
    });
  });
});
