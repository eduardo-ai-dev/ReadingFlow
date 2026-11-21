import { coverColor } from "@/lib/cover-color";

export type LandingPreviewTab = "physical" | "digital" | "audio";

export interface LandingExampleBook {
  id: string;
  title: string;
  author: string;
  format: string;
  detail: string;
  status: "Lendo agora" | "Concluído";
  /** Caminho estático em public/landing/covers/ (se ausente, BookCover gera capa editorial). */
  coverUrl?: string;
  coverWidth?: number;
  coverHeight?: number;
  /** Nota de licenciamento/origem dos arquivos estáticos (obras e capas em domínio público). */
  coverLicenseNote?: string;
  spineColor: string;
  seed: string;
  currentPage?: number;
  totalPages?: number;
}

const SPINE_COLOR_1 = coverColor("landing-dom-casmurro-1899");
const SPINE_COLOR_2 = coverColor("landing-bras-cubas-1881", SPINE_COLOR_1);
const SPINE_COLOR_3 = coverColor("landing-iracema-1865", SPINE_COLOR_2);

/**
 * Livros de demonstração 100% estáticos para a prévia da landing page.
 * Zero consultas à API ou banco de dados.
 *
 * Licenciamento das capas físicas:
 * Obras clássicas brasileiras e primeiras edições históricas em Domínio Público
 * obtidas do Wikimedia Commons e otimizadas localmente em WebP (128x192, <= 3 KB cada).
 */
export const LANDING_PREVIEW_SHELVES: Record<
  LandingPreviewTab,
  readonly LandingExampleBook[]
> = {
  physical: [
    {
      id: "landing-dom-casmurro",
      title: "Dom Casmurro",
      author: "Machado de Assis",
      format: "Capa dura · 400 pág.",
      detail: "Pág. 184 de 400 (46%)",
      status: "Lendo agora",
      coverUrl: "/landing/covers/dom-casmurro.webp",
      coverWidth: 128,
      coverHeight: 192,
      coverLicenseNote: "1ª edição (1899) · Domínio Público · Wikimedia Commons",
      spineColor: SPINE_COLOR_1,
      seed: "landing-dom-casmurro-1899",
      currentPage: 184,
      totalPages: 400,
    },
    {
      id: "landing-bras-cubas",
      title: "Memórias Póstumas de Brás Cubas",
      author: "Machado de Assis",
      format: "Brochura · 320 pág.",
      detail: "Concluído · 5,0 ★",
      status: "Concluído",
      coverUrl: "/landing/covers/memorias-postumas-bras-cubas.webp",
      coverWidth: 128,
      coverHeight: 192,
      coverLicenseNote: "1ª edição (1881) · Domínio Público · Wikimedia Commons",
      spineColor: SPINE_COLOR_2,
      seed: "landing-bras-cubas-1881",
    },
    {
      id: "landing-iracema",
      title: "Iracema",
      author: "José de Alencar",
      format: "Capa dura · 160 pág.",
      detail: "Concluído · 4,5 ★",
      status: "Concluído",
      coverUrl: "/landing/covers/iracema.webp",
      coverWidth: 128,
      coverHeight: 192,
      coverLicenseNote: "1ª edição (1865) · Domínio Público · Wikimedia Commons",
      spineColor: SPINE_COLOR_3,
      seed: "landing-iracema-1865",
    },
  ],
  digital: [
    {
      id: "landing-o-cortico",
      title: "O Cortiço",
      author: "Aluísio Azevedo",
      format: "E-book · 280 pág.",
      detail: "100% lido · 5,0 ★",
      status: "Concluído",
      spineColor: coverColor("landing-o-cortico-1890"),
      seed: "landing-o-cortico-1890",
    },
  ],
  audio: [
    {
      id: "landing-quincas-borba",
      title: "Quincas Borba",
      author: "Machado de Assis · Narração integral",
      format: "Audiobook · 6,0 h",
      detail: "Obra: 4,5 ★ · Narração: 5,0 ★",
      status: "Concluído",
      spineColor: coverColor("landing-quincas-borba-1891"),
      seed: "landing-quincas-borba-1891",
    },
  ],
};

export const LANDING_PREVIEW_METRICS = {
  baseCurrentPage: 184,
  totalBookPages: 400,
  /** Memórias Póstumas (320) + Iracema (160) */
  completedPrintedPages: 480,
  /** O Cortiço (280) */
  digitalPages: 280,
  /** Quincas Borba (6,0 h) */
  audioHours: "6,0 h",
  completedBooksInitial: 4,
  goalBooksTarget: 6,
  dailyPaceLabel: "28 págs/dia",
} as const;
