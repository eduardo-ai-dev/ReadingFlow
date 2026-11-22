import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  buildGoogleBooksQueryPlan,
  classifyCoverSearchDiagnostic,
  deduplicateCoverCandidates,
  doesAuthorMatch,
  evaluateAuthorMatch,
  extractAuthorSurname,
  formatDiagnosticDevBadge,
  isAcceptableCoverDimensions,
  isDisqualifiedCoverTitle,
  isInvalidCoverPlaceholder,
  isUnambiguousCoverMatch,
  resolveBookCoverFallbackPalette,
  scoreCoverCandidate,
  stripBookTitleSubtitle,
  type CoverSearchCandidate,
} from "@/features/catalog/cover-search-rules";
import {
  getFromUserCoverBucket,
  importCoverFromExternalUrl,
  isPrivateOrReservedIp,
  validateAndResolveSsrfSafeUrl,
} from "@/server/catalog/cover-url-import";
import { validateChosenCoverWithSharp } from "@/server/catalog/cover-search";

describe("cover-search-rules", () => {
  describe("isDisqualifiedCoverTitle", () => {
    it("descarta resumos, análises e guias de estudo em pt-BR e inglês", () => {
      expect(isDisqualifiedCoverTitle("Resumo de Dom Casmurro")).toBe(true);
      expect(isDisqualifiedCoverTitle("Análise Crítica: 1984")).toBe(true);
      expect(isDisqualifiedCoverTitle("Guia de Estudo — Grande Sertão")).toBe(
        true
      );
      expect(isDisqualifiedCoverTitle("Summary of Atomic Habits")).toBe(true);
      expect(isDisqualifiedCoverTitle("Study Guide: Dune")).toBe(true);
    });

    it("mantém títulos legítimos de obras", () => {
      expect(isDisqualifiedCoverTitle("Dom Casmurro")).toBe(false);
      expect(isDisqualifiedCoverTitle("Torto Arado")).toBe(false);
      expect(
        isDisqualifiedCoverTitle("O Guia do Mochileiro das Galáxias")
      ).toBe(false);
      expect(isDisqualifiedCoverTitle("Grande Sertão: Veredas")).toBe(false);
    });
  });

  describe("stripBookTitleSubtitle & buildGoogleBooksQueryPlan", () => {
    it("remove subtítulo e sufixo de formato preservando hifens de palavras compostas", () => {
      expect(stripBookTitleSubtitle("Grande Sertão: Veredas")).toBe(
        "Grande Sertão"
      );
      expect(stripBookTitleSubtitle("Blink: A Decisão num Piscar")).toBe(
        "Blink"
      );
      expect(stripBookTitleSubtitle("O Avesso da Pele (Audiobook)")).toBe(
        "O Avesso da Pele"
      );
      expect(stripBookTitleSubtitle("Micro-Hábitos")).toBe("Micro-Hábitos");
    });

    it("monta 1ª tentativa com frases entre aspas sem acento e 2ª tentativa sem operadores e sem langRestrict=pt", () => {
      const plan = buildGoogleBooksQueryPlan({
        title: "As 48 Leis do Poder: Edição Integral",
        author: "Robert Greene",
      });

      expect(plan[0]).toEqual({
        strategy: "title_author_quoted",
        query: 'intitle:"as 48 leis do poder" inauthor:"greene"',
        langRestrictPt: true,
      });

      expect(plan[1]).toEqual({
        strategy: "title_author_plain",
        query: "as 48 leis do poder robert greene",
        langRestrictPt: false,
      });

      expect(
        plan.some(
          (p) =>
            p.strategy === "title_only_quoted" &&
            p.query === 'intitle:"as 48 leis do poder"' &&
            p.langRestrictPt === false
        )
      ).toBe(true);
    });
  });

  describe("doesAuthorMatch & evaluateAuthorMatch (autores só com sobrenome e redução de pontuação)", () => {
    it("aceita autores guardados só com sobrenome ('Assis', 'Greene', 'Rosa') quando todos os tokens existem na candidata", () => {
      expect(doesAuthorMatch("Assis", ["Machado de Assis"])).toBe(true);
      expect(doesAuthorMatch("Greene", ["Robert Greene"])).toBe(true);
      expect(doesAuthorMatch("Rosa", ["João Guimarães Rosa"])).toBe(true);
      expect(extractAuthorSurname("Machado de Assis")).toBe("assis");
      expect(extractAuthorSurname("Robert Greene")).toBe("greene");
      expect(extractAuthorSurname("João Guimarães Rosa")).toBe("rosa");
      expect(extractAuthorSurname("Itamar Vieira Junior")).toBe("vieira");
    });

    it("aceita variações de acento, ordem e iniciais (incluindo 'BJ Fogg' vs 'B.J. Fogg')", () => {
      expect(doesAuthorMatch("Machado de Assis", ["Machado de Assis"])).toBe(
        true
      );
      expect(doesAuthorMatch("Machado de Assis", ["Assis, Machado de"])).toBe(
        true
      );
      expect(
        doesAuthorMatch("Itamar Vieira Junior", ["Itamar Vieira Júnior"])
      ).toBe(true);
      expect(
        doesAuthorMatch("J. R. R. Tolkien", ["John Ronald Reuel Tolkien"])
      ).toBe(true);
      expect(doesAuthorMatch("BJ Fogg", ["B.J. Fogg"])).toBe(true);
      expect(doesAuthorMatch("Clarice Lispector", ["Lispector"])).toBe(true);
    });

    it("rejeita autores claramente diferentes em doesAuthorMatch mas reduz pontuação em scoreCoverCandidate sem descartar", () => {
      expect(doesAuthorMatch("Machado de Assis", ["José de Alencar"])).toBe(
        false
      );
      expect(doesAuthorMatch("George Orwell", ["Aldous Huxley"])).toBe(false);
      expect(doesAuthorMatch("Clarice Lispector", [])).toBe(false);

      const exactEval = evaluateAuthorMatch("Assis", ["Machado de Assis"]);
      const mismatchEval = evaluateAuthorMatch("Ichiro Kishimi", [
        "Fumitake Koga",
      ]);
      expect(exactEval.status).toBe("exact");
      expect(exactEval.scoreDelta).toBeGreaterThan(mismatchEval.scoreDelta);

      const candidateWithCoauthor: CoverSearchCandidate = {
        id: "ol-coragem",
        source: "openlibrary",
        coverUrl:
          "https://covers.openlibrary.org/b/id/12345-L.jpg?default=false",
        title: "A Coragem de Não Agradar",
        authors: ["Fumitake Koga"],
      };

      const scored = scoreCoverCandidate(
        { title: "A Coragem de Não Agradar", author: "Ichiro Kishimi" },
        candidateWithCoauthor
      );
      expect(scored.uncertainMatch).toBe(true);

      const deduped = deduplicateCoverCandidates([candidateWithCoauthor], 8, {
        title: "A Coragem de Não Agradar",
        author: "Ichiro Kishimi",
      });
      expect(deduped).toHaveLength(1);
      expect(deduped[0]?.uncertainMatch).toBe(true);
    });
  });

  describe("isInvalidCoverPlaceholder & isAcceptableCoverDimensions", () => {
    it("descarta placeholders 1x1 e URLs de 'image_not_available', mas não rejeita por largura de metadados na busca", () => {
      expect(
        isInvalidCoverPlaceholder({
          url: "https://covers.openlibrary.org/b/id/1-L.jpg",
          width: 1,
          height: 1,
        })
      ).toBe(true);
      expect(
        isInvalidCoverPlaceholder({
          url: "https://example.com/images/image_not_available.jpg",
        })
      ).toBe(true);
      expect(
        isInvalidCoverPlaceholder({
          url: "https://books.google.com/books/content?id=1&zoom=1",
          width: 128,
          height: 192,
        })
      ).toBe(false);
    });

    it("mantém isAcceptableCoverDimensions para validação estrita 2:3", () => {
      expect(isAcceptableCoverDimensions(400, 600)).toBe(true);
      expect(isAcceptableCoverDimensions(200, 320)).toBe(true);
      expect(isAcceptableCoverDimensions(128, 192)).toBe(false);
      expect(isAcceptableCoverDimensions(400, 400)).toBe(false);
    });

    it("valida a dimensão da candidata escolhida com sharp (validateChosenCoverWithSharp)", async () => {
      const validBuf = await sharp({
        create: { width: 320, height: 480, channels: 3, background: "#722F3E" },
      })
        .webp()
        .toBuffer();
      const validDataUrl = `data:image/webp;base64,${validBuf.toString("base64")}`;
      const okRes = await validateChosenCoverWithSharp(validDataUrl);
      expect(okRes.ok).toBe(true);
      expect(okRes.width).toBe(320);
      expect(okRes.height).toBe(480);

      const tinyBuf = await sharp({
        create: { width: 1, height: 1, channels: 3, background: "#000000" },
      })
        .png()
        .toBuffer();
      const tinyDataUrl = `data:image/png;base64,${tinyBuf.toString("base64")}`;
      const badRes = await validateChosenCoverWithSharp(tinyDataUrl);
      expect(badRes.ok).toBe(false);
    });
  });

  describe("deduplicateCoverCandidates & ranqueamento por tamanho", () => {
    it("deduplica por ISBN normalizado, ranqueia maior resolução primeiro e limita a 8 candidatas", () => {
      const list: CoverSearchCandidate[] = [
        {
          id: "g-small",
          source: "google",
          coverUrl: "https://books.google.com/books/content?id=small&zoom=1",
          title: "Dom Casmurro",
          authors: ["Machado de Assis"],
          width: 128,
          height: 192,
        },
        {
          id: "g-large",
          source: "google",
          coverUrl: "https://books.google.com/books/content?id=large&zoom=3",
          title: "Dom Casmurro",
          authors: ["Machado de Assis"],
          isbn: "978-85-359-0277-8",
          width: 600,
          height: 900,
        },
        {
          id: "ol1",
          source: "openlibrary",
          coverUrl: "https://covers.openlibrary.org/b/isbn/9788535902778-L.jpg",
          title: "Dom Casmurro",
          authors: ["Machado de Assis"],
          isbn: "9788535902778",
        },
        ...Array.from({ length: 10 }, (_, idx) => ({
          id: `extra-${idx}`,
          source: "google" as const,
          coverUrl: `https://books.google.com/books/content?id=extra-${idx}`,
          title: `Dom Casmurro Edição ${idx}`,
          authors: ["Machado de Assis"],
        })),
      ];

      const deduped = deduplicateCoverCandidates(list, 8, {
        title: "Dom Casmurro",
        author: "Machado de Assis",
        isbn: "9788535902778",
      });
      expect(deduped).toHaveLength(8);
      expect(deduped[0]?.id).toBe("g-large");
      expect(deduped.some((c) => c.id === "ol1")).toBe(false);
    });
  });

  describe("formatDiagnosticDevBadge & classifyCoverSearchDiagnostic", () => {
    it("formata o selo de dev com o motivo real (ex.: google: 0 resultados · ol: 404 · filtro: autor)", () => {
      const badge = formatDiagnosticDevBadge([
        {
          provider: "google",
          status: "no_results",
          httpStatus: 200,
          totalResults: 0,
          candidatesFound: 0,
        },
        {
          provider: "openlibrary",
          status: "no_results",
          httpStatus: 404,
          totalResults: 0,
          candidatesFound: 0,
          rejectedByAuthor: 2,
        },
      ]);

      expect(badge).toBe("google: 0 resultados · ol: 404 · filtro: autor");

      const diag = classifyCoverSearchDiagnostic(0, [
        {
          provider: "google",
          status: "rate_limited",
          httpStatus: 429,
          totalResults: 0,
          candidatesFound: 0,
        },
        {
          provider: "openlibrary",
          status: "no_results",
          httpStatus: 200,
          totalResults: 3,
          candidatesFound: 0,
          rejectedByMissingImageLinks: 2,
          rejectedBySummary: 1,
        },
      ]);
      expect(diag.badgePtBr).toBe(
        'google: 429 · ol: 0/3 · filtro: "resumo", sem imageLinks'
      );
    });
  });

  describe("isUnambiguousCoverMatch", () => {
    const candidates: CoverSearchCandidate[] = [
      {
        id: "g1",
        source: "google",
        coverUrl: "https://books.google.com/books/content?id=dom1",
        title: "Dom Casmurro",
        authors: ["Machado de Assis"],
        isbn: "9788535902778",
      },
      {
        id: "g2",
        source: "google",
        coverUrl: "https://books.google.com/books/content?id=dom2",
        title: "Dom Casmurro: Edição Comentada",
        authors: ["Machado de Assis"],
      },
    ];

    it("aplica automaticamente quando ISBN bate exatamente", () => {
      const match = isUnambiguousCoverMatch(
        {
          title: "Dom Casmurro",
          author: "Machado de Assis",
          isbn: "978-85-359-0277-8",
        },
        candidates
      );
      expect(match?.id).toBe("g1");
    });

    it("aplica automaticamente quando título (inclusive sem subtítulo) e autor batem de forma inequívoca", () => {
      const match = isUnambiguousCoverMatch(
        { title: "Dom Casmurro", author: "Machado de Assis" },
        candidates
      );
      expect(match?.id).toBe("g1");

      const subtitleMatch = isUnambiguousCoverMatch(
        {
          title: "Blink: A Decisão num Piscar",
          author: "Malcolm Gladwell",
        },
        [
          {
            id: "ol-blink",
            source: "openlibrary",
            coverUrl: "https://covers.openlibrary.org/b/id/999-L.jpg",
            title: "Blink",
            authors: ["Malcolm Gladwell"],
          },
        ]
      );
      expect(subtitleMatch?.id).toBe("ol-blink");
    });

    it("exige confirmação do usuário quando o título não bate ou quando marcada como uncertainMatch", () => {
      const match = isUnambiguousCoverMatch(
        { title: "A Revolução", author: "George Orwell" },
        [
          {
            id: "g3",
            source: "google",
            coverUrl: "https://books.google.com/books/content?id=rev",
            title: "A Revolução dos Bichos",
            authors: ["George Orwell"],
          },
        ]
      );
      expect(match).toBeNull();

      const uncertain = isUnambiguousCoverMatch(
        { title: "Dom Casmurro", author: "Clarice Lispector" },
        candidates
      );
      expect(uncertain).toBeNull();
    });
  });

  describe("Colar link da imagem: proteção contra SSRF + re-encode com sharp + bucket do usuário", () => {
    it("bloqueia IPs privados, loopback, link-local, CGNAT e IPv4-mapped IPv6", () => {
      expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
      expect(isPrivateOrReservedIp("10.0.0.8")).toBe(true);
      expect(isPrivateOrReservedIp("172.16.0.1")).toBe(true);
      expect(isPrivateOrReservedIp("172.31.255.255")).toBe(true);
      expect(isPrivateOrReservedIp("192.168.1.100")).toBe(true);
      expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true);
      expect(isPrivateOrReservedIp("100.64.0.1")).toBe(true);
      expect(isPrivateOrReservedIp("0.0.0.0")).toBe(true);
      expect(isPrivateOrReservedIp("::1")).toBe(true);
      expect(isPrivateOrReservedIp("fe80::1")).toBe(true);
      expect(isPrivateOrReservedIp("fc00::1")).toBe(true);
      expect(isPrivateOrReservedIp("fd12:3456:789a::1")).toBe(true);
      expect(isPrivateOrReservedIp("::ffff:127.0.0.1")).toBe(true);
      expect(isPrivateOrReservedIp("::ffff:169.254.169.254")).toBe(true);

      // IPs públicos legítimos
      expect(isPrivateOrReservedIp("93.184.216.34")).toBe(false);
      expect(isPrivateOrReservedIp("172.32.0.1")).toBe(false);
      expect(isPrivateOrReservedIp("2606:2800:220:1:248:1893:25c8:1946")).toBe(
        false
      );
    });

    it("rejeita links não-HTTPS e domínios que resolvem para IP privado após DNS lookup", async () => {
      const nonHttps = await validateAndResolveSsrfSafeUrl(
        "http://example.com/cover.jpg",
        async () => [{ address: "93.184.216.34", family: 4 }]
      );
      expect(nonHttps.ok).toBe(false);
      if (!nonHttps.ok) expect(nonHttps.code).toBe("non_https");

      const dnsRebindToMetadata = await validateAndResolveSsrfSafeUrl(
        "https://evil.example.com/cover.jpg",
        async () => [{ address: "169.254.169.254", family: 4 }]
      );
      expect(dnsRebindToMetadata.ok).toBe(false);
      if (!dnsRebindToMetadata.ok) {
        expect(dnsRebindToMetadata.code).toBe("ssrf_blocked");
      }

      const dnsRebindToLoopbackIpv6 = await validateAndResolveSsrfSafeUrl(
        "https://evil6.example.com/cover.jpg",
        async () => [{ address: "::1", family: 6 }]
      );
      expect(dnsRebindToLoopbackIpv6.ok).toBe(false);
      if (!dnsRebindToLoopbackIpv6.ok) {
        expect(dnsRebindToLoopbackIpv6.code).toBe("ssrf_blocked");
      }
    });

    it("baixa imagem pública via HTTPS, bloqueia content-type inválido, re-encoda com sharp e salva no bucket do usuário", async () => {
      const samplePng = await sharp({
        create: { width: 420, height: 630, channels: 3, background: "#6E1E2A" },
      })
        .png()
        .toBuffer();

      const okImport = await importCoverFromExternalUrl({
        url: "https://cdn.example.com/books/capa.png",
        userId: "user-demo-acervo",
        editionId: "ed-test-1",
        lookupImpl: async () => [{ address: "93.184.216.34", family: 4 }],
        fetchImpl: async () =>
          new Response(new Uint8Array(samplePng), {
            status: 200,
            headers: { "Content-Type": "image/png" },
          }),
      });

      expect(okImport.ok).toBe(true);
      if (okImport.ok) {
        expect(okImport.dataUrl).toMatch(
          /^data:image\/(webp|png|jpeg);base64,/
        );
        expect(okImport.bucketPath).toMatch(
          /^covers\/user-demo-acervo\/ed-test-1-[0-9a-f]+\.(webp|png|jpg)$/
        );
        expect(okImport.width).toBe(420);
        expect(okImport.height).toBe(630);

        const stored = getFromUserCoverBucket(
          "user-demo-acervo",
          okImport.bucketPath
        );
        expect(stored).not.toBeNull();
        expect(stored?.mimeType).toBe("image/png");
      }

      // Rejeita content-type text/html
      const htmlImport = await importCoverFromExternalUrl({
        url: "https://cdn.example.com/books/not-image",
        userId: "user-demo-acervo",
        lookupImpl: async () => [{ address: "93.184.216.34", family: 4 }],
        fetchImpl: async () =>
          new Response("<html></html>", {
            status: 200,
            headers: { "Content-Type": "text/html" },
          }),
      });
      expect(htmlImport.ok).toBe(false);
      if (!htmlImport.ok) {
        expect(htmlImport.code).toBe("invalid_content_type");
      }
    });
  });

  describe("resolveBookCoverFallbackPalette", () => {
    it("deriva cores vivas determinísticas a partir do id/seed", () => {
      const p1 = resolveBookCoverFallbackPalette({ seed: "work-dom-casmurro" });
      const p2 = resolveBookCoverFallbackPalette({ seed: "work-torto-arado" });
      expect(p1.backgroundHex).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(p1.accentHex).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(p1.backgroundHex).not.toBe(p2.backgroundHex);
    });
  });
});
