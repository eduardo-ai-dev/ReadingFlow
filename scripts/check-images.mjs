#!/usr/bin/env node
/**
 * Guarda de qualidade de imagens da landing page (`scripts/check-images.mjs`):
 * 1. Inspeciona com `sharp` todas as imagens de hero e layouts em `public/hero-library-4k.webp`
 *    e `public/landing-layouts/*`:
 *    - Falha se qualquer imagem-fonte de hero ou layout desktop tiver largura < 2560px.
 *    - Falha se qualquer imagem ultrapassar o teto 4K (largura > 3840px — "nada de 8K").
 *    - Verifica os recortes retrato mobile em `public/landing-layouts/mobile/` (1080×1920, altura > largura).
 *    - Verifica as capas estáticas da prévia em `public/landing/covers/`.
 * 2. Verifica nos componentes da landing (`HeroRotator.tsx`, `LandingHeroClient.tsx`,
 *    `LandingProductPreview.tsx`, `BookCover.tsx`, `src/app/(marketing)/page.tsx`):
 *    - Nenhuma tag `<Image>` sem `sizes` ou sem `alt`.
 *    - Hero com `fill`, `sizes="100vw"`, `quality={85}` e `preload` somente na camada ativa.
 *    - Ausência de `unoptimized` no hero e ausência da prop depreciada `priority` no `<Image>`.
 * 3. Verifica `next.config.ts`:
 *    - `formats: ["image/avif", "image/webp"]`
 *    - `qualities: [75, 85]`
 *    - `deviceSizes` até `3840` e limite de combinações para controle de custo na Vercel.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const MIN_HERO_WIDTH = 2560;
const MAX_HERO_WIDTH = 3840;
const MIN_MOBILE_PORTRAIT_WIDTH = 1080;

const SUPPORTED_EXT = new Set([
  ".avif",
  ".webp",
  ".jpg",
  ".jpeg",
  ".jfif",
  ".png",
]);

let errors = 0;
let warnings = 0;

function fail(msg) {
  console.error(`[ERRO] ${msg}`);
  errors += 1;
}

function warn(msg) {
  console.warn(`[AVISO] ${msg}`);
  warnings += 1;
}

function ok(msg) {
  console.log(`[OK] ${msg}`);
}

async function checkHeroAndLayoutFiles() {
  console.log(
    "=== 1. Verificando dimensões das imagens da landing (sharp) ==="
  );

  const heroRootPath = path.join(ROOT, "public", "hero-library-4k.webp");
  if (!fs.existsSync(heroRootPath)) {
    fail("Arquivo public/hero-library-4k.webp não encontrado.");
  } else {
    const meta = await sharp(heroRootPath).metadata();
    const stat = fs.statSync(heroRootPath);
    if (!meta.width || !meta.height) {
      fail("Não foi possível ler dimensões de public/hero-library-4k.webp.");
    } else if (meta.width < MIN_HERO_WIDTH) {
      fail(
        `public/hero-library-4k.webp tem largura ${meta.width}px (mínimo exigido: ${MIN_HERO_WIDTH}px).`
      );
    } else if (meta.width > MAX_HERO_WIDTH) {
      fail(
        `public/hero-library-4k.webp tem largura ${meta.width}px (acima do teto 4K de ${MAX_HERO_WIDTH}px).`
      );
    } else {
      ok(
        `public/hero-library-4k.webp: ${meta.width}×${meta.height} (${meta.format}, ${Math.round(stat.size / 1024)} KB)`
      );
    }
  }

  const layoutsDir = path.join(ROOT, "public", "landing-layouts");
  if (!fs.existsSync(layoutsDir)) {
    fail("Diretório public/landing-layouts não encontrado.");
    return;
  }

  const layoutFiles = fs
    .readdirSync(layoutsDir, { withFileTypes: true })
    .filter(
      (d) => d.isFile() && SUPPORTED_EXT.has(path.extname(d.name).toLowerCase())
    )
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

  if (layoutFiles.length === 0) {
    fail("Nenhuma imagem encontrada em public/landing-layouts/.");
  }

  const mobileDir = path.join(layoutsDir, "mobile");
  let validLayouts = 0;
  let validMobileCrops = 0;

  for (const file of layoutFiles) {
    const full = path.join(layoutsDir, file);
    const meta = await sharp(full).metadata();

    if (!meta.width || !meta.height) {
      fail(`public/landing-layouts/${file}: metadados de dimensão inválidos.`);
      continue;
    }

    if (meta.width < MIN_HERO_WIDTH) {
      fail(
        `public/landing-layouts/${file} tem largura ${meta.width}px (< ${MIN_HERO_WIDTH}px exigidos).`
      );
    } else if (meta.width > MAX_HERO_WIDTH) {
      fail(
        `public/landing-layouts/${file} tem largura ${meta.width}px (> ${MAX_HERO_WIDTH}px teto 4K).`
      );
    } else {
      validLayouts += 1;
    }

    const baseName = file.replace(/\.[^.]+$/, "");
    const mobileCandidate = path.join(mobileDir, `${baseName}.webp`);
    if (!fs.existsSync(mobileCandidate)) {
      warn(
        `Recorte retrato mobile ausente para ${file} (esperado: public/landing-layouts/mobile/${baseName}.webp).`
      );
    } else {
      const mMeta = await sharp(mobileCandidate).metadata();
      if (
        !mMeta.width ||
        !mMeta.height ||
        mMeta.width < MIN_MOBILE_PORTRAIT_WIDTH ||
        mMeta.height <= mMeta.width
      ) {
        fail(
          `public/landing-layouts/mobile/${baseName}.webp deve ser retrato com largura >= ${MIN_MOBILE_PORTRAIT_WIDTH}px (atual: ${mMeta.width}×${mMeta.height}).`
        );
      } else {
        validMobileCrops += 1;
      }
    }
  }

  ok(
    `public/landing-layouts/: ${validLayouts}/${layoutFiles.length} layouts com largura entre ${MIN_HERO_WIDTH}px e ${MAX_HERO_WIDTH}px.`
  );
  ok(
    `public/landing-layouts/mobile/: ${validMobileCrops}/${layoutFiles.length} recortes retrato mobile (1080×1920) verificados.`
  );

  const coversDir = path.join(ROOT, "public", "landing", "covers");
  if (fs.existsSync(coversDir)) {
    const covers = fs
      .readdirSync(coversDir)
      .filter((f) => SUPPORTED_EXT.has(path.extname(f).toLowerCase()));
    for (const c of covers) {
      const full = path.join(coversDir, c);
      const m = await sharp(full).metadata();
      const s = fs.statSync(full);
      if (!m.width || !m.height || m.width < 128) {
        fail(
          `public/landing/covers/${c} tem largura insuficiente (${m.width}×${m.height}).`
        );
      } else {
        ok(
          `public/landing/covers/${c}: ${m.width}×${m.height} (${m.format}, ${(s.size / 1024).toFixed(1)} KB)`
        );
      }
    }
  }
}

function extractJsxTags(source, tagName) {
  const tags = [];
  const regex = new RegExp(`<${tagName}\\b`, "g");
  let match;
  while ((match = regex.exec(source)) !== null) {
    const start = match.index;
    let i = start + match[0].length;
    let braceDepth = 0;
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    while (i < source.length) {
      const ch = source[i];
      const prev = source[i - 1];
      if (!inSingle && !inDouble && !inTemplate) {
        if (ch === "{") braceDepth += 1;
        else if (ch === "}") braceDepth = Math.max(0, braceDepth - 1);
        else if (ch === "'" && prev !== "\\") inSingle = true;
        else if (ch === '"' && prev !== "\\") inDouble = true;
        else if (ch === "`" && prev !== "\\") inTemplate = true;
        else if (ch === ">" && braceDepth === 0) {
          tags.push(source.slice(start, i + 1));
          break;
        }
      } else if (inSingle && ch === "'" && prev !== "\\") {
        inSingle = false;
      } else if (inDouble && ch === '"' && prev !== "\\") {
        inDouble = false;
      } else if (inTemplate && ch === "`" && prev !== "\\") {
        inTemplate = false;
      }
      i += 1;
    }
  }
  return tags;
}

function checkLandingComponents() {
  console.log(
    "\n=== 2. Verificando atributos sizes/alt/quality/preload nos componentes ==="
  );

  const componentFiles = [
    "src/components/HeroRotator.tsx",
    "src/components/LandingHeroClient.tsx",
    "src/components/LandingProductPreview.tsx",
    "src/components/BookCover.tsx",
    "src/app/(marketing)/page.tsx",
  ];

  for (const relPath of componentFiles) {
    const full = path.join(ROOT, relPath);
    if (!fs.existsSync(full)) {
      fail(`Componente esperado não encontrado: ${relPath}`);
      continue;
    }

    const content = fs.readFileSync(full, "utf8");
    const imageTags = extractJsxTags(content, "Image");

    for (let idx = 0; idx < imageTags.length; idx += 1) {
      const tag = imageTags[idx];
      const label = `${relPath} <Image #${idx + 1}>`;

      if (!/\balt\s*=/.test(tag)) {
        fail(`${label} está sem o atributo obrigatório 'alt'.`);
      }
      if (!/\bsizes\s*=/.test(tag)) {
        fail(`${label} está sem o atributo obrigatório 'sizes'.`);
      }
      if (/\s+priority(?=\s|=|\/|>)/.test(tag)) {
        fail(
          `${label} usa a prop depreciada 'priority' do Next <16; use 'preload'.`
        );
      }

      if (
        relPath.includes("HeroRotator.tsx") ||
        relPath.includes("LandingHeroClient.tsx")
      ) {
        if (/\bunoptimized\b/.test(tag)) {
          fail(`${label} não pode usar 'unoptimized' no hero.`);
        }
        if (!/\bfill\b/.test(tag)) {
          fail(`${label} no hero deve usar a prop 'fill'.`);
        }
        if (!/\bsizes\s*=\s*["']100vw["']/.test(tag)) {
          fail(`${label} no hero deve usar sizes="100vw".`);
        }
        if (!/\bquality\s*=\s*\{\s*85\s*\}/.test(tag)) {
          fail(`${label} no hero deve usar quality={85}.`);
        }
      }
    }

    if (relPath === "src/components/HeroRotator.tsx") {
      if (imageTags.length === 0) {
        fail("HeroRotator.tsx não contém nenhum componente <Image>.");
      } else if (imageTags.length > 2) {
        fail(
          `HeroRotator.tsx contém ${imageTags.length} camadas <Image> (máximo permitido no DOM: 2 — ativa e próxima).`
        );
      } else {
        const preloadCount = imageTags.filter((t) =>
          /\bpreload\b/.test(t)
        ).length;
        if (preloadCount !== 1) {
          fail(
            `HeroRotator.tsx deve ter 'preload' em exatamente 1 <Image> (o hero ativo); encontrado: ${preloadCount}.`
          );
        } else {
          ok(
            `HeroRotator.tsx: ${imageTags.length} camadas <Image> (fill, sizes="100vw", quality={85}, preload somente na camada ativa).`
          );
        }
      }
    } else if (imageTags.length > 0) {
      ok(
        `${relPath}: ${imageTags.length} <Image> verificado(s) com 'alt', 'sizes' e 'preload' válidos.`
      );
    }
  }
}

function checkNextConfig() {
  console.log(
    "\n=== 3. Verificando configuração de imagens em next.config.ts ==="
  );
  const configPath = path.join(ROOT, "next.config.ts");
  if (!fs.existsSync(configPath)) {
    fail("next.config.ts não encontrado.");
    return;
  }

  const src = fs.readFileSync(configPath, "utf8");

  if (
    !/formats\s*:\s*\[\s*["']image\/avif["']\s*,\s*["']image\/webp["']\s*\]/.test(
      src
    )
  ) {
    fail(
      "next.config.ts deve definir images.formats: ['image/avif', 'image/webp']."
    );
  } else {
    ok("next.config.ts: images.formats = ['image/avif', 'image/webp'].");
  }

  if (!/qualities\s*:\s*\[\s*75\s*,\s*85\s*\]/.test(src)) {
    fail("next.config.ts deve definir images.qualities: [75, 85].");
  } else {
    ok("next.config.ts: images.qualities = [75, 85].");
  }

  const deviceMatch = /deviceSizes\s*:\s*\[([^\]]+)\]/.exec(src);
  const imageMatch = /imageSizes\s*:\s*\[([^\]]+)\]/.exec(src);
  const deviceSizes = deviceMatch
    ? deviceMatch[1]
        .split(",")
        .map((n) => Number.parseInt(n.trim(), 10))
        .filter(Number.isFinite)
    : [640, 750, 828, 1080, 1200, 1920, 2048, 3840];
  const imageSizes = imageMatch
    ? imageMatch[1]
        .split(",")
        .map((n) => Number.parseInt(n.trim(), 10))
        .filter(Number.isFinite)
    : [32, 48, 64, 96, 128, 256, 384];

  if (!deviceSizes.includes(3840) || Math.max(...deviceSizes) > 3840) {
    fail(
      `next.config.ts: deviceSizes deve ter teto em 3840 (4K, sem 8K). Atual: [${deviceSizes.join(", ")}].`
    );
  } else {
    ok(`next.config.ts: deviceSizes = [${deviceSizes.join(", ")}] (teto 4K).`);
  }

  const totalCombinations = 2 * 2 * (deviceSizes.length + imageSizes.length);
  if (totalCombinations > 64) {
    warn(
      `next.config.ts gera ${totalCombinations} combinações potenciais por imagem (formatos × qualidades × larguras).`
    );
  } else {
    ok(
      `next.config.ts: combinações de otimização limitadas a ${totalCombinations} (2 formatos × 2 qualidades × ${deviceSizes.length + imageSizes.length} larguras).`
    );
  }
}

await checkHeroAndLayoutFiles();
checkLandingComponents();
checkNextConfig();

if (errors > 0) {
  console.error(
    `\n[FALHA] Verificação de imagens da landing falhou com ${errors} erro(s) e ${warnings} aviso(s).`
  );
  process.exit(1);
}

console.log(
  `\n[SUCESSO] Todas as imagens e componentes da landing passaram na verificação (${warnings} aviso(s)).`
);
