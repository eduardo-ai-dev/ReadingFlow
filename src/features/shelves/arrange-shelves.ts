import { hashCoverSeed, extractAuthorSurname } from "@/lib/cover-color";
import { normalizeSearchText } from "@/features/catalog/rules";
import {
  normalizeRealisticBookFormat,
  type VirtualBookItem,
} from "@/features/shelves/virtual-bookshelf";

export const SHELF_LAYOUT_STORAGE_KEY = "readingflow:shelf-layout:v1";

export type ShelfColorPresetId =
  "classic-dark" | "editorial-tricolor" | "parchment-wood" | "crimson-gold";

export interface ShelfHeaderMeta {
  title?: string;
  colorPresetId?: ShelfColorPresetId;
  /** Quando true, exibe o título da coleção na pílula esquerda (ex: "Lista de Leitura") em vez de apenas bolinhas */
  displayAsTitle?: boolean;
  /** Paleta personalizada de bolinhas selecionada pelo usuário */
  customDots?: string[];
}

export type ShelfMaterialStyle =
  "classic-wood" | "minimal-modern" | "editorial-bordeaux";

export type ShelfOrganizationMode = "color" | "genre" | "custom";

export type ShelfPresetId =
  "classica" | "minimalista" | "vitrine" | "bordo" | "personalizada";

export type ShelfMaterial =
  "nogueira" | "carvalho" | "grafite" | "bordo" | "pedra";

export type BracketStyle = "classico" | "dourado" | "flutuante";

export type NicheBackdrop =
  "creme" | "madeira" | "verde_biblioteca" | "bordo_profundo" | "preto_fosco";

export type ShelfDensity = "compacta" | "padrao" | "vitrine";

export type OrganizationMode = "cor" | "genero" | "livre";

export type BookDisplayMode = "lombada" | "capa_frente" | "inclinado";

export type DecorItemType =
  | "planta"
  | "vela"
  | "ampulheta"
  | "bookend"
  | "xicara"
  | "busto"
  | "espacador";

export interface ShelfThemeConfig {
  presetId: ShelfPresetId;
  material: ShelfMaterial;
  bracketStyle: BracketStyle;
  nicheBackdrop: NicheBackdrop;
  ledWarm3000K: boolean;
  topSpotlights: boolean;
  density: ShelfDensity;
  organizationMode: OrganizationMode;
}

export type ShelfSlotItem =
  | {
      kind: "book";
      id: string;
      bookId: string;
      displayMode: BookDisplayMode;
      tiltDirection?: "left" | "right";
      customSpineColor?: string | null;
    }
  | {
      kind: "decor";
      id: string;
      decorType: DecorItemType;
    };

export interface CustomShelfRow {
  id: string;
  title: string;
  items: ShelfSlotItem[];
}

export interface ShelfDecorPlacement {
  id: string;
  decorType: DecorItemType;
  /** Posição relativa aos livros da prateleira (-1 = início; >= N = final) */
  afterBookIndex: number;
}

export const DEFAULT_SHELF_THEME_CONFIG: ShelfThemeConfig = {
  presetId: "classica",
  material: "nogueira",
  bracketStyle: "classico",
  nicheBackdrop: "creme",
  ledWarm3000K: false,
  topSpotlights: false,
  density: "padrao",
  organizationMode: "cor",
};

export interface ShelfPresetDefinition {
  id: Exclude<ShelfPresetId, "personalizada">;
  label: string;
  subtitle: string;
  swatches: readonly [string, string, string];
  config: Omit<ShelfThemeConfig, "presetId" | "organizationMode">;
}

export const SHELF_PRESETS: readonly ShelfPresetDefinition[] = [
  {
    id: "classica",
    label: "Clássica",
    subtitle: "Nogueira escura, suportes clássicos e nicho creme editorial",
    swatches: ["#3B261C", "#C8A46E", "#F4EFE6"],
    config: {
      material: "nogueira",
      bracketStyle: "classico",
      nicheBackdrop: "creme",
      ledWarm3000K: false,
      topSpotlights: false,
      density: "padrao",
    },
  },
  {
    id: "minimalista",
    label: "Minimalista",
    subtitle: "Grafite fosco com prateleiras flutuantes e linhas limpas",
    swatches: ["#1C1E1C", "#3A3E3A", "#F4EFE6"],
    config: {
      material: "grafite",
      bracketStyle: "flutuante",
      nicheBackdrop: "creme",
      ledWarm3000K: false,
      topSpotlights: false,
      density: "padrao",
    },
  },
  {
    id: "vitrine",
    label: "Vitrine Iluminada",
    subtitle: "Carvalho quente, nicho verde biblioteca, LED 3000K e spots",
    swatches: ["#9C7248", "#1F352B", "#F8CF8E"],
    config: {
      material: "carvalho",
      bracketStyle: "dourado",
      nicheBackdrop: "verde_biblioteca",
      ledWarm3000K: true,
      topSpotlights: true,
      density: "vitrine",
    },
  },
  {
    id: "bordo",
    label: "Editorial Bordô",
    subtitle: "Tábua bordô profundo, filetes dourados e LED indireto",
    swatches: ["#6E1E2A", "#D4AF7A", "#2E151B"],
    config: {
      material: "bordo",
      bracketStyle: "dourado",
      nicheBackdrop: "bordo_profundo",
      ledWarm3000K: true,
      topSpotlights: false,
      density: "padrao",
    },
  },
];

