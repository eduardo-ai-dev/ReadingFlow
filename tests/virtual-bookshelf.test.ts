import { describe, expect, it } from "vitest";
import {
  computeContrastRatioHex,
  computeShelfBookGeometry,
  filterVirtualBooksByQuickFilter,
  groupBooksByGenre,
  packShelfBooksByWidth,
  resolveBookDimensions,
  resolveSpinePalette,
  SHELF_COLOR_PRESETS,
  type VirtualBookItem,
} from "@/features/shelves/virtual-bookshelf";
import { resolveCanonicalGenre } from "@/features/shelves/genres";

const SAMPLE_USER_BOOKS: VirtualBookItem[] = [
  {
    id: 1,
    title: "O Estrangeiro",
    genre: "Clássicos",
    spineColor: "#2b2b2b",
    coverUrl: "/covers/estrangeiro.jpg",
    pages: 120,
  },
  {
    id: 2,
    title: "Fourth Wing",
    genre: "Fantasia",
    spineColor: "#8b0000",
    coverUrl: "/covers/fourthwing.jpg",
    pages: 500,
  },
  {
    id: 3,
    title: "O Mito de Sísifo",
    genre: "Filosofia",
    spineColor: "#e0d8c8",
    coverUrl: "/covers/sisifo.jpg",
    pages: 150,
  },
];

