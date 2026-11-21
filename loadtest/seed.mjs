import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { enforceLoadtestSafety, isLoadtestUserEmail } from "./safety-guard.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(REPO_ROOT, ".loadtest-data");

export const DEFAULT_LOADTEST_PASSWORD = "LoadTest#2026!";

const SCALE_PRESETS = {
  small: { users: 20, booksPerUser: 500, sqliteSyncUsers: 5 },
  medium: { users: 100, booksPerUser: 1000, sqliteSyncUsers: 3 },
  large: { users: 50, booksPerUser: 2000, sqliteSyncUsers: 2 },
  smoke: { users: 10, booksPerUser: 500, sqliteSyncUsers: 3 },
};

const SHORT_TITLES = [
  "O Aleph",
  "Fogo",
  "Sagarana",
  "Iracema",
  "Angústia",
  "Vidas Secas",
  "Dom Casmurro",
  "A Hora da Estrela",
  "Torto Arado",
  "Quincas Borba",
];

const MEDIUM_ACCENTED_TITLES = [
  "Memórias Póstumas de Brás Cubas",
  "Grande Sertão: Veredas",
  "A Paixão Segundo G.H.",
  "Quarto de Despejo: Diário de uma Favelada",
  "Crônica da Casa Assassinada",
  "O Tempo e o Vento: O Continente",
  "Lavoura Arcaica — Edição Comemorativa",
  "Ponciá Vicêncio",
  "Macunaíma: O Herói sem Nenhum Caráter",
  "Romanceiro da Inconfidência",
];

const LONG_EDITORIAL_TITLES = [
  "Tratado Histórico-Crítico sobre a Arquitetura das Bibliotecas Particulares e das Coleções Raras no Século XIX — Edição Bilíngue Comentada e Anotada",
  "Compêndio Luso-Brasileiro de Tipografia Clássica, Encadernação em Couro Bordô, Conservação de Papel Pergaminho e Catalogação Bibliográfica Moderna",
  "Ensaios Completos sobre a Fenomenologia da Leitura Silenciosa, Memória Espacial e Organização de Acervos Literários de Longa Duração",
  "Antologia Crítica das Correspondências Literárias e Manuscritos Inéditos do Realismo e Modernismo no Brasil com Notas Filológicas",
];

const FULL_AUTHORS = [
  "Machado de Assis",
  "Clarice Lispector",
  "João Guimarães Rosa",
  "Conceição Evaristo",
  "Graciliano Ramos",
  "Lygia Fagundes Telles",
  "Carolina Maria de Jesus",
  "Jorge Amado",
  "Cecília Meireles",
  "Raduan Nassar",
  "Itamar Vieira Junior",
  "Mário de Andrade",
];

const SURNAME_ONLY_AUTHORS = [
  "Assis",
  "Lispector",
  "Rosa",
  "Greene",
  "Maquiavel",
  "Fogg",
  "Borges",
  "Saramago",
];

const GENRES = [
  "Ficção Brasileira",
  "Clássicos",
  "Filosofia",
  "História",
  "Poesia",
  "Ensaios",
  "Ficção Científica",
  "Biografia",
  "Psicologia",
  "Contos",
  "Mistério",
  "Arte & Design",
];

const SPINE_COLORS = [
  "#6E1E2A",
  "#2D5A43",
  "#7A4B2A",
  "#26466D",
  "#8A3B2B",
  "#5B3A63",
  "#7E5E24",
  "#35524A",
  "#6C2D3C",
  "#47392E",
];

const SPINE_ACCENTS = ["#DFBE88", "#D4AF7A", "#E5D3B3", "#C8A46E", "#EAD8B1"];

/**
 * PRNG determinístico (Mulberry32) para reprodutibilidade exata com semente.
 */
