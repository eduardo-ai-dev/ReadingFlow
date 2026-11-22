import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverLandingLayouts } from "@/server/landing/discover-layouts";
import {
  buildLandingLayoutsFromEntries,
  compareLandingLayoutFilenames,
  deriveDefaultLabelFromFilename,
  isSupportedLandingImageFilename,
  parseLandingLayoutsManifest,
} from "@/lib/landing-layouts";

describe("Landing hero layouts static manifest & pure builder", () => {
  it("filters supported extensions and sorts filenames naturally", () => {
    expect(isSupportedLandingImageFilename("01-hero.webp")).toBe(true);
    expect(isSupportedLandingImageFilename("02-HERO.AVIF")).toBe(true);
    expect(isSupportedLandingImageFilename("03-scene.jpg")).toBe(true);
    expect(isSupportedLandingImageFilename("04-scene.png")).toBe(true);
    expect(isSupportedLandingImageFilename("layouts.json")).toBe(false);
    expect(isSupportedLandingImageFilename("notes.txt")).toBe(false);

    const names = [
      "10-decimo.webp",
      "02-segundo.jpg",
      "01-primeiro.png",
      "03-terceiro.avif",
    ];
    expect([...names].sort(compareLandingLayoutFilenames)).toEqual([
      "01-primeiro.png",
      "02-segundo.jpg",
      "03-terceiro.avif",
      "10-decimo.webp",
    ]);

    expect(deriveDefaultLabelFromFilename("02-dark-academia.jpg")).toBe(
      "Dark academia"
    );
  });

  it("returns an empty array when no supported filenames are provided", () => {
    expect(buildLandingLayoutsFromEntries({ filenames: [] })).toEqual([]);
    expect(
      buildLandingLayoutsFromEntries({
        filenames: ["README.md", "layouts.json"],
      })
    ).toEqual([]);
  });

  it("works with a single image and no manifest using defaults", () => {
    const layouts = buildLandingLayoutsFromEntries({
      filenames: ["01-sala-leitura.webp"],
    });
    expect(layouts).toHaveLength(1);
    expect(layouts[0]).toMatchObject({
      filename: "01-sala-leitura.webp",
      src: "/landing-layouts/01-sala-leitura.webp",
      label: "Sala leitura",
      objectPosition: "50% 50%",
      hasEmbeddedBrandText: false,
      hotspots: [],
    });
    expect(layouts[0]?.alt).toContain("Sala leitura");
  });

  it("merges optional layouts.json manifest, pairs mobile crops and strips unsafe hotspot hrefs", () => {
    const manifest = parseLandingLayoutsManifest({
      layouts: {
        "01-classica.webp": {
          label: "Biblioteca Clássica",
          alt: "Biblioteca clássica com lua na janela",
          objectPosition: "40% 55%",
          mobileObjectPosition: "30% 50%",
          hotspots: [
            {
              id: "nicho-1",
              label: "Estante principal",
              description: "Organize seus livros",
              x: 38,
              y: 45,
              href: "#funcionalidades",
            },
            {
              id: "xss-test",
              label: "Link inseguro",
              x: 50,
              y: 50,
              href: "javascript:alert(1)",
            },
          ],
        },
      },
    });

    const layouts = buildLandingLayoutsFromEntries({
      filenames: ["02-novo-layout.png", "01-classica.webp", "README.md"],
      mobileFilenames: ["01-classica.webp"],
      manifest,
    });

    expect(layouts).toHaveLength(2);
    expect(layouts[0]).toMatchObject({
      filename: "01-classica.webp",
      src: "/landing-layouts/01-classica.webp",
      mobileSrc: "/landing-layouts/mobile/01-classica.webp",
      label: "Biblioteca Clássica",
      alt: "Biblioteca clássica com lua na janela",
      objectPosition: "40% 55%",
      mobileObjectPosition: "30% 50%",
    });
    expect(layouts[0]?.hotspots).toHaveLength(2);
    expect(layouts[0]?.hotspots[0]?.href).toBe("#funcionalidades");
    expect(layouts[0]?.hotspots[1]?.href).toBeUndefined();
  });

  it("discoverLandingLayouts() retorna o manifesto estático sem fs.readdir e todos os arquivos existem em public/ com case exato", async () => {
    const layouts = await discoverLandingLayouts();
    expect(layouts.length).toBeGreaterThanOrEqual(8);

    const publicDir = path.resolve(process.cwd(), "public");
    const desktopOnDisk = new Set(
      fs.readdirSync(path.join(publicDir, "landing-layouts"))
    );
    const mobileOnDisk = new Set(
      fs.readdirSync(path.join(publicDir, "landing-layouts", "mobile"))
    );

    for (const layout of layouts) {
      const decodedDesktop = decodeURIComponent(
        layout.src.replace(/^\/landing-layouts\//, "")
      );
      expect(desktopOnDisk.has(decodedDesktop)).toBe(true);

      if (layout.mobileSrc) {
        const decodedMobile = decodeURIComponent(
          layout.mobileSrc.replace(/^\/landing-layouts\/mobile\//, "")
        );
        expect(mobileOnDisk.has(decodedMobile)).toBe(true);
      }
    }

    // Fallback estático do HeroRotator também deve existir em public/
    expect(fs.existsSync(path.join(publicDir, "hero-library-4k.webp"))).toBe(
      true
    );
  });
});
