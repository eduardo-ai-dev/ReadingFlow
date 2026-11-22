import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isDemoSessionAllowed } from "@/lib/auth-demo";
import type {
  Edition,
  ImportJob,
  LibraryItem,
  Reading,
  ReadingGoal,
  Review,
  Shelf,
  UploadedCoverRecord,
  UserProfile,
  UserSettings,
  WishlistItem,
  Work,
} from "@/lib/domain";
import { computeWorkFingerprint } from "@/features/catalog/rules";
import { parseCoverDataUrl } from "@/features/catalog/cover-rules";
import {
  clampPaperHsl,
  deriveSpineAccentHex,
} from "@/features/catalog/spine-color-rules";
import { DEFAULT_AMBIENT_PREFERENCES } from "@/features/reading/ambient-catalog";
import { EMPTY_PERSISTED_SHELF_LAYOUT } from "@/features/shelves/arrange-shelves";
import {
  DEFAULT_DENSITY,
  DEFAULT_FX,
  DEFAULT_MOTION,
  DEFAULT_THEME_ID,
} from "@/lib/themes/themes.config";
import { formatDateInTimezone, shiftYmdDays } from "@/lib/dates";
import { createLiveCatalogPipeline } from "@/server/catalog/providers";
import { ormSeedWorkspace } from "@/server/db/orm-repository";
import { hashPassword } from "@/server/security/password";

export const SESSION_COOKIE_NAME = "rf_session_id";
export const DEMO_SESSION_COOKIE_NAME = "rf_demo_session";
export const DEMO_USER_ID = "user-demo-acervo";

export interface UserWorkspaceData {
  profile: UserProfile;
  passwordHashSim: string;
  /** Indica se o e-mail da conta já foi confirmado (false aciona reenvio silencioso no login sem revelar estado). */
  emailConfirmed?: boolean;
  works: Work[];
  editions: Edition[];
  shelves: Shelf[];
  items: LibraryItem[];
  wishlist: WishlistItem[];
  readings: Reading[];
  reviews: Review[];
  goals: ReadingGoal[];
  importJobs: ImportJob[];
  /** Preferências persistidas por conta (`user_settings`: tema, arrumação 3D, sons ambiente, foco). */
  settings?: UserSettings;
  /** Armazenamento privado de uploads de capa restrito ao dono (`{userId}/{editionId}/{fileName}`). */
  uploadedCovers?: Record<string, UploadedCoverRecord>;
  lastUndoAction?: {
    id: string;
    label: string;
    createdAtMs: number;
    restoreSnapshot: Omit<UserWorkspaceData, "lastUndoAction">;
  };
}

export interface PasswordResetTokenRecord {
  userId: string;
  expiresAtMs: number;
}

interface GlobalStoreShape {
  usersById: Map<string, UserWorkspaceData>;
  userIdByEmail: Map<string, string>;
  sessions: Map<string, string>; // sessionToken -> userId
  sessionCreatedAt: Map<string, number>; // sessionToken -> epoch ms (para validar sessão recente na troca de senha)
  passwordResetTokens: Map<string, PasswordResetTokenRecord>; // legado (novos tokens usam auth_secrets com Argon2id)
}

declare global {
  var __readingFlowMemoryStore: GlobalStoreShape | undefined;
}

export function createDefaultShelves(userId: string): Shelf[] {
  return [
    {
      id: `shelf-phys-${userId}`,
      userId,
      name: "Estante Física",
      kind: "physical",
      sortMode: "manual",
      position: 0,
    },
    {
      id: `shelf-dig-${userId}`,
      userId,
      name: "Estante Digital",
      kind: "digital",
      sortMode: "manual",
      position: 1,
    },
    {
      id: `shelf-aud-${userId}`,
      userId,
      name: "Audiobooks",
      kind: "audio",
      sortMode: "manual",
      position: 2,
    },
  ];
}

