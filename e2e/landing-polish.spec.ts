import { expect, test } from "@playwright/test";

const CAPTURE_DIR =
  "C:/Users/PICHAU/.gemini/antigravity/brain/f3a01bfd-1980-4513-8d2a-383b0097cea7/landing-captures";

test.describe("Landing polish — capas reais, cabeçalho de sessão, CTAs, âncoras e scrollbar", () => {
  test("valida 1440px, 1024px e 390px (visitante e logado) e gera capturas", async ({
    page,
  }) => {
    const coverApiCalls: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/covers/")) {
        coverApiCalls.push(req.url());
      }
    });

    // Força estado visitante explícito no endpoint leve /api/session
    await page.route("**/api/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ authenticated: false, displayName: null }),
      });
    });

    /* ==================== 1. DESKTOP 1440px ==================== */
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "networkidle" });

    // Barra de rolagem com tokens do tema
    const htmlStyles = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return {
        gutter: cs.scrollbarGutter,
        width: cs.scrollbarWidth,
        track: cs.getPropertyValue("--scrollbar-track").trim(),
        thumb: cs.getPropertyValue("--scrollbar-thumb").trim(),
        hover: cs.getPropertyValue("--scrollbar-thumb-hover").trim(),
      };
    });
    expect(htmlStyles.gutter).toContain("stable");
    expect(htmlStyles.width).toBe("thin");
    expect(htmlStyles.track).not.toBe("");
    expect(htmlStyles.thumb).not.toBe("");
    expect(htmlStyles.hover).not.toBe("");

    // Cabeçalho visitante em 1440px
    const header = page.locator("header.rf-marketing-header");
    await expect(header).toBeVisible();
    await expect(header.getByRole("link", { name: /^Entrar/i })).toBeVisible();
    await expect(
      header.getByRole("link", { name: /Criar minha estante/i })
    ).toBeVisible();
    await expect(
      header.getByRole("link", { name: /^Abrir Minha Estante$/i })
    ).toHaveCount(0);

    // Captura do cabeçalho em 1440px (visitante)
    await page.screenshot({
      path: `${CAPTURE_DIR}/header-1440-visitante.png`,
      clip: { x: 0, y: 0, width: 1440, height: 180 },
    });

    // Âncoras do menu com scroll-margin-top sem esconder títulos
    const headerHeight1440 = (await header.boundingBox())!.height;
    for (const anchor of [
      { label: "Sobre", heading: /Sobre o ReadingFlow/i },
      { label: "Funcionalidades", heading: /Projetado para Cada Momento/i },
      { label: "FAQ", heading: /Perguntas & Respostas/i },
    ]) {
      await header.getByRole("link", { name: new RegExp(anchor.label, "i") }).first().click();
      await page.waitForTimeout(350);
      const headingBox = await page
        .getByRole("heading", { name: anchor.heading })
        .boundingBox();
      expect(headingBox).not.toBeNull();
      expect(headingBox!.y).toBeGreaterThanOrEqual(headerHeight1440 - 2);
    }

    // Pacto editorial >= 14px
    const privacyFontSize = await page
      .locator('[aria-label="Compromissos de privacidade do ReadingFlow"] p')
      .first()
      .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
    expect(privacyFontSize).toBeGreaterThanOrEqual(14);

    // Alinhamento dos 3 cards de funcionalidades
    const cardParagraphYs = await page
      .locator("#funcionalidades h3 + p")
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().y)));
    expect(cardParagraphYs).toHaveLength(3);
    expect(Math.abs(cardParagraphYs[0]! - cardParagraphYs[1]!)).toBeLessThanOrEqual(2);
    expect(Math.abs(cardParagraphYs[1]! - cardParagraphYs[2]!)).toBeLessThanOrEqual(2);

    // Links dos cards sem presumir conta existente
    await expect(
      page.locator("#funcionalidades").getByRole("link", { name: /Conhecer a Estante/i })
    ).toBeVisible();
    await expect(
      page.locator("#funcionalidades").getByRole("link", { name: /Conhecer o Canto de Foco/i })
    ).toBeVisible();
    await expect(
      page.locator("#funcionalidades").getByRole("link", { name: /Conhecer a Evolução/i })
    ).toBeVisible();

    // Prévia em 1440px: capas reais, sem título duplicado no cabeçalho do card, sem "Ed. Clássica"
    const previewSection = page.locator("#preview");
    await previewSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);

    const previewCard = page.locator('[data-landing-preview="true"]');
    await expect(previewCard).toBeVisible();
    await expect(previewCard.getByText("Exemplo · dados fictícios")).toBeVisible();
    await expect(previewCard.getByText("Prévia da Sua Nova Estante")).toHaveCount(0);
    await expect(previewCard.getByText("Ed. Clássica")).toHaveCount(0);

    // Confere as 3 capas reais carregadas com width/height e alt descritivo
    for (const title of [
      "Dom Casmurro",
      "Memórias Póstumas de Brás Cubas",
      "Iracema",
    ]) {
      const img = previewCard.locator(`img[alt="Capa de ${title}"]`);
      await expect(img).toBeVisible();
      const info = await img.evaluate((el: HTMLImageElement) => ({
        complete: el.complete,
        naturalWidth: el.naturalWidth,
        widthAttr: el.getAttribute("width"),
        heightAttr: el.getAttribute("height"),
      }));
      expect(info.complete).toBe(true);
      expect(info.naturalWidth).toBeGreaterThanOrEqual(64);
      expect(info.widthAttr).toBe("128");
      expect(info.heightAttr).toBe("192");
    }
    await expect(
      previewCard.locator('[data-cover-state="loaded"]')
    ).toHaveCount(3);

    // Captura da prévia em 1440px
    await previewSection.screenshot({
      path: `${CAPTURE_DIR}/preview-1440.png`,
    });

    // Alterna para aba Digital e valida fallback gerado sem erro e sem API
    await previewCard.getByRole("tab", { name: /Digital/i }).click();
    await expect(previewCard.getByText("O Cortiço").first()).toBeVisible();
    await expect(
      previewCard.locator('[data-cover-state="fallback"]').first()
    ).toBeVisible();
    await previewCard.getByRole("tab", { name: /Física/i }).click();

    // CTAs de conversão unificados em "Criar minha estante"
    await expect(
      previewSection.getByRole("link", { name: /^Criar minha estante$/i })
    ).toBeVisible();
    const finalCtaLinks = page.getByRole("link", {
      name: /^Criar minha estante$/i,
    });
    expect(await finalCtaLinks.count()).toBeGreaterThanOrEqual(3);

    // Zero chamadas à API de capas na landing
    expect(coverApiCalls).toEqual([]);

    /* ==================== 2. TABLET/LAPTOP 1024px ==================== */
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    const overflow1024 = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    );
    expect(overflow1024).toBe(false);

    /* ==================== 3. MOBILE 390px (VISITANTE) ==================== */
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);

    const overflow390 = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    );
    expect(overflow390).toBe(false);

    const headerBox390 = await header.boundingBox();
    const brandBox390 = await header.getByRole("link", { name: "ReadingFlow" }).boundingBox();
    const actionsBox390 = await header.locator('[data-session-state]').boundingBox();
    expect(headerBox390!.height).toBeLessThanOrEqual(60);
    expect(brandBox390!.x + brandBox390!.width).toBeLessThan(actionsBox390!.x);

    // Captura do cabeçalho em 390px (visitante)
    await page.screenshot({
      path: `${CAPTURE_DIR}/header-390-visitante.png`,
      clip: { x: 0, y: 0, width: 390, height: 150 },
    });

    // Abre o menu hambúrguer e verifica ações iguais às do cabeçalho
    await header.getByRole("button", { name: /Abrir menu/i }).click();
    const mobileMenu = header.getByRole("menu");
    await expect(mobileMenu).toBeVisible();
    await expect(
      mobileMenu.getByRole("menuitem", { name: /Criar minha estante/i })
    ).toBeVisible();
    await expect(
      mobileMenu.getByRole("menuitem", { name: /^Entrar$/i })
    ).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: `${CAPTURE_DIR}/header-390-menu-aberto.png`,
      clip: { x: 0, y: 0, width: 390, height: 420 },
    });
    await header.getByRole("button", { name: /Fechar menu/i }).click();

    // Captura da prévia em 390px + garante que nenhum card interno vaze horizontalmente
    await previewSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const previewBounds = await previewCard.boundingBox();
    const firstItemBounds = await previewCard
      .locator('[role="tabpanel"] > div > div')
      .first()
      .boundingBox();
    expect(previewBounds).not.toBeNull();
    expect(firstItemBounds).not.toBeNull();
    expect(firstItemBounds!.x + firstItemBounds!.width).toBeLessThanOrEqual(
      previewBounds!.x + previewBounds!.width
    );
    await previewSection.screenshot({
      path: `${CAPTURE_DIR}/preview-390.png`,
    });

    /* ==================== 4. ESTADO LOGADO (1440px e 390px) ==================== */
    await page.unroute("**/api/session");
    await page.route("**/api/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          authenticated: true,
          displayName: "Helena Silva",
        }),
      });
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(
      header.locator('[data-session-state="authenticated"]')
    ).toBeVisible();
    await expect(
      header.getByRole("link", { name: /Abrir Minha Estante/i })
    ).toBeVisible();
    await expect(
      header.getByRole("link", { name: /Conta de Helena Silva/i })
    ).toBeVisible();
    await expect(header.getByRole("link", { name: /^Entrar/i })).toHaveCount(0);

    await page.screenshot({
      path: `${CAPTURE_DIR}/header-1440-logado.png`,
      clip: { x: 0, y: 0, width: 1440, height: 150 },
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await page.screenshot({
      path: `${CAPTURE_DIR}/header-390-logado.png`,
      clip: { x: 0, y: 0, width: 390, height: 150 },
    });
  });
});
