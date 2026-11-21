import { describe, expect, it } from "vitest";
import {
  clampPaperHsl,
  deriveSpineAccentHex,
  pickDominantSpineColor,
  pickDominantSpinePalette,
  rgbToHsl,
} from "@/features/catalog/spine-color-rules";
import {
  computeShelfBookGeometry,
  pickPublisherMark,
  pickSpineTemplate,
  PUBLISHER_MARKS,
  type SpineTemplateId,
} from "@/features/shelves/virtual-bookshelf";

function solid(r: number, g: number, b: number, count: number): number[] {
  return Array.from({ length: count }, () => [r, g, b]).flat();
}

describe("pickDominantSpineColor — cor predominante da capa (server-side)", () => {
  it("escolhe a cor da capa e ignora a moldura quase branca", () => {
    const pixels = [...solid(250, 250, 248, 60), ...solid(40, 70, 120, 40)];
    expect(pickDominantSpineColor(pixels, 3)).toBe("#284678");
  });

  it("mantém uma capa preta como preta, mesmo com um detalhe colorido pequeno", () => {
    const pixels = [...solid(18, 18, 18, 90), ...solid(220, 40, 40, 6)];
    const result = pickDominantSpineColor(pixels, 3);
    expect(result).toBe("#121212");
  });

  it("ignora pixels transparentes e devolve null quando nada é aproveitável", () => {
    const transparent = [10, 10, 10, 0, 200, 30, 30, 0];
    expect(pickDominantSpineColor(transparent, 4)).toBeNull();
    expect(pickDominantSpineColor(solid(255, 255, 255, 20), 3)).toBeNull();
  });

  it("extrai cor principal e segunda cor dominante (accent) e limita HSL ao acabamento de papel (S <= 70%, L 18%–82%)", () => {
    const pixels = [...solid(28, 45, 88, 70), ...solid(215, 165, 45, 30)];
    const pal = pickDominantSpinePalette(pixels, 3);
    expect(pal).not.toBeNull();
    expect(pal!.primary).not.toBe(pal!.accent);

    for (const neon of ["#FF0000", "#00FF22", "#000000", "#FFFFFF", "#FFEE00"]) {
      const paper = clampPaperHsl(neon);
      const r = Number.parseInt(paper.slice(1, 3), 16);
      const g = Number.parseInt(paper.slice(3, 5), 16);
      const b = Number.parseInt(paper.slice(5, 7), 16);
      const { s, l } = rgbToHsl(r, g, b);
      expect(s).toBeLessThanOrEqual(71);
      expect(l).toBeGreaterThanOrEqual(17);
      expect(l).toBeLessThanOrEqual(83);
    }

    const derived = deriveSpineAccentHex("#284678", "seed-x");
    expect(derived).toMatch(/^#[0-9a-f]{6}$/);
    expect(derived).not.toBe("#284678");
  });
});

describe("computeShelfBookGeometry & templates gráficos — determinismo e limites", () => {
  it("é determinística: mesma entrada gera sempre a mesma altura (sem Math.random)", () => {
    const a = computeShelfBookGeometry({ pages: 320, format: "paperback", seed: "livro-1" });
    const b = computeShelfBookGeometry({ pages: 320, format: "paperback", seed: "livro-1" });
    expect(a).toEqual(b);
  });

  it("mantém altura em 150–215px e espessura em 12–56px para qualquer seed", () => {
    for (let i = 0; i < 200; i += 1) {
      const g = computeShelfBookGeometry({
        pages: (i * 37) % 1400,
        format: i % 2 === 0 ? "hardcover" : "pocket",
        seed: `seed-${i}`,
      });
      expect(g.heightPx).toBeGreaterThanOrEqual(150);
      expect(g.heightPx).toBeLessThanOrEqual(215);
      expect(g.spineWidthPx).toBeGreaterThanOrEqual(12);
      expect(g.spineWidthPx).toBeLessThanOrEqual(56);
    }
  });

  it("nunca repete o mesmo template gráfico (A/B/C/D) em dois livros vizinhos e distribui marcas de editora em ~50%", () => {
    let prev: SpineTemplateId | null = null;
    const seen = new Set<SpineTemplateId>();
    let markCount = 0;
    for (let i = 0; i < 100; i += 1) {
      const tpl = pickSpineTemplate(`vol-${i}`, prev);
      expect(tpl).not.toBe(prev);
      seen.add(tpl);
      prev = tpl;

      const mark = pickPublisherMark(`vol-${i}`);
      if (mark !== null) {
        markCount += 1;
        expect(PUBLISHER_MARKS).toContain(mark);
      }
    }
    expect(seen.size).toBe(4);
    expect(markCount).toBeGreaterThan(30);
    expect(markCount).toBeLessThan(70);
  });

  it("sem páginas usa o padrão de 240 (240 × 0,07 = 16,8px ± 2px)", () => {
    const g = computeShelfBookGeometry({ pages: undefined, format: null, seed: "sem-paginas" });
    expect(g.spineWidthPx).toBeGreaterThanOrEqual(14.8);
    expect(g.spineWidthPx).toBeLessThanOrEqual(18.8);
  });
});
