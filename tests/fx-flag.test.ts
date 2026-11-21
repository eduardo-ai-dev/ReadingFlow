import { describe, expect, it } from "vitest";
import { DEFAULT_FX, normalizeFxPreference } from "@/lib/themes/themes.config";
import { buildThemeInitScript } from "@/lib/themes/theme-init-script";

describe("Flag de efeitos ambientais (--rf-fx / data-fx / ?perf=min)", () => {
  it("normaliza valores válidos e usa 'full' como padrão", () => {
    expect(DEFAULT_FX).toBe("full");
    expect(normalizeFxPreference("min")).toBe("min");
    expect(normalizeFxPreference("full")).toBe("full");
    expect(normalizeFxPreference("invalid")).toBe("full");
    expect(normalizeFxPreference(undefined)).toBe("full");
  });

  it("script de inicialização lê ?perf=min, cookie rf_fx e aplica data-fx e --rf-fx", () => {
    const script = buildThemeInitScript();
    expect(script).toContain("perf");
    expect(script).toContain("rf_fx");
    expect(script).toContain("data-fx");
    expect(script).toContain("--rf-fx");
  });
});
