import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { enforceLoadtestSafety } from "./safety-guard.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

function loadCoverFixtures() {
  const candidates = [
    path.join(REPO_ROOT, "public", "landing", "covers", "dom-casmurro.webp"),
    path.join(REPO_ROOT, "public", "landing", "covers", "iracema.webp"),
    path.join(
      REPO_ROOT,
      "public",
      "landing",
      "covers",
      "memorias-postumas-bras-cubas.webp"
    ),
  ];
  const buffers = [];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      buffers.push(fs.readFileSync(file));
    }
  }
  if (buffers.length === 0) {
    // Fallback minimal valid WebP 240x360 header if static file is missing
    buffers.push(
      Buffer.from("RIFF$\x00\x00\x00WEBPVP8 \x18\x00\x00\x00", "binary")
    );
  }
  return buffers;
}

function extractQueryMeta(rawQ = "") {
  const decoded = decodeURIComponent(rawQ || "").trim();
  const intitleMatch = decoded.match(/intitle:"([^"]+)"/i);
  const inauthorMatch = decoded.match(/inauthor:"([^"]+)"/i);
  const isbnMatch = decoded.match(/(?:isbn:)?(97[89]\d{10}|\d{9}[\dXx])/i);

  const rawClean = decoded
    .replace(/intitle:"[^"]+"/gi, "")
    .replace(/inauthor:"[^"]+"/gi, "")
    .replace(/isbn:\S+/gi, "")
    .trim();

  const title =
    intitleMatch?.[1]?.trim() ||
    (rawClean ? rawClean.split(/\s+/).slice(0, 4).join(" ") : "Dom Casmurro");
  const author = inauthorMatch?.[1]?.trim() || "Machado de Assis";
  const isbn = isbnMatch?.[1]?.replace(/[^0-9Xx]/g, "") || "9788535910667";

  return { title, author, isbn };
}

/**
 * Servidor falso local para Google Books, Open Library, Hardcover, Apple Books e BrasilAPI.
 * Suporta modos determinísticos: "normal", "429", "timeout", "empty" e "slow".
 */
