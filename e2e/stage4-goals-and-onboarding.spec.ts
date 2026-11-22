import { expect, test } from "@playwright/test";

test.describe("Etapa 4 — Metas sem culpa e Onboarding para conta vazia", () => {
  test("conta de teste exibe metas por viabilidade (Páginas = No ritmo, Livros = Meta ambiciosa), sem selo vermelho nem termos de falha", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/entrar");
    await page
      .getByRole("button", { name: /Explorar Biblioteca Demonstrativa/i })
      .click();
    await page.waitForURL((u) => !u.pathname.includes("/entrar"), {
      timeout: 30_000,
    });

    consoleErrors.length = 0;
    pageErrors.length = 0;

    // 1. Verificar /painel, /metas e /evolucao
    for (const route of ["/painel", "/metas", "/evolucao"]) {
      await page.goto(route, { waitUntil: "networkidle" });

      const bodyText = (await page.locator("main").innerText()).toLowerCase();
      expect(bodyText).not.toContain("atrasada");
      expect(bodyText).not.toContain("falhou");
      expect(bodyText).not.toContain("perdeu");

      // Badges com ícone + texto (nunca só cor)
      // A meta de páginas sai "No ritmo" (on_track) quando freq >= necessário (ou "Dá para alcançar" em dias finais do mês com 8 dias fixos no demo)
      const pagesBadge = page
        .locator(
          '[data-goal-status="on_track"], [data-goal-status="achievable"]'
        )
        .first();
      await expect(pagesBadge).toBeVisible();
      await expect(pagesBadge).toContainText(/No ritmo|Dá para alcançar/);
      await expect(pagesBadge.locator("svg")).toBeVisible();

      const booksBadge = page.locator('[data-goal-status="ambitious"]').first();
      await expect(booksBadge).toBeVisible();
      await expect(booksBadge).toContainText("Meta ambiciosa");
      await expect(booksBadge.locator("svg")).toBeVisible();

      // Progresso em destaque + alternativa realista
      await expect(page.locator("main")).toContainText("4 de 6 livros, 67%");
      await expect(page.locator("main")).toContainText(
        "1.000 de 1.500 páginas, 67%"
      );
      await expect(page.locator("main")).toContainText(
        "No seu ritmo, 5 livros até 31/12."
      );
    }

    // 2. Interações "Ver como chegar lá" e "Ajustar meta" em /metas
    await page.goto("/metas", { waitUntil: "networkidle" });
    await page
      .getByRole("button", { name: /Ver como chegar lá/i })
      .first()
      .click();
    await expect(
      page.getByText(/Caminho sugerido no seu ritmo/i).first()
    ).toBeVisible();

    await page
      .getByRole("button", { name: /Ajustar meta/i })
      .first()
      .click();
    await expect(
      page.getByText(/Ajustar alvo ou adiar prazo \(sem penalidade\)/i).first()
    ).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("conta nova vazia vê guia de 3 passos dispensável/retomável em Configurações e estados vazios ilustrados sem dados de demonstração", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(err.message));

    const uniqueEmail = `etapa4-vazia-${Date.now()}@readingflow.test`;
    await page.goto("/criar-conta", { waitUntil: "networkidle" });

    await page.locator("#signup-email").fill(uniqueEmail);
    await page.locator("#signup-password").fill("LeituraSerena#2026!Xy");

    // Marcar checkboxes de idade mínima (>= 16) e aceite de termos
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check();
    }

    await page
      .getByRole("button", { name: /Criar minha biblioteca|Criar conta/i })
      .click();
    await page.waitForURL((u) => !u.pathname.includes("/criar-conta"), {
      timeout: 30_000,
    });

    // Concluir wizard inicial /onboarding se redirecionado (conta recém-criada)
    if (page.url().includes("/onboarding")) {
      await page.getByRole("button", { name: /Continuar/i }).click();
      await page.getByRole("button", { name: /Continuar/i }).click();
      const finishBtn = page.getByRole("button", {
        name: /Ir para minha biblioteca|Concluir|Pular|Começar/i,
      });
      if ((await finishBtn.count()) > 0) {
        await finishBtn.first().click();
        await page.waitForURL((u) => !u.pathname.includes("/onboarding"), {
          timeout: 15_000,
        });
      }
    }

    consoleErrors.length = 0;
    pageErrors.length = 0;

    // 1. Painel: guia de 3 passos visível e ZERO livros de demonstração misturados
    await page.goto("/painel", { waitUntil: "networkidle" });
    const guide = page.getByTestId("onboarding-guide");
    await expect(guide).toBeVisible();
    await expect(guide).toContainText("Adicione seu primeiro livro");
    await expect(guide).toContainText("Defina uma meta anual");
    await expect(guide).toContainText("Conheça o Canto de Foco");
    expect((await guide.innerText()).toLowerCase()).not.toContain("goodreads");

    const painelText = await page.locator("main").innerText();
    expect(painelText).not.toContain("Dom Casmurro");
    expect(painelText).not.toContain("Grande Sertão: Veredas");

    // 2. Dispensar guia e confirmar persistência após reload
    await guide.getByRole("button", { name: /Dispensar guia/i }).click();
    await expect(guide).toBeHidden({ timeout: 10_000 });

    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByTestId("onboarding-guide")).toHaveCount(0);

    // 3. Reativar em Configurações -> Primeiros passos
    await page.goto("/configuracoes", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: /Primeiros passos/i })
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Retomar guia de primeiros passos/i })
      .click();
    await expect(
      page.getByText(/Guia de primeiros passos reativado no Painel/i)
    ).toBeVisible();

    await page.goto("/painel", { waitUntil: "networkidle" });
    await expect(page.getByTestId("onboarding-guide")).toBeVisible();

    // 4. Estante 3D e Estantes 2D: estante vazia ilustrada
    for (const shelfRoute of ["/estante-3d", "/estantes"]) {
      await page.goto(shelfRoute, { waitUntil: "networkidle" });
      const emptyShelf = page.getByTestId("empty-bookshelf-illustration");
      await expect(emptyShelf).toBeVisible();
      await expect(emptyShelf.getByRole("img")).toBeVisible();
      await expect(
        emptyShelf.getByRole("link", { name: /Adicionar primeiro livro/i })
      ).toBeVisible();
    }

    // 5. Explorar: estado vazio acolhedor sem dados demo misturados
    await page.goto("/explorar", { waitUntil: "networkidle" });
    await expect(page.getByTestId("explorar-empty-state")).toBeVisible();
    const explorarText = await page.locator("main").innerText();
    expect(explorarText).not.toContain("Dom Casmurro");

    // 6. Evolução: estado vazio acolhedor sem dados demo misturados
    await page.goto("/evolucao", { waitUntil: "networkidle" });
    await expect(page.getByTestId("evolucao-empty-state")).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
