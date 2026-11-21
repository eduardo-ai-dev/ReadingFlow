import { cookies } from "next/headers";
import type {
  Edition,
  ImportJob,
  LibraryItem,
  Reading,
  ReadingGoal,
  Review,
  Shelf,
  UserProfile,
  WishlistItem,
  Work,
} from "@/lib/domain";
import { computeWorkFingerprint } from "@/features/catalog/rules";
import {
  clampPaperHsl,
  deriveSpineAccentHex,
} from "@/features/catalog/spine-color-rules";
import { formatDateInTimezone } from "@/lib/dates";
import { createLiveCatalogPipeline } from "@/server/catalog/providers";
import { ormSeedWorkspace } from "@/server/db/orm-repository";
import { hashPassword } from "@/server/security/password";

export const SESSION_COOKIE_NAME = "rf_session_id";
export const DEMO_SESSION_COOKIE_NAME = "rf_demo_session";
export const DEMO_USER_ID = "user-demo-acervo";

export interface UserWorkspaceData {
  profile: UserProfile;
  passwordHashSim: string;
  works: Work[];
  editions: Edition[];
  shelves: Shelf[];
  items: LibraryItem[];
  wishlist: WishlistItem[];
  readings: Reading[];
  reviews: Review[];
  goals: ReadingGoal[];
  importJobs: ImportJob[];
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
  passwordResetTokens: Map<string, PasswordResetTokenRecord>; // sha256(token) -> record
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
  const baseDateUtc = new Date(`${todayYmd}T12:00:00.000Z`);
  const demoDailyLogs = demoDailyPageSlices.map((pages, idx) => {
    const logDate = new Date(baseDateUtc);
    logDate.setUTCDate(
      logDate.getUTCDate() - (demoDailyPageSlices.length - 1 - idx)
    );
    return {
      ymd: logDate.toISOString().slice(0, 10),
      pages,
    };
  });

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

export function getMemoryStore(): GlobalStoreShape {
  if (!globalThis.__readingFlowMemoryStore) {
    const demo = buildDemoWorkspace();
    const usersById = new Map<string, UserWorkspaceData>([
      [DEMO_USER_ID, demo],
    ]);
    const userIdByEmail = new Map<string, string>([
      [demo.profile.email.toLowerCase(), DEMO_USER_ID],
    ]);
    const sessions = new Map<string, string>();
    const passwordResetTokens = new Map<string, PasswordResetTokenRecord>();
    globalThis.__readingFlowMemoryStore = {
      usersById,
      userIdByEmail,
      sessions,
      passwordResetTokens,
    };
    void ormSeedWorkspace(demo).catch(() => {});
  } else {
    if (!globalThis.__readingFlowMemoryStore.passwordResetTokens) {
      globalThis.__readingFlowMemoryStore.passwordResetTokens = new Map();
    }
    if (!globalThis.__readingFlowMemoryStore.usersById.has(DEMO_USER_ID)) {
      const demo = buildDemoWorkspace();
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

  // Fallback de sessão demonstrativa via cookie rf_demo_session=true
  const isDemoCookie =
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
    throw new Error("Sessão não autenticada.");
  }
  return ws;
}

export function saveUndoSnapshot(ws: UserWorkspaceData, label: string): void {
  const { lastUndoAction: _ignored, ...rest } = ws;
  void _ignored;
  ws.lastUndoAction = {
    id: `undo-${Date.now()}`,
    label,
    createdAtMs: Date.now(),
    restoreSnapshot: structuredClone(rest),
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
