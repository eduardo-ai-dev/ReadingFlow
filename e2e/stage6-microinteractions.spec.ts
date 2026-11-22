import { expect, test } from "@playwright/test";

test.describe("Etapa 6 — Microinterações, feedback, Desfazer 5s e INP", () => {
  test("registra progresso com toast + Desfazer 5s, validação inline, concluir livro com cartão sóbrio + fita bordô e INP < 200ms", async ({
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

    await page.goto("/painel", { waitUntil: "networkidle" });
    consoleErrors.length = 0;
    pageErrors.length = 0;

    // 1. Validação em linha: páginas acima do total (560)
    const progressInput = page.getByRole("spinbutton", { name: "Progresso" });
    await progressInput.fill("999");
    await expect(progressInput).toHaveAttribute("aria-invalid", "true");
    await expect(
      page.getByText(/O número de páginas não pode exceder o total do livro/i)
    ).toBeVisible();

    // Restaura valor para 248
    await progressInput.fill("248");
    await expect(progressInput).toHaveAttribute("aria-invalid", "false");

    // 2. Atalho +10 pág.: mede tempo de resposta de interação (INP < 200ms) e valida toast + Desfazer
    const plus10Btn = page.getByRole("button", { name: /Avançar 10 páginas/i });
    const interactionStart = await page.evaluate(() => performance.now());
    await plus10Btn.click();
    // Atualização otimista imediata antes mesmo do server roundtrip completar
    await expect(page.getByText(/Página 258 de 560/i)).toBeVisible({
      timeout: 5_000,
    });
    const optimisticMs = await page.evaluate(
      (start) => performance.now() - start,
      interactionStart
    );
    expect(optimisticMs).toBeLessThan(200);

    const toast = page.getByTestId("feedback-toast");
    await expect(toast).toBeVisible({ timeout: 10_000 });
    await expect(toast).toHaveAttribute("aria-live", "polite");
    await expect(toast).toContainText("+10 páginas registradas: 258 de 560");

    // 3. Clicar em Desfazer dentro dos 5s -> restaura para 248
    await toast.getByRole("button", { name: /Desfazer/i }).click();
    await expect(page.getByText(/Página 248 de 560/i)).toBeVisible({
      timeout: 10_000,
    });

    // 4. Concluir livro -> cartão sóbrio com estatísticas (Dias, Pág./dia, Nota) e fita bordô
    await page.getByRole("button", { name: /Concluir livro/i }).click();
    const completedCard = page.getByTestId("book-completed-card");
    await expect(completedCard).toBeVisible({ timeout: 10_000 });
    await expect(completedCard).toContainText("Leitura concluída");
    await expect(completedCard).toContainText("Dias");
    await expect(completedCard).toContainText("Pág./dia");
    await expect(completedCard).toContainText("Nota");
    await expect(page.getByTestId("book-completed-ribbon")).toBeVisible();

    // Fecha cartão com Escape (foco gerenciado)
    await page.keyboard.press("Escape");
    await expect(completedCard).toBeHidden();

    // Desfaz a conclusão para manter o estado da conta demo limpo para os demais testes
    const finishToast = page.getByTestId("feedback-toast");
    if (await finishToast.isVisible()) {
      const undoBtn = finishToast.getByRole("button", { name: /Desfazer/i });
      if ((await undoBtn.count()) > 0) {
        await undoBtn.click();
        await expect(page.getByText(/Página 248 de 560/i)).toBeVisible({
          timeout: 10_000,
        });
      }
    }

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("respeita prefers-reduced-motion: reduce mantendo feedback textual e opção de haptics em /configuracoes", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });

    await page.goto("/entrar");
    await page
      .getByRole("button", { name: /Explorar Biblioteca Demonstrativa/i })
      .click();
    await page.waitForURL((u) => !u.pathname.includes("/entrar"), {
      timeout: 30_000,
    });

    await page.goto("/painel", { waitUntil: "networkidle" });
    // Verifica que os tokens de movimento estão declarados no :root
    const motionTokens = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        fast: style.getPropertyValue("--motion-fast").trim(),
        base: style.getPropertyValue("--motion-base").trim(),
        slow: style.getPropertyValue("--motion-slow").trim(),
        ease: style.getPropertyValue("--motion-ease").trim(),
      };
    });
    expect(motionTokens.fast).toMatch(/^(120ms|0?\.12s)$/);
    expect(motionTokens.base).toMatch(/^(200ms|0?\.2s)$/);
    expect(motionTokens.slow).toMatch(/^(320ms|0?\.32s)$/);
    expect(motionTokens.ease).toContain("cubic-bezier");

    // Verifica que em /configuracoes existe o controle desligável de feedback tátil no celular
    await page.goto("/configuracoes", { waitUntil: "networkidle" });
    const hapticsCheckbox = page.getByRole("checkbox", {
      name: /Feedback tátil leve no celular/i,
    });
    await expect(hapticsCheckbox).toBeVisible();
    const wasChecked = await hapticsCheckbox.isChecked();
    await hapticsCheckbox.setChecked(!wasChecked);
    await expect(page.getByTestId("feedback-toast")).toContainText(
      wasChecked ? /Feedback tátil desativado/i : /Feedback tátil ativado/i
    );
    // Restaura estado original para manter idempotência
    await hapticsCheckbox.setChecked(wasChecked);
  });
});
