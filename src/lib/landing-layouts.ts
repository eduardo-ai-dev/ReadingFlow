import { z } from "zod";

export const LANDING_LAYOUTS_PUBLIC_PREFIX = "/landing-layouts";
export const LANDING_LAYOUTS_MOBILE_PUBLIC_PREFIX = "/landing-layouts/mobile";

export const SUPPORTED_LANDING_IMAGE_EXTENSIONS = new Set([
  ".avif",
  ".webp",
  ".jpg",
  ".jpeg",
  ".jfif",
  ".png",
]);

export interface LandingLayoutHotspot {
  id: string;
  label: string;
  description?: string;
  /** Coordenada horizontal em porcentagem (0..100). */
  x: number;
  /** Coordenada vertical em porcentagem (0..100). */
  y: number;
  href?: string;
}

export interface LandingHeroLayout {
  id: string;
  filename: string;
  src: string;
  /** Recorte retrato próprio para mobile (ex.: 1080×1920 em public/landing-layouts/mobile/). */
  mobileSrc?: string;
  label: string;
  alt: string;
  objectPosition: string;
  mobileObjectPosition: string;
  hasEmbeddedBrandText: boolean;
  hotspots: LandingLayoutHotspot[];
}

const SAFE_OBJECT_POSITION_RE =
  /^(?:left|center|right|top|bottom|\d{1,3}(?:\.\d+)?%)(?:\s+(?:left|center|right|top|bottom|\d{1,3}(?:\.\d+)?%))?$/i;

export function sanitizeObjectPosition(
  value?: string,
  fallback = "50% 50%"
): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  return SAFE_OBJECT_POSITION_RE.test(trimmed) ? trimmed : fallback;
}

export function sanitizeHotspotHref(href?: string): string | undefined {
  if (!href) return undefined;
  const trimmed = href.trim();
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) {
    return trimmed;
  }
  return undefined;
}

export function isSupportedLandingImageFilename(filename: string): boolean {
  if (!filename || filename.startsWith(".")) return false;
  const dotIdx = filename.lastIndexOf(".");
  if (dotIdx <= 0) return false;
  const ext = filename.slice(dotIdx).toLowerCase();
  return SUPPORTED_LANDING_IMAGE_EXTENSIONS.has(ext);
}

export function compareLandingLayoutFilenames(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

export function deriveDefaultLabelFromFilename(filename: string): string {
  const withoutExt = filename.replace(/\.[^.]+$/, "");
  const withoutNumericPrefix = withoutExt.replace(/^\d+[\s._-]+/, "");
  const words = withoutNumericPrefix
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!words) return "Biblioteca";
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function deriveDefaultAltFromFilename(filename: string): string {
  const label = deriveDefaultLabelFromFilename(filename);
  return `Cenário de leitura do ReadingFlow: ${label}`;
}

const hotspotSchema = z.object({
  id: z.string().min(1).max(60).optional(),
  label: z.string().min(1).max(80),
  description: z.string().max(180).optional(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  href: z.string().max(200).optional(),
});

const manifestEntrySchema = z.object({
  label: z.string().min(1).max(80).optional(),
  alt: z.string().min(1).max(280).optional(),
  objectPosition: z.string().max(40).optional(),
  mobileObjectPosition: z.string().max(40).optional(),
  hasEmbeddedBrandText: z.boolean().optional(),
  hotspots: z.array(hotspotSchema).max(8).optional(),
});

export type LandingLayoutManifestEntry = z.infer<typeof manifestEntrySchema>;

const wrappedManifestSchema = z.object({
  layouts: z.record(z.string(), manifestEntrySchema),
});

const flatManifestSchema = z.record(z.string(), manifestEntrySchema);

export function parseLandingLayoutsManifest(
  rawJson: unknown
): Record<string, LandingLayoutManifestEntry> {
  const wrapped = wrappedManifestSchema.safeParse(rawJson);
  if (wrapped.success) {
    return wrapped.data.layouts;
  }
  const flat = flatManifestSchema.safeParse(rawJson);
  if (flat.success) {
    return flat.data;
  }
  return {};
}