export async function startMockCatalogServer(options = {}) {
  enforceLoadtestSafety({ env: options.env ?? process.env });

  const port = Number(options.port ?? process.env.LOADTEST_MOCK_PORT ?? 4110);
  const host = options.host ?? "127.0.0.1";
  const coverBuffers = loadCoverFixtures();

  const state = {
    mode: "normal", // "normal" | "429" | "timeout" | "empty" | "slow"
    delayMs: 0,
    providerModes: {},
    stats: {
      totalRequests: 0,
      byProvider: {
        google: 0,
        openlibrary: 0,
        hardcover: 0,
        apple: 0,
        brasilapi: 0,
        covers: 0,
      },
      statusCounts: {},
    },
  };

  const recordStatus = (code) => {
    state.stats.statusCounts[code] = (state.stats.statusCounts[code] ?? 0) + 1;
  };

  const detectProvider = (pathname) => {
    const p = pathname.toLowerCase();
    if (p.includes("brasilapi") || p.includes("/api/isbn/")) return "brasilapi";
    if (
      p.includes("googleapis") ||
      p.includes("google") ||
      p.includes("/books/v1/volumes")
    )
      return "google";
    if (
      p.includes("openlibrary") ||
      p.includes("/search.json") ||
      p.includes("/api/books") ||
      p.includes("/b/id/") ||
      p.includes("/b/isbn/")
    )
      return "openlibrary";
    if (p.includes("hardcover") || p.includes("/v1/graphql"))
      return "hardcover";
    if (
      p.includes("itunes.apple") ||
      p.includes("apple") ||
      p.includes("/search")
    )
      return "apple";
    if (p.startsWith("/covers/")) return "covers";
    return "google";
  };

  const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url ?? "/", `http://${host}:${port}`);
    const pathname = reqUrl.pathname;

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (pathname === "/health" || pathname === "/__admin/stats") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          mode: state.mode,
          delayMs: state.delayMs,
          providerModes: state.providerModes,
          stats: state.stats,
        })
      );
      return;
    }

    if (pathname === "/__admin/mode" && req.method === "POST") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      if (body.mode) state.mode = body.mode;
      if (typeof body.delayMs === "number") state.delayMs = body.delayMs;
      if (body.provider && body.providerMode) {
        state.providerModes[body.provider] = body.providerMode;
      }
      if (body.resetProviderModes) {
        state.providerModes = {};
      }
      if (body.resetStats) {
        state.stats.totalRequests = 0;
        for (const k of Object.keys(state.stats.byProvider)) {
          state.stats.byProvider[k] = 0;
        }
        state.stats.statusCounts = {};
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ ok: true, mode: state.mode, delayMs: state.delayMs })
      );
      return;
    }

    const provider = detectProvider(pathname);
    state.stats.totalRequests += 1;
    state.stats.byProvider[provider] =
      (state.stats.byProvider[provider] ?? 0) + 1;

    const effectiveMode =
      reqUrl.searchParams.get("__mock_mode") ||
      state.providerModes[provider] ||
      state.mode;

    const effectiveDelay =
      effectiveMode === "timeout"
        ? 6500
        : effectiveMode === "slow"
          ? Math.max(800, state.delayMs || 1200)
          : state.delayMs;

    if (effectiveDelay > 0) {
      await new Promise((r) => setTimeout(r, effectiveDelay));
    }

    if (effectiveMode === "429") {
      recordStatus(429);
      res.writeHead(429, {
        "Content-Type": "application/json",
        "Retry-After": "2",
      });
      res.end(
        JSON.stringify({
          error: { code: 429, message: "Too Many Requests (Mock 429)" },
        })
      );
      return;
    }

    if (effectiveMode === "timeout") {
      recordStatus(504);
      res.writeHead(504, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Gateway Timeout (Mock)" }));
      return;
    }

    const baseUrl = `http://${host}:${port}`;

    // Entrega de imagens de capa reais em memória
    if (
      pathname.startsWith("/covers/") ||
      pathname.includes("/b/id/") ||
      pathname.includes("/b/isbn/") ||
      pathname.includes("/books/content")
    ) {
      if (effectiveMode === "empty") {
        recordStatus(404);
        res.writeHead(404);
        res.end();
        return;
      }
      const idx =
        Math.abs(
          pathname
            .split("")
            .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 7)
        ) % coverBuffers.length;
      const buf = coverBuffers[idx];
      recordStatus(200);
      res.writeHead(200, {
        "Content-Type": "image/webp",
        "Content-Length": String(buf.length),
        "Cache-Control": "public, max-age=3600",
      });
      if (req.method === "HEAD") {
        res.end();
      } else {
        res.end(buf);
      }
      return;
    }

    // 1. BrasilAPI ISBN endpoint
    if (provider === "brasilapi") {
      if (effectiveMode === "empty") {
        recordStatus(404);
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "ISBN não encontrado no mock" }));
        return;
      }
      const isbnSeg =
        pathname.split("/").filter(Boolean).pop() || "9788535910667";
      recordStatus(200);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          isbn: isbnSeg.replace(/[^0-9Xx]/g, ""),
          title: `Obra Editorial ${isbnSeg.slice(-4)}`,
          subtitle: "Edição Brasileira Mock",
          authors: ["Machado de Assis", "Clarice Lispector"],
          publisher: "Companhia das Letras",
          synopsis:
            "Fixture determinística servida pelo mock local do ReadingFlow.",
          year: 2022,
          page_count: 336,
          cover_url: `${baseUrl}/covers/brasilapi-${isbnSeg}.webp`,
        })
      );
      return;
    }

    // 2. Hardcover GraphQL endpoint
    if (provider === "hardcover") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const rawBody = Buffer.concat(chunks).toString("utf8");
      let variables = {};
      try {
        variables = JSON.parse(rawBody || "{}").variables ?? {};
      } catch {
        variables = {};
      }
      if (effectiveMode === "empty") {
        recordStatus(200);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: { books: [], editions: [] } }));
        return;
      }
      const title = variables.title || "Dom Casmurro";
      const isbn = variables.isbn || "9788535910667";
      recordStatus(200);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          data: {
            books: [
              {
                id: 801,
                title,
                pages: 312,
                release_year: 2021,
                image: {
                  url: `${baseUrl}/covers/hardcover-${encodeURIComponent(isbn)}.webp`,
                  width: 480,
                  height: 720,
                },
                contributions: [{ author: { name: "Machado de Assis" } }],
              },
            ],
            editions: [
              {
                id: 901,
                isbn_13: isbn,
                pages: 312,
                image: {
                  url: `${baseUrl}/covers/hardcover-ed-${encodeURIComponent(isbn)}.webp`,
                  width: 480,
                  height: 720,
                },
                book: {
                  id: 801,
                  title,
                  release_year: 2021,
                  contributions: [{ author: { name: "Machado de Assis" } }],
                },
              },
            ],
          },
        })
      );
      return;
    }

    // 3. Apple Books iTunes Search endpoint
    if (provider === "apple") {
      if (effectiveMode === "empty") {
        recordStatus(200);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ resultCount: 0, results: [] }));
        return;
      }
      const term = reqUrl.searchParams.get("term") || "Dom Casmurro";
      recordStatus(200);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          resultCount: 1,
          results: [
            {
              trackId: 500101,
              trackName: term,
              artistName: "Machado de Assis",
              releaseDate: "2021-05-10T00:00:00Z",
              artworkUrl100: `${baseUrl}/covers/apple-100x100bb.jpg`,
            },
          ],
        })
      );
      return;
    }

    // 4. Open Library endpoints (/search.json & /api/books)
    if (provider === "openlibrary") {
      if (pathname.includes("/api/books")) {
        const bibkeys =
          reqUrl.searchParams.get("bibkeys") || "ISBN:9788535910667";
        if (effectiveMode === "empty") {
          recordStatus(200);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({}));
          return;
        }
        recordStatus(200);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            [bibkeys]: {
              title: "Obra Clássica Open Library",
              authors: [{ name: "Machado de Assis" }],
              publishers: [{ name: "Penguin Companhia" }],
              number_of_pages: 288,
              publish_date: "2020",
              cover: {
                small: `${baseUrl}/covers/ol-small.webp`,
                medium: `${baseUrl}/covers/ol-medium.webp`,
                large: `${baseUrl}/covers/ol-large.webp`,
              },
            },
          })
        );
        return;
      }

      if (effectiveMode === "empty") {
        recordStatus(200);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ numFound: 0, docs: [] }));
        return;
      }

      const q =
        reqUrl.searchParams.get("q") ||
        reqUrl.searchParams.get("title") ||
        "Dom Casmurro";
      const authorParam =
        reqUrl.searchParams.get("author") || "Machado de Assis";
      const meta = extractQueryMeta(q);
      recordStatus(200);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          numFound: 2,
          docs: [
            {
              key: "/works/OL90001W",
              title: meta.title,
              author_name: [authorParam || meta.author],
              first_publish_year: 2019,
              number_of_pages_median: 296,
              isbn: [meta.isbn, "9788535914849"],
              subject: ["Ficção Brasileira"],
              cover_i: 901001,
            },
            {
              key: "/works/OL90002W",
              title: `${meta.title} — Edição Comentada`,
              author_name: [authorParam || meta.author],
              first_publish_year: 2022,
              number_of_pages_median: 340,
              isbn: ["9788535931983"],
              subject: ["Clássicos"],
              cover_i: 901002,
            },
          ],
        })
      );
      return;
    }

    // 5. Google Books (/books/v1/volumes)
    if (effectiveMode === "empty") {
      recordStatus(200);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ totalItems: 0, items: [] }));
      return;
    }

    const q = reqUrl.searchParams.get("q") || "Dom Casmurro";
    const meta = extractQueryMeta(q);
    recordStatus(200);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        kind: "books#volumes",
        totalItems: 2,
        items: [
          {
            id: "mock-google-vol-1",
            volumeInfo: {
              title: meta.title,
              authors: [meta.author],
              publisher: "Companhia das Letras",
              publishedDate: "2021-03-15",
              description:
                "Edição de teste servida pelo mock de estresse local.",
              pageCount: 280,
              categories: ["Ficção"],
              language: "pt-BR",
              industryIdentifiers: [{ type: "ISBN_13", identifier: meta.isbn }],
              imageLinks: {
                smallThumbnail: `${baseUrl}/covers/google-1-sm.webp`,
                thumbnail: `${baseUrl}/covers/google-1-lg.webp`,
              },
            },
          },
          {
            id: "mock-google-vol-2",
            volumeInfo: {
              title: `${meta.title} (Edição de Bolso)`,
              authors: [meta.author],
              publisher: "Penguin-Companhia",
              publishedDate: "2023-08-01",
              pageCount: 304,
              categories: ["Literatura Brasileira"],
              language: "pt-BR",
              industryIdentifiers: [
                { type: "ISBN_13", identifier: "9788535914849" },
              ],
              imageLinks: {
                smallThumbnail: `${baseUrl}/covers/google-2-sm.webp`,
                thumbnail: `${baseUrl}/covers/google-2-lg.webp`,
              },
            },
          },
        ],
      })
    );
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });

  const address = server.address();
  const actualPort =
    typeof address === "object" && address ? address.port : port;
  const baseUrl = `http://${host}:${actualPort}`;

  return {
    server,
    port: actualPort,
    baseUrl,
    getState: () => state,
    setMode: (nextMode, delayMs = 0) => {
      state.mode = nextMode;
      state.delayMs = delayMs;
    },
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      }),
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  startMockCatalogServer().then((instance) => {
    console.log(
      `[ReadingFlow/mock-server] Mock de provedores externos ativo em ${instance.baseUrl}`
    );
  });
}
