import { describe, expect, it } from "vitest";
import {
  computeCoverCoverageStats,
  COVER_MAX_CANDIDATES,
} from "@/features/catalog/cover-search-rules";
import {
  computeRowGroupBreakIndices,
  computeShelfBookGeometry,
  DEFAULT_GROUP_GAP_PX,
  groupBooksByGenre,
  measureBookRenderLayout,
  packShelfBooksByWidth,
  resolveGroupTiltIndices,
  resolveShelfGroupGapPx,
  UNIFORM_COMPARTMENT_ROW_HEIGHT_PX,
  type VirtualBookItem,
} from "@/features/shelves/virtual-bookshelf";
import { resolveRowSpineVisuals } from "@/components/ShelfView";

function makeSyntheticBooks(count: number): VirtualBookItem[] {
  const formats = ["capa_dura", "brochura", "bolso"] as const;
  return Array.from({ length: count }, (_, idx) => ({
    id: `stage5-book-${idx}`,
    seed: `stage5-seed-${idx}`,
    title: `Volume Editorial ${idx + 1}: Ensaio de Biblioteca`,
    author: `Autora ${idx + 1} Sobrenome`,
    pages: 110 + ((idx * 53) % 620),
    format: formats[idx % formats.length],
    genre: idx % 2 === 0 ? "Literatura" : "História",
    coverUrl: null,
  }));
}

describe("Etapa 5 — Cobertura de capas e arquitetura da Estante 3D", () => {
  it("calcula cobertura de capas corretamente (vazio, parcial e 100%)", () => {
    expect(computeCoverCoverageStats([])).toEqual({
      total: 0,
      withRealCover: 0,
      withoutCover: 0,
      coveragePercent: 0,
    });

    const partial = computeCoverCoverageStats([
      { coverUrl: "https://covers.openlibrary.org/b/id/1-L.jpg" },
      { coverUrl: "   " },
      { coverUrl: null },
      { coverUrl: "/api/covers/file/u1/e4/cover.webp" },
    ]);
    expect(partial).toEqual({
      total: 4,
      withRealCover: 2,
      withoutCover: 2,
      coveragePercent: 50,
    });

    expect(COVER_MAX_CANDIDATES).toBe(8);
  });

  it("mantém vãos entre grupos estritamente entre 28 e 56px e inclina só o último livro antes de cada vão", () => {
    expect(DEFAULT_GROUP_GAP_PX).toBeGreaterThanOrEqual(28);
    expect(DEFAULT_GROUP_GAP_PX).toBeLessThanOrEqual(56);

    for (const density of ["compacta", "padrao", "vitrine"] as const) {
      const gap = resolveShelfGroupGapPx(density);
      expect(gap).toBeGreaterThanOrEqual(28);
      expect(gap).toBeLessThanOrEqual(56);
    }

    const breaks = computeRowGroupBreakIndices(12, "row-demo-1");
    expect(breaks.length).toBeGreaterThanOrEqual(1);
    const tilted = resolveGroupTiltIndices(12, breaks, DEFAULT_GROUP_GAP_PX);
    expect(tilted.size).toBe(breaks.length);
    for (const breakIdx of breaks) {
      expect(tilted.has(breakIdx - 1)).toBe(true);
    }
    // Último livro da fileira não inclina para não colidir com o aparador
    expect(tilted.has(11)).toBe(false);
    // Sem vão >= 28px, nenhum livro inclina
    expect(resolveGroupTiltIndices(12, breaks, 16).size).toBe(0);
  });

  it("garante alturas de lombada entre 150 e 215px, compartimento uniforme >= 220px e espessura proporcional às páginas", () => {
    expect(UNIFORM_COMPARTMENT_ROW_HEIGHT_PX).toBeGreaterThanOrEqual(220);

    const thin = computeShelfBookGeometry({
      pages: 96,
      format: "bolso",
      seed: "a",
    });
    const mid = computeShelfBookGeometry({
      pages: 320,
      format: "brochura",
      seed: "a",
    });
    const thick = computeShelfBookGeometry({
      pages: 780,
      format: "capa_dura",
      seed: "a",
    });

    expect(thin.spineWidthPx).toBeLessThan(mid.spineWidthPx);
    expect(mid.spineWidthPx).toBeLessThan(thick.spineWidthPx);

    for (const book of makeSyntheticBooks(60)) {
      const geo = computeShelfBookGeometry({
        pages: book.pages,
        format: book.format,
        seed: book.seed ?? String(book.id),
      });
      expect(geo.heightPx).toBeGreaterThanOrEqual(150);
      expect(geo.heightPx).toBeLessThanOrEqual(215);
      expect(geo.heightPx).toBeLessThan(UNIFORM_COMPARTMENT_ROW_HEIGHT_PX);
    }
  });

  it("empacota 150 e 500 livros com zero overflow por prateleira, vizinhos distintos e tempo rápido", () => {
    for (const count of [150, 500]) {
      const books = makeSyntheticBooks(count);
      const t0 = performance.now();
      const groups = groupBooksByGenre(books);
      let resolvedTotal = 0;

      for (const group of groups) {
        const chunks = packShelfBooksByWidth(group.books, {
          maxRowWidthPx: 680,
          groupGapPx: DEFAULT_GROUP_GAP_PX,
          rowSeedPrefix: `stage5-${count}-${group.genreKey}`,
        });

        for (const chunk of chunks) {
          const visuals = resolveRowSpineVisuals(chunk.books);
          resolvedTotal += visuals.length;

          // Nenhum par de vizinhos repete a mesma cor ou o mesmo template
          for (let i = 1; i < visuals.length; i++) {
            const prev = visuals[i - 1]!;
            const curr = visuals[i]!;
            expect(curr.template).not.toBe(prev.template);
            expect(curr.spineBg.toLowerCase()).not.toBe(
              prev.spineBg.toLowerCase()
            );
          }

          // Nenhum livro fora da tábua: soma das larguras + vãos <= maxRowWidthPx
          const totalWidth =
            chunk.books.reduce(
              (acc, b) => acc + measureBookRenderLayout(b).widthPx,
              0
            ) +
            chunk.groupBreakIndices.length * chunk.groupGapPx;
          expect(totalWidth).toBeLessThanOrEqual(680 + 1);
        }
      }

      const elapsedMs = performance.now() - t0;
      expect(resolvedTotal).toBe(count);
      expect(elapsedMs).toBeLessThan(150);
    }
  });
});
