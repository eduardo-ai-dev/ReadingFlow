import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";

const STATIC_LOCAL_COVERS = [
  "/landing/covers/dom-casmurro.webp",
  "/landing/covers/iracema.webp",
  "/landing/covers/memorias-postumas-bras-cubas.webp",
];

test.describe("Etapa 5 — Capas reais, Estante 3D (móvel completo) e fluidez com 150 e 500 livros", () => {
  test.afterAll(async ({ request }) => {
    await request
      .post("/api/internal/loadtest", { data: { action: "cleanup" } })
      .catch(() => {});
  });
  test("renderiza móvel completo (cornija, rodapé, nicho em arco), zero buscas de capa ao abrir, hover/ficha rápida e caminho manual de capa", async ({
    page,
  }) => {
    const coverSearchRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/covers/search")) {
        coverSearchRequests.push(req.url());
      }
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/entrar");
    await page
      .getByRole("button", { name: /Explorar Biblioteca Demonstrativa/i })
      .click();
    await page.waitForURL((url) => !url.pathname.includes("/entrar"), {
      timeout: 25_000,
    });

    coverSearchRequests.length = 0;
    await page.goto("/estante-3d", { waitUntil: "networkidle" });

    // Zero buscas de capa ao exibir a estante
    expect(coverSearchRequests).toHaveLength(0);

    // Cobertura real exibida no cabeçalho
    await expect(page.getByText(/com capa real/i)).toBeVisible();

    // Móvel completo: cornija, rodapé e nicho em arco com livro em andamento exposto de frente
    await expect(page.locator('[data-cabinet-cornice="true"]')).toBeVisible();
    await expect(page.locator('[data-cabinet-baseboard="true"]')).toBeVisible();
    const archNiche = page.locator('[data-reading-arch-niche="true"]');
    await expect(archNiche).toBeVisible();
    await expect(archNiche).toContainText(/Lendo agora/i);

    // Inspeciona geometria, zero overflow, compartimentos uniformes, nós leves e livros inclinados
    const metrics = await page.evaluate(() => {
      const bookcase = document.querySelector("[class*=bookcase]");
      const slots = document.querySelectorAll(".rf-book-slot");
      const shelfRect = bookcase ? bookcase.getBoundingClientRect() : null;
      let overflowCount = 0;
      slots.forEach((slot) => {
        const r = slot.getBoundingClientRect();
        if (
          shelfRect &&
          (r.right > shelfRect.right + 2 || r.left < shelfRect.left - 2)
        ) {
          overflowCount += 1;
        }
      });
      const avgNodesPerBook = slots.length
        ? Math.round(
            Array.from(slots).reduce(
              (acc, el) => acc + el.querySelectorAll("*").length,
              0
            ) / slots.length
          )
        : 0;
      const tierHeights = Array.from(
        document.querySelectorAll("[class*=shelfTier]")
      ).map((el) => Math.round(el.getBoundingClientRect().height));
      const tiltedAutoCount = document.querySelectorAll(
        '[data-auto-tilted="true"]'
      ).length;
      const horizontalOverflow =
        document.documentElement.scrollWidth > window.innerWidth + 1;

      return {
        booksCount: slots.length,
        overflowCount,
        avgNodesPerBook,
        tierHeights,
        tiltedAutoCount,
        horizontalOverflow,
      };
    });

    expect(metrics.booksCount).toBeGreaterThanOrEqual(20);
    expect(metrics.overflowCount).toBe(0);
    expect(metrics.horizontalOverflow).toBe(false);
    expect(metrics.avgNodesPerBook).toBeLessThanOrEqual(9);
    expect(metrics.tiltedAutoCount).toBeGreaterThanOrEqual(1);
    expect(new Set(metrics.tierHeights).size).toBe(1);

    // Hover numa lombada atualiza a ficha rápida
    const secondBook = page.locator(".rf-book-slot button").nth(1);
    await secondBook.hover();
    await expect(page.getByText("Ficha rápida", { exact: true })).toBeVisible();

    // Caminho manual na Ficha Rápida abre o seletor de edição (editar busca, colar link ou foto)
    const chooseCoverLink = page.getByTestId("quick-panel-choose-cover");
    await expect(chooseCoverLink).toBeVisible();
    await chooseCoverLink.click();
    await page.waitForURL(/\/livros\/.+\?editarCapa=1/, { timeout: 20_000 });
    await expect(
      page
        .getByRole("button", { name: /Colar link da imagem|Enviar foto/i })
        .first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("suporta estante 3D fluida com 150 e 500 livros sem overflow e com content-visibility ativo", async ({
    page,
    request,
  }, testInfo) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.setViewportSize({ width: 1440, height: 900 });

    const seedMod = (await import(
      pathToFileURL(path.resolve(process.cwd(), "loadtest/seed.mjs")).href
    )) as {
      DEFAULT_LOADTEST_PASSWORD: string;
      generateDeterministicUserWorkspace: (opts: {
        userIndex: number;
        bookCount: number;
        seed?: number;
      }) => {
        workspace: {
          profile: { email: string };
          editions: Array<{ coverUrl?: string }>;
        };
      };
    };

    const workerOffset = (testInfo.workerIndex + 1) * 10;

    for (const [stepIdx, count] of [
      [1, 150],
      [2, 500],
    ] as const) {
      const userIdx = 900 + workerOffset + stepIdx;
      const generated = seedMod.generateDeterministicUserWorkspace({
        userIndex: userIdx,
        bookCount: count,
        seed: 20261122 + userIdx,
      });
      const ws = generated.workspace;

      // Substitui URLs do mock server por capas estáticas locais ou fallback (sem erro de rede)
      ws.editions.forEach((ed, i) => {
        ed.coverUrl =
          i % 3 === 0
            ? STATIC_LOCAL_COVERS[i % STATIC_LOCAL_COVERS.length]
            : undefined;
      });

      const seedRes = await request.post("/api/internal/loadtest", {
        data: {
          action: "seed_batch",
          workspaces: [{ workspace: ws, syncSqlite: false }],
        },
      });
      expect(seedRes.ok()).toBe(true);

      // Faz login na conta sintética dentro do browser
      await page.goto("/entrar");
      await page.evaluate(
        async ({ email, password }) => {
          const res = await fetch("/api/internal/loadtest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "signIn",
              email,
              password,
              rememberMe: true,
            }),
          });
          if (!res.ok) throw new Error(`signIn failed: ${res.status}`);
        },
        {
          email: ws.profile.email,
          password: seedMod.DEFAULT_LOADTEST_PASSWORD,
        }
      );

      const navStart = Date.now();
      await page.goto("/estante-3d", { waitUntil: "domcontentloaded" });
      await expect(page.locator('[data-cabinet-cornice="true"]')).toBeVisible({
        timeout: 20_000,
      });
      const navMs = Date.now() - navStart;

      // Confirma que todos os 150 / 500 volumes foram catalogados e indexados na estante
      await expect(
        page.getByRole("button", { name: new RegExp(`Todos \\(${count}\\)`) })
      ).toBeVisible();

      // Rola suavemente pelo móvel para exercitar virtualização / content-visibility
      await page.evaluate(() => window.scrollTo(0, 600));
      await page.waitForTimeout(120);

      const scaleMetrics = await page.evaluate(() => {
        const bookcase = document.querySelector("[class*=bookcase]");
        const shelfRect = bookcase ? bookcase.getBoundingClientRect() : null;
        const slots = document.querySelectorAll(".rf-book-slot");
        let overflowCount = 0;
        slots.forEach((slot) => {
          const r = slot.getBoundingClientRect();
          if (
            shelfRect &&
            (r.right > shelfRect.right + 2 || r.left < shelfRect.left - 2)
          ) {
            overflowCount += 1;
          }
        });
        const sections = Array.from(
          document.querySelectorAll("[class*=shelfSection]")
        );
        const contentVisibilityCount = sections.filter(
          (el) => getComputedStyle(el).contentVisibility === "auto"
        ).length;
        const horizontalOverflow =
          document.documentElement.scrollWidth > window.innerWidth + 1;

        return {
          booksMounted: slots.length,
          shelvesRendered: sections.length,
          overflowCount,
          contentVisibilityCount,
          horizontalOverflow,
        };
      });

      // Mede latência interativa (clique em filtro)
      const filterBtn = page.getByRole("button", { name: /Só Físicos/i });
      const clickStart = Date.now();
      await filterBtn.click();
      await expect(filterBtn).toHaveAttribute("aria-pressed", "true");
      const filterClickMs = Date.now() - clickStart;

      console.log(
        `[STAGE5_SCALE_${count}]`,
        JSON.stringify({
          project: testInfo.project.name,
          count,
          navMs,
          filterClickMs,
          ...scaleMetrics,
        })
      );

      expect(scaleMetrics.booksMounted).toBeGreaterThan(0);
      expect(scaleMetrics.booksMounted).toBeLessThanOrEqual(count);
      expect(scaleMetrics.overflowCount).toBe(0);
      expect(scaleMetrics.horizontalOverflow).toBe(false);
      expect(scaleMetrics.contentVisibilityCount).toBeGreaterThan(0);
      expect(filterClickMs).toBeLessThan(600);
      expect(navMs).toBeLessThan(15_000);
    }

    expect(consoleErrors).toHaveLength(0);
  });
});
