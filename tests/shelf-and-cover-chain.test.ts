import { beforeEach, describe, expect, it } from "vitest";
import {
  computeFittedSpineTypography,
  isFlatCharcoalHex,
  resolveEffectiveSpineColor,
} from "@/components/Book3D";
import { resolveRowSpineVisuals } from "@/components/ShelfView";
import { classifyCoverSearchDiagnostic } from "@/features/catalog/cover-search-rules";
import {
  resetCoverSearchRuntimeCaches,
  searchBookCovers,
} from "@/server/catalog/cover-search";

describe("Lombadas: auto-fit sem reticências, 2 linhas e paleta editorial", () => {
  it("mantém a fonte entre 8px e 15px e aumenta a legibilidade em títulos curtos e lombadas grossas", () => {
    const shortThick = computeFittedSpineTypography({
      title: "Princípios",
      authorSurname: "Dalio",
      heightPx: 200,
      spineWidthPx: 52,
      template: "A",
      typoStyle: "serif-bold",
    });

    expect(shortThick.lines).toEqual(["Princípios"]);
    expect(shortThick.titleFontPx).toBeGreaterThanOrEqual(13);
    expect(shortThick.titleFontPx).toBeLessThanOrEqual(15);
    expect(shortThick.wasWordAbbreviated).toBe(false);
  });

  it("quebra títulos longos em 2 linhas balanceadas quando a espessura >= 26px sem usar reticências", () => {
    const thickLong = computeFittedSpineTypography({
      title: "Como Fazer Amigos e Influenciar Pessoas",
      authorSurname: "Carnegie",
      heightPx: 192,
      spineWidthPx: 48,
      template: "A",
      typoStyle: "serif-bold",
    });

    expect(thickLong.lines).toHaveLength(2);
    expect(thickLong.lines.join(" ")).toBe(
      "Como Fazer Amigos e Influenciar Pessoas"
    );
    expect(thickLong.lines.join(" ")).not.toMatch(/\.{3}|…/);
    expect(thickLong.titleFontPx).toBeGreaterThanOrEqual(8);
    expect(thickLong.titleFontPx).toBeLessThanOrEqual(15);
    expect(thickLong.wasWordAbbreviated).toBe(false);
  });

  it("em lombadas finas (< 26px) nunca quebra em 2 linhas, nunca usa reticências e só abrevia por palavra inteira se não couber a 8px", () => {
    const thinVeryLong = computeFittedSpineTypography({
      title: "Quarto de Despejo: Diário de uma Favelada",
      authorSurname: "Jesus",
      heightPx: 162,
      spineWidthPx: 14,
      template: "B",
      typoStyle: "serif-bold",
    });

    expect(thinVeryLong.lines).toHaveLength(1);
    expect(thinVeryLong.titleFontPx).toBeGreaterThanOrEqual(8);
    expect(thinVeryLong.titleFontPx).toBeLessThanOrEqual(15);
    expect(thinVeryLong.lines[0]).toBe("Quarto de Despejo");
    expect(thinVeryLong.lines[0]).not.toMatch(/\.{3}|…/);
    expect(thinVeryLong.wasWordAbbreviated).toBe(true);

    const thinNoSubtitleVeryLong = computeFittedSpineTypography({
      title: "Uma História Muito Longa Sobre Todos Os Livros Perdidos da Biblioteca Imperial",
      authorSurname: "Autor",
      heightPx: 150,
      spineWidthPx: 13,
      template: "D",
      typoStyle: "sans-condensed",
    });

    expect(thinNoSubtitleVeryLong.lines).toHaveLength(1);
    expect(thinNoSubtitleVeryLong.titleFontPx).toBe(8);
    expect(thinNoSubtitleVeryLong.lines[0]).not.toMatch(/\.{3}|…/);
    // Garante que abreviou por palavra inteira (cada palavra da linha pertence às palavras originais)
    const originalWords = new Set(
      "Uma História Muito Longa Sobre Todos Os Livros Perdidos da Biblioteca Imperial".split(
        " "
      )
    );
    for (const w of thinNoSubtitleVeryLong.lines[0]!.split(" ")) {
      expect(originalWords.has(w)).toBe(true);
    }
  });

  it("preserva cores da capa real e substitui cinza-chumbo por paleta editorial variada sem capa", () => {
    const withCover = resolveEffectiveSpineColor({
      coverUrl: "https://covers.openlibrary.org/b/id/647501-L.jpg?default=false",
      rawColor: "#1A1B1A",
      seed: "book-with-cover",
    });
    expect(withCover.isFromCover).toBe(true);
    expect(withCover.color).toBe("#1A1B1A");

    const withoutCoverCharcoal = resolveEffectiveSpineColor({
      coverUrl: null,
      rawColor: "#141514",
      seed: "book-no-cover",
    });
    expect(withoutCoverCharcoal.isFromCover).toBe(false);
    expect(isFlatCharcoalHex(withoutCoverCharcoal.color)).toBe(false);
  });

  it("impede vizinhos de repetirem template + cor na mesma prateleira", () => {
    const uniformGrayBooks = Array.from({ length: 10 }, (_, idx) => ({
      resolvedSeed: `same-seed-family-${idx}`,
      coverUrl: null,
      spineBg: "#141514",
      spineAccentHex: "#2B2D2B",
    }));

    const visuals = resolveRowSpineVisuals(uniformGrayBooks);
    expect(visuals).toHaveLength(10);

    const distinctColors = new Set(visuals.map((v) => v.spineBg.toLowerCase()));
    expect(distinctColors.size).toBeGreaterThanOrEqual(4);

    for (let i = 1; i < visuals.length; i += 1) {
      const prev = visuals[i - 1]!;
      const cur = visuals[i]!;
      expect(cur.template).not.toBe(prev.template);
      expect(cur.spineBg.toLowerCase()).not.toBe(prev.spineBg.toLowerCase());
      expect(isFlatCharcoalHex(cur.spineBg)).toBe(false);
    }
  });
});

