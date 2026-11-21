import type {
  AllowedFontId,
  DensityPreference,
  MotionPreference,
  ThemeContrastPairSpec,
  ThemeDefinition,
  ThemeId,
  ThemePreference,
} from "./themes.types";

export const DEFAULT_THEME_ID: ThemeId = "caderno";
export const DEFAULT_DENSITY: DensityPreference = "comfortable";
export const DEFAULT_MOTION: MotionPreference = "system";

/** Par claro/escuro usado quando a preferência do usuário é "system" ("Automático": Caderno ↔ Dark Academia). */
export const SYSTEM_THEME_PAIR: Readonly<{ light: ThemeId; dark: ThemeId }> = {
  light: "caderno",
  dark: "dark-academia",
};

export const THEME_COOKIE_NAME = "rf_theme";
export const DENSITY_COOKIE_NAME = "rf_density";
export const MOTION_COOKIE_NAME = "rf_motion";

export const ALLOWED_FONTS: Record<
  AllowedFontId,
  { id: AllowedFontId; label: string; cssVar: string }
> = {
  playfair: {
    id: "playfair",
    label: "Playfair Display (Editorial Serifada)",
    cssVar: "var(--font-serif)",
  },
  hanken: {
    id: "hanken",
    label: "Hanken Grotesk (Interface Sans)",
    cssVar: "var(--font-sans)",
  },
  "jetbrains-mono": {
    id: "jetbrains-mono",
    label: "JetBrains Mono (Monoespaçada / ISBN)",
    cssVar: "var(--font-mono)",
  },
};

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  caderno: {
    id: "caderno",
    legacyAliases: ["light", "editorial-light"],
    name: "Caderno",
    shortLabel: "Caderno (Padrão)",
    description:
      "Papel linho quente, madeira clássica, destaque Camel e detalhes em Bordô editorial.",
    colorScheme: "light",
    ambientId: "03-madeira-dourada",
    ambientLabel: "Madeira Dourada",
    shelfMaterial: "classic-wood",
    shelfMaterialLabel: "Madeira Clássica",
    preview: {
      /* theme-exempt: amostras estáticas do catálogo de temas para o card seletor */
      background: "#F4EFE6",
      /* theme-exempt: amostras estáticas do catálogo de temas para o card seletor */
      surface: "#FAF7F1",
      /* theme-exempt: amostras estáticas do catálogo de temas para o card seletor */
      text: "#2C221E",
      /* theme-exempt: amostras estáticas do catálogo de temas para o card seletor */
      accent: "#C8A46E",
      /* theme-exempt: amostras estáticas do catálogo de temas para o card seletor */
      accentSecondary: "#722F3E",
    },
    allowedAccents: ["camel", "wine-plum"],
    defaultAccent: "camel",
    allowedFonts: ["playfair", "hanken", "jetbrains-mono"],
    defaultFonts: {
      heading: "playfair",
      body: "hanken",
      numeric: "playfair",
    },
  },
  "dark-academia": {
    id: "dark-academia",
    legacyAliases: ["dark", "editorial-dark"],
    name: "Dark Academia",
    shortLabel: "Dark Academia",
    description:
      "Biblioteca noturna em Onyx, nogueira escura com latão, textos em linho e acentos Camel/Rosé.",
    colorScheme: "dark",
    ambientId: "02-dark-academia",
    ambientLabel: "Dark Academia",
    shelfMaterial: "classic-wood",
    shelfMaterialLabel: "Madeira Clássica (escura + latão)",
    preview: {
      /* theme-exempt: amostras estáticas do catálogo de temas para o card seletor */
      background: "#141514",
      /* theme-exempt: amostras estáticas do catálogo de temas para o card seletor */
      surface: "#222422",
      /* theme-exempt: amostras estáticas do catálogo de temas para o card seletor */
      text: "#F4EFE6",
      /* theme-exempt: amostras estáticas do catálogo de temas para o card seletor */
      accent: "#C8A46E",
      /* theme-exempt: amostras estáticas do catálogo de temas para o card seletor */
      accentSecondary: "#722F3E",
    },
    allowedAccents: ["camel", "wine-plum"],
    defaultAccent: "camel",
    allowedFonts: ["playfair", "hanken", "jetbrains-mono"],
    defaultFonts: {
      heading: "playfair",
      body: "hanken",
      numeric: "playfair",
    },
  },
  escandinavo: {
    id: "escandinavo",
    name: "Escandinavo",
    shortLabel: "Escandinavo",
    description:
      "Minimalismo luminoso em papel mineral, navegação clara, carvalho claro, títulos sans e Petróleo/Barro.",
    colorScheme: "light",
    ambientId: "08-minimalista-claro",
    ambientLabel: "Santuário Minimalista",
    shelfMaterial: "minimal-modern",
    shelfMaterialLabel: "Minimalista (carvalho claro)",
    preview: {
      /* theme-exempt: amostras estáticas do catálogo de temas para o card seletor */
      background: "#F5F6F4",
      /* theme-exempt: amostras estáticas do catálogo de temas para o card seletor */
      surface: "#FCFCFB",
      /* theme-exempt: amostras estáticas do catálogo de temas para o card seletor */
      text: "#1F2A2E",
      /* theme-exempt: amostras estáticas do catálogo de temas para o card seletor */
      accent: "#2F6B6B",
      /* theme-exempt: amostras estáticas do catálogo de temas para o card seletor */
      accentSecondary: "#9C5238",
    },
    allowedAccents: ["petrol", "terracotta"],
    defaultAccent: "petrol",
    allowedFonts: ["hanken", "playfair", "jetbrains-mono"],
    defaultFonts: {
      heading: "hanken",
      body: "hanken",
      numeric: "hanken",
    },
  },
  gotico: {
    id: "gotico",
    name: "Gótico",
    shortLabel: "Gótico",
    description:
      "Atmosfera noturna em obsidiana, estante de ébano com filete bordô, bordô vivo, prata e cantos afiados.",
    colorScheme: "dark",
    ambientId: "07-torre-noturna",
    ambientLabel: "Torre Noturna",
    shelfMaterial: "editorial-bordeaux",
    shelfMaterialLabel: "Editorial Bordô (ébano + filete bordô)",
    preview: {
      /* theme-exempt: amostras estáticas do catálogo de temas para o card seletor */
      background: "#0F0D10",
      /* theme-exempt: amostras estáticas do catálogo de temas para o card seletor */
      surface: "#1B171D",
      /* theme-exempt: amostras estáticas do catálogo de temas para o card seletor */
      text: "#E8E2DA",
      /* theme-exempt: amostras estáticas do catálogo de temas para o card seletor */
      accent: "#A3283F",
      /* theme-exempt: amostras estáticas do catálogo de temas para o card seletor */
      accentSecondary: "#A9A7B3",
    },
    allowedAccents: ["crimson", "silver"],
    defaultAccent: "crimson",
    allowedFonts: ["playfair", "hanken", "jetbrains-mono"],
    defaultFonts: {
      heading: "playfair",
      body: "hanken",
      numeric: "playfair",
    },
  },
};