export const SHELF_MATERIAL_V2_OPTIONS: ReadonlyArray<{
  id: ShelfMaterial;
  label: string;
  description: string;
  swatchPrimary: string;
  swatchAccent: string;
}> = [
  {
    id: "nogueira",
    label: "Nogueira",
    description: "Madeira nobre escura de biblioteca clássica",
    swatchPrimary: "#3B261C",
    swatchAccent: "#5C3D2C",
  },
  {
    id: "carvalho",
    label: "Carvalho",
    description: "Madeira clara aquecida com veios suaves",
    swatchPrimary: "#9A7148",
    swatchAccent: "#C29968",
  },
  {
    id: "grafite",
    label: "Grafite",
    description: "Acabamento arquitetônico fosco contemporâneo",
    swatchPrimary: "#1D1F1D",
    swatchAccent: "#3E423E",
  },
  {
    id: "bordo",
    label: "Bordô",
    description: "Madeira envernizada bordô editorial com filete latão",
    swatchPrimary: "#6E1E2A",
    swatchAccent: "#C8A46E",
  },
  {
    id: "pedra",
    label: "Pedra",
    description: "Travertino mineral claro com textura tátil",
    swatchPrimary: "#CFC5B6",
    swatchAccent: "#A89C8B",
  },
];

export const SHELF_BRACKET_OPTIONS: ReadonlyArray<{
  id: BracketStyle;
  label: string;
  description: string;
}> = [
  {
    id: "classico",
    label: "Clássico",
    description: "Mão-francesa discreta em metal escurecido",
  },
  {
    id: "dourado",
    label: "Latão",
    description: "Suportes metálicos em latão acetinado quente",
  },
  {
    id: "flutuante",
    label: "Flutuante",
    description: "Fixação invisível com sombra arquitetônica",
  },
];

export const SHELF_BACKDROP_OPTIONS: ReadonlyArray<{
  id: NicheBackdrop;
  label: string;
  swatch: string;
  isDark: boolean;
}> = [
  { id: "creme", label: "Creme", swatch: "#EDE6D9", isDark: false },
  { id: "madeira", label: "Madeira", swatch: "#5A3E2D", isDark: true },
  {
    id: "verde_biblioteca",
    label: "Verde Biblioteca",
    swatch: "#1F352B",
    isDark: true,
  },
  {
    id: "bordo_profundo",
    label: "Bordô Profundo",
    swatch: "#33161D",
    isDark: true,
  },
  {
    id: "preto_fosco",
    label: "Preto Fosco",
    swatch: "#171717",
    isDark: true,
  },
];

export const SHELF_DENSITY_OPTIONS: ReadonlyArray<{
  id: ShelfDensity;
  label: string;
  gapPx: number;
  description: string;
}> = [
  {
    id: "compacta",
    label: "Compacta",
    gapPx: 1,
    description: "Mais volumes lado a lado, sem folga",
  },
  {
    id: "padrao",
    label: "Padrão",
    gapPx: 3,
    description: "Respiro equilibrado de biblioteca pessoal",
  },
  {
    id: "vitrine",
    label: "Vitrine",
    gapPx: 8,
    description: "Espaçamento amplo para destaques e objetos",
  },
];

