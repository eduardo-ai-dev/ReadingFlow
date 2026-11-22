#!/usr/bin/env node
/**
 * Gera em tempo de build o manifesto estático `src/server/landing/landing-layouts.generated.ts`
 * a partir de `public/landing-layouts/`, eliminando qualquer `fs.readdir` em runtime
 * (incompatível com Cloudflare Workers / workerd, onde assets ficam no binding `ASSETS`).
 */
import fs from "node:fs";
import path from "node:path";

const SUPPORTED_EXTS = new Set([
  ".avif",
  ".webp",
  ".jpg",
  ".jpeg",
  ".jfif",
  ".png",
]);

const SAFE_OBJECT_POSITION_RE =
  /^(?:left|center|right|top|bottom|\d{1,3}(?:\.\d+)?%)(?:\s+(?:left|center|right|top|bottom|\d{1,3}(?:\.\d+)?%))?$/i;

function isSupportedImage(filename) {
  if (!filename || filename.startsWith(".")) return false;
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_EXTS.has(ext);
}

function compareFilenames(a, b) {
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

function deriveLabel(filename) {
  const withoutExt = filename.replace(/\.[^.]+$/, "");
  const withoutNum = withoutExt.replace(/^\d+[\s._-]+/, "");
  const words = withoutNum.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!words) return "Biblioteca";
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function sanitizeObjPos(value, fallback = "50% 50%") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return SAFE_OBJECT_POSITION_RE.test(trimmed) ? trimmed : fallback;
}

function sanitizeHref(href) {
  if (typeof href !== "string") return undefined;
  const trimmed = href.trim();
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return trimmed;
  return undefined;
}

const repoRoot = process.cwd();
const layoutsDir = path.join(repoRoot, "public", "landing-layouts");
const mobileDir = path.join(layoutsDir, "mobile");
const manifestPath = path.join(layoutsDir, "layouts.json");
const outPath = path.join(
  repoRoot,
  "src",
  "server",
  "landing",
  "landing-layouts.generated.ts"
);

const desktopFiles = fs.existsSync(layoutsDir)
  ? fs
      .readdirSync(layoutsDir, { withFileTypes: true })
      .filter((d) => d.isFile() && isSupportedImage(d.name))
      .map((d) => d.name)
      .sort(compareFilenames)
  : [];

const mobileFiles = new Set(
  fs.existsSync(mobileDir)
    ? fs
        .readdirSync(mobileDir, { withFileTypes: true })
        .filter((d) => d.isFile() && isSupportedImage(d.name))
        .map((d) => d.name)
    : []
);

let rawManifest = {};
if (fs.existsSync(manifestPath)) {
  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    rawManifest =
      parsed && typeof parsed === "object" && parsed.layouts
        ? parsed.layouts
        : parsed && typeof parsed === "object"
          ? parsed
          : {};
  } catch {
    rawManifest = {};
  }
}

const generatedLayouts = desktopFiles.map((filename, index) => {
  const meta = rawManifest[filename] ?? {};
  const defaultLabel = deriveLabel(filename);
  const objectPosition = sanitizeObjPos(meta.objectPosition, "50% 50%");
  const mobileObjectPosition = sanitizeObjPos(
    meta.mobileObjectPosition,
    objectPosition
  );

  const baseName = filename.replace(/\.[^.]+$/, "");
  const mobileCandidate = `${baseName}.webp`;
  const mobileSrc = mobileFiles.has(mobileCandidate)
    ? `/landing-layouts/mobile/${encodeURIComponent(mobileCandidate)}`
    : mobileFiles.has(filename)
      ? `/landing-layouts/mobile/${encodeURIComponent(filename)}`
      : undefined;

  const hotspots = Array.isArray(meta.hotspots)
    ? meta.hotspots.map((hs, hsIdx) => ({
        id: hs.id ?? `${index + 1}-hs-${hsIdx + 1}`,
        label: String(hs.label ?? ""),
        ...(hs.description ? { description: String(hs.description) } : {}),
        x: Number(hs.x ?? 50),
        y: Number(hs.y ?? 50),
        ...(sanitizeHref(hs.href) ? { href: sanitizeHref(hs.href) } : {}),
      }))
    : [];

  return {
    id: `layout-${index + 1}-${filename.replace(/[^a-zA-Z0-9_-]/g, "")}`,
    filename,
    src: `/landing-layouts/${encodeURIComponent(filename)}`,
    ...(mobileSrc ? { mobileSrc } : {}),
    label: typeof meta.label === "string" ? meta.label : defaultLabel,
    alt:
      typeof meta.alt === "string"
        ? meta.alt
        : `Cenário de leitura do ReadingFlow: ${defaultLabel}`,
    objectPosition,
    mobileObjectPosition,
    hasEmbeddedBrandText: Boolean(meta.hasEmbeddedBrandText),
    hotspots,
  };
});

const fileContent = `// Arquivo gerado automaticamente por scripts/generate-landing-manifest.mjs — não editar manualmente.
import type { LandingHeroLayout } from "@/lib/landing-layouts";

export const GENERATED_LANDING_LAYOUTS: readonly LandingHeroLayout[] = ${JSON.stringify(generatedLayouts, null, 2)} as const;
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, fileContent, "utf8");

console.log(
  `[OK] Manifesto estático da landing gerado: ${generatedLayouts.length} layouts desktop (${generatedLayouts.filter((l) => Boolean(l.mobileSrc)).length} com mobileSrc) em src/server/landing/landing-layouts.generated.ts.`
);