export const THEME_LIST: readonly ThemeDefinition[] = [
  THEMES.caderno,
  THEMES["dark-academia"],
  THEMES.escandinavo,
  THEMES.gotico,
];

export const DENSITY_OPTIONS: ReadonlyArray<{
  id: DensityPreference;
  label: string;
  description: string;
}> = [
  {
    id: "compact",
    label: "Compacta",
    description: "Mais itens visíveis na tela com espaçamento enxuto.",
  },
  {
    id: "comfortable",
    label: "Confortável",
    description: "Ritmo editorial padrão do ReadingFlow.",
  },
  {
    id: "spacious",
    label: "Espaçosa",
    description: "Respiro ampliado para leitura prolongada.",
  },
];

export const MOTION_OPTIONS: ReadonlyArray<{
  id: MotionPreference;
  label: string;
  description: string;
}> = [
  {
    id: "system",
    label: "Seguir sistema",
    description: "Respeita a preferência de movimento reduzido do sistema.",
  },
  {
    id: "reduced",
    label: "Reduzido",
    description: "Desativa animações e transições de deslocamento.",
  },
  {
    id: "full",
    label: "Completo",
    description: "Microinterações editoriais suaves ativadas.",
  },
];

/** Pares obrigatórios verificados pelo validador (texto >= 4.5:1; bordas/foco/ícones >= 3:1). */
export const REQUIRED_THEME_CONTRAST_PAIRS: readonly ThemeContrastPairSpec[] = [
  {
    label: "Texto primário / canvas",
    fgToken: "--rf-text-primary",
    bgToken: "--rf-surface-canvas",
    minRatio: 4.5,
  },
  {
    label: "Título / canvas",
    fgToken: "--rf-text-heading",
    bgToken: "--rf-surface-canvas",
    minRatio: 4.5,
  },
  {
    label: "Texto secundário / canvas",
    fgToken: "--rf-text-secondary",
    bgToken: "--rf-surface-canvas",
    minRatio: 4.5,
  },
  {
    label: "Texto secundário / fundo secundário",
    fgToken: "--rf-text-secondary",
    bgToken: "--rf-surface-desk",
    minRatio: 4.5,
  },
  {
    label: "Texto terciário / canvas",
    fgToken: "--rf-text-tertiary",
    bgToken: "--rf-surface-canvas",
    minRatio: 4.5,
  },
  {
    label: "Texto terciário / fundo secundário",
    fgToken: "--rf-text-tertiary",
    bgToken: "--rf-surface-desk",
    minRatio: 4.5,
  },
  {
    label: "Texto primário / card sólido",
    fgToken: "--rf-text-primary",
    bgToken: "--rf-surface-card-solid",
    minRatio: 4.5,
  },
  {
    label: "Texto secundário / card sólido",
    fgToken: "--rf-text-secondary",
    bgToken: "--rf-surface-card-solid",
    minRatio: 4.5,
  },
  {
    label: "Texto terciário / card sólido",
    fgToken: "--rf-text-tertiary",
    bgToken: "--rf-surface-card-solid",
    minRatio: 4.5,
  },
  {
    label: "Texto primário / superfície elevada",
    fgToken: "--rf-text-primary",
    bgToken: "--rf-surface-elevated",
    minRatio: 4.5,
  },
  {
    label: "Texto secundário / superfície sutil",
    fgToken: "--rf-text-secondary",
    bgToken: "--rf-surface-subtle",
    minRatio: 4.5,
  },
  {
    label: "Texto sobre destaque primário (Button primary)",
    fgToken: "--rf-accent-on-primary",
    bgToken: "--rf-accent-primary",
    minRatio: 4.5,
  },
  {
    label: "Texto sobre destaque primário hover",
    fgToken: "--rf-accent-on-primary",
    bgToken: "--rf-accent-primary-hover",
    minRatio: 4.5,
  },
  {
    label: "Texto sobre destaque secundário (Button secondary / Chip ativo)",
    fgToken: "--rf-accent-on-secondary",
    bgToken: "--rf-accent-secondary",
    minRatio: 4.5,
  },
  {
    label: "Texto sobre destaque secundário hover",
    fgToken: "--rf-accent-on-secondary",
    bgToken: "--rf-accent-secondary-hover",
    minRatio: 4.5,
  },
  {
    label: "Destaque texto/ícone / canvas",
    fgToken: "--rf-text-accent-secondary",
    bgToken: "--rf-surface-canvas",
    minRatio: 4.5,
  },
  {
    label: "Destaque texto/ícone / card sólido",
    fgToken: "--rf-text-accent-secondary",
    bgToken: "--rf-surface-card-solid",
    minRatio: 4.5,
  },
  {
    label: "Spotlight (texto / fundo contraste)",
    fgToken: "--rf-text-on-contrast",
    bgToken: "--rf-surface-contrast",
    minRatio: 4.5,
  },
  {
    label: "Spotlight muted / fundo contraste",
    fgToken: "--rf-text-on-contrast-muted",
    bgToken: "--rf-surface-contrast",
    minRatio: 4.5,
  },
  {
    label: "Estado sucesso (texto / fundo)",
    fgToken: "--rf-status-success",
    bgToken: "--rf-status-success-bg",
    minRatio: 4.5,
  },
  {
    label: "Estado aviso (texto / fundo)",
    fgToken: "--rf-status-warning",
    bgToken: "--rf-status-warning-bg",
    minRatio: 4.5,
  },
  {
    label: "Estado erro (texto / fundo)",
    fgToken: "--rf-status-error",
    bgToken: "--rf-status-error-bg",
    minRatio: 4.5,
  },
  {
    label: "Estado info (texto / fundo)",
    fgToken: "--rf-status-info",
    bgToken: "--rf-status-info-bg",
    minRatio: 4.5,
  },
  {
    label: "Borda de campo / canvas (UI >= 3:1)",
    fgToken: "--rf-border-strong",
    bgToken: "--rf-surface-canvas",
    minRatio: 3.0,
  },
  {
    label: "Borda de campo / card sólido (UI >= 3:1)",
    fgToken: "--rf-border-strong",
    bgToken: "--rf-surface-card-solid",
    minRatio: 3.0,
  },
  {
    label: "Anel de foco / canvas (UI >= 3:1)",
    fgToken: "--rf-focus-ring-color",
    bgToken: "--rf-surface-canvas",
    minRatio: 3.0,
  },
  {
    label: "Anel de foco / card sólido (UI >= 3:1)",
    fgToken: "--rf-focus-ring-color",
    bgToken: "--rf-surface-card-solid",
    minRatio: 3.0,
  },
  {
    label: "Calendário nível 0",
    fgToken: "--rf-cal-0-text",
    bgToken: "--rf-cal-0-bg",
    minRatio: 4.5,
  },
  {
    label: "Calendário nível 1",
    fgToken: "--rf-cal-1-text",
    bgToken: "--rf-cal-1-bg",
    minRatio: 4.5,
  },
  {
    label: "Calendário nível 2",
    fgToken: "--rf-cal-2-text",
    bgToken: "--rf-cal-2-bg",
    minRatio: 4.5,
  },
  {
    label: "Calendário nível 3",
    fgToken: "--rf-cal-3-text",
    bgToken: "--rf-cal-3-bg",
    minRatio: 4.5,
  },
  {
    label: "Calendário nível 4",
    fgToken: "--rf-cal-4-text",
    bgToken: "--rf-cal-4-bg",
    minRatio: 4.5,
  },
];