export const SHELF_DECOR_OPTIONS: ReadonlyArray<{
  id: DecorItemType;
  label: string;
  shortLabel: string;
  widthPx: number;
  description: string;
}> = [
  {
    id: "planta",
    label: "Planta em Vaso",
    shortLabel: "Planta",
    widthPx: 44,
    description: "Vaso em terracota com folhagem orgânica",
  },
  {
    id: "vela",
    label: "Vela Aromática",
    shortLabel: "Vela",
    widthPx: 34,
    description: "Copo âmbar com chama quente suave",
  },
  {
    id: "ampulheta",
    label: "Ampulheta",
    shortLabel: "Ampulheta",
    widthPx: 36,
    description: "Ampulheta de latão e vidro clássico",
  },
  {
    id: "bookend",
    label: "Aparador",
    shortLabel: "Aparador",
    widthPx: 26,
    description: "Aparador geométrico em bronze e couro",
  },
  {
    id: "xicara",
    label: "Xícara de Café",
    shortLabel: "Xícara",
    widthPx: 40,
    description: "Porcelana artesanal sobre pires",
  },
  {
    id: "busto",
    label: "Busto Clássico",
    shortLabel: "Busto",
    widthPx: 44,
    description: "Escultura em gesso marfim minimalista",
  },
  {
    id: "espacador",
    label: "Espaçador",
    shortLabel: "Respiro",
    widthPx: 38,
    description: "Vão livre para separar coleções na mesma tábua",
  },
];

export const BOOK_DISPLAY_MODE_OPTIONS: ReadonlyArray<{
  id: BookDisplayMode;
  label: string;
  description: string;
}> = [
  {
    id: "lombada",
    label: "Lombada",
    description: "Vertical padrão mostrando a lombada",
  },
  {
    id: "capa_frente",
    label: "Capa de Frente",
    description: "Exibe a capa frontal em destaque de vitrine",
  },
  {
    id: "inclinado",
    label: "Inclinado",
    description: "Apoiado em ângulo editorial suave",
  },
];

export const SHELF_MATERIAL_OPTIONS: ReadonlyArray<{
  id: ShelfMaterialStyle;
  label: string;
  description: string;
  swatchPrimary: string;
  swatchAccent: string;
}> = [
  {
    id: "classic-wood",
    label: "Madeira Clássica",
    description: "Madeira escura nogueira com suportes clássicos",
    swatchPrimary: "#2C221E",
    swatchAccent: "#5C3D2C",
  },
  {
    id: "minimal-modern",
    label: "Minimalista",
    description: "Grafite contemporâneo de linha fina e limpa",
    swatchPrimary: "#141514",
    swatchAccent: "#3A3D3A",
  },
  {
    id: "editorial-bordeaux",
    label: "Editorial Bordô",
    description: "Acabamento bordô editorial com filetes dourados",
    swatchPrimary: "#722F3E",
    swatchAccent: "#C4A77D",
  },
];

export const SHELF_ORGANIZATION_OPTIONS: ReadonlyArray<{
  id: ShelfOrganizationMode;
  label: string;
  description: string;
}> = [
  {
    id: "color",
    label: "Por Cor",
    description: "Bolinhas de paleta editáveis para organizar lombadas por cor",
  },
  {
    id: "genre",
    label: "Por Gênero",
    description: "Prateleiras nomeadas por gênero literário ou coleção",
  },
  {
    id: "custom",
    label: "Livre",
    description: "Nomes livres editáveis e ordem manual personalizada",
  },
];

export function toOrganizationModeV2(
  legacy?: ShelfOrganizationMode | OrganizationMode
): OrganizationMode {
  if (legacy === "cor" || legacy === "color") return "cor";
  if (legacy === "genero" || legacy === "genre") return "genero";
  if (legacy === "livre" || legacy === "custom") return "livre";
  return "cor";
}

export function toLegacyOrganizationMode(
  mode: OrganizationMode
): ShelfOrganizationMode {
  if (mode === "genero") return "genre";
  if (mode === "livre") return "custom";
  return "color";
}

export function toLegacyShelfMaterial(
  material: ShelfMaterial
): ShelfMaterialStyle {
  if (material === "grafite") return "minimal-modern";
  if (material === "bordo") return "editorial-bordeaux";
  return "classic-wood";
}

export function detectMatchingShelfPreset(
  config: Omit<ShelfThemeConfig, "presetId">
): ShelfPresetId {
  for (const preset of SHELF_PRESETS) {
    if (
      preset.config.material === config.material &&
      preset.config.bracketStyle === config.bracketStyle &&
      preset.config.nicheBackdrop === config.nicheBackdrop &&
      preset.config.ledWarm3000K === config.ledWarm3000K &&
      preset.config.topSpotlights === config.topSpotlights &&
      preset.config.density === config.density
    ) {
      return preset.id;
    }
  }
  return "personalizada";
}

export function applyShelfPreset(
  current: ShelfThemeConfig,
  presetId: Exclude<ShelfPresetId, "personalizada">
): ShelfThemeConfig {
  const preset = SHELF_PRESETS.find((p) => p.id === presetId);
  if (!preset) return current;
  return {
    ...current,
    ...preset.config,
    presetId: preset.id,
  };
}