export function createSeededRng(seedInput = 20261121) {
  let a = Number(seedInput) >>> 0;
  return {
    nextFloat() {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    nextInt(min, maxInclusive) {
      return min + Math.floor(this.nextFloat() * (maxInclusive - min + 1));
    },
    pick(arr) {
      return arr[Math.floor(this.nextFloat() * arr.length)];
    },
  };
}

let cachedPasswordHash = null;
export function getSharedLoadtestPasswordHash(
  plainPassword = DEFAULT_LOADTEST_PASSWORD
) {
  if (cachedPasswordHash) return cachedPasswordHash;
  const salt = "7loadtestfixedsalt20261121abcdef";
  const derived = crypto.scryptSync(plainPassword, salt, 64).toString("hex");
  cachedPasswordHash = `scrypt$${salt}$${derived}`;
  return cachedPasswordHash;
}

function buildValidIsbn13(index) {
  const body = `97885${String(1000000 + (index % 8999999)).slice(0, 7)}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(body[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return `${body}${check}`;
}

/**
 * Constrói um workspace determinístico para `loadtest+N@example.test` com:
 * - `bookCount` livros (30..1200 páginas, formatos variados, títulos curtos/longos/acentuados, autores só com sobrenome)
 * - ~10 sessões de leitura (`dailyLogs`) por livro concluído + anotações
 * - metas anual e mensal
 * - 10 a 60 prateleiras com grupos customizados
 * - capas apontando para o mock server local e ~25% com `coverLocked: true`
 */
export function generateDeterministicUserWorkspace({
  userIndex,
  bookCount,
  seed = 20261121,
  mockBaseUrl = "http://127.0.0.1:4110",
}) {
  const rng = createSeededRng(seed + userIndex * 9973);
  const email = `loadtest+${userIndex}@example.test`;
  if (!isLoadtestUserEmail(email)) {
    throw new Error(`E-mail de teste inválido: ${email}`);
  }

  const userId = `user-loadtest-${userIndex}`;
  const nowIso = "2026-11-21T12:00:00.000Z";
  const passwordHash = getSharedLoadtestPasswordHash();

  const shelves = [
    {
      id: `shelf-${userId}-physical`,
      userId,
      name: "Física",
      kind: "physical",
      isDefault: true,
      sortMode: "manual",
      createdAt: nowIso,
    },
    {
      id: `shelf-${userId}-digital`,
      userId,
      name: "Digital",
      kind: "digital",
      isDefault: true,
      sortMode: "manual",
      createdAt: nowIso,
    },
    {
      id: `shelf-${userId}-audio`,
      userId,
      name: "Audiobooks",
      kind: "audio",
      isDefault: true,
      sortMode: "manual",
      createdAt: nowIso,
    },
  ];

  // 10 a 60 prateleiras customizadas com grupos na Estante 3D
  const customShelfCount = rng.nextInt(10, 60);
  const customShelves = [];
  const shelfOrder = [];
  const shelfMeta = {};
  const customOrderByShelf = {};
  const bookShelfMap = {};

  for (let s = 1; s <= customShelfCount; s++) {
    const key = `custom-ala-${s}`;
    const genreName = GENRES[(s - 1) % GENRES.length];
    const title = `Ala ${s} · ${genreName}`;
    customShelves.push({ key, title });
    shelfOrder.push(key);
    shelfMeta[key] = {
      title,
      displayAsTitle: s % 3 !== 0,
      customDots: [
        SPINE_COLORS[s % SPINE_COLORS.length],
        SPINE_COLORS[(s + 3) % SPINE_COLORS.length],
      ],
    };
    customOrderByShelf[key] = [];
  }

  const works = [];
  const editions = [];
  const items = [];
  const readings = [];
  const reviews = [];
  const wishlist = [];

  const formats = ["hardcover", "paperback", "pocket", "ebook", "audiobook"];
  const shelfPositions = {
    physical: 0,
    digital: 0,
    audio: 0,
  };

  for (let b = 1; b <= bookCount; b++) {
    const workId = `work-lt-${userIndex}-${b}`;
    const editionId = `ed-lt-${userIndex}-${b}`;
    const itemId = `item-lt-${userIndex}-${b}`;

    const titleRoll = rng.nextFloat();
    let baseTitle;
    if (titleRoll < 0.25) {
      baseTitle = rng.pick(SHORT_TITLES);
    } else if (titleRoll < 0.85) {
      baseTitle = rng.pick(MEDIUM_ACCENTED_TITLES);
    } else {
      baseTitle = rng.pick(LONG_EDITORIAL_TITLES);
    }
    const title = `${baseTitle} · Vol. ${b}`;

    const useSurnameOnly = rng.nextFloat() < 0.25;
    const authorName = useSurnameOnly
      ? rng.pick(SURNAME_ONLY_AUTHORS)
      : rng.pick(FULL_AUTHORS);

    const genre = GENRES[(b + userIndex) % GENRES.length];
    const format = formats[b % formats.length];
    const pages = rng.nextInt(30, 1200);
    const isbn13 = buildValidIsbn13(userIndex * 10000 + b);
    const spineColor = SPINE_COLORS[b % SPINE_COLORS.length];
    const spineAccent = SPINE_ACCENTS[b % SPINE_ACCENTS.length];

    const hasMockCover = rng.nextFloat() < 0.85;
    const coverLocked = hasMockCover && rng.nextFloat() < 0.3;
    const coverUrl = hasMockCover
      ? `${mockBaseUrl}/covers/mock-cover-${(b % 24) + 1}.webp`
      : undefined;

    works.push({
      id: workId,
      ownerId: userId,
      title,
      primaryGenre: genre,
      firstPublishedYear: rng.nextInt(1880, 2026),
      description:
        b % 4 === 0
          ? `Anotação editorial e sinopse estendida para "${title}", escrita por ${authorName}.`
          : undefined,
      contributors: [{ name: authorName, role: "author" }],
      fingerprint: `${title.toLowerCase().replace(/[^a-z0-9]/g, "")}-${authorName.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
      source: "manual",
      createdAt: nowIso,
    });

    editions.push({
      id: editionId,
      ownerId: userId,
      workId,
      title,
      format,
      language: "pt-BR",
      isbn13,
      publisher: b % 2 === 0 ? "Companhia das Letras" : "Penguin-Companhia",
      pages: format === "audiobook" ? undefined : pages,
      durationSeconds: format === "audiobook" ? pages * 110 : undefined,
      coverUrl,
      coverSource: hasMockCover ? "openlibrary" : undefined,
      coverLocked,
      coverSelectedAt: coverLocked ? nowIso : undefined,
      coverColor: spineColor,
      coverAccentColor: spineAccent,
      source: "manual",
      contributors: [{ name: authorName, role: "author" }],
      createdAt: nowIso,
    });

    const shelfKind =
      format === "ebook"
        ? "digital"
        : format === "audiobook"
          ? "audio"
          : "physical";
    const targetShelf = shelves.find((s) => s.kind === shelfKind) ?? shelves[0];
    const pos = shelfPositions[shelfKind];
    shelfPositions[shelfKind] += 1;

    items.push({
      id: itemId,
      userId,
      editionId,
      shelfId: targetShelf.id,
      status: "owned",
      shelfPosition: pos,
      currency: "BRL",
      acquiredOn: "2026-01-15",
      notes:
        b % 3 === 0
          ? `Exemplar #${b} com anotações de margem e ex-libris.`
          : undefined,
      createdAt: nowIso,
    });

    const customShelfKey = customShelves[(b - 1) % customShelves.length].key;
    bookShelfMap[itemId] = customShelfKey;
    customOrderByShelf[customShelfKey].push(itemId);

    // Status de leitura realista: ~35% finished (~10 sessões cada), ~5% reading, ~8% paused, ~5% abandoned, resto not_started
    const statusRoll = rng.nextFloat();
    let readingStatus = "not_started";
    if (b <= 3) {
      readingStatus = "reading";
    } else if (statusRoll < 0.35) {
      readingStatus = "finished";
    } else if (statusRoll < 0.43) {
      readingStatus = "paused";
    } else if (statusRoll < 0.48) {
      readingStatus = "abandoned";
    }

    if (readingStatus !== "not_started") {
      const readingId = `reading-lt-${userIndex}-${b}`;
      const isFinished = readingStatus === "finished";
      const progressValue = isFinished
        ? pages
        : Math.max(5, Math.floor(pages * rng.nextFloat() * 0.85));
      const progressPercent = isFinished
        ? 100
        : Math.min(99, Math.max(1, Math.round((progressValue / pages) * 100)));

      // ~10 sessões de leitura por livro lido
      const sessionCount = isFinished ? rng.nextInt(8, 12) : rng.nextInt(2, 4);
      const dailyLogs = [];
      let remaining = progressValue;
      for (let sIdx = 1; sIdx <= sessionCount; sIdx++) {
        const isLast = sIdx === sessionCount;
        const delta = isLast
          ? Math.max(1, remaining)
          : Math.max(1, Math.floor(remaining / (sessionCount - sIdx + 1)));
        remaining = Math.max(0, remaining - delta);
        const month = String(((b + sIdx) % 10) + 1).padStart(2, "0");
        const day = String(((b * 3 + sIdx) % 28) + 1).padStart(2, "0");
        dailyLogs.push({
          ymd: `2026-${month}-${day}`,
          pages: delta,
          seconds: 0,
        });
      }

      readings.push({
        id: readingId,
        userId,
        workId,
        editionId,
        libraryItemId: itemId,
        status: readingStatus,
        format,
        countsForGoals: true,
        progressUnit: "pages",
        progressValue,
        progressTotal: pages,
        startedOn: "2026-01-10",
        finishedOn: isFinished ? "2026-10-15" : undefined,
        abandonReason:
          readingStatus === "abandoned"
            ? "Ritmo lento, retomarei depois"
            : undefined,
        notes:
          b % 2 === 0
            ? `Sessão anotada em "${title}": reflexões sobre estrutura narrativa e estilo de ${authorName}.`
            : undefined,
        dailyLogs,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      if (isFinished && b % 2 === 0) {
        const halfStars = rng.nextInt(5, 10) * 0.5;
        reviews.push({
          id: `rev-lt-${userIndex}-${b}`,
          userId,
          workId,
          rating: halfStars,
          narrationRating: format === "audiobook" ? 4.5 : undefined,
          body: `Resenha de "${title}": prosa envolvente e edição caprichada.`,
          isPrivate: true,
          updatedAt: nowIso,
        });
      }
    }
  }

  const goals = [
    {
      id: `goal-annual-books-${userId}`,
      userId,
      title: "Meta Anual de Livros 2026",
      kind: "books",
      period: "year",
      startsOn: "2026-01-01",
      endsOn: "2026-12-31",
      targetValue: Math.max(24, Math.round(bookCount * 0.25)),
      tolerancePercent: 5,
      countRereads: true,
      createdAt: nowIso,
    },
    {
      id: `goal-annual-pages-${userId}`,
      userId,
      title: "Meta Anual de Páginas 2026",
      kind: "pages",
      period: "year",
      startsOn: "2026-01-01",
      endsOn: "2026-12-31",
      targetValue: Math.max(8000, Math.round(bookCount * 90)),
      tolerancePercent: 5,
      countRereads: true,
      createdAt: nowIso,
    },
    {
      id: `goal-monthly-books-${userId}`,
      userId,
      title: "Meta Mensal de Novembro",
      kind: "books",
      period: "month",
      startsOn: "2026-11-01",
      endsOn: "2026-11-30",
      targetValue: 4,
      tolerancePercent: 5,
      countRereads: true,
      createdAt: nowIso,
    },
  ];

  const profile = {
    id: userId,
    email,
    displayName: `Leitor Loadtest #${userIndex}`,
    locale: "pt-BR",
    timezone: "America/Sao_Paulo",
    defaultCurrency: "BRL",
    theme: "light",
    density: "normal",
    motion: "normal",
    fx: "off",
    threeD: "auto",
    goalsCountRereads: true,
    maxSimultaneousReadings: 10,
    telemetryOptOut: true,
    onboardingCompleted: true,
    preferredFormats: ["physical", "digital", "audio"],
    acceptedTermsVersion: "2026.1",
    acceptedTermsAt: nowIso,
  };

  const settings = {
    userId,
    theme: "light",
    density: "normal",
    motion: "normal",
    fx: "off",
    ambientSound: {
      activeIds: [],
      volumes: {},
      masterVolume: 0.75,
      timerMinutes: 0,
    },
    shelfLayout: {
      version: 2,
      organizationMode: "custom",
      shelfMaterial: "classic-wood",
      customShelves,
      shelfOrder,
      bookShelfMap,
      customOrderByShelf,
      shelfMeta,
      bookDisplayModes: {},
      bookTiltDirections: {},
      shelfDecorByRow: {},
    },
    updatedAt: nowIso,
  };

  return {
    workspace: {
      profile,
      passwordHashSim: passwordHash,
      works,
      editions,
      shelves,
      items,
      wishlist,
      readings,
      reviews,
      goals,
      importJobs: [],
      settings,
    },
    sessionToken: `lt-sess-user-${userIndex}-seed-${seed}`,
  };
}

function parseCliArgs(argv) {
  const opts = {
    scale: process.env.LOADTEST_SCALE || "small",
    seed: Number(process.env.LOADTEST_SEED || 20261121),
    users: null,
    booksPerUser: null,
    extraScaleUsers: [], // e.g., [{ userIndex: 901, books: 500 }, { userIndex: 902, books: 1000 }, { userIndex: 903, books: 2000 }]
  };

  for (const arg of argv) {
    if (arg.startsWith("--scale=")) opts.scale = arg.split("=")[1];
    if (arg.startsWith("--seed=")) opts.seed = Number(arg.split("=")[1]);
    if (arg.startsWith("--users=")) opts.users = Number(arg.split("=")[1]);
    if (arg.startsWith("--books="))
      opts.booksPerUser = Number(arg.split("=")[1]);
    if (arg === "--with-browser-scales") {
      opts.extraScaleUsers = [
        { userIndex: 500, books: 500 },
        { userIndex: 1000, books: 1000 },
        { userIndex: 2000, books: 2000 },
      ];
    }
  }
  return opts;
}

export async function runLoadtestSeed(customOptions = {}) {
  const { appBaseUrl } = enforceLoadtestSafety({
    appUrl: customOptions.appUrl,
    env: customOptions.env ?? process.env,
  });

  const cli = parseCliArgs(process.argv.slice(2));
  const scaleName = customOptions.scale ?? cli.scale ?? "small";
  const preset = SCALE_PRESETS[scaleName] ?? SCALE_PRESETS.small;
  const totalUsers = customOptions.users ?? cli.users ?? preset.users;
  const booksPerUser =
    customOptions.booksPerUser ?? cli.booksPerUser ?? preset.booksPerUser;
  const seed = customOptions.seed ?? cli.seed ?? 20261121;
  const mockBaseUrl =
    customOptions.mockBaseUrl ??
    process.env.MOCK_CATALOG_BASE_URL ??
    "http://127.0.0.1:4110";
  const extraScaleUsers =
    customOptions.extraScaleUsers ?? cli.extraScaleUsers ?? [];

  fs.mkdirSync(DATA_DIR, { recursive: true });

  console.log(
    `[ReadingFlow/seed] Gerando escala "${scaleName}" (${totalUsers} usuários × ${booksPerUser} livros, seed=${seed})...`
  );

  const t0 = performance.now();
  const userManifest = [];
  const batchSize = 5;
  let pendingBatch = [];

  const flushBatch = async (batch) => {
    if (batch.length === 0) return;
    const res = await fetch(`${appBaseUrl}/api/internal/loadtest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "seed_batch",
        workspaces: batch,
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(
        `Falha ao enviar seed_batch para ${appBaseUrl}/api/internal/loadtest (HTTP ${res.status}): ${txt}`
      );
    }
  };

  for (let u = 1; u <= totalUsers; u++) {
    const generated = generateDeterministicUserWorkspace({
      userIndex: u,
      bookCount: booksPerUser,
      seed,
      mockBaseUrl,
    });
    const syncSqlite = u <= preset.sqliteSyncUsers;
    pendingBatch.push({
      workspace: generated.workspace,
      sessionToken: generated.sessionToken,
      syncSqlite,
    });
    userManifest.push({
      userIndex: u,
      userId: generated.workspace.profile.id,
      email: generated.workspace.profile.email,
      password: DEFAULT_LOADTEST_PASSWORD,
      bookCount: booksPerUser,
      sessionToken: generated.sessionToken,
      firstWorkId: generated.workspace.works[0]?.id,
      firstEditionId: generated.workspace.editions[0]?.id,
      firstReadingId: generated.workspace.readings[0]?.id,
      lockedEditionId: generated.workspace.editions.find((e) => e.coverLocked)
        ?.id,
      unlockedEditionId: generated.workspace.editions.find(
        (e) => !e.coverLocked
      )?.id,
    });

    if (pendingBatch.length >= batchSize) {
      await flushBatch(pendingBatch);
      pendingBatch = [];
    }
  }

  for (const extra of extraScaleUsers) {
    const generated = generateDeterministicUserWorkspace({
      userIndex: extra.userIndex,
      bookCount: extra.books,
      seed,
      mockBaseUrl,
    });
    pendingBatch.push({
      workspace: generated.workspace,
      sessionToken: generated.sessionToken,
      syncSqlite: true,
    });
    userManifest.push({
      userIndex: extra.userIndex,
      userId: generated.workspace.profile.id,
      email: generated.workspace.profile.email,
      password: DEFAULT_LOADTEST_PASSWORD,
      bookCount: extra.books,
      sessionToken: generated.sessionToken,
      firstWorkId: generated.workspace.works[0]?.id,
      firstEditionId: generated.workspace.editions[0]?.id,
      firstReadingId: generated.workspace.readings[0]?.id,
      lockedEditionId: generated.workspace.editions.find((e) => e.coverLocked)
        ?.id,
      unlockedEditionId: generated.workspace.editions.find(
        (e) => !e.coverLocked
      )?.id,
    });
    if (pendingBatch.length >= batchSize) {
      await flushBatch(pendingBatch);
      pendingBatch = [];
    }
  }

  await flushBatch(pendingBatch);

  // Executa ANALYZE e obtém diagnóstico das tabelas e planos de consulta
  const sampleUser =
    userManifest[userManifest.length - 1]?.userId ?? userManifest[0]?.userId;
  const diagRes = await fetch(
    `${appBaseUrl}/api/internal/loadtest?sampleUserId=${encodeURIComponent(sampleUser ?? "")}`
  );
  const diagnostics = diagRes.ok ? await diagRes.json() : null;

  const durationMs = Math.round(performance.now() - t0);

  // Salva Playwright storageState para o usuário principal e manifesto completo
  const primaryUser = userManifest[0];
  const appHost = new URL(appBaseUrl).hostname;
  const storageState = {
    cookies: primaryUser
      ? [
          {
            name: "rf_session_id",
            value: primaryUser.sessionToken,
            domain: appHost,
            path: "/",
            httpOnly: true,
            secure: false,
            sameSite: "Lax",
          },
        ]
      : [],
    origins: [],
  };

  const storageStatePath = path.join(DATA_DIR, "playwright-storage-state.json");
  fs.writeFileSync(storageStatePath, JSON.stringify(storageState, null, 2));

  const manifest = {
    generatedAt: new Date().toISOString(),
    scale: scaleName,
    seed,
    totalUsers: userManifest.length,
    booksPerUser,
    durationMs,
    appBaseUrl,
    mockBaseUrl,
    storageStatePath,
    users: userManifest,
    diagnostics,
  };

  const manifestPath = path.join(DATA_DIR, "seed-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(
    `[ReadingFlow/seed] Concluído em ${durationMs} ms (${userManifest.length} usuários semeados).`
  );
  if (diagnostics?.sqlite?.tableStats) {
    console.log(
      "[ReadingFlow/seed] Tamanho das tabelas após ANALYZE:",
      JSON.stringify(diagnostics.sqlite.tableStats)
    );
  }

  return manifest;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runLoadtestSeed().catch((err) => {
    console.error("[ReadingFlow/seed] Erro fatal:", err);
    process.exit(1);
  });
}