export function normalizeThemePreference(raw?: string | null): ThemePreference {
  switch (raw?.trim()) {
    case "system":
      return "system";
    case "light":
    case "editorial-light":
    case "caderno":
      return "caderno";
    case "dark":
    case "editorial-dark":
    case "dark-academia":
      return "dark-academia";
    case "escandinavo":
      return "escandinavo";
    case "gotico":
      return "gotico";
    default:
      return DEFAULT_THEME_ID;
  }
}

export function resolveThemeId(
  preference: ThemePreference,
  prefersDark = false
): ThemeId {
  if (preference === "system") {
    return prefersDark ? SYSTEM_THEME_PAIR.dark : SYSTEM_THEME_PAIR.light;
  }
  const normalized = normalizeThemePreference(preference);
  if (normalized === "system") {
    return prefersDark ? SYSTEM_THEME_PAIR.dark : SYSTEM_THEME_PAIR.light;
  }
  if (
    normalized === "caderno" ||
    normalized === "dark-academia" ||
    normalized === "escandinavo" ||
    normalized === "gotico"
  ) {
    return normalized;
  }
  return DEFAULT_THEME_ID;
}

export function normalizeDensityPreference(
  raw?: string | null
): DensityPreference {
  if (raw === "compact" || raw === "comfortable" || raw === "spacious") {
    return raw;
  }
  return DEFAULT_DENSITY;
}

export function normalizeMotionPreference(
  raw?: string | null
): MotionPreference {
  if (raw === "system" || raw === "reduced" || raw === "full") {
    return raw;
  }
  return DEFAULT_MOTION;
}
