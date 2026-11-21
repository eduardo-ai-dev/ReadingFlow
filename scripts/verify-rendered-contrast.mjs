#!/usr/bin/env node
/**
 * Validação de contraste REALMENTE RENDERIZADO (`getComputedStyle` no Playwright)
 * nos 4 temas curados + modo Automático (escuro) nas telas de referência:
 * - Landing (`/`) -> prévia interativa (aba ativa, selo Lendo agora, barra Meta Anual, barra do livro, card)
 * - Painel (`/painel`) -> título principal e cards
 * - Estante 3D (`/estante-3d`) -> ficha rápida e controles
 *
 * Uso:
 *   RENDERED_BASE_URL=http://localhost:3005 node scripts/verify-rendered-contrast.mjs
 */
import { chromium } from "@playwright/test";

const BASE_URL = process.env.RENDERED_BASE_URL || "http://localhost:3000";

const SCENARIOS = [
  { theme: "caderno", colorScheme: "light", label: "Caderno (claro)" },
  {
    theme: "dark-academia",
    colorScheme: "dark",
    label: "Dark Academia (escuro)",
  },
  { theme: "escandinavo", colorScheme: "light", label: "Escandinavo (claro)" },
  { theme: "gotico", colorScheme: "dark", label: "Gótico (escuro)" },
  {
    theme: "system",
    colorScheme: "dark",
    label: "Automático + sistema escuro",
  },
];

