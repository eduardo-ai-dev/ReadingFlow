import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("ReadingFlow R0 (2D) — Fluxos Críticos e Acessibilidade WCAG 2.2 AA", () => {
  test("Landing Page: quarto noturno interativo (100vh sem overflow), luminária com cordão, lombadas clicáveis, modal 3D e WCAG 2.2 AA", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: /ReadingFlow — Leia\. Acompanhe\. Evolua\./i,
      })
    ).toBeVisible();

    // Cabeçalho minimalista com logotipo, acesso e controle de som/menu
    await expect(
      page.getByRole("link", { name: "ReadingFlow" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^Entrar$/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Criar conta/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Silenciar sons do ambiente/i })
    ).toBeVisible();

    // Relógio analógico e cordão da luminária pendente (alternância isLightOn)
    await expect(
      page.getByRole("img", { name: /Relógio analógico/i })
    ).toBeVisible();

    const pullCord = page.getByRole("button", {
      name: /luminária pendente/i,
    });
    await expect(pullCord).toHaveAttribute("aria-pressed", "true");
    await pullCord.click();
    await expect(pullCord).toHaveAttribute("aria-pressed", "false");
    await pullCord.click();
    await expect(pullCord).toHaveAttribute("aria-pressed", "true");

    // Prateleira superior esquerda com 11 livros claros/coloridos + 1 inclinado (12 volumes)
    const topLeftShelf = page.getByRole("group", {
      name: "Prateleira superior de clássicos",
    });
    await expect(topLeftShelf.locator("button.book-spine")).toHaveCount(12);

    // Interação com livro da estante -> abre vitrine 3D em modal
    const austenBtn = page.getByRole("button", {
      name: /Abrir livro Orgulho e Preconceito, de Jane Austen/i,
    });
    await expect(austenBtn).toBeVisible();
    await austenBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Orgulho e Preconceito" })
    ).toBeVisible();
    await expect(dialog.getByText(/Jane Austen/).first()).toBeVisible();

    // Fechar com Escape e verificar retorno de foco para a lombada clicada
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(austenBtn).toBeFocused();

    // Reabrir e fechar com o botão Fechar
    await austenBtn.click();
    await expect(dialog).toBeVisible();
    await page.getByRole("button", { name: "Fechar" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(austenBtn).toBeFocused();

    // Garante ausência total de overflow vertical (zero barra de rolagem na landing) e horizontal
    const { hasHorizOverflow, hasVertOverflow } = await page.evaluate(() => ({
      hasHorizOverflow:
        document.documentElement.scrollWidth > window.innerWidth,
      hasVertOverflow:
        document.documentElement.scrollHeight > window.innerHeight + 2,
    }));
    expect(hasHorizOverflow).toBe(false);
    expect(hasVertOverflow).toBe(false);

    // Validação estrita de acessibilidade WCAG 2.2 AA
    const a11y = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();

    const seriousOrCritical = a11y.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(seriousOrCritical).toEqual([]);
  });

  test("Jornada completa isolada: cadastro -> onboarding -> adicionar livro -> leitura -> desejos -> exportação CSV segura", async ({
    page,
  }, testInfo) => {
    const uniqueEmail = `leitor-${testInfo.project.name}-${Date.now()}@readingflow.local`;

    await page.goto("/criar-conta");
    await page.getByLabel(/^E-mail$/i).fill(uniqueEmail);
    await page.getByLabel(/Senha/i).fill("SenhaSegura123!");
    await page.getByLabel(/Declaro ter pelo menos 16 anos/i).check();
    await page.getByLabel(/Li e concordo com os/i).check();
    await page.getByRole("button", { name: /Criar minha biblioteca/i }).click();

    // Onboarding em 3 passos
    await expect(page).toHaveURL(/\/onboarding/);
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page
      .getByRole("button", {
        name: /Concluir e adicionar meu primeiro livro/i,
      })
      .click();

    // Página Adicionar: testa rejeição de ISBN inválido e cadastro manual com nota perigosa p/ CSV
    await expect(page).toHaveURL(/\/adicionar/);
    await page.getByLabel(/Digite o ISBN-10 ou ISBN-13/i).fill("9788535931980");
    await page.getByRole("button", { name: "Buscar ISBN" }).click();
    await expect(page.getByText(/ISBN inválido/i)).toBeVisible();

    await page.getByLabel(/Título da obra/i).fill("Vidas Secas");
    await page.getByLabel(/Autor\(a\) principal/i).fill("Graciliano Ramos");
    await page.getByLabel(/Número de páginas/i).fill("176");
    await page
      .getByLabel(/Notas privadas do exemplar/i)
      .fill('=HYPERLINK("https://evil.example")');
    await page.getByLabel(/Iniciar leitura deste livro imediatamente/i).check();
    await page.getByRole("button", { name: "Salvar na Estante" }).click();

    // Detalhe do livro recém-cadastrado
    await expect(page).toHaveURL(/\/livros\/work-/);
    await expect(
      page.getByRole("heading", { name: "Vidas Secas" })
    ).toBeVisible();

    // Concluir leitura pelo controle rápido
    await page.getByRole("button", { name: "Concluir livro" }).click();
    await expect(page.getByText("Concluído").first()).toBeVisible();

    // Verificar acessibilidade WCAG 2.2 AA dentro da área autenticada
    const appA11y = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    const seriousAppViolations = appA11y.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(seriousAppViolations).toEqual([]);

    // Lista de desejos -> compra atômica para estante
    await page.goto("/desejos");
    await page.getByRole("button", { name: /\+ Novo desejo/i }).click();
    await page.getByLabel(/Título \*/i).fill("Capitães da Areia");
    await page.getByLabel(/Autor\(a\) \*/i).fill("Jorge Amado");
    await page.getByRole("button", { name: "Salvar desejo" }).click();

    await expect(
      page.getByRole("link", { name: "Capitães da Areia" })
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Comprei · Mover p\/ Estante/i })
      .click();
    await page
      .getByRole("button", { name: /Confirmar entrada na estante/i })
      .click();
    await expect(page.getByText(/Desejos já adquiridos/i)).toBeVisible();

    // Verifica Estantes (Lista e Grade 2D)
    await page.goto("/estantes");
    await expect(
      page.getByRole("heading", { name: "Vidas Secas" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Capitães da Areia" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Lista" }).click();
    await expect(page.getByText(/Graciliano Ramos/).first()).toBeVisible();

    // Verifica neutralização de CSV contra fórmulas (= + - @)
    const csvRes = await page.request.get("/api/export?format=csv");
    expect(csvRes.status()).toBe(200);
    const csvBody = await csvRes.text();
    expect(csvBody).toContain("'=HYPERLINK");
  });

  test("Estante Virtual CSS 3D: seleciona prisma sem alterar layout, passa no axe-core e navega para /generos/terror", async ({
    page,
  }) => {
    await page.goto("/entrar");
    await page
      .getByRole("button", { name: /Explorar Biblioteca Demonstrativa/i })
      .click();
    await expect(page).toHaveURL(/\/painel/);

    await page.goto("/estantes");
    const slots = page.locator(".rf-shelf > .rf-book-slot");
    await expect(slots).toHaveCount(7);
    await expect(slots.first()).toBeVisible();

    const firstSlot = slots.nth(0);
    const secondSlot = slots.nth(1);
    const terrorButton = firstSlot.locator("button.rf-book-prism");
    await terrorButton.scrollIntoViewIfNeeded();
    const boxBefore1 = await firstSlot.boundingBox();
    const boxBefore2 = await secondSlot.boundingBox();

    await expect(terrorButton).toHaveAttribute("aria-pressed", "false");

    // 1º clique/toque seleciona o volume na estante 3D
    await terrorButton.click();
    await expect(terrorButton).toHaveAttribute("aria-pressed", "true");
    await expect(firstSlot).toHaveClass(/is-selected/);

    // Garante zero mudança de layout nos slots da estante
    const boxAfter1 = await firstSlot.boundingBox();
    const boxAfter2 = await secondSlot.boundingBox();
    expect(Math.round(boxAfter1?.width ?? 0)).toBe(
      Math.round(boxBefore1?.width ?? 0)
    );
    expect(Math.round(boxAfter1?.height ?? 0)).toBe(
      Math.round(boxBefore1?.height ?? 0)
    );
    expect(Math.round(boxAfter2?.x ?? 0)).toBe(
      Math.round(boxBefore2?.x ?? 0)
    );

    const shelfA11y = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    expect(
      shelfA11y.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      )
    ).toEqual([]);

    // 2º clique no prisma selecionado direciona à página dedicada do gênero
    await terrorButton.click();
    await expect(page).toHaveURL(/\/generos\/terror/);
    await expect(page).toHaveTitle(/Terror/i);
    await expect(
      page.getByRole("heading", { name: /Livros de Terror & Gótico/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Noite na Taverna" })
    ).toBeVisible();

    const genrePageA11y = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    expect(
      genrePageA11y.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      )
    ).toEqual([]);
  });

  test("VirtualBookshelf: gera nova prateleira dinâmica para gênero inédito, remove exibição de fuso horário, anima sem colisão e passa no axe-core", async ({
    page,
  }, testInfo) => {
    const uniqueEmail = `estante3d-${testInfo.project.name}-${Date.now()}@readingflow.local`;

    await page.goto("/criar-conta");
    await page.getByLabel(/^E-mail$/i).fill(uniqueEmail);
    await page.getByLabel(/Senha/i).fill("SenhaSegura123!");
    await page.getByLabel(/Declaro ter pelo menos 16 anos/i).check();
    await page.getByLabel(/Li e concordo com os/i).check();
    await page.getByRole("button", { name: /Criar minha biblioteca/i }).click();

    await expect(page).toHaveURL(/\/onboarding/);
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page
      .getByRole("button", {
        name: /Concluir e adicionar meu primeiro livro/i,
      })
      .click();

    // Cadastra 2 livros em Clássicos (para validar zero colisão entre vizinhos) e 1 no gênero inédito "Filosofia"
    await expect(page).toHaveURL(/\/adicionar/);
    await page.getByLabel(/Título da obra/i).fill("O Estrangeiro");
    await page.getByLabel(/Autor\(a\) principal/i).fill("Albert Camus");
    await page.getByLabel(/Número de páginas/i).fill("120");
    await page.getByLabel(/Gênero principal/i).fill("Clássicos");
    await page.getByRole("button", { name: "Salvar na Estante" }).click();
    await expect(page).toHaveURL(/\/livros\/work-/);

    await page.goto("/adicionar");
    await expect(page.getByRole("heading", { name: "Adicionar Livro ao Acervo" })).toBeVisible();
    await page.getByLabel(/Título da obra/i).fill("A Peste");
    await expect(page.getByLabel(/Título da obra/i)).toHaveValue("A Peste");
    await page.getByLabel(/Autor\(a\) principal/i).fill("Albert Camus");
    await page.getByLabel(/Número de páginas/i).fill("280");
    await page.getByLabel(/Gênero principal/i).fill("Clássicos");
    await page.getByRole("button", { name: "Salvar na Estante" }).click();
    await expect(page).toHaveURL(/\/livros\/work-/);

    await page.goto("/adicionar");
    await expect(page.getByRole("heading", { name: "Adicionar Livro ao Acervo" })).toBeVisible();
    await page.getByLabel(/Título da obra/i).fill("O Mito de Sísifo");
    await expect(page.getByLabel(/Título da obra/i)).toHaveValue("O Mito de Sísifo");
    await page.getByLabel(/Autor\(a\) principal/i).fill("Albert Camus");
    await page.getByLabel(/Número de páginas/i).fill("150");
    await page.getByLabel(/Gênero principal/i).fill("Filosofia");
    await page.getByRole("button", { name: "Salvar na Estante" }).click();
    await expect(page).toHaveURL(/\/livros\/work-/);

    // Verifica /estantes: prateleiras dinâmicas, zero fuso horário visível e zero deslocamento do vizinho
    await page.goto("/estantes");
    await expect(page).toHaveTitle(/Estantes/i);
    await expect(page.locator("body")).not.toContainText("America/Sao_Paulo");

    const classicosShelf = page.locator('[data-genre-shelf="classicos"]');
    const filosofiaShelf = page.locator('[data-genre-shelf="filosofia"]');
    await expect(classicosShelf).toBeVisible();
    await expect(filosofiaShelf).toBeVisible();

    const firstSlot = classicosShelf.locator("li").nth(0);
    const neighborSlot = classicosShelf.locator("li").nth(1);
    const estrangeiroBtn = firstSlot.getByRole("button", {
      name: /O Estrangeiro \(Clássicos/i,
    });
    await estrangeiroBtn.scrollIntoViewIfNeeded();
    const neighborBefore = await neighborSlot.boundingBox();

    await estrangeiroBtn.click();
    await expect(estrangeiroBtn).toHaveAttribute("aria-pressed", "true");

    const neighborAfter = await neighborSlot.boundingBox();
    expect(neighborAfter?.x).toBe(neighborBefore?.x);
    expect(neighborAfter?.width).toBe(neighborBefore?.width);

    // Valida acessibilidade WCAG 2.2 AA com a nova paleta escura moderna
    const shelfA11y = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    expect(
      shelfA11y.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      )
    ).toEqual([]);

    // Verifica que /painel também removeu a exibição de fuso horário no cabeçalho
    await page.goto("/painel");
    await expect(page).toHaveTitle(/Painel/i);
    await expect(page.locator("body")).not.toContainText("America/Sao_Paulo");
  });
});
