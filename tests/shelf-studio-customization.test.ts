import { describe, expect, it } from "vitest";
import {
  applyShelfPreset,
  buildCustomShelfRows,
  DEFAULT_SHELF_THEME_CONFIG,
  detectMatchingShelfPreset,
  getShelfDensityGapPx,
  migrateLegacyShelfThemeConfig,
  parsePersistedShelfLayout,
  patchShelfThemeConfig,
  SHELF_PRESETS,
} from "@/features/shelves/arrange-shelves";

describe("Estúdio de Personalização da Estante — Presets e Migração", () => {
  it("aplica todos os 4 presets de 1 clique corretamente", () => {
    for (const preset of SHELF_PRESETS) {
      const next = applyShelfPreset(DEFAULT_SHELF_THEME_CONFIG, preset.id);
      expect(next.presetId).toBe(preset.id);
      expect(next.material).toBe(preset.config.material);
      expect(next.bracketStyle).toBe(preset.config.bracketStyle);
      expect(next.nicheBackdrop).toBe(preset.config.nicheBackdrop);
      expect(next.ledWarm3000K).toBe(preset.config.ledWarm3000K);
      expect(next.topSpotlights).toBe(preset.config.topSpotlights);
      expect(next.density).toBe(preset.config.density);
    }
  });

  it("marca presetId como 'personalizada' ao editar um atributo individualmente e reconhece de volta se coincidir", () => {
    const vitrine = applyShelfPreset(DEFAULT_SHELF_THEME_CONFIG, "vitrine");
    expect(vitrine.presetId).toBe("vitrine");

    const custom = patchShelfThemeConfig(vitrine, { material: "pedra" });
    expect(custom.presetId).toBe("personalizada");
    expect(custom.material).toBe("pedra");
    expect(custom.ledWarm3000K).toBe(true);

    const backToVitrine = patchShelfThemeConfig(custom, {
      material: "carvalho",
    });
    expect(backToVitrine.presetId).toBe("vitrine");
    expect(detectMatchingShelfPreset(backToVitrine)).toBe("vitrine");
  });

  it("migra layouts legados sem perder livros, prateleiras ou capas em destaque", () => {
    const legacyRaw = JSON.stringify({
      shelfOrder: ["ficcao", "classicos"],
      bookShelfMap: { "b-1": "ficcao", "b-2": "classicos" },
      customShelves: [{ key: "classicos", title: "Clássicos" }],
      shelfMeta: { classicos: { title: "Clássicos", displayAsTitle: true } },
      customOrderByShelf: { ficcao: ["b-1"] },
      featuredCoverIds: ["b-1"],
      bookColorOverrides: { "b-2": "#722F3E" },
      shelfMaterial: "editorial-bordeaux",
      organizationMode: "genre",
    });

    const migrated = parsePersistedShelfLayout(legacyRaw);

    expect(migrated.shelfOrder).toEqual(["ficcao", "classicos"]);
    expect(migrated.bookShelfMap).toEqual({ "b-1": "ficcao", "b-2": "classicos" });
    expect(migrated.bookColorOverrides).toEqual({ "b-2": "#722F3E" });
    expect(migrated.bookDisplayModes?.["b-1"]).toBe("capa_frente");
    expect(migrated.themeConfig?.presetId).toBe("bordo");
    expect(migrated.themeConfig?.material).toBe("bordo");
    expect(migrated.themeConfig?.bracketStyle).toBe("dourado");
    expect(migrated.themeConfig?.nicheBackdrop).toBe("bordo_profundo");
    expect(migrated.themeConfig?.organizationMode).toBe("genero");
  });

  it("migra corretamente os 3 materiais legados", () => {
    expect(
      migrateLegacyShelfThemeConfig({ shelfMaterial: "classic-wood" }).presetId
    ).toBe("classica");
    expect(
      migrateLegacyShelfThemeConfig({ shelfMaterial: "minimal-modern" }).presetId
    ).toBe("minimalista");
    expect(
      migrateLegacyShelfThemeConfig({ shelfMaterial: "editorial-bordeaux" })
        .presetId
    ).toBe("bordo");
  });

  it("higieniza objetos decorativos e modos inválidos sem corromper o layout", () => {
    const raw = JSON.stringify({
      shelfOrder: ["s1"],
      themeConfig: {
        material: "carvalho",
        bracketStyle: "dourado",
        nicheBackdrop: "verde_biblioteca",
        ledWarm3000K: true,
        topSpotlights: true,
        density: "vitrine",
        organizationMode: "livre",
      },
      bookDisplayModes: {
        "b-1": "capa_frente",
        "b-2": "inclinado",
        "b-invalid": "flutuando",
      },
      bookTiltDirections: {
        "b-2": "left",
        "b-3": "up",
      },
      shelfDecorByRow: {
        s1: [
          { id: "d1", decorType: "planta", afterBookIndex: -1 },
          { id: "d2", decorType: "inexistente", afterBookIndex: 0 },
          { id: "d3", decorType: "vela", afterBookIndex: 2 },
        ],
      },
    });

    const parsed = parsePersistedShelfLayout(raw);
    expect(parsed.themeConfig?.presetId).toBe("vitrine");
    expect(parsed.bookDisplayModes).toEqual({
      "b-1": "capa_frente",
      "b-2": "inclinado",
    });
    expect(parsed.bookTiltDirections).toEqual({ "b-2": "left" });
    expect(parsed.shelfDecorByRow?.s1).toEqual([
      { id: "d1", decorType: "planta", afterBookIndex: -1 },
      { id: "d3", decorType: "vela", afterBookIndex: 2 },
    ]);
  });

  it("constrói CustomShelfRow intercalando livros e objetos nas posições corretas", () => {
    const rows = buildCustomShelfRows({
      shelves: [
        { key: "ficcao", title: "Ficção", bookIds: ["b1", "b2", "b3"] },
      ],
      bookDisplayModes: { b1: "capa_frente", b3: "inclinado" },
      bookTiltDirections: { b3: "left" },
      bookColorOverrides: { b2: "#3A6652" },
      shelfDecorByRow: {
        ficcao: [
          { id: "d-start", decorType: "planta", afterBookIndex: -1 },
          { id: "d-mid", decorType: "espacador", afterBookIndex: 0 },
          { id: "d-end", decorType: "vela", afterBookIndex: 5 },
        ],
      },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]!.items.map((item) => item.id)).toEqual([
      "d-start",
      "book:b1",
      "d-mid",
      "book:b2",
      "book:b3",
      "d-end",
    ]);
    expect(rows[0]!.items[1]).toMatchObject({
      kind: "book",
      bookId: "b1",
      displayMode: "capa_frente",
    });
    expect(rows[0]!.items[4]).toMatchObject({
      kind: "book",
      bookId: "b3",
      displayMode: "inclinado",
      tiltDirection: "left",
    });
  });

  it("retorna o espaçamento correto por densidade", () => {
    expect(getShelfDensityGapPx("compacta")).toBe(1);
    expect(getShelfDensityGapPx("padrao")).toBe(3);
    expect(getShelfDensityGapPx("vitrine")).toBe(8);
  });
});
