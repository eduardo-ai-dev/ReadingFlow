import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  isAllowedCoverImportHostname,
  validateAndResolveSsrfSafeUrl,
} from "@/server/catalog/cover-url-import";
import {
  resetCoverSearchRuntimeCaches,
  searchBookCovers,
} from "@/server/catalog/cover-search";
import { inspectImageHeader } from "@/server/catalog/image-header";

describe("Resiliência Cloudflare Workers (workerd) em /api/covers/search", () => {
  beforeEach(() => {
    resetCoverSearchRuntimeCaches();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("não importa node:dns, node:net, node:fs nem sharp nos módulos de busca/importação de capa", () => {
    const files = [
      "src/app/api/covers/search/route.ts",
      "src/server/catalog/cover-search.ts",
      "src/server/catalog/cover-url-import.ts",
      "src/server/catalog/image-header.ts",
    ];
    for (const rel of files) {
      const content = readFileSync(path.join(process.cwd(), rel), "utf8");
      expect(content).not.toMatch(/from\s+["']node:dns/);
      expect(content).not.toMatch(/from\s+["']node:net["']/);
      expect(content).not.toMatch(/from\s+["']node:fs/);
      expect(content).not.toMatch(/from\s+["']sharp["']/);
      expect(content).not.toMatch(/next:\s*\{\s*revalidate/);
    }
  });

  it("valida SSRF sem node:dns usando allowlist estrita HTTPS + bloqueio de IPs privados/ofuscados", async () => {
    expect(isAllowedCoverImportHostname("covers.openlibrary.org")).toBe(true);
    expect(isAllowedCoverImportHostname("books.google.com")).toBe(true);
    expect(isAllowedCoverImportHostname("m.media-amazon.com")).toBe(true);
    expect(isAllowedCoverImportHostname("evil.example.com")).toBe(false);

    const allowed = await validateAndResolveSsrfSafeUrl(
      "https://covers.openlibrary.org/b/isbn/9780140449136-L.jpg"
    );
    expect(allowed.ok).toBe(true);

    const blockedCases = [
      "http://covers.openlibrary.org/b/isbn/9780140449136-L.jpg",
      "https://localhost/cover.jpg",
      "https://127.0.0.1/cover.jpg",
      "https://169.254.169.254/latest/meta-data/",
      "https://[::1]/cover.jpg",
      "https://[fc00::1]/cover.jpg",
      "https://2130706433/cover.jpg",
      "https://0x7f000001/cover.jpg",
      "https://metadata.google.internal/computeMetadata/v1/",
      "https://covers.openlibrary.org:8443/b/id/1-L.jpg",
      "https://user:pass@covers.openlibrary.org/b/id/1-L.jpg",
      "https://untrusted-host.example/cover.jpg",
    ];

    for (const url of blockedCases) {
      const res = await validateAndResolveSsrfSafeUrl(url);
      expect(res.ok, `deveria bloquear ${url}`).toBe(false);
    }
  });

  it("isola falhas de um provedor e degrada para o próximo sem lançar exceção (nunca 500)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const fetchImpl: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("googleapis.com")) {
        throw new Error("Simulated Google Books network crash ?key=SECRET123");
      }
      if (url.includes("openlibrary.org/search.json")) {
        return new Response(
          JSON.stringify({
            docs: [
              {
                key: "/works/OL1W",
                title: "Dom Casmurro",
                author_name: ["Machado de Assis"],
                cover_i: 647501,
                first_publish_year: 1899,
                number_of_pages_median: 256,
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      throw new Error("Unexpected provider failure");
    };

    const result = await searchBookCovers({
      title: "Dom Casmurro",
      author: "Machado de Assis",
      fetchImpl,
      pauseBetweenCallsMs: 0,
      envOverride: {
        GOOGLE_BOOKS_API_KEY: "SECRET123",
        HARDCOVER_API_TOKEN: undefined,
        ENABLE_APPLE_BOOKS_COVERS: false,
      },
    });

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0]?.source).toBe("openlibrary");
    expect(errSpy).toHaveBeenCalled();
    // Garante que a chave nunca vaza no log
    const logged = JSON.stringify(errSpy.mock.calls);
    expect(logged).not.toContain("SECRET123");
  });

  it("retorna fallback controlado quando todos os provedores lançam exceção", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const crashingFetch: typeof fetch = async () => {
      throw new Error("Total network failure");
    };

    const result = await searchBookCovers({
      title: "Memórias Póstumas",
      author: "Machado de Assis",
      isbn: "9788520922316",
      fetchImpl: crashingFetch,
      pauseBetweenCallsMs: 0,
      envOverride: {
        GOOGLE_BOOKS_API_KEY: undefined,
        HARDCOVER_API_TOKEN: "Bearer-TOP-SECRET",
        ENABLE_APPLE_BOOKS_COVERS: false,
      },
    });

    expect(result.candidates).toEqual([]);
    expect(result.degraded).toBe(true);
    expect(result.apiUnavailable).toBe(true);
    expect(result.fallbackToManualUpload).toBe(true);
    expect(errSpy).toHaveBeenCalled();
  });

  it("inspectImageHeader retorna null sem lançar em cabeçalhos corrompidos ou truncados", () => {
    expect(inspectImageHeader(new Uint8Array(0))).toBeNull();
    expect(
      inspectImageHeader(new Uint8Array([0xff, 0xd8, 0xff, 0xc0]))
    ).toBeNull();
    expect(
      inspectImageHeader(
        new Uint8Array([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
        ])
      )
    ).toBeNull();
    expect(
      inspectImageHeader(
        new Uint8Array([
          0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56,
          0x50, 0x38, 0x58,
        ])
      )
    ).toBeNull();
  });
});