function srgbToLin(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminance({ r, g, b }) {
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
}
function parseRgba(str) {
  const m =
    /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/.exec(
      str || ""
    );
  if (!m) return null;
  return {
    r: Number(m[1]),
    g: Number(m[2]),
    b: Number(m[3]),
    a: m[4] === undefined ? 1 : Number(m[4]),
  };
}
function composite(fg, bg) {
  const a = fg.a;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  };
}
function contrast(fgStr, bgStr, fallbackBg = { r: 20, g: 21, b: 20, a: 1 }) {
  const fg = parseRgba(fgStr);
  const bg = parseRgba(bgStr);
  if (!fg || !bg) return null;
  const effBg = bg.a < 1 ? composite(bg, fallbackBg) : bg;
  const effFg = fg.a < 1 ? composite(fg, effBg) : fg;
  const l1 = luminance(effFg);
  const l2 = luminance(effBg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

async function main() {
  const browser = await chromium.launch();
  let failures = 0;

  for (const sc of SCENARIOS) {
    console.log(`\n=== Contraste renderizado: ${sc.label} ===`);
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: sc.colorScheme,
    });
    await ctx.addCookies([
      { name: "rf_theme", value: sc.theme, url: BASE_URL },
      { name: "rf_demo_session", value: "true", url: BASE_URL },
    ]);
    const page = await ctx.newPage();

    // 1. Landing preview
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    const preview = page.locator('[data-landing-preview="true"]');
    await preview.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);

    const landingPairs = await page.evaluate(() => {
      const prev = document.querySelector('[data-landing-preview="true"]');
      const tablist = prev?.querySelector('[role="tablist"]');
      const activeTab = prev?.querySelector(
        '[role="tab"][aria-selected="true"]'
      );
      const activeTabPill = activeTab?.querySelector(
        "span[aria-hidden='true']"
      );
      const readingBadge = prev?.querySelector('[data-badge="status"]');
      const goalTrack = prev?.querySelector(
        '[role="progressbar"][aria-label*="meta anual"]'
      );
      const goalFill = goalTrack?.firstElementChild;
      const bookTrack = prev?.querySelector(
        '[role="progressbar"][aria-label*="Dom Casmurro"]'
      );
      const bookFill = bookTrack?.firstElementChild;
      const titleEl = prev?.querySelector(
        "p.font-serif:not(.rf-book-cover-title)"
      );

      const cs = (el) => (el ? getComputedStyle(el) : null);
      return [
        {
          label: "Landing · Aba ativa (texto / pílula)",
          fg: cs(activeTab)?.color,
          bg:
            cs(activeTabPill)?.backgroundColor ||
            cs(activeTab)?.backgroundColor,
          min: 4.5,
        },
        {
          label: "Landing · Aba ativa (pílula / trilha)",
          fg: cs(activeTabPill)?.backgroundColor,
          bg: cs(tablist)?.backgroundColor,
          min: 3.0,
        },
        {
          label: "Landing · Selo 'Lendo agora' (texto / fundo)",
          fg: cs(readingBadge)?.color,
          bg: cs(readingBadge)?.backgroundColor,
          min: 4.5,
        },
        {
          label: "Landing · Barra Meta anual (preenchimento / trilha)",
          fg: cs(goalFill)?.backgroundColor,
          bg: cs(goalTrack)?.backgroundColor,
          min: 3.0,
        },
        {
          label: "Landing · Barra livro atual (preenchimento / trilha)",
          fg: cs(bookFill)?.backgroundColor,
          bg: cs(bookTrack)?.backgroundColor,
          min: 3.0,
        },
        {
          label: "Landing · Título livro (texto / card prévia)",
          fg: cs(titleEl)?.color,
          bg: cs(prev)?.backgroundColor,
          min: 4.5,
        },
      ];
    });

    // 2. Painel
    await page.goto(`${BASE_URL}/painel`, { waitUntil: "networkidle" });
    const painelPairs = await page.evaluate(() => {
      const sheet = document.querySelector(".rf-editorial-sheet");
      const h1 = document.querySelector("h1");
      const card = document.querySelector(".rf-card");
      const cardHeading = card?.querySelector("h2");
      const cs = (el) => (el ? getComputedStyle(el) : null);
      return [
        {
          label: "Painel · Título principal (h1 / folha)",
          fg: cs(h1)?.color,
          bg: cs(sheet)?.backgroundColor,
          min: 4.5,
        },
        {
          label: "Painel · Título de card (h2 / card)",
          fg: cs(cardHeading)?.color,
          bg: cs(card)?.backgroundColor,
          min: 4.5,
        },
      ];
    });

    // 3. Estante 3D
    await page.goto(`${BASE_URL}/estante-3d`, { waitUntil: "networkidle" });
    const estantePairs = await page.evaluate(() => {
      const sheet = document.querySelector(".rf-editorial-sheet");
      const h1 = document.querySelector("h1");
      const qp = document.querySelector('[data-book-quick-panel="true"]');
      const qpTitle = qp?.querySelector("h3");
      const cs = (el) => (el ? getComputedStyle(el) : null);
      return [
        {
          label: "Estante 3D · Título página (h1 / folha)",
          fg: cs(h1)?.color,
          bg: cs(sheet)?.backgroundColor,
          min: 4.5,
        },
        {
          label: "Estante 3D · Ficha rápida (título / painel)",
          fg: cs(qpTitle)?.color,
          bg: cs(qp)?.backgroundColor,
          min: 4.5,
        },
      ];
    });

    for (const pair of [...landingPairs, ...painelPairs, ...estantePairs]) {
      const ratio = contrast(pair.fg, pair.bg);
      if (ratio === null || ratio < pair.min) {
        console.error(
          `  [FALHA] ${pair.label}: ${ratio ? ratio.toFixed(2) : "N/A"}:1 (mín. ${pair.min}:1) [${pair.fg} / ${pair.bg}]`
        );
        failures += 1;
      } else {
        console.log(
          `  [OK] ${pair.label}: ${ratio.toFixed(2)}:1 (mín. ${pair.min}:1)`
        );
      }
    }

    await ctx.close();
  }

  await browser.close();

  if (failures > 0) {
    console.error(
      `\n[FALHA] ${failures} par(es) renderizado(s) abaixo do contraste mínimo.`
    );
    process.exit(1);
  }
  console.log(
    "\n[OK] Todos os pares renderizados passaram na validação de contraste real (Playwright)."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