export function patchShelfThemeConfig(
  current: ShelfThemeConfig,
  patch: Partial<Omit<ShelfThemeConfig, "presetId">>
): ShelfThemeConfig {
  const nextBase = {
    material: patch.material ?? current.material,
    bracketStyle: patch.bracketStyle ?? current.bracketStyle,
    nicheBackdrop: patch.nicheBackdrop ?? current.nicheBackdrop,
    ledWarm3000K: patch.ledWarm3000K ?? current.ledWarm3000K,
    topSpotlights: patch.topSpotlights ?? current.topSpotlights,
    density: patch.density ?? current.density,
    organizationMode: patch.organizationMode ?? current.organizationMode,
  };
  return {
    ...nextBase,
    presetId: detectMatchingShelfPreset(nextBase),
  };
}

export function migrateLegacyShelfThemeConfig(params: {
  shelfMaterial?: ShelfMaterialStyle;
  organizationMode?: ShelfOrganizationMode;
}): ShelfThemeConfig {
  const org = toOrganizationModeV2(params.organizationMode);
  if (params.shelfMaterial === "minimal-modern") {
    return applyShelfPreset(
      { ...DEFAULT_SHELF_THEME_CONFIG, organizationMode: org },
      "minimalista"
    );
  }
  if (params.shelfMaterial === "editorial-bordeaux") {
    return applyShelfPreset(
      { ...DEFAULT_SHELF_THEME_CONFIG, organizationMode: org },
      "bordo"
    );
  }
  return {
    ...DEFAULT_SHELF_THEME_CONFIG,
    organizationMode: org,
  };
}

export function getShelfDensityGapPx(density: ShelfDensity): number {
  const found = SHELF_DENSITY_OPTIONS.find((opt) => opt.id === density);
  return found ? found.gapPx : 3;
}

export interface PersistedShelfLayout {
  shelfOrder: string[];
  bookShelfMap: Record<string, string>;
  customShelves: Array<{ key: string; title: string }>;
  shelfMeta: Record<string, ShelfHeaderMeta>;
  customOrderByShelf: Record<string, string[]>;
  featuredCoverIds: string[];
  bookColorOverrides?: Record<string, string>;
  shelfMaterial?: ShelfMaterialStyle;
  organizationMode?: ShelfOrganizationMode;
  themeConfig?: ShelfThemeConfig;
  bookDisplayModes?: Record<string, BookDisplayMode>;
  bookTiltDirections?: Record<string, "left" | "right">;
  shelfDecorByRow?: Record<string, ShelfDecorPlacement[]>;
  customRows?: CustomShelfRow[];
}

export const EMPTY_PERSISTED_SHELF_LAYOUT: PersistedShelfLayout = {
  shelfOrder: [],
  bookShelfMap: {},
  customShelves: [],
  shelfMeta: {},
  customOrderByShelf: {},
  featuredCoverIds: [],
  bookColorOverrides: {},
  shelfMaterial: "classic-wood",
  organizationMode: "color",
  themeConfig: DEFAULT_SHELF_THEME_CONFIG,
  bookDisplayModes: {},
  bookTiltDirections: {},
  shelfDecorByRow: {},
  customRows: [],
};

function parseHexRgb(hex: string): [number, number, number] | null {
  const cleaned = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    return [
      Number.parseInt(cleaned[0]! + cleaned[0]!, 16),
      Number.parseInt(cleaned[1]! + cleaned[1]!, 16),
      Number.parseInt(cleaned[2]! + cleaned[2]!, 16),
    ];
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return [
      Number.parseInt(cleaned.slice(0, 2), 16),
      Number.parseInt(cleaned.slice(2, 4), 16),
      Number.parseInt(cleaned.slice(4, 6), 16),
    ];
  }
  return null;
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const rgb = parseHexRgb(hex) ?? [81, 38, 47];
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return { h: 0, s: 0, l: Math.round(l * 100) };
  }

  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let h = 0;
  if (max === r) {
    h = (g - b) / delta + (g < b ? 6 : 0);
  } else if (max === g) {
    h = (b - r) / delta + 2;
  } else {
    h = (r - g) / delta + 4;
  }
  h /= 6;

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/** Garante contraste AA (>= 4,5:1) escolhendo marfim (#F5F2EB) ou grafite (#1F1B18) conforme luminância. */
export function resolveSpineContrastInk(spineHex: string): string {
  const rgb = parseHexRgb(spineHex) ?? [44, 34, 30];
  const toLinear = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum =
    0.2126 * toLinear(rgb[0]) +
    0.7152 * toLinear(rgb[1]) +
    0.0722 * toLinear(rgb[2]);
  return lum > 0.34 ? "#1F1B18" : "#F5F2EB";
}