function buildDemoWorkspace(): UserWorkspaceData {
  const userId = DEMO_USER_ID;
  const shelves = createDefaultShelves(userId);
  const physShelfId = shelves[0]!.id;
  const digShelfId = shelves[1]!.id;
  const audShelfId = shelves[2]!.id;

  const todayYmd = formatDateInTimezone(new Date(), "America/Sao_Paulo");
  const currentYearMonth = todayYmd.slice(0, 7);
  const demoDailyPageSlices = [28, 32, 30, 36, 28, 34, 30, 30] as const; // Soma = 248 páginas
  const demoDailyLogs = demoDailyPageSlices.map((pages, idx) => ({
    ymd: shiftYmdDays(todayYmd, -(demoDailyPageSlices.length - 1 - idx)),
    pages,
  }));

  const works: Work[] = [
    {
      id: "work-dom-casmurro",
      ownerId: null,
      title: "Dom Casmurro",
      firstPublishedYear: 1899,
      primaryGenre: "Clássico Brasileiro",
      description:
        "Bento Santiago reconstitui da velhice a juventude no Rio de Janeiro imperial, a amizade com Escobar e o casamento com Capitu.",
      contributors: [{ name: "Machado de Assis", role: "author" }],
      fingerprint: computeWorkFingerprint(
        "Dom Casmurro",
        "Machado de Assis",
        "pt-BR"
      ),
      source: "brasilapi",
      createdAt: "2026-01-10T12:00:00.000Z",
    },
    {
      id: "work-torto-arado",
      ownerId: null,
      title: "Torto Arado",
      firstPublishedYear: 2019,
      primaryGenre: "Ficção Contemporânea",
      description:
        "No sertão da Chapada Diamantina, as irmãs Bibiana e Belonísia têm suas vidas marcadas por um acidente de infância e pela luta pela terra.",
      contributors: [{ name: "Itamar Vieira Junior", role: "author" }],
      fingerprint: computeWorkFingerprint(
        "Torto Arado",
        "Itamar Vieira Junior",
        "pt-BR"
      ),
      source: "brasilapi",
      createdAt: "2026-02-05T12:00:00.000Z",
    },
    {
      id: "work-hora-estrela",
      ownerId: null,
      title: "A Hora da Estrela",
      firstPublishedYear: 1977,
      primaryGenre: "Literatura Brasileira",
      description:
        "Rodrigo S.M. narra a vida silenciosa da datilógrafa alagoana Macabéa no Rio de Janeiro.",
      contributors: [{ name: "Clarice Lispector", role: "author" }],
      fingerprint: computeWorkFingerprint(
        "A Hora da Estrela",
        "Clarice Lispector",
        "pt-BR"
      ),
      source: "brasilapi",
      createdAt: "2026-03-12T12:00:00.000Z",
    },
    {
      id: "work-grande-sertao",
      ownerId: null,
      title: "Grande Sertão: Veredas",
      firstPublishedYear: 1956,
      primaryGenre: "Clássico Brasileiro",
      description:
        "Riobaldo revisita a travessia pelo sertão mineiro, os bandos de jagunços e o afeto enigmático por Diadorim.",
      contributors: [{ name: "João Guimarães Rosa", role: "author" }],
      fingerprint: computeWorkFingerprint(
        "Grande Sertão: Veredas",
        "João Guimarães Rosa",
        "pt-BR"
      ),
      source: "brasilapi",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
    {
      id: "work-avesso-pele",
      ownerId: null,
      title: "O Avesso da Pele",
      firstPublishedYear: 2020,
      primaryGenre: "Ficção Contemporânea",
      description:
        "Pedro reconstrói a trajetória do pai, Henrique, professor de escola pública em Porto Alegre.",
      contributors: [{ name: "Jeferson Tenório", role: "author" }],
      fingerprint: computeWorkFingerprint(
        "O Avesso da Pele",
        "Jeferson Tenório",
        "pt-BR"
      ),
      source: "brasilapi",
      createdAt: "2026-05-15T12:00:00.000Z",
    },
    {
      id: "work-quarto-despejo",
      ownerId: null,
      title: "Quarto de Despejo: Diário de uma Favelada",
      firstPublishedYear: 1960,
      primaryGenre: "Memórias e Diários",
      description:
        "Diários reais escritos por Carolina Maria de Jesus no Canindé, em São Paulo, entre 1955 e 1960.",
      contributors: [{ name: "Carolina Maria de Jesus", role: "author" }],
      fingerprint: computeWorkFingerprint(
        "Quarto de Despejo: Diário de uma Favelada",
        "Carolina Maria de Jesus",
        "pt-BR"
      ),
      source: "brasilapi",
      createdAt: "2026-06-20T12:00:00.000Z",
    },
    {
      id: "work-noite-na-taverna",
      ownerId: null,
      title: "Noite na Taverna",
      firstPublishedYear: 1855,
      primaryGenre: "Terror",
      description:
        "Contos góticos e macabros narrados ao redor de uma mesa de taverna por cinco jovens boêmios.",
      contributors: [{ name: "Álvares de Azevedo", role: "author" }],
      fingerprint: computeWorkFingerprint(
        "Noite na Taverna",
        "Álvares de Azevedo",
        "pt-BR"
      ),
      source: "brasilapi",
      createdAt: "2026-08-10T12:00:00.000Z",
    },
  ];

  const editions: Edition[] = [
    {
      id: "ed-dom-casmurro",
      workId: "work-dom-casmurro",
      ownerId: null,
      isbn13: "9788563560278",
      title: "Dom Casmurro",
      publisher: "Penguin-Companhia",
      language: "pt-BR",
      format: "paperback",
      pages: 400,
      heightMm: 210,
      thicknessMm: 22,
      coverColor: "#141514",
      contributors: [{ name: "Machado de Assis", role: "author" }],
      source: "brasilapi",
      createdAt: "2026-01-10T12:00:00.000Z",
    },
    {
      id: "ed-torto-arado",
      workId: "work-torto-arado",
      ownerId: null,
      isbn13: "9786559210886",
      title: "Torto Arado",
      publisher: "Todavia",
      language: "pt-BR",
      format: "hardcover",
      pages: 264,
      heightMm: 230,
      thicknessMm: 15,
      coverColor: "#2D6A4F",
      contributors: [{ name: "Itamar Vieira Junior", role: "author" }],
      source: "brasilapi",
      createdAt: "2026-02-05T12:00:00.000Z",
    },
    {
      id: "ed-hora-estrela-ebook",
      workId: "work-hora-estrela",
      ownerId: null,
      isbn13: "9788532530783",
      title: "A Hora da Estrela",
      publisher: "Rocco Digital",
      language: "pt-BR",
      format: "ebook",
      pages: 88,
      heightMm: 200,
      thicknessMm: 4,
      coverColor: "#65A30D",
      contributors: [{ name: "Clarice Lispector", role: "author" }],
      source: "brasilapi",
      createdAt: "2026-03-12T12:00:00.000Z",
    },
    {
      id: "ed-grande-sertao",
      workId: "work-grande-sertao",
      ownerId: null,
      isbn13: "9788535931983",
      title: "Grande Sertão: Veredas",
      publisher: "Companhia das Letras",
      language: "pt-BR",
      format: "hardcover",
      pages: 560,
      heightMm: 230,
      thicknessMm: 30,
      coverColor: "#141514",
      contributors: [{ name: "João Guimarães Rosa", role: "author" }],
      source: "brasilapi",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
    {
      id: "ed-avesso-pele-audio",
      workId: "work-avesso-pele",
      ownerId: null,
      title: "O Avesso da Pele (Audiobook)",
      publisher: "Companhia das Letras Áudio",
      language: "pt-BR",
      format: "audiobook",
      durationSeconds: 21600, // 6h
      heightMm: 200,
      thicknessMm: 4,
      coverColor: "#1E201E",
      contributors: [
        { name: "Jeferson Tenório", role: "author" },
        { name: "Lázaro Ramos", role: "narrator" },
      ],
      source: "manual",
      createdAt: "2026-05-15T12:00:00.000Z",
    },
    {
      id: "ed-quarto-despejo",
      workId: "work-quarto-despejo",
      ownerId: null,
      isbn13: "9788508171279",
      title: "Quarto de Despejo",
      publisher: "Ática",
      language: "pt-BR",
      format: "paperback",
      pages: 200,
      heightMm: 210,
      thicknessMm: 12,
      coverColor: "#B91C1C",
      contributors: [{ name: "Carolina Maria de Jesus", role: "author" }],
      source: "brasilapi",
      createdAt: "2026-06-20T12:00:00.000Z",
    },
    {
      id: "ed-noite-na-taverna",
      workId: "work-noite-na-taverna",
      ownerId: null,
      isbn13: "9788525420312",
      title: "Noite na Taverna",
      publisher: "L&PM Pocket",
      language: "pt-BR",
      format: "pocket",
      pages: 128,
      heightMm: 180,
      thicknessMm: 9,
      coverColor: "#141514",
      contributors: [{ name: "Álvares de Azevedo", role: "author" }],
      source: "brasilapi",
      createdAt: "2026-08-10T12:00:00.000Z",
    },
  ];

  const items: LibraryItem[] = [
    {
      id: "item-dom-casmurro",
      userId,
      editionId: "ed-dom-casmurro",
      shelfId: physShelfId,
      shelfPosition: 0,
      status: "owned",
      acquiredOn: "2026-01-12",
      pricePaid: 44.9,
      currency: "BRL",
      store: "Livraria Martins Fontes",
      condition: "new",
      createdAt: "2026-01-12T12:00:00.000Z",
    },
    {
      id: "item-torto-arado",
      userId,
      editionId: "ed-torto-arado",
      shelfId: physShelfId,
      shelfPosition: 1,
      status: "owned",
      acquiredOn: "2026-02-10",
      pricePaid: 69.9,
      currency: "BRL",
      store: "Livraria da Travessa",
      condition: "new",
      createdAt: "2026-02-10T12:00:00.000Z",
    },
    {
      id: "item-hora-estrela",
      userId,
      editionId: "ed-hora-estrela-ebook",
      shelfId: digShelfId,
      shelfPosition: 0,
      status: "owned",
      acquiredOn: "2026-03-14",
      pricePaid: 24.9,
      currency: "BRL",
      store: "Loja Digital",
      createdAt: "2026-03-14T12:00:00.000Z",
    },
    {
      id: "item-grande-sertao",
      userId,
      editionId: "ed-grande-sertao",
      shelfId: physShelfId,
      shelfPosition: 2,
      status: "owned",
      acquiredOn: "2026-09-01",
      pricePaid: 89.9,
      currency: "BRL",
      store: "Sebo Central",
      condition: "good",
      createdAt: "2026-09-01T12:00:00.000Z",
    },
    {
      id: "item-avesso-pele",
      userId,
      editionId: "ed-avesso-pele-audio",
      shelfId: audShelfId,
      shelfPosition: 0,
      status: "owned",
      acquiredOn: "2026-07-04",
      pricePaid: 34.9,
      currency: "BRL",
      createdAt: "2026-07-04T12:00:00.000Z",
    },
    {
      id: "item-noite-na-taverna",
      userId,
      editionId: "ed-noite-na-taverna",
      shelfId: physShelfId,
      shelfPosition: 3,
      status: "owned",
      acquiredOn: "2026-08-12",
      pricePaid: 22.9,
      currency: "BRL",
      store: "Sebo do Centro",
      condition: "good",
      createdAt: "2026-08-12T12:00:00.000Z",
    },
  ];

  // Seed apenas de desenvolvimento com 28 livros (páginas 90..900 e cores variadas: preto, verde,
  // vermelho, laranja, amarelo, azul, roxo, branco e marrom). Nunca vai para produção.
  const isDevVisualSeed =
    (process.env.NODE_ENV !== "production" ||
      process.env.RF_DEV_SEED === "1") &&
    process.env.RF_DEV_SEED !== "6";

  if (isDevVisualSeed) {
    for (const w of works) {
      w.primaryGenre = "Clássico Brasileiro";
    }

    const devExtraBooks: ReadonlyArray<{
      slug: string;
      title: string;
      author: string;
      genre: string;
      pages: number;
      color: string;
      format?: Edition["format"];
    }> = [
      // Prateleira 1 (Pretos e Verdes — junto aos 6 livros base = 11 livros, ~435px)
      {
        slug: "principios",
        title: "Princípios",
        author: "Ray Dalio",
        genre: "Clássico Brasileiro",
        pages: 760,
        color: "#141514",
        format: "hardcover",
      },
      {
        slug: "48-leis-poder",
        title: "As 48 Leis do Poder",
        author: "Robert Greene",
        genre: "Clássico Brasileiro",
        pages: 720,
        color: "#181918",
        format: "hardcover",
      },
      {
        slug: "responsabilidade-extrema",
        title: "Responsabilidade Extrema",
        author: "Jocko Willink",
        genre: "Clássico Brasileiro",
        pages: 640,
        color: "#141514",
      },
      {
        slug: "elon-musk",
        title: "Elon Musk",
        author: "Walter Isaacson",
        genre: "Clássico Brasileiro",
        pages: 900,
        color: "#141514",
        format: "hardcover",
      },
      {
        slug: "capitalismo-atencao",
        title: "Capitalismo da Atenção",
        author: "Georg Franck",
        genre: "Clássico Brasileiro",
        pages: 560,
        color: "#4ADE80",
      },
      // Prateleira 2 (Vermelhos, Laranjas, Amarelos, Azuis e Roxos: 9 livros, ~445px)
      {
        slug: "o-principe",
        title: "O Príncipe",
        author: "Nicolau Maquiavel",
        genre: "Estratégia & Liderança",
        pages: 480,
        color: "#991B1B",
      },
      {
        slug: "mulheres-correm-lobos",
        title: "Mulheres que Correm com os Lobos",
        author: "Clarissa Pinkola Estés",
        genre: "Estratégia & Liderança",
        pages: 860,
        color: "#B91C1C",
        format: "hardcover",
      },
      {
        slug: "como-fazer-amigos",
        title: "Como Fazer Amigos e Influenciar Pessoas",
        author: "Dale Carnegie",
        genre: "Estratégia & Liderança",
        pages: 700,
        color: "#DC2626",
      },
      {
        slug: "empresas-feitas-vencer",
        title: "Empresas Feitas para Vencer",
        author: "Jim Collins",
        genre: "Estratégia & Liderança",
        pages: 520,
        color: "#B91C1C",
      },
      {
        slug: "coragem-nao-agradar",
        title: "A Coragem de Não Agradar",
        author: "Ichiro Kishimi",
        genre: "Estratégia & Liderança",
        pages: 620,
        color: "#A16207",
      },
      {
        slug: "freemium",
        title: "Freemium",
        author: "Eric Seufert",
        genre: "Estratégia & Liderança",
        pages: 740,
        color: "#EAB308",
      },
      {
        slug: "arte-fazer-acontecer",
        title: "A Arte de Fazer Acontecer",
        author: "David Allen",
        genre: "Estratégia & Liderança",
        pages: 700,
        color: "#EA580C",
      },
      {
        slug: "como-chegar-ao-sim",
        title: "Como Chegar ao Sim",
        author: "Roger Fisher",
        genre: "Estratégia & Liderança",
        pages: 640,
        color: "#1D4ED8",
      },
      {
        slug: "obstaculo-e-o-caminho",
        title: "O Obstáculo é o Caminho",
        author: "Ryan Holiday",
        genre: "Estratégia & Liderança",
        pages: 720,
        color: "#4338CA",
      },
      // Prateleira 3 (Brancos, Cremes e Marrons: 8 livros, ~437px)
      {
        slug: "diario-estoico",
        title: "Diário Estoico",
        author: "Ryan Holiday",
        genre: "Ensaios & Psicologia",
        pages: 820,
        color: "#FAF8F5",
        format: "hardcover",
      },
      {
        slug: "psicologia-financeira",
        title: "A Psicologia Financeira",
        author: "Morgan Housel",
        genre: "Ensaios & Psicologia",
        pages: 700,
        color: "#F3EFE6",
      },
      {
        slug: "essencialismo",
        title: "Essencialismo",
        author: "Greg McKeown",
        genre: "Ensaios & Psicologia",
        pages: 680,
        color: "#FAF8F5",
      },
      {
        slug: "disciplina-e-liberdade",
        title: "Micro-Hábitos",
        author: "BJ Fogg",
        genre: "Ensaios & Psicologia",
        pages: 740,
        color: "#FDFBF7",
      },
      {
        slug: "storynomics",
        title: "Blink: A Decisão num Piscar",
        author: "Malcolm Gladwell",
        genre: "Ensaios & Psicologia",
        pages: 680,
        color: "#EFECE4",
      },
      {
        slug: "marca-da-vitoria",
        title: "A Marca da Vitória",
        author: "Phil Knight",
        genre: "Ensaios & Psicologia",
        pages: 660,
        color: "#E7E0D3",
      },
      {
        slug: "diario-de-um-ceo",
        title: "O Diário de um CEO",
        author: "Steven Bartlett",
        genre: "Ensaios & Psicologia",
        pages: 880,
        color: "#F5F2EB",
        format: "hardcover",
      },
      {
        slug: "rapido-e-devagar",
        title: "Rápido e Devagar",
        author: "Daniel Kahneman",
        genre: "Ensaios & Psicologia",
        pages: 900,
        color: "#784B2A",
        format: "hardcover",
      },
    ];

    devExtraBooks.forEach((b, idx) => {
      const workId = `work-dev-${b.slug}`;
      const editionId = `ed-dev-${b.slug}`;
      const itemId = `item-dev-${b.slug}`;
      works.push({
        id: workId,
        ownerId: null,
        title: b.title,
        firstPublishedYear: 2015 + (idx % 10),
        primaryGenre: b.genre,
        contributors: [{ name: b.author, role: "author" }],
        fingerprint: computeWorkFingerprint(b.title, b.author, "pt-BR"),
        source: "manual",
        createdAt: "2026-08-20T12:00:00.000Z",
      });
      editions.push({
        id: editionId,
        workId,
        ownerId: null,
        title: b.title,
        publisher: "ReadingFlow Editorial",
        language: "pt-BR",
        format: b.format ?? "paperback",
        pages: b.pages,
        coverColor: clampPaperHsl(b.color),
        coverAccentColor: deriveSpineAccentHex(
          clampPaperHsl(b.color),
          editionId
        ),
        contributors: [{ name: b.author, role: "author" }],
        source: "manual",
        createdAt: "2026-08-20T12:00:00.000Z",
      });
      items.push({
        id: itemId,
        userId,
        editionId,
        shelfId: physShelfId,
        shelfPosition: 4 + idx,
        status: "owned",
        acquiredOn: "2026-08-20",
        currency: "BRL",
        createdAt: "2026-08-20T12:00:00.000Z",
      });
    });
  }

  for (const ed of editions) {
    if (ed.coverColor) {
      ed.coverColor = clampPaperHsl(ed.coverColor);
      if (!ed.coverAccentColor) {
        ed.coverAccentColor = deriveSpineAccentHex(ed.coverColor, ed.id);
      }
    }
  }

  const readings: Reading[] = [
    {
      id: "read-dom-casmurro",
      userId,
      workId: "work-dom-casmurro",
      editionId: "ed-dom-casmurro",
      libraryItemId: "item-dom-casmurro",
      format: "paperback",
      status: "finished",
      startedOn: "2026-01-15",
      finishedOn: "2026-02-02",
      progressUnit: "pages",
      progressValue: 400,
      progressTotal: 400,
      countsForGoals: true,
      createdAt: "2026-01-15T12:00:00.000Z",
      updatedAt: "2026-02-02T20:00:00.000Z",
    },
    {
      id: "read-torto-arado",
      userId,
      workId: "work-torto-arado",
      editionId: "ed-torto-arado",
      libraryItemId: "item-torto-arado",
      format: "hardcover",
      status: "finished",
      startedOn: "2026-02-15",
      finishedOn: "2026-03-01",
      progressUnit: "pages",
      progressValue: 264,
      progressTotal: 264,
      countsForGoals: true,
      createdAt: "2026-02-15T12:00:00.000Z",
      updatedAt: "2026-03-01T20:00:00.000Z",
    },
    {
      id: "read-hora-estrela",
      userId,
      workId: "work-hora-estrela",
      editionId: "ed-hora-estrela-ebook",
      libraryItemId: "item-hora-estrela",
      format: "ebook",
      status: "finished",
      startedOn: "2026-04-10",
      finishedOn: "2026-04-12",
      progressUnit: "percent",
      progressValue: 100,
      progressTotal: 100,
      countsForGoals: true,
      createdAt: "2026-04-10T12:00:00.000Z",
      updatedAt: "2026-04-12T20:00:00.000Z",
    },
    {
      id: "read-avesso-pele",
      userId,
      workId: "work-avesso-pele",
      editionId: "ed-avesso-pele-audio",
      libraryItemId: "item-avesso-pele",
      format: "audiobook",
      status: "finished",
      startedOn: "2026-07-05",
      finishedOn: "2026-07-18",
      progressUnit: "seconds",
      progressValue: 21600,
      progressTotal: 21600,
      countsForGoals: true,
      createdAt: "2026-07-05T12:00:00.000Z",
      updatedAt: "2026-07-18T20:00:00.000Z",
    },
    {
      id: "read-grande-sertao",
      userId,
      workId: "work-grande-sertao",
      editionId: "ed-grande-sertao",
      libraryItemId: "item-grande-sertao",
      format: "hardcover",
      status: "reading",
      startedOn: `${currentYearMonth}-01`,
      progressUnit: "pages",
      progressValue: 248,
      progressTotal: 560,
      dailyLogs: demoDailyLogs,
      countsForGoals: true,
      createdAt: `${currentYearMonth}-01T12:00:00.000Z`,
      updatedAt: `${todayYmd}T20:00:00.000Z`,
    },
  ];

  const reviews: Review[] = [
    {
      id: "rev-dom-casmurro",
      userId,
      workId: "work-dom-casmurro",
      rating: 5.0,
      isPrivate: true,
      updatedAt: "2026-02-02T20:00:00.000Z",
    },
    {
      id: "rev-torto-arado",
      userId,
      workId: "work-torto-arado",
      rating: 4.5,
      isPrivate: true,
      updatedAt: "2026-03-01T20:00:00.000Z",
    },
    {
      id: "rev-hora-estrela",
      userId,
      workId: "work-hora-estrela",
      rating: 5.0,
      isPrivate: true,
      updatedAt: "2026-04-12T20:00:00.000Z",
    },
    {
      id: "rev-avesso-pele",
      userId,
      workId: "work-avesso-pele",
      rating: 4.5,
      narrationRating: 5.0,
      isPrivate: true,
      updatedAt: "2026-07-18T20:00:00.000Z",
    },
  ];

  const wishlist: WishlistItem[] = [
    {
      id: "wish-quarto-despejo",
      userId,
      workId: "work-quarto-despejo",
      editionId: "ed-quarto-despejo",
      priority: 5,
      targetPrice: 49.9,
      currency: "BRL",
      whereToBuy: "Livraria Cultura / Sebo",
      notes: "Edição comemorativa comentada",
      status: "wanted",
      createdAt: "2026-10-05T12:00:00.000Z",
    },
  ];

  const goals: ReadingGoal[] = [
    {
      id: "goal-2026-books",
      userId,
      title: "Leituras de 2026",
      kind: "books",
      period: "year",
      startsOn: "2026-01-01",
      endsOn: "2026-12-31",
      targetValue: 6,
      tolerancePercent: 5,
      countRereads: false,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "goal-2026-pages",
      userId,
      title: "Páginas no ano",
      kind: "pages",
      period: "year",
      startsOn: "2026-01-01",
      endsOn: "2026-12-31",
      targetValue: 1500,
      tolerancePercent: 5,
      countRereads: false,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  return {
    profile: {
      id: userId,
      email: "demo@readingflow.local",
      displayName: "Acervo Demonstrativo",
      locale: "pt-BR",
      timezone: "America/Sao_Paulo",
      defaultCurrency: "BRL",
      theme: "light",
      threeD: "auto",
      goalsCountRereads: false,
      maxSimultaneousReadings: 5,
      telemetryOptOut: false,
      onboardingCompleted: true,
      onboardingGoal: "organize",
      preferredFormats: ["physical", "digital", "audio"],
      acceptedTermsVersion: "1.0",
      acceptedTermsAt: "2026-01-01T10:00:00.000Z",
    },
    passwordHashSim: hashPassword("demo1234"),
    works,
    editions,
    shelves,
    items,
    wishlist,
    readings,
    reviews,
    goals,
    importJobs: [],
  };
}

export function createDefaultUserSettings(profile: UserProfile): UserSettings {
  return {
    userId: profile.id,
    theme: profile.theme ?? DEFAULT_THEME_ID,
    density: profile.density ?? DEFAULT_DENSITY,
    motion: profile.motion ?? DEFAULT_MOTION,
    fx: profile.fx ?? DEFAULT_FX,
    shelfLayout: structuredClone(EMPTY_PERSISTED_SHELF_LAYOUT),
    ambientPreferences: structuredClone(
      profile.focusAmbientPreferences ?? DEFAULT_AMBIENT_PREFERENCES
    ),
    focusDefaultMode: "free",
    onboardingGuide: {
      dismissed: profile.id === DEMO_USER_ID,
      reopened: false,
      completedSteps: [],
    },
    updatedAt: new Date().toISOString(),
  };
}

export function ensureWorkspaceSettings(ws: UserWorkspaceData): UserSettings {
  if (!ws.settings) {
    ws.settings = createDefaultUserSettings(ws.profile);
  }
  if (!ws.settings.onboardingGuide) {
    ws.settings.onboardingGuide = {
      dismissed: ws.profile.id === DEMO_USER_ID,
      reopened: false,
      completedSteps: [],
    };
  }
  if (!ws.uploadedCovers) {
    ws.uploadedCovers = {};
  }
  return ws.settings;
}

const MIME_TO_EXT: Record<UploadedCoverRecord["mimeType"], string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/**
 * Persiste uma capa enviada pelo usuário (`data:image/...`) no armazenamento privado
 * isolado por `{userId}/{editionId}/{fileName}` e retorna URL autenticada estável.
 */
export function saveUserUploadedCover(
  ws: UserWorkspaceData,
  editionId: string,
  dataUrl: string
): { routeUrl: string; record: UploadedCoverRecord } | null {
  const parsed = parseCoverDataUrl(dataUrl);
  if (!parsed) return null;

  ensureWorkspaceSettings(ws);
  const hash = crypto
    .createHash("sha256")
    .update(parsed.base64)
    .digest("hex")
    .slice(0, 16);
  const ext = MIME_TO_EXT[parsed.mime];
  const fileName = `cover-${hash}.${ext}`;
  const storageKey = `${ws.profile.id}/${editionId}/${fileName}`;
  const record: UploadedCoverRecord = {
    ownerId: ws.profile.id,
    editionId,
    fileName,
    mimeType: parsed.mime,
    bytesBase64: parsed.base64,
    etag: `"${hash}"`,
    createdAt: new Date().toISOString(),
  };

  ws.uploadedCovers![storageKey] = record;
  return {
    routeUrl: `/api/covers/file/${encodeURIComponent(ws.profile.id)}/${encodeURIComponent(editionId)}/${encodeURIComponent(fileName)}`,
    record,
  };
}

/**
 * Lê um arquivo de capa privado garantindo estritamente que o usuário autenticado é o dono.
 */
export function readUserUploadedCover(
  ws: UserWorkspaceData,
  ownerId: string,
  editionId: string,
  fileName: string
): UploadedCoverRecord | null {
  if (ws.profile.id !== ownerId) {
    return null;
  }
  const key = `${ownerId}/${editionId}/${fileName}`;
  return ws.uploadedCovers?.[key] ?? null;
}

/** Remove todos os arquivos privados de capa vinculados a uma edição (ao excluir livro/capa). */
export function deleteEditionUploadedCovers(
  ws: UserWorkspaceData,
  editionId: string
): number {
  if (!ws.uploadedCovers) return 0;
  const prefix = `${ws.profile.id}/${editionId}/`;
  let removed = 0;
  for (const key of Object.keys(ws.uploadedCovers)) {
    if (key.startsWith(prefix)) {
      delete ws.uploadedCovers[key];
      removed += 1;
    }
  }
  return removed;
}

/**
 * Guarda de integridade relacional (equivalente à FK composta `(id, user_id)`):
 * impede vincular obra, edição ou prateleira pertencente a outro usuário.
 */
export function assertOwnedWorkspaceEntities(
  ws: UserWorkspaceData,
  refs: { workId?: string; editionId?: string; shelfId?: string }
): { ok: true } | { ok: false; error: string } {
  if (refs.workId) {
    const work = ws.works.find(
      (w) =>
        w.id === refs.workId &&
        (w.ownerId === null || w.ownerId === ws.profile.id)
    );
    if (!work) {
      return { ok: false, error: "Obra não encontrada na sua conta." };
    }
  }
  if (refs.editionId) {
    const edition = ws.editions.find(
      (e) =>
        e.id === refs.editionId &&
        (e.ownerId === null || e.ownerId === ws.profile.id)
    );
    if (!edition) {
      return { ok: false, error: "Edição não encontrada na sua conta." };
    }
  }
  if (refs.shelfId) {
    const shelf = ws.shelves.find(
      (s) => s.id === refs.shelfId && s.userId === ws.profile.id
    );
    if (!shelf) {
      return { ok: false, error: "Prateleira não encontrada na sua conta." };
    }
  }
  return { ok: true };
}

export function getMemoryStore(): GlobalStoreShape {
  const allowDemoSeed = isDemoSessionAllowed();
  if (!globalThis.__readingFlowMemoryStore) {
    const usersById = new Map<string, UserWorkspaceData>();
    const userIdByEmail = new Map<string, string>();
    const sessions = new Map<string, string>();
    const sessionCreatedAt = new Map<string, number>();
    const passwordResetTokens = new Map<string, PasswordResetTokenRecord>();
    if (allowDemoSeed) {
      const demo = buildDemoWorkspace();
      ensureWorkspaceSettings(demo);
      usersById.set(DEMO_USER_ID, demo);
      userIdByEmail.set(demo.profile.email.toLowerCase(), DEMO_USER_ID);
      void ormSeedWorkspace(demo).catch(() => {});
    }
    globalThis.__readingFlowMemoryStore = {
      usersById,
      userIdByEmail,
      sessions,
      sessionCreatedAt,
      passwordResetTokens,
    };
  } else {
    if (!globalThis.__readingFlowMemoryStore.sessionCreatedAt) {
      globalThis.__readingFlowMemoryStore.sessionCreatedAt = new Map();
    }
    if (!globalThis.__readingFlowMemoryStore.passwordResetTokens) {
      globalThis.__readingFlowMemoryStore.passwordResetTokens = new Map();
    }
    if (
      allowDemoSeed &&
      !globalThis.__readingFlowMemoryStore.usersById.has(DEMO_USER_ID)
    ) {
      const demo = buildDemoWorkspace();
      ensureWorkspaceSettings(demo);
      globalThis.__readingFlowMemoryStore.usersById.set(DEMO_USER_ID, demo);
      globalThis.__readingFlowMemoryStore.userIdByEmail.set(
        demo.profile.email.toLowerCase(),
        DEMO_USER_ID
      );
      globalThis.__readingFlowMemoryStore.usersById.delete("user-demo-helena");
      void ormSeedWorkspace(demo).catch(() => {});
    }
  }
  return globalThis.__readingFlowMemoryStore;
}

export async function getAuthenticatedWorkspace(): Promise<UserWorkspaceData | null> {
  const cookieStore = await cookies();
  const store = getMemoryStore();

  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const rawUserId = store.sessions.get(token);
    const resolvedUserId =
      rawUserId === "user-demo-helena" ? DEMO_USER_ID : rawUserId;
    if (resolvedUserId) {
      const ws = store.usersById.get(resolvedUserId);
      if (ws) return ws;
    }
  }

  // Fallback de sessão demonstrativa via cookie rf_demo_session=true (bloqueado em produção por padrão)
  const isDemoCookie =
    isDemoSessionAllowed() &&
    cookieStore.get(DEMO_SESSION_COOKIE_NAME)?.value === "true";
  if (isDemoCookie) {
    let demoWs = store.usersById.get(DEMO_USER_ID);
    if (!demoWs) {
      demoWs = buildDemoWorkspace();
      store.usersById.set(DEMO_USER_ID, demoWs);
    }
    return demoWs;
  }

  return null;
}

export async function requireAuthenticatedWorkspace(): Promise<UserWorkspaceData> {
  const ws = await getAuthenticatedWorkspace();
  if (!ws) {
    redirect("/entrar");
  }
  return ws;
}

interface WorkspaceQueryCacheEntry {
  fingerprint: string;
  expiresAtMs: number;
  value: unknown;
}

const workspaceQueryCache = new Map<string, WorkspaceQueryCacheEntry>();
const workspaceRevisionCounter = new Map<string, number>();

function bumpWorkspaceRevision(userId: string): number {
  const next = (workspaceRevisionCounter.get(userId) ?? 0) + 1;
  workspaceRevisionCounter.set(userId, next);
  return next;
}

/**
 * Fingerprint O(1): combina o contador monotônico de revisão por usuário
 * (incrementado em toda mutação/invalidação) com comprimentos e ponteiros de
 * borda das coleções (detectando inclusive mutações diretas em testes unitários)
 * sem varrer nem concatenar 2.000 edições/leituras em cada hit de cache.
 */
function buildWorkspaceFingerprint(ws: UserWorkspaceData): string {
  const rev = workspaceRevisionCounter.get(ws.profile.id) ?? 0;
  const firstEd = ws.editions[0];
  const lastEd = ws.editions[ws.editions.length - 1];
  const firstReading = ws.readings[0];
  const lastReading = ws.readings[ws.readings.length - 1];
  const lastReview = ws.reviews[ws.reviews.length - 1];
  const firstItem = ws.items[0];
  const lastItem = ws.items[ws.items.length - 1];
  const settingsTs = ws.settings?.updatedAt ?? "0";

  return [
    ws.profile.id,
    rev,
    ws.profile.timezone,
    ws.profile.theme,
    ws.profile.goalsCountRereads ? "1" : "0",
    ws.works.length,
    ws.editions.length,
    ws.items.length,
    ws.readings.length,
    ws.reviews.length,
    ws.wishlist.length,
    ws.goals.length,
    ws.lastUndoAction?.id ?? "0",
    firstReading?.updatedAt ?? "0",
    lastReading?.updatedAt ?? "0",
    lastReview?.updatedAt ?? "0",
    firstItem?.id ?? "0",
    firstItem?.shelfPosition ?? 0,
    lastItem?.id ?? "0",
    lastItem?.shelfPosition ?? 0,
    firstEd?.coverUrl ?? "",
    firstEd?.coverLocked ? "1" : "0",
    lastEd?.coverUrl ?? "",
    lastEd?.coverLocked ? "1" : "0",
    settingsTs,
  ].join("|");
}

/** Invalida explicitamente todas as entradas de cache pertencentes a um usuário específico. */
export function invalidateUserWorkspaceCache(userId: string): void {
  bumpWorkspaceRevision(userId);
  const prefix = `${userId}::`;
  for (const key of workspaceQueryCache.keys()) {
    if (key.startsWith(prefix)) {
      workspaceQueryCache.delete(key);
    }
  }
}

/**
 * Cache de leitura leve por usuário com invalidação estrutural automática
 * (fingerprint do workspace + TTL curto), acelerando trocas de aba sem servir dado obsoleto.
 */
export function cachedWorkspaceQuery<T>(
  ws: UserWorkspaceData,
  queryKey: string,
  compute: () => T,
  ttlMs = 15_000
): T {
  const cacheKey = `${ws.profile.id}::${queryKey}`;
  const fingerprint = buildWorkspaceFingerprint(ws);
  const now = Date.now();
  const existing = workspaceQueryCache.get(cacheKey);
  if (
    existing &&
    existing.fingerprint === fingerprint &&
    existing.expiresAtMs > now
  ) {
    return existing.value as T;
  }

  const value = compute();
  workspaceQueryCache.set(cacheKey, {
    fingerprint,
    expiresAtMs: now + ttlMs,
    value,
  });
  return value;
}

export function saveUndoSnapshot(ws: UserWorkspaceData, label: string): void {
  bumpWorkspaceRevision(ws.profile.id);
  const now = Date.now();
  const cloneShallowList = <T extends object>(list: readonly T[]): T[] => {
    const out = new Array<T>(list.length);
    for (let i = 0; i < list.length; i += 1) {
      out[i] = { ...list[i]! };
    }
    return out;
  };
  const works = new Array<Work>(ws.works.length);
  for (let i = 0; i < ws.works.length; i += 1) {
    const w = ws.works[i]!;
    works[i] = { ...w, contributors: w.contributors.slice() };
  }
  const editions = new Array<Edition>(ws.editions.length);
  for (let i = 0; i < ws.editions.length; i += 1) {
    const e = ws.editions[i]!;
    editions[i] = { ...e, contributors: e.contributors.slice() };
  }
  const readings = new Array<Reading>(ws.readings.length);
  for (let i = 0; i < ws.readings.length; i += 1) {
    const r = ws.readings[i]!;
    readings[i] = {
      ...r,
      dailyLogs: r.dailyLogs ? r.dailyLogs.slice() : undefined,
    };
  }
  ws.lastUndoAction = {
    id: `undo-${now}`,
    label,
    createdAtMs: now,
    restoreSnapshot: {
      profile: { ...ws.profile },
      passwordHashSim: ws.passwordHashSim,
      works,
      editions,
      shelves: cloneShallowList(ws.shelves),
      items: cloneShallowList(ws.items),
      wishlist: cloneShallowList(ws.wishlist),
      readings,
      reviews: cloneShallowList(ws.reviews),
      goals: cloneShallowList(ws.goals),
      importJobs: cloneShallowList(ws.importJobs),
    },
  };
}

export function getCatalogPipelineForWorkspace(ws: UserWorkspaceData) {
  return createLiveCatalogPipeline(async (isbn13) => {
    const ed = ws.editions.find((e) => e.isbn13 === isbn13);
    if (!ed) return null;
    const work = ws.works.find((w) => w.id === ed.workId);
    return {
      isbn13,
      title: ed.title,
      subtitle: ed.subtitle,
      authors: ed.contributors
        .filter((c) => c.role === "author")
        .map((c) => c.name),
      publisher: ed.publisher,
      pages: ed.pages,
      publishedYear: work?.firstPublishedYear,
      description: work?.description,
      coverUrl: ed.coverUrl,
      heightMm: ed.heightMm,
      widthMm: ed.widthMm,
      language: ed.language,
      source: ed.source === "import" ? "manual" : ed.source,
    };
  });
}
