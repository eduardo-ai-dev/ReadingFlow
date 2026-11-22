import { expect, test } from "@playwright/test";

test.describe("Regressão React #607 e estabilidade de dados em /estatisticas e rotas principais", () => {
  test("carrega /estatisticas e alterna filtros sem erro #607, sem aviso de hidratação e sem loop de requisições", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const statsRequests: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    // Autenticação via conta demonstrativa em ambiente de desenvolvimento/staging
    await page.goto("/entrar");
    await page
      .getByRole("button", { name: /Explorar Biblioteca Demonstrativa/i })
      .click();
    await page.waitForURL((u) => !u.pathname.includes("/entrar"), {
      timeout: 30_000,
    });

    // Limpa contadores e monitora exclusivamente requisições de dados da rota /estatisticas
    consoleErrors.length = 0;
    pageErrors.length = 0;
    page.on("request", (req) => {
      const url = req.url();
      if (
        url.includes("/estatisticas") &&
        (req.resourceType() === "document" || Boolean(req.headers()["rsc"]))
      ) {
        statsRequests.push(url);
      }
    });

    // 1. Abertura direta de /estatisticas
    await page.goto("/estatisticas", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: /Estatísticas e Ranking Geral/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Histórico por ano/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Ranking Geral Automático/i })
    ).toBeVisible();

    // Aguarda janela para detectar qualquer loop de suspensão / nova busca
    await page.waitForTimeout(1_000);
    const initialLoadCount = statsRequests.length;
    expect(initialLoadCount).toBeLessThanOrEqual(2);

    // 2. Alterna os 3 filtros de período (1 RSC fetch por troca, sem loop)
    await page.getByRole("link", { name: "Mês atual" }).click();
    await expect(page).toHaveURL(/periodo=current_month/);
    await page.waitForTimeout(600);

    await page.getByRole("link", { name: "Todo o histórico" }).click();
    await expect(page).toHaveURL(/periodo=all_time/);
    await page.waitForTimeout(600);

    await page.getByRole("link", { name: "Ano atual" }).click();
    await expect(page).toHaveURL(/periodo=current_year/);
    await page.waitForTimeout(600);

    // 1 load inicial + 3 trocas de filtro (+ possível prefetch) => teto estrito sem loop
    expect(statsRequests.length).toBeLessThanOrEqual(8);

    // Zero erros de console (incluindo React #607 / conditional-use-of-use e hidratação)
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("varredura de rotas principais (/painel, /estantes, /estante-3d, /explorar, /leitura/foco) sem React #607 nem loop de requisições", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    await page.goto("/entrar");
    await page
      .getByRole("button", { name: /Explorar Biblioteca Demonstrativa/i })
      .click();
    await page.waitForURL((u) => !u.pathname.includes("/entrar"), {
      timeout: 30_000,
    });

    consoleErrors.length = 0;
    pageErrors.length = 0;

    const routesToCheck = [
      "/painel",
      "/estantes",
      "/estante-3d",
      "/explorar",
      "/leitura/foco",
      "/estatisticas",
    ];

    for (const route of routesToCheck) {
      let dataReqsForRoute = 0;
      const listener = (req: import("@playwright/test").Request) => {
        if (
          req.url().includes(route) &&
          (req.resourceType() === "document" || Boolean(req.headers()["rsc"]))
        ) {
          dataReqsForRoute += 1;
        }
      };
      page.on("request", listener);
      await page.goto(route, { waitUntil: "networkidle" });
      await page.waitForTimeout(700);
      page.off("request", listener);

      // Sem loop de suspensão e nova busca
      expect(dataReqsForRoute).toBeLessThanOrEqual(3);
    }

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