/**
 * Calcula dimensões orgânicas para o modo "Arrumar Estante":
 * - Lombadas: largura entre 22px e 48px proporcional às páginas
 * - Capa em destaque: largura entre 68px e 84px (76px)
 * - Altura orgânica entre 125px e 152px com variação natural de 4px–18px entre vizinhos
 */
export function computeArrangeBookDimensions(params: {
  pages?: number | null;
  seed: string;
  format?: string | null;
  featuredCover?: boolean;
}): {
  widthPx: number;
  heightPx: number;
} {
  const format = normalizeRealisticBookFormat(params.format);
  const safePages =
    typeof params.pages === "number" &&
    Number.isFinite(params.pages) &&
    params.pages > 0
      ? Math.max(60, params.pages)
      : 220;

  const baseHeightByFormat: Record<string, number> = {
    capa_dura: 144,
    brochura: 136,
    bolso: 129,
    ebook: 135,
    audio: 133,
  };

  const hHash = hashCoverSeed(`${params.seed}:arrange-height`);
  const delta = (hHash % 17) - 8; // [-8, +8] => variação até 16px
  const baseH = baseHeightByFormat[format] ?? 136;
  const heightPx = Math.max(125, Math.min(152, Math.round(baseH + delta)));

  if (params.featuredCover) {
    return { widthPx: 76, heightPx };
  }

  const widthPx = Math.round(
    Math.max(22, Math.min(48, 18 + safePages * 0.055))
  );
  return { widthPx, heightPx };
}

/**
 * Ordena livros por harmonia cromática da cor predominante/lombada:
 * 1. Escuros/acromáticos profundos (l < 20)
 * 2. Cores cromáticas ordenadas por matiz (vermelho -> laranja -> amarelo -> verde -> azul -> roxo)
 * 3. Claros/acromáticos suaves no fim (l >= 78 ou baixa saturação clara)
 */
export function sortBooksByColorHue<
  T extends { id: string | number; spineColor?: string | null },
>(books: readonly T[], resolveColor: (book: T) => string): T[] {
  return [...books].sort((a, b) => {
    const hslA = hexToHsl(resolveColor(a));
    const hslB = hexToHsl(resolveColor(b));

    const band = (hsl: { h: number; s: number; l: number }) => {
      if (hsl.l <= 22) return 0; // Pretos / tons profundos
      if (hsl.l >= 86 || (hsl.s < 16 && hsl.l >= 72)) return 2; // Brancos / cremes
      if (hsl.s < 14) return 0; // Cinzas neutros agrupados aos escuros
      return 1; // Espectro cromático por matiz
    };

    const bandA = band(hslA);
    const bandB = band(hslB);
    if (bandA !== bandB) return bandA - bandB;

    if (bandA === 1) {
      if (hslA.h !== hslB.h) return hslA.h - hslB.h;
      return hslA.l - hslB.l;
    }

    return hslA.l - hslB.l;
  });
}

/**
 * Extrai até `maxDots` cores representativas distintas dos livros de uma prateleira
 * para compor as bolinhas glossy da barra esquerda.
 */
export function extractPredominantDotColors<T>(
  books: readonly T[],
  resolveColor: (book: T) => string,
  maxDots = 4
): string[] {
  const picked: string[] = [];
  const pickedHsls: Array<{ h: number; s: number; l: number }> = [];

  for (const book of books) {
    const hex = resolveColor(book);
    const hsl = hexToHsl(hex);
    const isTooClose = pickedHsls.some((existing) => {
      const dh = Math.min(
        Math.abs(existing.h - hsl.h),
        360 - Math.abs(existing.h - hsl.h)
      );
      const dl = Math.abs(existing.l - hsl.l);
      return dh < 24 && dl < 18;
    });
    if (!isTooClose) {
      picked.push(hex);
      pickedHsls.push(hsl);
    }
    if (picked.length >= maxDots) break;
  }

  if (picked.length === 0) {
    return ["#1E1D1B", "#2D4F3E"];
  }
  return picked;
}

/** Gera micro-espaçamento orgânico (4px–14px) entre agrupamentos naturais na prateleira. */
export function computeNaturalClusterGapPx(
  book: VirtualBookItem,
  index: number
): number {
  if (index === 0) return 0;
  const seed = String(book.seed ?? book.id ?? book.title);
  const hash = hashCoverSeed(`${seed}:gap:${index}`);
  if (hash % 3 === 0) {
    return 8 + (hash % 7); // 8px..14px vão natural de prateleira parcial
  }
  return 4;
}

export function buildCompactSpineMeta(book: VirtualBookItem): {
  title: string;
  authorSurname: string;
  monogram: string;
} {
  const cleanTitle = book.title.trim() || "Livro";
  const surname = extractAuthorSurname(book.author);
  const pubRaw = (book.publisher ?? "RF").trim();
  const monogram =
    pubRaw
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "RF";

  return {
    title: cleanTitle,
    authorSurname: surname,
    monogram,
  };
}

