export type ThemeId = "caderno" | "dark-academia" | "escandinavo" | "gotico";

/**
 * Preferência persistida do usuário:
 * - "system": escolhe automaticamente entre o par Caderno ↔ Dark Academia pelo `prefers-color-scheme`.
 * - "caderno" | "dark-academia" | "escandinavo" | "gotico": os 4 temas curados da Fase 3.
 * - "editorial-light" | "editorial-dark" | "light" | "dark": aliases legados mantidos para 100% de compatibilidade.
 */
export type ThemePreference =
  | "system"
  | ThemeId
  | "editorial-light"
  | "editorial-dark"
  | "light"
  | "dark";

export type DensityPreference = "compact" | "comfortable" | "spacious";

export type MotionPreference = "system" | "reduced" | "full";

export type AllowedFontId = "playfair" | "hanken" | "jetbrains-mono";

export type AllowedAccentId =
  | "camel"
  | "wine-plum"
  | "petrol"
  | "terracotta"
  | "crimson"
  | "silver";

export type ThemeShelfMaterial =
  | "classic-wood"
  | "minimal-modern"
  | "editorial-bordeaux";

export interface ThemeContrastPairSpec {
  label: string;
  fgToken: string;
  bgToken: string;
  minRatio: number;
}

export interface ThemePreviewSwatches {
  background: string;
  surface: string;
  text: string;
  accent: string;
  accentSecondary: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  legacyAliases?: readonly string[];
  name: string;
  shortLabel: string;
  description: string;
  colorScheme: "light" | "dark";
  /** Ambiente mais próximo em `public/landing-layouts/` (ligação completa na Fase 4). */
  ambientId: string;
  ambientLabel: string;
  shelfMaterial: ThemeShelfMaterial;
  shelfMaterialLabel: string;
  preview: ThemePreviewSwatches;
  allowedAccents: readonly AllowedAccentId[];
  defaultAccent: AllowedAccentId;
  allowedFonts: readonly AllowedFontId[];
  defaultFonts: {
    heading: AllowedFontId;
    body: AllowedFontId;
    numeric: AllowedFontId;
  };
}

export interface UserThemePreferences {
  theme: ThemePreference;
  density: DensityPreference;
  motion: MotionPreference;
}
