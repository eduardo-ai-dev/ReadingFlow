import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetAuthenticatedWorkspace = vi.fn();
const mockIsDemoWorkspace = vi.fn();
const mockSearchBookCovers = vi.fn();

vi.mock("@/server/store/memory-repository", () => ({
  getAuthenticatedWorkspace: () => mockGetAuthenticatedWorkspace(),
  isDemoWorkspace: (ws: unknown) => mockIsDemoWorkspace(ws),
}));

vi.mock("@/server/catalog/cover-search", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/catalog/cover-search")>();
  return {
    ...actual,
    searchBookCovers: (...args: unknown[]) => mockSearchBookCovers(...args),
  };
});

import { GET } from "@/app/api/covers/search/route";

describe("Degradação graciosa da rota GET /api/covers/search (sem HTTP 500)", () => {
  beforeEach(() => {
    mockGetAuthenticatedWorkspace.mockReset();
    mockIsDemoWorkspace.mockReset();
    mockSearchBookCovers.mockReset();
    mockGetAuthenticatedWorkspace.mockResolvedValue({
      profile: { id: "user-route-test-1" },
    });
    mockIsDemoWorkspace.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mantém HTTP 400 quando parâmetros de entrada do cliente são inválidos", async () => {
    const req = new NextRequest(
      "https://readingflow.app/api/covers/search?title=a"
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      candidates: unknown[];
      fallbackToManualUpload: boolean;
    };
    expect(body.candidates).toEqual([]);
    expect(body.fallbackToManualUpload).toBe(true);
  });

  it("retorna HTTP 200 com fallback controlado e loga [covers/search] quando searchBookCovers lança exceção", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockSearchBookCovers.mockRejectedValueOnce(
      new Error("Unexpected crash ?key=SUPER_SECRET")
    );

    const req = new NextRequest(
      "https://readingflow.app/api/covers/search?title=Dom%20Casmurro&nocache=1"
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      candidates: unknown[];
      degraded: boolean;
      googleRateLimited: boolean;
      apiUnavailable: boolean;
      fallbackToManualUpload: boolean;
      notice?: string;
    };
    expect(body.candidates).toEqual([]);
    expect(body.degraded).toBe(true);
    expect(body.googleRateLimited).toBe(false);
    expect(body.apiUnavailable).toBe(true);
    expect(body.fallbackToManualUpload).toBe(true);
    expect(body.notice).toBeTruthy();

    expect(errSpy).toHaveBeenCalledWith(
      "[covers/search]",
      expect.objectContaining({ method: "GET" })
    );
    expect(JSON.stringify(errSpy.mock.calls)).not.toContain("SUPER_SECRET");
  });

  it("retorna HTTP 200 com fallback controlado quando getAuthenticatedWorkspace lança exceção inesperada", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetAuthenticatedWorkspace.mockRejectedValueOnce(
      new Error("Transient D1 error")
    );

    const req = new NextRequest(
      "https://readingflow.app/api/covers/search?title=Dom%20Casmurro"
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      candidates: unknown[];
      degraded: boolean;
      apiUnavailable: boolean;
      fallbackToManualUpload: boolean;
    };
    expect(body.candidates).toEqual([]);
    expect(body.degraded).toBe(true);
    expect(body.apiUnavailable).toBe(true);
    expect(body.fallbackToManualUpload).toBe(true);
    expect(errSpy).toHaveBeenCalledWith(
      "[covers/search]",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("permite GET /api/covers/search em sessão demonstrativa em modo somente leitura, ignorando nocache=1 e sem gravar cache", async () => {
    mockGetAuthenticatedWorkspace.mockResolvedValueOnce({
      profile: { id: "user-demo-acervo" },
    });
    mockIsDemoWorkspace.mockReturnValueOnce(true);
    mockSearchBookCovers.mockResolvedValueOnce({
      candidates: [],
      degraded: false,
      googleRateLimited: false,
      apiUnavailable: false,
      fallbackToManualUpload: true,
    });

    const req = new NextRequest(
      "https://readingflow.app/api/covers/search?title=Dom%20Casmurro&nocache=1"
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockSearchBookCovers).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Dom Casmurro",
        bypassCache: false,
        skipCacheWrite: true,
      })
    );
  });
});