export function normalizeShelfKey(title: string): string {
  const slug = normalizeSearchText(title)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `prateleira-${Date.now().toString(36)}`;
}

const VALID_MATERIALS = new Set<ShelfMaterial>([
  "nogueira",
  "carvalho",
  "grafite",
  "bordo",
  "pedra",
]);
const VALID_BRACKETS = new Set<BracketStyle>([
  "classico",
  "dourado",
  "flutuante",
]);
const VALID_BACKDROPS = new Set<NicheBackdrop>([
  "creme",
  "madeira",
  "verde_biblioteca",
  "bordo_profundo",
  "preto_fosco",
]);
const VALID_DENSITIES = new Set<ShelfDensity>([
  "compacta",
  "padrao",
  "vitrine",
]);
const VALID_ORG_MODES = new Set<OrganizationMode>(["cor", "genero", "livre"]);
const VALID_BOOK_MODES = new Set<BookDisplayMode>([
  "lombada",
  "capa_frente",
  "inclinado",
]);
const VALID_DECOR_TYPES = new Set<DecorItemType>([
  "planta",
  "vela",
  "ampulheta",
  "bookend",
  "xicara",
  "busto",
  "espacador",
]);

function parseThemeConfig(
  rawTheme: unknown,
  legacyMaterial: ShelfMaterialStyle,
  legacyOrg: ShelfOrganizationMode
): ShelfThemeConfig {
  if (!rawTheme || typeof rawTheme !== "object") {
    return migrateLegacyShelfThemeConfig({
      shelfMaterial: legacyMaterial,
      organizationMode: legacyOrg,
    });
  }
  const obj = rawTheme as Partial<ShelfThemeConfig>;
  const material =
    obj.material && VALID_MATERIALS.has(obj.material)
      ? obj.material
      : DEFAULT_SHELF_THEME_CONFIG.material;
  const bracketStyle =
    obj.bracketStyle && VALID_BRACKETS.has(obj.bracketStyle)
      ? obj.bracketStyle
      : DEFAULT_SHELF_THEME_CONFIG.bracketStyle;
  const nicheBackdrop =
    obj.nicheBackdrop && VALID_BACKDROPS.has(obj.nicheBackdrop)
      ? obj.nicheBackdrop
      : DEFAULT_SHELF_THEME_CONFIG.nicheBackdrop;
  const density =
    obj.density && VALID_DENSITIES.has(obj.density)
      ? obj.density
      : DEFAULT_SHELF_THEME_CONFIG.density;
  const organizationMode =
    obj.organizationMode && VALID_ORG_MODES.has(obj.organizationMode)
      ? obj.organizationMode
      : toOrganizationModeV2(legacyOrg);
  const ledWarm3000K = Boolean(obj.ledWarm3000K);
  const topSpotlights = Boolean(obj.topSpotlights);

  const base = {
    material,
    bracketStyle,
    nicheBackdrop,
    ledWarm3000K,
    topSpotlights,
    density,
    organizationMode,
  };
  return {
    ...base,
    presetId: detectMatchingShelfPreset(base),
  };
}

function parseBookDisplayModes(
  raw: unknown,
  featuredCoverIds: readonly string[]
): Record<string, BookDisplayMode> {
  const result: Record<string, BookDisplayMode> = {};
  for (const id of featuredCoverIds) {
    result[String(id)] = "capa_frente";
  }
  if (raw && typeof raw === "object") {
    for (const [bookId, mode] of Object.entries(
      raw as Record<string, unknown>
    )) {
      if (
        typeof mode === "string" &&
        VALID_BOOK_MODES.has(mode as BookDisplayMode)
      ) {
        result[bookId] = mode as BookDisplayMode;
      }
    }
  }
  return result;
}

function parseBookTiltDirections(
  raw: unknown
): Record<string, "left" | "right"> {
  const result: Record<string, "left" | "right"> = {};
  if (raw && typeof raw === "object") {
    for (const [bookId, dir] of Object.entries(
      raw as Record<string, unknown>
    )) {
      if (dir === "left" || dir === "right") {
        result[bookId] = dir;
      }
    }
  }
  return result;
}

