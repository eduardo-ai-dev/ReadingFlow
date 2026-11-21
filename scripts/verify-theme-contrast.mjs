#!/usr/bin/env node
/**
 * Guarda de build (Fases 1–3):
 * 1. Valida que `src/styles/design-tokens.css` não contém cores literais hardcoded.
 * 2. Calcula o contraste WCAG 2.1 em TODOS os arquivos `src/styles/themes/*.css`:
 *    - Texto normal: >= 4.5:1
 *    - Texto grande, ícones, bordas de campo e anel de foco: >= 3.0:1
 *    - Texto sobre destaque (primário/secundário) e todos os 4 estados (sucesso/aviso/erro/info): >= 4.5:1
 * 3. Valida presença dos tokens da estante (`--rf-frame`, `--rf-plank`, `--rf-back`, `--rf-line`)
 *    e garante que, nos temas escuros, o painel traseiro (`--rf-back`) é mais claro que o canvas.
 * 4. Valida os 6 tokens de gráfico (`--rf-chart-1..6`) e reporta separação perceptual (ΔE) sob daltonismo.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const THEMES_DIR = path.join(ROOT, "src", "styles", "themes");
const DESIGN_TOKENS_FILE = path.join(ROOT, "src", "styles", "design-tokens.css");

const REQUIRED_SHELF_TOKENS = ["--rf-frame", "--rf-plank", "--rf-back", "--rf-line"];
const REQUIRED_CHART_TOKENS = [
  "--rf-chart-1",
  "--rf-chart-2",
  "--rf-chart-3",
  "--rf-chart-4",
  "--rf-chart-5",
  "--rf-chart-6",
];

const CONTRAST_PAIRS = [
  // Texto normal (>= 4.5:1)
  { label: "Texto primário / canvas", fg: "--rf-text-primary", bg: "--rf-surface-canvas", min: 4.5 },
  { label: "Título / canvas", fg: "--rf-text-heading", bg: "--rf-surface-canvas", min: 4.5 },
  { label: "Texto secundário / canvas", fg: "--rf-text-secondary", bg: "--rf-surface-canvas", min: 4.5 },
  { label: "Texto secundário / fundo secundário", fg: "--rf-text-secondary", bg: "--rf-surface-desk", min: 4.5 },
  { label: "Texto terciário / canvas", fg: "--rf-text-tertiary", bg: "--rf-surface-canvas", min: 4.5 },
  { label: "Texto terciário / fundo secundário", fg: "--rf-text-tertiary", bg: "--rf-surface-desk", min: 4.5 },
  { label: "Texto primário / card sólido", fg: "--rf-text-primary", bg: "--rf-surface-card-solid", min: 4.5 },
  { label: "Texto secundário / card sólido", fg: "--rf-text-secondary", bg: "--rf-surface-card-solid", min: 4.5 },
  { label: "Texto terciário / card sólido", fg: "--rf-text-tertiary", bg: "--rf-surface-card-solid", min: 4.5 },
  { label: "Texto primário / superfície elevada", fg: "--rf-text-primary", bg: "--rf-surface-elevated", min: 4.5 },
  { label: "Texto secundário / superfície sutil", fg: "--rf-text-secondary", bg: "--rf-surface-subtle", min: 4.5 },
  // Texto sobre destaque (>= 4.5:1)
  { label: "Destaque primário (texto / fundo)", fg: "--rf-accent-on-primary", bg: "--rf-accent-primary", min: 4.5 },
  { label: "Destaque primário hover (texto / fundo)", fg: "--rf-accent-on-primary", bg: "--rf-accent-primary-hover", min: 4.5 },
  { label: "Destaque secundário / Chip ativo", fg: "--rf-accent-on-secondary", bg: "--rf-accent-secondary", min: 4.5 },
  { label: "Destaque secundário hover", fg: "--rf-accent-on-secondary", bg: "--rf-accent-secondary-hover", min: 4.5 },
  { label: "Destaque texto-ícone / canvas", fg: "--rf-text-accent-secondary", bg: "--rf-surface-canvas", min: 4.5 },
  { label: "Destaque texto-ícone / card sólido", fg: "--rf-text-accent-secondary", bg: "--rf-surface-card-solid", min: 4.5 },
  // Spotlight
  { label: "Spotlight (texto / fundo contraste)", fg: "--rf-text-on-contrast", bg: "--rf-surface-contrast", min: 4.5 },
  { label: "Spotlight muted / fundo contraste", fg: "--rf-text-on-contrast-muted", bg: "--rf-surface-contrast", min: 4.5 },
  // Estados semânticos (>= 4.5:1)
  { label: "Status sucesso (texto / fundo)", fg: "--rf-status-success", bg: "--rf-status-success-bg", min: 4.5 },
  { label: "Status aviso (texto / fundo)", fg: "--rf-status-warning", bg: "--rf-status-warning-bg", min: 4.5 },
  { label: "Status erro (texto / fundo)", fg: "--rf-status-error", bg: "--rf-status-error-bg", min: 4.5 },
  { label: "Status info (texto / fundo)", fg: "--rf-status-info", bg: "--rf-status-info-bg", min: 4.5 },
  // Bordas de campo, ícones e anel de foco (UI >= 3.0:1)
  { label: "Borda de campo / canvas (UI >= 3:1)", fg: "--rf-border-strong", bg: "--rf-surface-canvas", min: 3.0 },
  { label: "Borda de campo / card sólido (UI >= 3:1)", fg: "--rf-border-strong", bg: "--rf-surface-card-solid", min: 3.0 },
  { label: "Anel de foco / canvas (UI >= 3:1)", fg: "--rf-focus-ring-color", bg: "--rf-surface-canvas", min: 3.0 },
  { label: "Anel de foco / card sólido (UI >= 3:1)", fg: "--rf-focus-ring-color", bg: "--rf-surface-card-solid", min: 3.0 },
  { label: "Anel de foco / navegação (UI >= 3:1)", fg: "--rf-focus-ring-color", bg: "--rf-nav-bg", min: 3.0 },
  { label: "Ícone destaque nav / superfície nav (UI >= 3:1)", fg: "--rf-nav-accent", bg: "--rf-nav-surface", min: 3.0 },
  // Calendário (5 passos >= 4.5:1)
  { label: "Calendário nível 0", fg: "--rf-cal-0-text", bg: "--rf-cal-0-bg", min: 4.5 },
  { label: "Calendário nível 1", fg: "--rf-cal-1-text", bg: "--rf-cal-1-bg", min: 4.5 },
  { label: "Calendário nível 2", fg: "--rf-cal-2-text", bg: "--rf-cal-2-bg", min: 4.5 },
  { label: "Calendário nível 3", fg: "--rf-cal-3-text", bg: "--rf-cal-3-bg", min: 4.5 },
  { label: "Calendário nível 4", fg: "--rf-cal-4-text", bg: "--rf-cal-4-bg", min: 4.5 },
  // Navegação (>= 4.5:1)
  { label: "Navegação (texto / masthead)", fg: "--rf-nav-text", bg: "--rf-nav-bg", min: 4.5 },
  { label: "Navegação (muted / cápsula)", fg: "--rf-nav-text-muted", bg: "--rf-nav-surface", min: 4.5 },
  { label: "Navegação (placeholder / busca)", fg: "--rf-nav-text-subtle", bg: "--rf-nav-surface", min: 4.5 },
  { label: "Navegação (accent / popover)", fg: "--rf-nav-accent", bg: "--rf-nav-surface-elevated", min: 4.5 },
  { label: "Navegação (perigo sair / popover)", fg: "--rf-nav-danger", bg: "--rf-nav-surface-elevated", min: 4.5 },
  { label: "Navegação (marketing links / header)", fg: "--rf-nav-text-marketing", bg: "--rf-nav-bg-marketing", min: 4.5 },
  // Barra de rolagem (UI >= 3.0:1)
  { label: "Scrollbar (thumb / track >= 3:1)", fg: "--scrollbar-thumb", bg: "--scrollbar-track", min: 3.0 },
  { label: "Scrollbar hover (thumb-hover / track >= 3:1)", fg: "--scrollbar-thumb-hover", bg: "--scrollbar-track", min: 3.0 },
];

function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function parseCssCustomProperties(css) {
  const clean = stripCssComments(css);
  const vars = new Map();
  const re = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  let match;
  while ((match = re.exec(clean)) !== null) {
    vars.set(match[1].trim(), match[2].trim());
  }
  const schemeMatch = /color-scheme\s*:\s*(light|dark)\s*;/i.exec(clean);
  return { vars, colorScheme: schemeMatch ? schemeMatch[1].toLowerCase() : "light" };
}

function resolveVarValue(vars, token, depth = 0) {
  if (depth > 8) return null;
  const raw = vars.get(token);
  if (!raw) return null;
  const varMatch = /^var\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,\s*([^)]+))?\)$/.exec(raw);
  if (varMatch) {
    return resolveVarValue(vars, varMatch[1], depth + 1) ?? varMatch[2]?.trim() ?? null;
  }
  return raw;
}

function parseColorToRgba(raw) {
  if (!raw) return null;
  const str = raw.trim();

  const hexMatch = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(str);
  if (hexMatch) {
    let h = hexMatch[1];
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    return {
      r: Number.parseInt(h.slice(0, 2), 16),
      g: Number.parseInt(h.slice(2, 4), 16),
      b: Number.parseInt(h.slice(4, 6), 16),
      a: 1,
    };
  }

  const rgbaMatch =
    /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})(?:\s*[,/]\s*([0-9.]+))?\s*\)$/i.exec(
      str
    );
  if (rgbaMatch) {
    return {
      r: Number(rgbaMatch[1]),
      g: Number(rgbaMatch[2]),
      b: Number(rgbaMatch[3]),
      a: rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1,
    };
  }

  return null;
}

function compositeOver(fg, bg) {
  const a = fg.a;
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a)),
    a: 1,
  };
}

function relativeLuminance({ r, g, b }) {
  const toLinear = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(rgbA, rgbB) {
  const l1 = relativeLuminance(rgbA);
  const l2 = relativeLuminance(rgbB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function rgbToLab({ r, g, b }) {
  const [R, G, B] = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1.0;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

function deltaE(a, b) {
  const A = rgbToLab(a);
  const B = rgbToLab(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

const CVD_MATRICES = {
  deuteranopia: [
    [0.3673, 0.8606, -0.2279],
    [0.2801, 0.6725, 0.0474],
    [-0.0118, 0.0429, 0.9689],
  ],
  protanopia: [
    [0.1523, 1.0526, -0.2049],
    [0.1145, 0.7863, 0.0992],
    [-0.0039, -0.0481, 1.052],
  ],
  tritanopia: [
    [1.2555, -0.0767, -0.1788],
    [-0.0784, 0.9308, 0.1476],
    [0.0047, 0.6914, 0.3039],
  ],
};

function simulateCvd({ r, g, b }, matrix) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return {
    r: clamp(matrix[0][0] * r + matrix[0][1] * g + matrix[0][2] * b),
    g: clamp(matrix[1][0] * r + matrix[1][1] * g + matrix[1][2] * b),
    b: clamp(matrix[2][0] * r + matrix[2][1] * g + matrix[2][2] * b),
    a: 1,
  };
}

let hasErrors = false;

// 1. Garante que design-tokens.css não contém cores literais
if (fs.existsSync(DESIGN_TOKENS_FILE)) {
  const tokensCss = stripCssComments(fs.readFileSync(DESIGN_TOKENS_FILE, "utf8"));
  const literalColors = tokensCss.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/gi);
  if (literalColors && literalColors.length > 0) {
    console.error(
      `[ERRO] src/styles/design-tokens.css contém cores literais proibidas: ${literalColors.join(", ")}`
    );
    hasErrors = true;
  }
}

// 2. Valida contraste WCAG AA em todos os arquivos src/styles/themes/*.css
const themeFiles = fs
  .readdirSync(THEMES_DIR)
  .filter((f) => f.endsWith(".css"))
  .sort();

if (themeFiles.length < 4) {
  console.error(
    `[ERRO] Esperados ao menos 4 temas curados em src/styles/themes/, encontrados: ${themeFiles.join(", ")}`
  );
  process.exit(1);
}

for (const fileName of themeFiles) {
  const fullPath = path.join(THEMES_DIR, fileName);
  const { vars, colorScheme } = parseCssCustomProperties(
    fs.readFileSync(fullPath, "utf8")
  );
  const canvasColor = parseColorToRgba(
    resolveVarValue(vars, "--rf-surface-canvas")
  ) ?? { r: 244, g: 239, b: 230, a: 1 };

  console.log(`\n=== Verificando contraste WCAG AA (${colorScheme}): ${fileName} ===`);

  for (const pair of CONTRAST_PAIRS) {
    const fgRaw = resolveVarValue(vars, pair.fg);
    const bgRaw = resolveVarValue(vars, pair.bg);
    const fgParsed = parseColorToRgba(fgRaw);
    const bgParsed = parseColorToRgba(bgRaw);

    if (!fgParsed || !bgParsed) {
      console.error(
        `  [FALHA] ${pair.label}: token ausente ou inválido (${pair.fg}=${fgRaw}, ${pair.bg}=${bgRaw})`
      );
      hasErrors = true;
      continue;
    }

    const effectiveBg =
      bgParsed.a < 1 ? compositeOver(bgParsed, canvasColor) : bgParsed;
    const effectiveFg =
      fgParsed.a < 1 ? compositeOver(fgParsed, effectiveBg) : fgParsed;
    const ratio = contrastRatio(effectiveFg, effectiveBg);
    const passed = ratio >= pair.min;
    const mark = passed ? "OK" : "FALHA";

    console.log(
      `  [${mark}] ${pair.label}: ${ratio.toFixed(2)}:1 (mín. ${pair.min}:1) [${fgRaw} / ${bgRaw}]`
    );

    if (!passed) {
      hasErrors = true;
    }
  }

  // 3. Tokens obrigatórios da estante + painel traseiro mais claro no escuro
  for (const shelfToken of REQUIRED_SHELF_TOKENS) {
    const val = resolveVarValue(vars, shelfToken);
    if (!val) {
      console.error(`  [FALHA] Token de estante ausente: ${shelfToken}`);
      hasErrors = true;
    }
  }
  if (colorScheme === "dark") {
    const backColor = parseColorToRgba(resolveVarValue(vars, "--rf-back"));
    if (!backColor || relativeLuminance(backColor) <= relativeLuminance(canvasColor)) {
      console.error(
        `  [FALHA] Estante escura: --rf-back (${resolveVarValue(vars, "--rf-back")}) precisa ser mais claro que --rf-surface-canvas (${resolveVarValue(vars, "--rf-surface-canvas")})`
      );
      hasErrors = true;
    } else {
      console.log(
        `  [OK] Estante escura: --rf-back (${resolveVarValue(vars, "--rf-back")}) mais claro que canvas (${resolveVarValue(vars, "--rf-surface-canvas")})`
      );
    }
  }

  // 4. Paleta de gráficos (6 cores) + separação sob daltonismo (deut/prot/trit)
  const chartColors = REQUIRED_CHART_TOKENS.map((t) =>
    parseColorToRgba(resolveVarValue(vars, t))
  );
  if (chartColors.some((c) => !c)) {
    console.error("  [FALHA] Paleta de gráficos incompleta (--rf-chart-1..6).");
    hasErrors = true;
  } else {
    const cvdSummary = [];
    for (const [mode, matrix] of Object.entries(CVD_MATRICES)) {
      const simulated = chartColors.map((c) => simulateCvd(c, matrix));
      let minD = Number.POSITIVE_INFINITY;
      for (let i = 0; i < simulated.length; i++) {
        for (let j = i + 1; j < simulated.length; j++) {
          minD = Math.min(minD, deltaE(simulated[i], simulated[j]));
        }
      }
      cvdSummary.push(`${mode.slice(0, 4)} ΔE=${minD.toFixed(1)}`);
      if (minD < 8.0) {
        console.error(
          `  [FALHA] Paleta de gráficos colapsa em ${mode} (menor ΔE=${minD.toFixed(1)}, mín. 8.0)`
        );
        hasErrors = true;
      }
    }
    console.log(`  [OK] Paleta de gráficos (6 cores · CVD): ${cvdSummary.join(" · ")}`);
  }
}

if (hasErrors) {
  console.error(
    "\n[FALHA] A verificação de contraste/tokens reprovou um ou mais temas."
  );
  process.exit(1);
}

console.log(
  `\n[OK] Todos os ${themeFiles.length} temas curados passaram na verificação WCAG AA (texto >= 4.5:1, UI/foco/bordas >= 3:1, estante escura e daltonismo) sem cores literais em design-tokens.css.`
);
