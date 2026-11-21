import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverLandingLayouts } from "@/server/landing/discover-layouts";
import {
  compareLandingLayoutFilenames,
  deriveDefaultLabelFromFilename,
  isSupportedLandingImageFilename,
} from "@/lib/landing-layouts";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "rf-landing-layouts-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))
  );
});

describe("Landing hero layouts automatic discovery", () => {
  it("filters supported extensions and sorts filenames naturally", () => {
    expect(isSupportedLandingImageFilename("01-hero.webp")).toBe(true);
    expect(isSupportedLandingImageFilename("02-HERO.AVIF")).toBe(true);
    expect(isSupportedLandingImageFilename("03-scene.jpg")).toBe(true);
    expect(isSupportedLandingImageFilename("04-scene.png")).toBe(true);
    expect(isSupportedLandingImageFilename("layouts.json")).toBe(false);
    expect(isSupportedLandingImageFilename("notes.txt")).toBe(false);

    const names = ["10-decimo.webp", "02-segundo.jpg", "01-primeiro.png", "03-terceiro.avif"];
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

  it("returns an empty array without throwing when folder does not exist or is empty", async () => {
    const missing = path.join(os.tmpdir(), `nonexistent-${Date.now()}`);
    expect(await discoverLandingLayouts(missing)).toEqual([]);

    const emptyDir = await makeTempDir();
    expect(await discoverLandingLayouts(emptyDir)).toEqual([]);
  });

  it("works with a single image and no layouts.json manifest using defaults", async () => {
    const dir = await makeTempDir();
    await fs.writeFile(path.join(dir, "01-sala-leitura.webp"), "fake");

    const layouts = await discoverLandingLayouts(dir);
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

  it("merges optional layouts.json manifest and still auto-discovers newly dropped files", async () => {
    const dir = await makeTempDir();
    await fs.writeFile(path.join(dir, "01-classica.webp"), "a");
    await fs.writeFile(path.join(dir, "02-novo-layout.png"), "b");
    await fs.writeFile(path.join(dir, "README.md"), "ignored");
    await fs.writeFile(
      path.join(dir, "layouts.json"),
      JSON.stringify({
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
      })
    );

    const layouts = await discoverLandingLayouts(dir);
    expect(layouts).toHaveLength(2);
    expect(layouts[0]).toMatchObject({
      filename: "01-classica.webp",
      label: "Biblioteca Clássica",
      alt: "Biblioteca clássica com lua na janela",
      objectPosition: "40% 55%",
      mobileObjectPosition: "30% 50%",
    });
    expect(layouts[0]?.hotspots).toHaveLength(2);
    expect(layouts[0]?.hotspots[0]?.href).toBe("#funcionalidades");
    expect(layouts[0]?.hotspots[1]?.href).toBeUndefined();

    // Newly dropped file not present in layouts.json still loads with defaults
    expect(layouts[1]).toMatchObject({
      filename: "02-novo-layout.png",
      src: "/landing-layouts/02-novo-layout.png",
      objectPosition: "50% 50%",
      hotspots: [],
    });
  });

  it("falls back gracefully when layouts.json is malformed JSON", async () => {
    const dir = await makeTempDir();
    await fs.writeFile(path.join(dir, "01-fallback.jpg"), "a");
    await fs.writeFile(path.join(dir, "layouts.json"), "{ invalid json");

    const layouts = await discoverLandingLayouts(dir);
    expect(layouts).toHaveLength(1);
    expect(layouts[0]?.filename).toBe("01-fallback.jpg");
    expect(layouts[0]?.objectPosition).toBe("50% 50%");
  });

  it("discovers the repository public/landing-layouts assets in order", async () => {
    const layouts = await discoverLandingLayouts();
    expect(layouts.length).toBeGreaterThanOrEqual(8);
    expect(layouts[0]?.filename).toBe("01-biblioteca-classica.webp");
    expect(layouts.every((l) => !l.hasEmbeddedBrandText)).toBe(true);
  });
});
