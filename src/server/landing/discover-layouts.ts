import "server-only";
import type { LandingHeroLayout } from "@/lib/landing-layouts";
import { GENERATED_LANDING_LAYOUTS } from "./landing-layouts.generated";

/**
 * Retorna os layouts da landing a partir do manifesto estático gerado em build
 * (`scripts/generate-landing-manifest.mjs`), sem qualquer leitura de filesystem
 * (`fs.readdir` / `fs.readFile`) em runtime.
 *
 * 100% compatível com Cloudflare Workers (`workerd`), onde `public/` é servido
 * exclusivamente via binding `ASSETS` (`.open-next/assets`).
 */
export async function discoverLandingLayouts(): Promise<LandingHeroLayout[]> {
  return GENERATED_LANDING_LAYOUTS.map((layout) => ({
    ...layout,
    hotspots: layout.hotspots.map((hs) => ({ ...hs })),
  }));
}
