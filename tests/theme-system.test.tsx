import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  DEFAULT_DENSITY,
  DEFAULT_MOTION,
  DEFAULT_THEME_ID,
  normalizeDensityPreference,
  normalizeMotionPreference,
  normalizeThemePreference,
  resolveThemeId,
  SYSTEM_THEME_PAIR,
  THEME_LIST,
  THEMES,
} from "@/lib/themes/themes.config";
import { buildThemeInitScript } from "@/lib/themes/theme-init-script";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { ThemeCardsPicker } from "@/components/ThemeCardsPicker";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FilterChip } from "@/components/ui/FilterChip";
import { Modal } from "@/components/ui/Modal";

vi.mock("@/features/auth/actions", () => ({
  updateThemePreferencesAction: vi.fn().mockResolvedValue({
    ok: true,
    persistedToProfile: true,
  }),
}));

function mockMatchMedia(prefersDark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-color-scheme: dark")
        ? prefersDark
        : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("themes.config & rules (4 curated themes)", () => {
  it("normalizes legacy and canonical curated theme preferences with safe defaults", () => {
    expect(normalizeThemePreference(undefined)).toBe(DEFAULT_THEME_ID);
    expect(normalizeThemePreference("light")).toBe("caderno");
    expect(normalizeThemePreference("editorial-light")).toBe("caderno");
    expect(normalizeThemePreference("caderno")).toBe("caderno");
    expect(normalizeThemePreference("dark")).toBe("dark-academia");
    expect(normalizeThemePreference("editorial-dark")).toBe("dark-academia");
    expect(normalizeThemePreference("dark-academia")).toBe("dark-academia");
    expect(normalizeThemePreference("escandinavo")).toBe("escandinavo");
    expect(normalizeThemePreference("gotico")).toBe("gotico");
    expect(normalizeThemePreference("system")).toBe("system");
    expect(normalizeThemePreference("unknown")).toBe(DEFAULT_THEME_ID);
  });

  it("resolves 'system' using Caderno <-> Dark Academia pair based on prefers-color-scheme", () => {
    expect(SYSTEM_THEME_PAIR).toEqual({ light: "caderno", dark: "dark-academia" });
    expect(resolveThemeId("system", false)).toBe("caderno");
    expect(resolveThemeId("system", true)).toBe("dark-academia");
    expect(resolveThemeId("escandinavo", true)).toBe("escandinavo");
    expect(resolveThemeId("gotico", false)).toBe("gotico");
  });

  it("exposes exactly 4 curated themes with ambientId, preview swatches and 3 preloaded fonts max", () => {
    expect(THEME_LIST.map((t) => t.id)).toEqual([
      "caderno",
      "dark-academia",
      "escandinavo",
      "gotico",
    ]);
    for (const theme of Object.values(THEMES)) {
      expect(theme.ambientId.length).toBeGreaterThan(0);
      expect(theme.preview.background).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(theme.preview.text).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(theme.preview.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(theme.allowedFonts.length).toBeLessThanOrEqual(3);
      expect(theme.allowedFonts).toContain(theme.defaultFonts.heading);
      expect(theme.allowedFonts).toContain(theme.defaultFonts.body);
      expect(theme.allowedFonts).toContain(theme.defaultFonts.numeric);
    }
    expect(THEMES.escandinavo.defaultFonts.heading).toBe("hanken");
  });

  it("normalizes density and motion preferences", () => {
    expect(normalizeDensityPreference("compact")).toBe("compact");
    expect(normalizeDensityPreference("spacious")).toBe("spacious");
    expect(normalizeDensityPreference("invalid")).toBe(DEFAULT_DENSITY);

    expect(normalizeMotionPreference("reduced")).toBe("reduced");
    expect(normalizeMotionPreference("full")).toBe("full");
    expect(normalizeMotionPreference("invalid")).toBe(DEFAULT_MOTION);
  });

  it("generates inline init script supporting all 4 curated themes before hydration", () => {
    const script = buildThemeInitScript();
    expect(script).toContain("caderno");
    expect(script).toContain("dark-academia");
    expect(script).toContain("escandinavo");
    expect(script).toContain("gotico");
    expect(script).toContain("prefers-color-scheme: dark");
  });
});

describe("ThemeProvider, ThemeCardsPicker, ThemeSwitcher & shared components", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockMatchMedia(false);
    document.cookie = "rf_theme=; Max-Age=0; Path=/";
    document.cookie = "rf_density=; Max-Age=0; Path=/";
    document.cookie = "rf_motion=; Max-Age=0; Path=/";
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-density");
    document.documentElement.removeAttribute("data-motion");
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) =>
      window.setTimeout(() => cb(performance.now()), 16)
    );
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) =>
      window.clearTimeout(id)
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("switches all 4 curated themes live via ThemeCardsPicker and persists cookies", () => {
    render(
      <ThemeProvider initialTheme="caderno">
        <ThemeCardsPicker />
      </ThemeProvider>
    );

    act(() => {
      vi.advanceTimersByTime(32);
    });

    expect(document.documentElement.getAttribute("data-theme")).toBe("caderno");

    fireEvent.click(screen.getByRole("radio", { name: /Dark Academia/i }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark-academia");
    expect(document.cookie).toContain("rf_theme=dark-academia");

    fireEvent.click(screen.getByRole("radio", { name: /Escandinavo/i }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("escandinavo");
    expect(document.cookie).toContain("rf_theme=escandinavo");

    fireEvent.click(screen.getByRole("radio", { name: /Gótico/i }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("gotico");
    expect(document.cookie).toContain("rf_theme=gotico");
  });

  it("switches theme, density and motion live via ThemeSwitcher and renders pilots", () => {
    render(
      <ThemeProvider
        initialTheme="caderno"
        initialDensity="comfortable"
        initialMotion="system"
      >
        <ThemeSwitcher />
        <Card>
          <Button variant="primary">Ação Primária</Button>
          <FilterChip label="Físicos" count={12} active />
        </Card>
      </ThemeProvider>
    );

    act(() => {
      vi.advanceTimersByTime(32);
    });

    expect(document.documentElement.getAttribute("data-theme")).toBe("caderno");

    fireEvent.click(screen.getByRole("button", { name: /^Dark Academia$/i }));
    expect(document.documentElement.getAttribute("data-theme")).toBe(
      "dark-academia"
    );

    fireEvent.click(screen.getByRole("button", { name: "Compacta" }));
    expect(document.documentElement.getAttribute("data-density")).toBe("compact");

    fireEvent.click(screen.getByRole("button", { name: "Reduzido" }));
    expect(document.documentElement.getAttribute("data-motion")).toBe("reduced");

    expect(screen.getByRole("button", { name: "Ação Primária" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Físicos/i })).toBeTruthy();
  });

  it("resolves 'Automático' to dark-academia when system prefers dark", () => {
    mockMatchMedia(true);

    render(
      <ThemeProvider initialTheme="system">
        <ThemeSwitcher />
      </ThemeProvider>
    );

    act(() => {
      vi.advanceTimersByTime(32);
    });

    expect(document.documentElement.getAttribute("data-theme")).toBe(
      "dark-academia"
    );
    expect(screen.getByTestId("active-theme-badge").textContent).toContain(
      "dark-academia (auto)"
    );
  });

  it("renders shared Modal with accessible dialog semantics and closes on Escape", () => {
    const onClose = vi.fn();

    render(
      <Modal open onClose={onClose} tone="dark" eyebrow="ReadingFlow" title="Contato">
        <p>Conteúdo institucional</p>
      </Modal>
    );

    const dialog = screen.getByRole("dialog", { name: "Contato" });
    expect(dialog).toBeTruthy();
    expect(screen.getByText("Conteúdo institucional")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