function parseShelfDecorByRow(
  raw: unknown
): Record<string, ShelfDecorPlacement[]> {
  const result: Record<string, ShelfDecorPlacement[]> = {};
  if (!raw || typeof raw !== "object") return result;

  for (const [shelfKey, list] of Object.entries(
    raw as Record<string, unknown>
  )) {
    if (!Array.isArray(list)) continue;
    const valid: ShelfDecorPlacement[] = [];
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const obj = item as Partial<ShelfDecorPlacement>;
      if (
        typeof obj.id === "string" &&
        obj.id.length > 0 &&
        typeof obj.decorType === "string" &&
        VALID_DECOR_TYPES.has(obj.decorType as DecorItemType)
      ) {
        valid.push({
          id: obj.id,
          decorType: obj.decorType as DecorItemType,
          afterBookIndex:
            typeof obj.afterBookIndex === "number" &&
            Number.isFinite(obj.afterBookIndex)
              ? Math.floor(obj.afterBookIndex)
              : 999,
        });
      }
    }
    if (valid.length > 0) {
      result[shelfKey] = valid;
    }
  }
  return result;
}

/** Constrói a lista canônica de CustomShelfRow a partir de prateleiras, modos e decorações. */
export function buildCustomShelfRows(params: {
  shelves: ReadonlyArray<{
    key: string;
    title: string;
    bookIds: readonly string[];
  }>;
  bookDisplayModes?: Record<string, BookDisplayMode>;
  bookTiltDirections?: Record<string, "left" | "right">;
  bookColorOverrides?: Record<string, string>;
  shelfDecorByRow?: Record<string, ShelfDecorPlacement[]>;
}): CustomShelfRow[] {
  const displayModes = params.bookDisplayModes ?? {};
  const tiltDirections = params.bookTiltDirections ?? {};
  const colorOverrides = params.bookColorOverrides ?? {};
  const decorByRow = params.shelfDecorByRow ?? {};

  return params.shelves.map((shelf) => {
    const items: ShelfSlotItem[] = [];
    const decorList = decorByRow[shelf.key] ?? [];

    for (const d of decorList) {
      if (d.afterBookIndex < 0) {
        items.push({ kind: "decor", id: d.id, decorType: d.decorType });
      }
    }

    shelf.bookIds.forEach((bookId, idx) => {
      const displayMode = displayModes[bookId] ?? "lombada";
      items.push({
        kind: "book",
        id: `book:${bookId}`,
        bookId,
        displayMode,
        tiltDirection:
          displayMode === "inclinado"
            ? (tiltDirections[bookId] ?? "right")
            : undefined,
        customSpineColor: colorOverrides[bookId] ?? null,
      });

      for (const d of decorList) {
        if (d.afterBookIndex === idx) {
          items.push({ kind: "decor", id: d.id, decorType: d.decorType });
        }
      }
    });

    for (const d of decorList) {
      if (d.afterBookIndex >= shelf.bookIds.length) {
        items.push({ kind: "decor", id: d.id, decorType: d.decorType });
      }
    }

    return {
      id: shelf.key,
      title: shelf.title,
      items,
    };
  });
}

/**
 * Garante invariantes de integridade da arrumação da Estante 3D (mesmo sob edições concorrentes):
 * - Chaves de prateleira em `shelfOrder` e `customShelves` são únicas.
 * - Nenhum livro pode aparecer em duas prateleiras simultaneamente em `customOrderByShelf` ou `customRows`.
 * - Se `bookShelfMap[bookId]` aponta para `shelfKey`, o livro só pode residir na lista ordenada de `shelfKey`.
 */
