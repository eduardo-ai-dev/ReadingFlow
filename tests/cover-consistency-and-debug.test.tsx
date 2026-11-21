import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { BookCover } from "@/components/BookCover";
import { CoverEditionPicker } from "@/components/CoverEditionPicker";
import {
  isCoverDebugEnabled,
  resolvePersistedCoverUrl,
  resolveWorkCoverEdition,
} from "@/features/catalog/cover-url";
import type { Edition } from "@/lib/domain";

const ORIGINAL_COVER_DEBUG = process.env.NEXT_PUBLIC_COVER_DEBUG;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (ORIGINAL_COVER_DEBUG === undefined) {
    delete process.env.NEXT_PUBLIC_COVER_DEBUG;
  } else {
    process.env.NEXT_PUBLIC_COVER_DEBUG = ORIGINAL_COVER_DEBUG;
  }
});

describe("Bug 4 regression — Capa persistida consistente, zero fetch na exibição e selo dev atrás de NEXT_PUBLIC_COVER_DEBUG=1", () => {
  it("não exibe selo dev: por padrão e não dispara nenhuma requisição fetch ao renderizar BookCover", () => {
    delete process.env.NEXT_PUBLIC_COVER_DEBUG;
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const { container } = render(
      <BookCover
        title="Torto Arado"
        author="Itamar Vieira Junior"
        coverUrl={null}
        diagnosticReason="google: 429 · ol: 1 ok"
        size="md"
      />
    );

    expect(isCoverDebugEnabled()).toBe(false);
    expect(container.textContent).not.toContain("dev:");
    expect(
      container.querySelector('[data-testid="book-cover-dev-badge"]')
    ).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("exibe selo dev: SOMENTE quando NEXT_PUBLIC_COVER_DEBUG=1 fora de produção", () => {
    process.env.NEXT_PUBLIC_COVER_DEBUG = "1";

    const { container } = render(
      <BookCover
        title="Torto Arado"
        author="Itamar Vieira Junior"
        coverUrl={null}
        diagnosticReason="ol: 1 ok"
        size="md"
      />
    );

    expect(isCoverDebugEnabled()).toBe(true);
    const badge = container.querySelector(
      '[data-testid="book-cover-dev-badge"]'
    );
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain("dev: ol: 1 ok");
  });

  it("resolveWorkCoverEdition garante a mesma cover_url entre Painel e Estante mesmo com múltiplas edições (ex.: Torto Arado)", () => {
    const editionWithoutCover: Edition = {
      id: "ed-torto-1",
      workId: "work-torto",
      ownerId: "user-test",
      source: "manual",
      title: "Torto Arado",
      contributors: [{ name: "Itamar Vieira Junior", role: "author" }],
      format: "paperback",
      language: "pt-BR",
      pages: 264,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const editionWithCover: Edition = {
      id: "ed-torto-2",
      workId: "work-torto",
      ownerId: "user-test",
      source: "open_library",
      title: "Torto Arado",
      contributors: [{ name: "Itamar Vieira Junior", role: "author" }],
      format: "hardcover",
      language: "pt-BR",
      pages: 264,
      coverUrl: "https://covers.openlibrary.org/b/id/123456-L.jpg",
      coverSource: "openlibrary",
      createdAt: "2026-01-02T00:00:00.000Z",
    };

    const editions = [editionWithoutCover, editionWithCover];
    const editionsById = new Map(editions.map((e) => [e.id, e]));

    const estanteEdition = resolveWorkCoverEdition({
      workId: "work-torto",
      preferredEditionId: "ed-torto-1",
      editions,
      editionsById,
    });
    const painelEdition = resolveWorkCoverEdition({
      workId: "work-torto",
      preferredEditionId: "ed-torto-2",
      editions,
      editionsById,
    });

    expect(resolvePersistedCoverUrl(estanteEdition)).toBe(
      "https://covers.openlibrary.org/b/id/123456-L.jpg"
    );
    expect(resolvePersistedCoverUrl(painelEdition)).toBe(
      resolvePersistedCoverUrl(estanteEdition)
    );
  });

  it("persiste automaticamente via onApply quando busca explícita no CoverEditionPicker retorna match inequívoco (ol: 1 ok) e oculta selo dev sem flag", async () => {
    delete process.env.NEXT_PUBLIC_COVER_DEBUG;
    const onApply = vi.fn();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [
            {
              id: "ol-torto-1",
              source: "openlibrary",
              title: "Torto Arado",
              authors: ["Itamar Vieira Junior"],
              coverUrl: "https://covers.openlibrary.org/b/id/987654-L.jpg",
              pageCount: 264,
            },
          ],
          pageCount: 264,
          degraded: false,
          googleRateLimited: true,
          fallbackToManualUpload: false,
          diagnostic: {
            reason: "ok",
            reasonPtBr: "ol: 1 ok",
            badgePtBr: "google: 429 · ol: 1 ok",
            attempts: [],
            queriesSent: [],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    render(
      <CoverEditionPicker
        title="Torto Arado"
        author="Itamar Vieira Junior"
        selectedCoverUrl={null}
        autoSearch
        onApply={onApply}
      />
    );

    await waitFor(() => {
      expect(onApply).toHaveBeenCalledWith(
        expect.objectContaining({
          coverUrl: "https://covers.openlibrary.org/b/id/987654-L.jpg",
          coverSource: "openlibrary",
        })
      );
    });

    expect(screen.queryByTestId("cover-picker-dev-badge")).toBeNull();
  });
});
