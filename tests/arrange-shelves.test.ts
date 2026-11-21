import { describe, expect, it } from "vitest";
import {
  computeArrangeBookDimensions,
  extractPredominantDotColors,
  hexToHsl,
  parsePersistedShelfLayout,
  resolveSpineContrastInk,
  sortBooksByColorHue,
} from "@/features/shelves/arrange-shelves";

describe("arrange-shelves — física visual, cores e ordenação cromática", () => {
  it("calcula dimensões das lombadas entre 22px–48px de largura e 125px–152px de altura", () => {
    const slim = computeArrangeBookDimensions({
      pages: 90,
      seed: "slim-90",
      format: "pocket",
    });
    const medium = computeArrangeBookDimensions({
      pages: 340,
      seed: "med-340",
      format: "paperback",
    });
    const thick = computeArrangeBookDimensions({
      pages: 900,
      seed: "thick-900",
      format: "hardcover",
    });
    const featured = computeArrangeBookDimensions({
      pages: 340,
      seed: "featured-340",
      featuredCover: true,
    });

    for (const d of [slim, medium, thick]) {
      expect(d.widthPx).toBeGreaterThanOrEqual(22);
      expect(d.widthPx).toBeLessThanOrEqual(48);
      expect(d.heightPx).toBeGreaterThanOrEqual(125);
      expect(d.heightPx).toBeLessThanOrEqual(152);
    }

    expect(thick.widthPx).toBeGreaterThan(medium.widthPx);
    expect(medium.widthPx).toBeGreaterThanOrEqual(slim.widthPx);
    expect(featured.widthPx).toBeGreaterThanOrEqual(68);
    expect(featured.widthPx).toBeLessThanOrEqual(84);
    expect(featured.heightPx).toBeGreaterThanOrEqual(125);
    expect(featured.heightPx).toBeLessThanOrEqual(152);
  });

  it("converte hex para HSL e ordena livros por espectro cromático coerente", () => {
    expect(hexToHsl("#111111").l).toBeLessThan(15);
    expect(hexToHsl("#D92B2B").h).toBeLessThan(20);

    const unsorted = [
      { id: "blue", spineColor: "#2563EB" },
      { id: "white", spineColor: "#F5F2EB" },
      { id: "black", spineColor: "#141514" },
      { id: "red", spineColor: "#C53030" },
      { id: "green", spineColor: "#2F855A" },
    ];

    const sorted = sortBooksByColorHue(unsorted, (b) => b.spineColor);
    expect(sorted.map((b) => b.id)).toEqual([
      "black",
      "red",
      "green",
      "blue",
      "white",
    ]);
  });

  it("extrai bolinhas de cor predominantes distintas e calcula tinta AA contrastante", () => {
    const books = [
      { color: "#141514" },
      { color: "#171817" }, // muito próxima de #141514 -> deduplicada
      { color: "#2D4F3E" },
      { color: "#C53030" },
    ];
    const dots = extractPredominantDotColors(books, (b) => b.color, 4);
    expect(dots).toEqual(["#141514", "#2D4F3E", "#C53030"]);

    expect(resolveSpineContrastInk("#141514")).toBe("#F5F2EB");
    expect(resolveSpineContrastInk("#F5F2EB")).toBe("#1F1B18");
  });

  it("persiste e valida tipo de estante (material + modo de organização) com fallback seguro", () => {
    const valid = parsePersistedShelfLayout(
      JSON.stringify({
        shelfMaterial: "editorial-bordeaux",
        organizationMode: "genre",
        bookColorOverrides: { "item-1": "#722F3E" },
      })
    );
    expect(valid.shelfMaterial).toBe("editorial-bordeaux");
    expect(valid.organizationMode).toBe("genre");
    expect(valid.bookColorOverrides).toEqual({ "item-1": "#722F3E" });

    const invalid = parsePersistedShelfLayout(
      JSON.stringify({
        shelfMaterial: "madeira-invalida",
        organizationMode: "invalido",
      })
    );
    expect(invalid.shelfMaterial).toBe("classic-wood");
    expect(invalid.organizationMode).toBe("color");
  });
});