export function reconcileShelfLayoutIntegrity(
  layout: PersistedShelfLayout
): PersistedShelfLayout {
  const uniqueShelfOrder = Array.from(
    new Set(
      layout.shelfOrder.filter((k) => typeof k === "string" && k.length > 0)
    )
  );

  const seenCustomShelfKeys = new Set<string>();
  const uniqueCustomShelves: Array<{ key: string; title: string }> = [];
  for (const s of layout.customShelves) {
    if (
      !s ||
      typeof s.key !== "string" ||
      !s.key ||
      seenCustomShelfKeys.has(s.key)
    ) {
      continue;
    }
    seenCustomShelfKeys.add(s.key);
    uniqueCustomShelves.push({
      key: s.key,
      title:
        typeof s.title === "string" && s.title.trim() ? s.title.trim() : s.key,
    });
  }

  const bookShelfMap: Record<string, string> = {};
  for (const [bookId, shelfKey] of Object.entries(layout.bookShelfMap ?? {})) {
    if (
      typeof bookId === "string" &&
      bookId &&
      typeof shelfKey === "string" &&
      shelfKey
    ) {
      bookShelfMap[bookId] = shelfKey;
    }
  }

  const claimedBooks = new Set<string>();
  const reconciledOrderByShelf: Record<string, string[]> = {};

  for (const [shelfKey, rawIds] of Object.entries(
    layout.customOrderByShelf ?? {}
  )) {
    if (!Array.isArray(rawIds)) continue;
    const cleanIds: string[] = [];
    for (const rawId of rawIds) {
      const bookId = String(rawId);
      if (!bookId || claimedBooks.has(bookId)) continue;
      const mappedShelf = bookShelfMap[bookId];
      if (mappedShelf && mappedShelf !== shelfKey) {
        continue;
      }
      claimedBooks.add(bookId);
      cleanIds.push(bookId);
    }
    reconciledOrderByShelf[shelfKey] = cleanIds;
  }

  // Garante que todo livro mapeado em bookShelfMap para uma prateleira com ordem customizada esteja presente nela
  for (const [bookId, targetShelfKey] of Object.entries(bookShelfMap)) {
    if (!claimedBooks.has(bookId) && reconciledOrderByShelf[targetShelfKey]) {
      reconciledOrderByShelf[targetShelfKey]!.push(bookId);
      claimedBooks.add(bookId);
    }
  }

  let reconciledCustomRows = layout.customRows;
  if (Array.isArray(layout.customRows) && layout.customRows.length > 0) {
    const claimedInRows = new Set<string>();
    reconciledCustomRows = layout.customRows.map((row) => ({
      ...row,
      items: Array.isArray(row.items)
        ? row.items.filter((slot) => {
            if (slot.kind !== "book") return true;
            const mappedShelf = bookShelfMap[slot.bookId];
            if (mappedShelf && mappedShelf !== row.id) return false;
            if (claimedInRows.has(slot.bookId)) return false;
            claimedInRows.add(slot.bookId);
            return true;
          })
        : [],
    }));
  }

  return {
    ...layout,
    shelfOrder: uniqueShelfOrder,
    customShelves: uniqueCustomShelves,
    bookShelfMap,
    customOrderByShelf: reconciledOrderByShelf,
    featuredCoverIds: Array.from(new Set(layout.featuredCoverIds ?? [])),
    customRows: reconciledCustomRows,
  };
}

// Re-export compatível para leituras de estado compartilhado entre rotas
export function parsePersistedShelfLayout(
  raw: string | null
): PersistedShelfLayout {
  if (!raw) return EMPTY_PERSISTED_SHELF_LAYOUT;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedShelfLayout>;
    const legacyMaterial: ShelfMaterialStyle =
      parsed.shelfMaterial === "classic-wood" ||
      parsed.shelfMaterial === "minimal-modern" ||
      parsed.shelfMaterial === "editorial-bordeaux"
        ? parsed.shelfMaterial
        : "classic-wood";
    const legacyOrg: ShelfOrganizationMode =
      parsed.organizationMode === "color" ||
      parsed.organizationMode === "genre" ||
      parsed.organizationMode === "custom"
        ? parsed.organizationMode
        : "color";
    const featuredCoverIds = Array.isArray(parsed.featuredCoverIds)
      ? parsed.featuredCoverIds
      : [];
    const themeConfig = parseThemeConfig(
      parsed.themeConfig,
      legacyMaterial,
      legacyOrg
    );
    return reconcileShelfLayoutIntegrity({
      shelfOrder: Array.isArray(parsed.shelfOrder) ? parsed.shelfOrder : [],
      bookShelfMap:
        parsed.bookShelfMap && typeof parsed.bookShelfMap === "object"
          ? parsed.bookShelfMap
          : {},
      customShelves: Array.isArray(parsed.customShelves)
        ? parsed.customShelves
        : [],
      shelfMeta:
        parsed.shelfMeta && typeof parsed.shelfMeta === "object"
          ? parsed.shelfMeta
          : {},
      customOrderByShelf:
        parsed.customOrderByShelf &&
        typeof parsed.customOrderByShelf === "object"
          ? parsed.customOrderByShelf
          : {},
      featuredCoverIds,
      bookColorOverrides:
        parsed.bookColorOverrides &&
        typeof parsed.bookColorOverrides === "object"
          ? parsed.bookColorOverrides
          : {},
      shelfMaterial: toLegacyShelfMaterial(themeConfig.material),
      organizationMode: toLegacyOrganizationMode(themeConfig.organizationMode),
      themeConfig,
      bookDisplayModes: parseBookDisplayModes(
        parsed.bookDisplayModes,
        featuredCoverIds
      ),
      bookTiltDirections: parseBookTiltDirections(parsed.bookTiltDirections),
      shelfDecorByRow: parseShelfDecorByRow(parsed.shelfDecorByRow),
      customRows: Array.isArray(parsed.customRows) ? parsed.customRows : [],
    });
  } catch {
    return EMPTY_PERSISTED_SHELF_LAYOUT;
  }
}