describe("VirtualBookshelf — agrupamento dinâmico por gênero e contraste 3D", () => {
  it("agrupa o array base de livros em uma prateleira exclusiva para cada gênero", () => {
    const shelves = groupBooksByGenre(SAMPLE_USER_BOOKS);

    expect(shelves).toHaveLength(3);
    expect(shelves.map((s) => s.genre)).toEqual([
      "Clássicos",
      "Fantasia",
      "Filosofia",
    ]);
    expect(shelves[0]?.books[0]?.title).toBe("O Estrangeiro");
    expect(shelves[1]?.books[0]?.title).toBe("Fourth Wing");
    expect(shelves[2]?.books[0]?.title).toBe("O Mito de Sísifo");
  });

  it("insere livro em prateleira existente (mesmo com variação de caixa/espaço) e cria nova prateleira para gênero inédito", () => {
    const updatedBooks: VirtualBookItem[] = [
      ...SAMPLE_USER_BOOKS,
      {
        id: 4,
        title: "O Nome do Vento",
        genre: "  fantasia ",
        spineColor: "#1f3b2d",
        pages: 656,
      },
      {
        id: 5,
        title: "1984",
        genre: "Distopia",
        spineColor: "#6a3f28",
        pages: 336,
      },
      {
        id: 6,
        title: "Caderno Sem Rótulo",
        genre: "",
        pages: 96,
      },
    ];

    const shelves = groupBooksByGenre(updatedBooks);

    expect(shelves.map((s) => s.genre)).toEqual([
      "Clássicos",
      "Fantasia",
      "Filosofia",
      "Distopia",
      "Acervo Geral",
    ]);

    const fantasiaShelf = shelves.find((s) => s.genre === "Fantasia");
    expect(fantasiaShelf?.books.map((b) => b.title)).toEqual([
      "Fourth Wing",
      "O Nome do Vento",
    ]);

    const distopiaShelf = shelves.find((s) => s.genre === "Distopia");
    expect(distopiaShelf?.books.map((b) => b.title)).toEqual(["1984"]);
  });

  it("garante contraste WCAG 2.2 AA (>= 4,5:1) na lombada para cores escuras, claras e tons médios", () => {
    for (const rawHex of [
      "#2b2b2b",
      "#8b0000",
      "#e0d8c8",
      "#767676",
      "#808080",
      undefined,
    ]) {
      const palette = resolveSpinePalette(rawHex, "Livro Teste");
      const ratio = computeContrastRatioHex(palette.spineBg, palette.spineInk);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("calcula espessura da lombada proporcional ao número de páginas dentro de limites seguros", () => {
    const slim = resolveBookDimensions({ id: 1, title: "Curto", pages: 120 });
    const thick = resolveBookDimensions({
      id: 2,
      title: "Calhamaço",
      pages: 500,
    });

    expect(thick.spineWidthPx).toBeGreaterThan(slim.spineWidthPx);
    expect(slim.spineWidthPx).toBeGreaterThanOrEqual(30);
    expect(thick.spineWidthPx).toBeLessThanOrEqual(58);
  });

  it("unifica taxonomias de gênero entre alas literárias e agrupa prateleiras esparsas em Miscelânea", () => {
    expect(resolveCanonicalGenre("Horror").label).toBe("Terror");
    expect(resolveCanonicalGenre("Clássicos").label).toBe("Clássico Brasileiro");
    expect(resolveCanonicalGenre("Brasiliana").label).toBe(
      "Literatura Brasileira"
    );

    const mixedBooks: VirtualBookItem[] = [
      { id: "c1", title: "C1", genre: "Clássicos", pages: 200 },
      { id: "c2", title: "C2", genre: "Clássico Brasileiro", pages: 220 },
      { id: "c3", title: "C3", genre: "Universal", pages: 240 },
      { id: "t1", title: "T1", genre: "Terror", pages: 180 },
      { id: "f1", title: "F1", genre: "Fantasia", pages: 310 },
      { id: "m1", title: "M1", genre: "Mistério", pages: 260 },
    ];

    const shelves = groupBooksByGenre(mixedBooks, {
      unifyTaxonomy: true,
      compactSmallThreshold: 2,
      miscLabel: "Miscelânea",
    });

    expect(shelves.map((s) => s.genre)).toEqual([
      "Clássico Brasileiro",
      "Miscelânea",
    ]);
    expect(shelves[0]?.books.map((b) => b.id)).toEqual(["c1", "c2", "c3"]);
    expect(shelves[1]?.books.map((b) => b.id)).toEqual(["t1", "f1", "m1"]);
  });

  it("filtra volumes pelas categorias rápidas Todos, Só Físicos, Só Digitais, Em Andamento, Concluídos e Desejos", () => {
    const libraryBooks: VirtualBookItem[] = [
      {
        id: "b1",
        title: "Físico Lendo",
        shelfKind: "physical",
        readingStatus: "reading",
      },
      {
        id: "b2",
        title: "Digital Concluído",
        shelfKind: "digital",
        format: "ebook",
        readingStatus: "finished",
      },
      {
        id: "b3",
        title: "Áudio Pausado",
        shelfKind: "audio",
        format: "audiobook",
        readingStatus: "paused",
      },
    ];
    const wishBooks: VirtualBookItem[] = [
      { id: "w1", title: "Desejado", isWishlist: true },
    ];

    expect(
      filterVirtualBooksByQuickFilter(libraryBooks, wishBooks, "all").map(
        (b) => b.id
      )
    ).toEqual(["b1", "b2", "b3"]);
    expect(
      filterVirtualBooksByQuickFilter(libraryBooks, wishBooks, "physical").map(
        (b) => b.id
      )
    ).toEqual(["b1"]);
    expect(
      filterVirtualBooksByQuickFilter(libraryBooks, wishBooks, "digital").map(
        (b) => b.id
      )
    ).toEqual(["b2", "b3"]);
    expect(
      filterVirtualBooksByQuickFilter(libraryBooks, wishBooks, "reading").map(
        (b) => b.id
      )
    ).toEqual(["b1"]);
    expect(
      filterVirtualBooksByQuickFilter(libraryBooks, wishBooks, "finished").map(
        (b) => b.id
      )
    ).toEqual(["b2"]);
    expect(
      filterVirtualBooksByQuickFilter(libraryBooks, wishBooks, "wishlist").map(
        (b) => b.id
      )
    ).toEqual(["w1"]);
  });

  it("calcula alturas entre 150px e 210px (+12px quando pages > 500) e espessura clamp(12px, pages * 0.07px, 56px) ± 2px", () => {
    const slimPocket = computeShelfBookGeometry({
      pages: 90,
      format: "bolso",
      seed: "bolso-90",
    });
    const mediumPaperback = computeShelfBookGeometry({
      pages: 400,
      format: "brochura",
      seed: "brochura-400",
    });
    const thickHardcover = computeShelfBookGeometry({
      pages: 1100,
      format: "capa_dura",
      seed: "capa-dura-1100",
    });
    const sameSeedShort = computeShelfBookGeometry({
      pages: 300,
      seed: "mesmo-seed",
    });
    const sameSeedLong = computeShelfBookGeometry({
      pages: 650,
      seed: "mesmo-seed",
    });

    for (const geom of [slimPocket, mediumPaperback, thickHardcover]) {
      expect(geom.heightPx).toBeGreaterThanOrEqual(150);
      expect(geom.heightPx).toBeLessThanOrEqual(215);
      expect(geom.depthPx).toBe(Math.round(geom.heightPx * 0.67));
    }

    expect(slimPocket.spineWidthPx).toBeGreaterThanOrEqual(12);
    expect(slimPocket.spineWidthPx).toBeLessThanOrEqual(14);
    expect(mediumPaperback.spineWidthPx).toBeGreaterThanOrEqual(26);
    expect(mediumPaperback.spineWidthPx).toBeLessThanOrEqual(30);
    expect(thickHardcover.spineWidthPx).toBeGreaterThanOrEqual(54);
    expect(thickHardcover.spineWidthPx).toBeLessThanOrEqual(56);
    expect(sameSeedLong.heightPx).toBe(Math.min(215, sameSeedShort.heightPx + 12));
  });

  it("empacota 28 livros em prateleiras de continuação pela soma das larguras (SSR-safe)", () => {
    const books = Array.from({ length: 28 }, (_, index) => ({
      id: `book-${index + 1}`,
      pages: 90 + ((index * 67) % 810),
    }));
    const rows = packShelfBooksByWidth(books, { maxRowWidthPx: 420, gapPx: 3 });

    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.reduce((acc, row) => acc + row.books.length, 0)).toBe(28);
    for (const row of rows) {
      expect(row.rowBooksWidthPx).toBeLessThanOrEqual(420);
      expect(row.maxBookHeightPx).toBeGreaterThanOrEqual(150);
      expect(row.maxBookHeightPx).toBeLessThanOrEqual(215);
    }
  });

  it("fornece conjuntos cromáticos predefinidos para pílulas de cabeçalho de prateleira", () => {
    expect(SHELF_COLOR_PRESETS.length).toBeGreaterThanOrEqual(3);
    for (const preset of SHELF_COLOR_PRESETS) {
      expect(preset.dots.length).toBeGreaterThanOrEqual(2);
      expect(preset.label.length).toBeGreaterThan(3);
    }
  });
});
