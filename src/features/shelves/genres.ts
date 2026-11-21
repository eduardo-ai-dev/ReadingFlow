import type { Book3DItem } from "@/components/Book3D";
import { normalizeSearchText } from "@/features/catalog/rules";
import { COVER_TONES } from "@/lib/cover-color";

export interface LiteraryGenreShelfDef extends Book3DItem {
  canonicalGenre: string;
  keywords: string[];
  headline: string;
}

/**
 * Lombadas 3D derivadas dos tons dessaturados da paleta Bordô Editorial
 * via `color-mix`, sem repetir cor em volumes vizinhos e com contraste >= 6,8:1.
 */
export const LITERARY_GENRE_VOLUMES: readonly LiteraryGenreShelfDef[] = [
  {
    id: "genre-terror",
    slug: "terror",
    num: "01",
    title: "Terror & Gótico",
    sub: "Horror",
    canonicalGenre: "Terror",
    keywords: ["terror", "horror", "gotico", "sobrenatural", "macabro"],
    width: 48,
    height: 238,
    color: COVER_TONES[0]!.hex,
    textColor: "#F4EFE6",
    headline:
      "Contos macabros, romance gótico, horror psicológico e sobrenatural.",
  },
  {
    id: "genre-classicos",
    slug: "classicos",
    num: "02",
    title: "Clássicos",
    sub: "Cânone",
    canonicalGenre: "Clássico Brasileiro",
    keywords: ["classico", "classicos", "canonico", "universal"],
    width: 52,
    height: 248,
    color: COVER_TONES[1]!.hex,
    textColor: "#F4EFE6",
    headline: "Obras fundamentais da literatura brasileira e universal.",
  },
  {
    id: "genre-contemporanea",
    slug: "ficcao-contemporanea",
    num: "03",
    title: "Ficção Atual",
    sub: "Século XXI",
    canonicalGenre: "Ficção Contemporânea",
    keywords: [
      "contemporanea",
      "contemporaneo",
      "atual",
      "ficcao contemporanea",
    ],
    width: 48,
    height: 228,
    color: COVER_TONES[4]!.hex,
    textColor: "#F4EFE6",
    headline: "Romances e narrativas contemporâneas premiadas.",
  },
  {
    id: "genre-brasiliana",
    slug: "literatura-brasileira",
    num: "04",
    title: "Brasiliana",
    sub: "Prosa",
    canonicalGenre: "Literatura Brasileira",
    keywords: [
      "literatura brasileira",
      "brasileira",
      "modernismo",
      "regionalismo",
    ],
    width: 46,
    height: 234,
    color: COVER_TONES[2]!.hex,
    textColor: "#F4EFE6",
    headline: "Vozes essenciais da prosa, crônica e poesia do Brasil.",
  },
  {
    id: "genre-memorias",
    slug: "memorias",
    num: "05",
    title: "Memórias",
    sub: "Diários",
    canonicalGenre: "Memórias e Diários",
    keywords: ["memorias", "diario", "diarios", "biografia", "autobiografia"],
    width: 46,
    height: 220,
    color: COVER_TONES[3]!.hex,
    textColor: "#F4EFE6",
    headline: "Diários reais, relatos biográficos, cartas e testemunhos.",
  },
  {
    id: "genre-fantasia",
    slug: "fantasia-scifi",
    num: "06",
    title: "Fantasia & Sci-Fi",
    sub: "Especulativa",
    canonicalGenre: "Fantasia & Ficção Científica",
    keywords: [
      "fantasia",
      "ficcao cientifica",
      "scifi",
      "sci fi",
      "distopia",
      "utopia",
    ],
    width: 50,
    height: 242,
    color: COVER_TONES[6]!.hex,
    textColor: "#F4EFE6",
    headline: "Mundos imaginados, ficção especulativa e distopias.",
  },
  {
    id: "genre-misterio",
    slug: "misterio",
    num: "07",
    title: "Mistério",
    sub: "Policial",
    canonicalGenre: "Mistério & Policial",
    keywords: ["misterio", "policial", "suspense", "thriller", "investigacao"],
    width: 46,
    height: 226,
    color: COVER_TONES[5]!.hex,
    textColor: "#F4EFE6",
    headline: "Romances policiais, enigmas clássicos e suspense investigativo.",
  },
];

export function findGenreVolumeBySlug(
  slug: string
): LiteraryGenreShelfDef | undefined {
  return LITERARY_GENRE_VOLUMES.find((g) => g.slug === slug);
}

export function doesWorkMatchGenreVolume(
  primaryGenre: string | undefined,
  volume: LiteraryGenreShelfDef
): boolean {
  if (!primaryGenre) return false;
  const norm = normalizeSearchText(primaryGenre);
  if (!norm) return false;
  if (norm === normalizeSearchText(volume.canonicalGenre)) return true;
  if (norm === normalizeSearchText(volume.title)) return true;
  return volume.keywords.some((kw) => norm.includes(normalizeSearchText(kw)));
}

export const UNIFIED_GENRE_NAMES: readonly string[] = LITERARY_GENRE_VOLUMES.map(
  (v) => v.canonicalGenre
);

/**
 * Resolve qualquer rótulo de gênero informado para a taxonomia unificada do ReadingFlow,
 * garantindo correspondência entre /estante-3d, /estantes, /explorar e /generos/[slug].
 */
export function resolveCanonicalGenre(rawGenre?: string | null): {
  key: string;
  label: string;
  slug?: string;
} {
  const trimmed = rawGenre?.trim() ?? "";
  if (!trimmed) {
    return { key: "acervo-geral", label: "Acervo Geral" };
  }

  for (const vol of LITERARY_GENRE_VOLUMES) {
    if (doesWorkMatchGenreVolume(trimmed, vol)) {
      return {
        key: vol.slug,
        label: vol.canonicalGenre,
        slug: vol.slug,
      };
    }
  }

  return {
    key: normalizeSearchText(trimmed) || "acervo-geral",
    label: trimmed,
  };
}
