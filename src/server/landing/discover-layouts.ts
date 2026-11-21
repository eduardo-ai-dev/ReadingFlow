import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import {
  LANDING_LAYOUTS_MOBILE_PUBLIC_PREFIX,
  LANDING_LAYOUTS_PUBLIC_PREFIX,
  compareLandingLayoutFilenames,
  deriveDefaultAltFromFilename,
  deriveDefaultLabelFromFilename,
  isSupportedLandingImageFilename,
  parseLandingLayoutsManifest,
  sanitizeHotspotHref,
  sanitizeObjectPosition,
  type LandingHeroLayout,
  type LandingLayoutHotspot,
  type LandingLayoutManifestEntry,
} from "@/lib/landing-layouts";

const DEFAULT_LAYOUTS_DIR = path.join(
  process.cwd(),
  "public",
  "landing-layouts"
);

async function readOptionalManifest(
  dirPath: string
): Promise<Record<string, LandingLayoutManifestEntry>> {
  const manifestPath = path.join(dirPath, "layouts.json");
  try {
    const rawText = await fs.readFile(
      /*turbopackIgnore: true*/ manifestPath,
      "utf8"
    );
    const parsed: unknown = JSON.parse(rawText);
    return parseLandingLayoutsManifest(parsed);
  } catch {
    // Manifest opcional: ausência ou erro de sintaxe nunca quebra o hero
    return {};
  }
}

/**
 * Descobre automaticamente os layouts do hero da landing lendo `public/landing-layouts/`
 * no build (Server Component com `export const dynamic = "force-static"`).
 *
 * - Aceita `.avif`, `.webp`, `.jpg`, `.jpeg`, `.png`
 * - Ordena naturalmente pelo nome do arquivo (`01-…`, `02-…`, `10-…`)
 * - Mescla metadados opcionais de `layouts.json` quando presentes
 * - Retorna `[]` silenciosamente se a pasta não existir ou estiver vazia
 */
export async function discoverLandingLayouts(
  dirPath: string = DEFAULT_LAYOUTS_DIR,
  publicPrefix: string = LANDING_LAYOUTS_PUBLIC_PREFIX
): Promise<LandingHeroLayout[]> {
  let entries: string[];
  try {
    const dirents = await fs.readdir(/*turbopackIgnore: true*/ dirPath, {
      withFileTypes: true,
    });
    entries = dirents
      .filter((d) => d.isFile() && isSupportedLandingImageFilename(d.name))
      .map((d) => d.name)
      .sort(compareLandingLayoutFilenames);
  } catch {
    return [];
  }

  if (entries.length === 0) {
    return [];
  }

  const manifest = await readOptionalManifest(dirPath);
  const mobilePrefix =
    publicPrefix === LANDING_LAYOUTS_PUBLIC_PREFIX
      ? LANDING_LAYOUTS_MOBILE_PUBLIC_PREFIX
      : `${publicPrefix}/mobile`;
  let mobileFiles = new Set<string>();
  try {
    const mobileDirents = await fs.readdir(
      /*turbopackIgnore: true*/ path.join(dirPath, "mobile"),
      { withFileTypes: true }
    );
    mobileFiles = new Set(
      mobileDirents
        .filter((d) => d.isFile() && isSupportedLandingImageFilename(d.name))
        .map((d) => d.name)
    );
  } catch {
    // Subpasta mobile/ opcional
  }

  return entries.map((filename, index) => {
    const meta = manifest[filename];
    const defaultLabel = deriveDefaultLabelFromFilename(filename);
    const objectPosition = sanitizeObjectPosition(
      meta?.objectPosition,
      "50% 50%"
    );
    const mobileObjectPosition = sanitizeObjectPosition(
      meta?.mobileObjectPosition,
      objectPosition
    );

    const baseName = filename.replace(/\.[^.]+$/, "");
    const mobileCandidate = `${baseName}.webp`;
    const mobileSrc = mobileFiles.has(mobileCandidate)
      ? `${mobilePrefix}/${encodeURIComponent(mobileCandidate)}`
      : mobileFiles.has(filename)
        ? `${mobilePrefix}/${encodeURIComponent(filename)}`
        : undefined;

    const hotspots: LandingLayoutHotspot[] = (meta?.hotspots ?? []).map(
      (hs, hsIdx) => ({
        id: hs.id ?? `${index + 1}-hs-${hsIdx + 1}`,
        label: hs.label,
        description: hs.description,
        x: hs.x,
        y: hs.y,
        href: sanitizeHotspotHref(hs.href),
      })
    );

    return {
      id: `layout-${index + 1}-${filename.replace(/[^a-zA-Z0-9_-]/g, "")}`,
      filename,
      src: `${publicPrefix}/${encodeURIComponent(filename)}`,
      ...(mobileSrc ? { mobileSrc } : {}),
      label: meta?.label ?? defaultLabel,
      alt: meta?.alt ?? deriveDefaultAltFromFilename(filename),
      objectPosition,
      mobileObjectPosition,
      hasEmbeddedBrandText: Boolean(meta?.hasEmbeddedBrandText),
      hotspots,
    };
  });
}
