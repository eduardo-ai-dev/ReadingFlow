import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeRowGroupBreakIndices,
  measureBookRenderLayout,
  packShelfBooksByWidth,
  resolveShelfGroupGapPx,
  type ShelfBookLayoutDisplayMode,
} from "@/features/shelves/virtual-bookshelf";

function makeBooks(count: number) {
  return Array.from({ length: count }, (_, idx) => ({
    id: `vol-${idx + 1}`,
    title: `Livro de Teste com Título Muito Longo Número ${idx + 1}: Edição Crítica Comentada`,
    pages: 96 + ((idx * 137) % 860),
    format: idx % 3 === 0 ? "capa_dura" : idx % 3 === 1 ? "brochura" : "bolso",
  }));
}

describe("Bug 3 regression — Empacotamento unificado, zero overflow e vãos apenas entre grupos de 3–7 livros", () => {
  it("gera vãos APENAS entre grupos de 3 a 7 livros para qualquer quantidade de 0 a 29 volumes", () => {
    for (let n = 0; n <= 29; n += 1) {
      const breaks = computeRowGroupBreakIndices(n, `seed-${n}`);
      if (n <= 7) {
        expect(breaks).toEqual([]);
      } else {
        expect(breaks.length).toBeGreaterThanOrEqual(1);
        const boundaries = [0, ...breaks, n];
        for (let i = 0; i < boundaries.length - 1; i += 1) {
          const groupSize = boundaries[i + 1]! - boundaries[i]!;
          expect(groupSize).toBeGreaterThanOrEqual(3);
          expect(groupSize).toBeLessThanOrEqual(7);
        }
      }
    }
  });

  it("empacota 29 livros sem jamais ultrapassar maxRowWidthPx em larguras mobile e desktop (lombada, capa_frente, inclinado e covers)", () => {
    const books = makeBooks(29);
    const displayModes: Record<string, ShelfBookLayoutDisplayMode> = {
      "vol-2": "capa_frente",
      "vol-5": "inclinado",
      "vol-11": "capa_frente",
      "vol-17": "inclinado",
      "vol-24": "capa_frente",
    };

    for (const width of [300, 480, 560, 600]) {
      for (const view3dMode of ["spines", "covers"] as const) {
        const groupGapPx = resolveShelfGroupGapPx("padrao");
        const rows = packShelfBooksByWidth(books, {
          maxRowWidthPx: width,
          groupGapPx,
          rowSeedPrefix: `test-${width}-${view3dMode}`,
          bookDisplayModes: displayModes,
          view3dMode,
        });

        expect(rows.reduce((sum, r) => sum + r.books.length, 0)).toBe(29);

        for (const row of rows) {
          // Recalcula largura usando a mesma função única measureBookRenderLayout
          const sumBooks = row.books.reduce((acc, b) => {
            const m = measureBookRenderLayout(b, {
              displayMode: displayModes[b.id] ?? "lombada",
              view3dMode,
            });
            return acc + m.widthPx;
          }, 0);
          const expectedTotal = Number(
            (sumBooks + row.groupBreakIndices.length * row.groupGapPx).toFixed(
              2
            )
          );
          expect(row.rowBooksWidthPx).toBe(expectedTotal);
          if (row.books.length > 1) {
            expect(row.rowBooksWidthPx).toBeLessThanOrEqual(width);
          }
          // Nunca há um vão para cada livro adjacente
          if (row.books.length >= 2) {
            expect(row.groupBreakIndices.length).toBeLessThan(
              row.books.length - 1
            );
          }
        }
      }
    }
  });

  it("remove gap global entre livros em .booksRow e aplica minmax(0, 640px) + min-width: 0 no grid de 2 colunas", () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), "src/components/VirtualBookshelf.module.css"),
      "utf8"
    );

    expect(css).toContain(
      "grid-template-columns: minmax(0, 640px) minmax(280px, 1fr);"
    );
    const booksRowBlock = css.match(/\.booksRow\s*\{[^}]*\}/)?.[0] ?? "";
    expect(booksRowBlock).toMatch(/\bgap\s*:\s*0\s*;/);
    expect(booksRowBlock).not.toContain("--books-gap");

    const bookcaseBlock = css.match(/\.bookcase\s*\{[^}]*\}/)?.[0] ?? "";
    expect(bookcaseBlock).toMatch(/\bmin-width\s*:\s*0\s*;/);

    const quickPanelBlock = css.match(/\.quickPanel\s*\{[^}]*\}/)?.[0] ?? "";
    expect(quickPanelBlock).toMatch(/\bmin-width\s*:\s*0\s*;/);
  });
});