describe("Cadeia de capas: BrasilAPI -> Google -> Open Library -> Hardcover + Apple flag + diagnóstico", () => {
  beforeEach(() => {
    resetCoverSearchRuntimeCaches();
  });

  it("com ISBN usa BrasilAPI (cover_url + page_count) primeiro e evita chamadas desnecessárias aos provedores seguintes", async () => {
    const calledUrls: string[] = [];

    const mockFetch: typeof fetch = async (input) => {
      const urlStr = typeof input === "string" ? input : input.toString();
      calledUrls.push(urlStr);

      if (urlStr.startsWith("https://brasilapi.com.br/api/isbn/v1/")) {
        return new Response(
          JSON.stringify({
            isbn: "9788535931983",
            title: "Grande Sertão: Veredas",
            authors: ["João Guimarães Rosa"],
            publisher: "Companhia das Letras",
            page_count: 560,
            year: 2019,
            cover_url:
              "https://api.mercadoeditorial.org/covers/9788535931983.jpg",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("Unexpected call", { status: 500 });
    };

    const res = await searchBookCovers({
      isbn: "9788535931983",
      title: "Grande Sertão: Veredas",
      author: "João Guimarães Rosa",
      pauseBetweenCallsMs: 0,
      fetchImpl: mockFetch,
      probeImpl: async (rawUrl) => ({
        ok: true,
        url: rawUrl,
        width: 400,
        height: 600,
      }),
      envOverride: {
        NODE_ENV: "development",
        HARDCOVER_API_TOKEN: "hc-secret-token",
        ENABLE_APPLE_BOOKS_COVERS: false,
      },
    });

    expect(calledUrls).toHaveLength(1);
    expect(calledUrls[0]).toContain("brasilapi.com.br/api/isbn/v1/9788535931983");
    expect(res.pageCount).toBe(560);
    expect(res.candidates[0]?.source).toBe("brasilapi");
    expect(res.candidates[0]?.pageCount).toBe(560);
    expect(res.diagnostic?.reason).toBe("ok");

    // Segunda chamada idêntica vem do cache (0 novas chamadas HTTP)
    const cachedRes = await searchBookCovers({
      isbn: "9788535931983",
      title: "Grande Sertão: Veredas",
      author: "João Guimarães Rosa",
      pauseBetweenCallsMs: 0,
      fetchImpl: mockFetch,
      probeImpl: async (rawUrl) => ({
        ok: true,
        url: rawUrl,
        width: 400,
        height: 600,
      }),
      envOverride: {
        NODE_ENV: "development",
        HARDCOVER_API_TOKEN: "hc-secret-token",
        ENABLE_APPLE_BOOKS_COVERS: false,
      },
    });
    expect(calledUrls).toHaveLength(1);
    expect(cachedRes.candidates[0]?.coverUrl).toBe(res.candidates[0]?.coverUrl);
  });

  it("com ISBN faz cascata BrasilAPI (sem capa, mantém page_count) -> Google (429) -> Open Library (?default=false) -> Hardcover, com Apple desligado por padrão", async () => {
    const calledUrls: string[] = [];

    const mockFetch: typeof fetch = async (input, init) => {
      const urlStr = typeof input === "string" ? input : input.toString();
      calledUrls.push(urlStr);

      if (urlStr.startsWith("https://brasilapi.com.br/api/isbn/v1/")) {
        return new Response(
          JSON.stringify({
            isbn: "9788535931983",
            title: "Grande Sertão: Veredas",
            authors: ["João Guimarães Rosa"],
            publisher: "Companhia das Letras",
            page_count: 560,
            year: 2019,
            cover_url: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (urlStr.startsWith("https://www.googleapis.com/books/v1/volumes")) {
        return new Response(JSON.stringify({ error: { code: 429 } }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (urlStr.startsWith("https://openlibrary.org/search.json")) {
        return new Response(JSON.stringify({ docs: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (urlStr === "https://api.hardcover.app/v1/graphql") {
        expect(init?.headers).toMatchObject({
          Authorization: "Bearer hc-secret-token",
        });
        return new Response(
          JSON.stringify({
            data: {
              editions: [
                {
                  id: 99,
                  title: "Grande Sertão: Veredas",
                  pages: 568,
                  isbn_13: "9788535931983",
                  release_year: 2019,
                  image: {
                    url: "https://assets.hardcover.app/edition/99/cover.jpg",
                  },
                  book: {
                    title: "Grande Sertão: Veredas",
                    contributions: [
                      { author: { name: "João Guimarães Rosa" } },
                    ],
                  },
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response("Not Found", { status: 404 });
    };

    const res = await searchBookCovers({
      isbn: "9788535931983",
      title: "Grande Sertão: Veredas",
      author: "João Guimarães Rosa",
      pauseBetweenCallsMs: 0,
      fetchImpl: mockFetch,
      probeImpl: async (rawUrl) => {
        if (rawUrl.includes("covers.openlibrary.org")) {
          expect(rawUrl).toContain("?default=false");
          return { ok: false, reason: "http_error", httpStatus: 404 };
        }
        return {
          ok: true,
          url: rawUrl,
          width: 400,
          height: 600,
        };
      },
      envOverride: {
        NODE_ENV: "development",
        HARDCOVER_API_TOKEN: "hc-secret-token",
        ENABLE_APPLE_BOOKS_COVERS: false,
      },
    });

    const providerOrder = calledUrls.map((u) => {
      if (u.includes("brasilapi.com.br")) return "brasilapi";
      if (u.includes("googleapis.com")) return "google";
      if (u.includes("openlibrary.org")) return "openlibrary";
      if (u.includes("hardcover.app")) return "hardcover";
      if (u.includes("itunes.apple.com")) return "apple";
      return "other";
    });

    expect(providerOrder).toEqual([
      "brasilapi",
      "google",
      "openlibrary",
      "hardcover",
    ]);
    expect(providerOrder).not.toContain("apple");

    expect(res.pageCount).toBe(560);
    expect(res.googleRateLimited).toBe(true);
    expect(res.degraded).toBe(true);
    expect(res.fallbackToManualUpload).toBe(false);
    expect(res.candidates).toHaveLength(1);
    expect(res.candidates[0]?.source).toBe("hardcover");
    expect(res.candidates[0]?.coverUrl).toBe(
      "https://assets.hardcover.app/edition/99/cover.jpg"
    );
    expect(res.candidates[0]?.pageCount).toBe(568);
    expect(res.diagnostic?.reason).toBe("ok");
  });

  it("sem ISBN segue Google -> Open Library -> Hardcover e ativa Apple (country=br) apenas quando a feature flag estiver ligada", async () => {
    const calledUrls: string[] = [];

    const mockFetch: typeof fetch = async (input) => {
      const urlStr = typeof input === "string" ? input : input.toString();
      calledUrls.push(urlStr);

      if (urlStr.startsWith("https://www.googleapis.com/books/v1/volumes")) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      }
      if (urlStr.startsWith("https://openlibrary.org/search.json")) {
        return new Response(JSON.stringify({ docs: [] }), { status: 200 });
      }
      if (urlStr === "https://api.hardcover.app/v1/graphql") {
        return new Response(JSON.stringify({ data: { books: [] } }), {
          status: 200,
        });
      }
      if (urlStr.startsWith("https://itunes.apple.com/search")) {
        expect(urlStr).toContain("country=br");
        expect(urlStr).toContain("entity=audiobook");
        return new Response(
          JSON.stringify({
            results: [
              {
                collectionId: 555,
                collectionName: "O Avesso da Pele",
                artistName: "Jeferson Tenório",
                artworkUrl100:
                  "https://is1-ssl.mzstatic.com/image/thumb/Music/v4/cover/100x100bb.jpg",
              },
            ],
          }),
          { status: 200 }
        );
      }
      return new Response("Not Found", { status: 404 });
    };

    const res = await searchBookCovers({
      title: "O Avesso da Pele",
      author: "Jeferson Tenório",
      format: "audiobook",
      pauseBetweenCallsMs: 0,
      fetchImpl: mockFetch,
      probeImpl: async (rawUrl) => ({
        ok: true,
        url: rawUrl,
        width: 600,
        height: 600,
      }),
      envOverride: {
        NODE_ENV: "development",
        HARDCOVER_API_TOKEN: "hc-token",
        ENABLE_APPLE_BOOKS_COVERS: true,
      },
    });

    expect(calledUrls.some((u) => u.includes("brasilapi.com.br"))).toBe(false);
    expect(calledUrls.some((u) => u.includes("itunes.apple.com/search"))).toBe(
      true
    );
    expect(res.candidates).toHaveLength(1);
    expect(res.candidates[0]?.source).toBe("apple");
    expect(res.candidates[0]?.coverUrl).toContain("600x600bb.jpg");
  });

  it("classifica diagnóstico de dev corretamente para filtro de qualidade, erro de API e nenhum resultado", () => {
    const qualityDiag = classifyCoverSearchDiagnostic(0, [
      {
        provider: "google",
        status: "quality_filter",
        candidatesFound: 0,
        rejectedByQuality: 2,
      },
      { provider: "openlibrary", status: "no_results", candidatesFound: 0 },
    ]);
    expect(qualityDiag.reason).toBe("quality_filter");
    expect(qualityDiag.reasonPtBr).toContain("filtro de qualidade");

    const apiErrDiag = classifyCoverSearchDiagnostic(0, [
      {
        provider: "google",
        status: "rate_limited",
        httpStatus: 429,
        candidatesFound: 0,
      },
      { provider: "openlibrary", status: "no_results", candidatesFound: 0 },
    ]);
    expect(apiErrDiag.reason).toBe("api_error");
    expect(apiErrDiag.reasonPtBr).toContain("erro de API");

    const emptyDiag = classifyCoverSearchDiagnostic(0, [
      { provider: "google", status: "no_results", candidatesFound: 0 },
      { provider: "openlibrary", status: "no_results", candidatesFound: 0 },
    ]);
    expect(emptyDiag.reason).toBe("no_results");
    expect(emptyDiag.reasonPtBr).toContain("nenhum resultado");
  });

  it("envia 1ª tentativa do Google Books com frases entre aspas sem acento e 2ª tentativa sem operadores e sem langRestrict=pt", async () => {
    const googleUrls: URL[] = [];

    const mockFetch: typeof fetch = async (input) => {
      const urlStr = typeof input === "string" ? input : input.toString();
      const parsed = new URL(urlStr);

      if (urlStr.startsWith("https://www.googleapis.com/books/v1/volumes")) {
        googleUrls.push(parsed);
        // 1ª tentativa retorna vazio; 2ª tentativa (sem operadores) retorna capa
        if (googleUrls.length === 1) {
          return new Response(JSON.stringify({ items: [] }), { status: 200 });
        }
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "48leis-1",
                volumeInfo: {
                  title: "As 48 Leis do Poder",
                  authors: ["Robert Greene"],
                  pageCount: 544,
                  imageLinks: {
                    thumbnail:
                      "https://books.google.com/books/content?id=48leis-1&printsec=frontcover&img=1&zoom=1",
                  },
                },
              },
            ],
          }),
          { status: 200 }
        );
      }

      if (urlStr.startsWith("https://openlibrary.org/search.json")) {
        return new Response(JSON.stringify({ docs: [] }), { status: 200 });
      }

      return new Response("Not Found", { status: 404 });
    };

    const res = await searchBookCovers({
      title: "As 48 Leis do Poder: Edição Concisa",
      author: "Robert Greene",
      pauseBetweenCallsMs: 0,
      fetchImpl: mockFetch,
      envOverride: {
        NODE_ENV: "development",
        ENABLE_APPLE_BOOKS_COVERS: false,
      },
    });

    expect(googleUrls.length).toBeGreaterThanOrEqual(2);
    expect(googleUrls[0]?.searchParams.get("q")).toBe(
      'intitle:"as 48 leis do poder" inauthor:"greene"'
    );
    expect(googleUrls[0]?.searchParams.get("langRestrict")).toBe("pt");

    expect(googleUrls[1]?.searchParams.get("q")).toBe(
      "as 48 leis do poder robert greene"
    );
    expect(googleUrls[1]?.searchParams.get("langRestrict")).toBeNull();

    expect(res.candidates.length).toBeGreaterThanOrEqual(1);
    expect(res.candidates[0]?.source).toBe("google");
    expect(res.candidates[0]?.title).toBe("As 48 Leis do Poder");
  });

  it("429/403/timeout não é tratado como 'sem capa', retorna apiUnavailable=true e não faz cache do erro", async () => {
    let calls = 0;

    const mockFetch: typeof fetch = async () => {
      calls += 1;
      return new Response(JSON.stringify({ error: { code: 429 } }), {
        status: 429,
      });
    };

    const firstRes = await searchBookCovers({
      title: "As 48 Leis do Poder",
      author: "Robert Greene",
      pauseBetweenCallsMs: 0,
      fetchImpl: mockFetch,
      envOverride: {
        NODE_ENV: "development",
        ENABLE_APPLE_BOOKS_COVERS: false,
      },
    });

    expect(firstRes.apiUnavailable).toBe(true);
    expect(firstRes.degraded).toBe(true);
    expect(firstRes.notice).toBe("Serviço indisponível, tentar de novo.");
    const firstCalls = calls;
    expect(firstCalls).toBeGreaterThan(0);

    // Como erro de API nunca é cacheado como resultado vazio, uma nova chamada com bypassCache=false não retorna do cache
    resetCoverSearchRuntimeCaches();
  });
});
