import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  buildNewBookDiscoveryQuery,
  filterNewBookSuggestions,
  normalizeSuggestionCoverUrl,
  pickWishlistSuggestions,
  type WishlistEligibilityInput,
} from "@/features/suggestions/rules";
import { computeWorkFingerprint } from "@/features/catalog/rules";
import { BookSuggestionsClient } from "@/components/BookSuggestionsClient";
import type { BookSearchResult } from "@/features/catalog/search-types";

const mockSaveToWishlist = vi.fn();
const mockStartNewReading = vi.fn();
const mockStartWishlistReading = vi.fn();

vi.mock("@/features/suggestions/actions", () => ({
  saveSuggestionToWishlistAction: (...args: unknown[]) =>
    mockSaveToWishlist(...args),
  startReadingNewSuggestionAction: (...args: unknown[]) =>
    mockStartNewReading(...args),
}));

vi.mock("@/features/wishlist/actions", () => ({
  startReadingFromWishlistAction: (...args: unknown[]) =>
    mockStartWishlistReading(...args),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mockSaveToWishlist.mockReset();
  mockStartNewReading.mockReset();
  mockStartWishlistReading.mockReset();
});

describe("Item 5 — Regras puras de Sugestões (Lista de Desejos vs. Novos Livros)", () => {
  it("pickWishlistSuggestions filtra apenas status='wanted', exclui já lidos/em leitura/possuídos e ordena por prioridade", () => {
    const entries: WishlistEligibilityInput[] = [
      {
        wishId: "w-read",
        workId: "work-read",
        status: "wanted",
        title: "Livro Já Lido",
        author: "Autor A",
        priority: 5,
        seed: "work-read",
        createdAt: "2026-01-10T00:00:00Z",
      },
      {
        wishId: "w-reading",
        workId: "work-reading",
        status: "wanted",
        title: "Livro Em Leitura",
        author: "Autor B",
        priority: 5,
        seed: "work-reading",
        createdAt: "2026-01-11T00:00:00Z",
      },
      {
        wishId: "w-owned",
        workId: "work-owned",
        status: "wanted",
        title: "Livro Já Na Estante",
        author: "Autor C",
        priority: 5,
        seed: "work-owned",
        createdAt: "2026-01-12T00:00:00Z",
      },
      {
        wishId: "w-purchased",
        workId: "work-purchased",
        status: "purchased",
        title: "Desejo Já Comprado",
        author: "Autor D",
        priority: 5,
        seed: "work-purchased",
        createdAt: "2026-01-13T00:00:00Z",
      },
      {
        wishId: "w-low",
        workId: "work-low",
        status: "wanted",
        title: "Desejo Prioridade 3",
        author: "Autor E",
        priority: 3,
        seed: "work-low",
        createdAt: "2026-01-14T00:00:00Z",
      },
      {
        wishId: "w-high",
        workId: "work-high",
        status: "wanted",
        title: "Desejo Prioridade 5",
        author: "Autor F",
        priority: 5,
        seed: "work-high",
        createdAt: "2026-01-09T00:00:00Z",
      },
    ];

    const picked = pickWishlistSuggestions(entries, {
      ownedWorkIds: new Set(["work-owned"]),
      readings: [
        { workId: "work-read", status: "finished" },
        { workId: "work-reading", status: "reading" },
      ],
    });

    expect(picked.map((p) => p.wishId)).toEqual(["w-high", "w-low"]);
  });

  it("filterNewBookSuggestions exclui obras já no acervo por ISBN ou fingerprint, deduplica e valida capas HTTPS", () => {
    const ownedFp = computeWorkFingerprint(
      "Torto Arado",
      "Itamar Vieira Junior",
      "pt-BR"
    );
    const wishFp = computeWorkFingerprint(
      "A Hora da Estrela",
      "Clarice Lispector",
      "pt-BR"
    );

    const candidates: BookSearchResult[] = [
      {
        id: "c-owned-isbn",
        fonte: "google_books",
        titulo: "Dom Casmurro",
        autor: "Machado de Assis",
        numero_paginas: 256,
        isbn: "9788535914849",
        genero: "Clássicos",
        ano: 1899,
        miniatura: "http://books.google.com/cover1.jpg",
        capas: ["http://books.google.com/cover1.jpg"],
      },
      {
        id: "c-owned-fp",
        fonte: "open_library",
        titulo: "Torto Arado",
        autor: "Itamar Vieira Junior",
        numero_paginas: 264,
        isbn: "",
        genero: "Literatura Brasileira",
        ano: 2019,
        miniatura: null,
        capas: [],
      },
      {
        id: "c-new-1",
        fonte: "google_books",
        titulo: "A Hora da Estrela",
        autor: "Clarice Lispector",
        numero_paginas: 88,
        isbn: "9788532530837",
        genero: "Literatura Brasileira",
        ano: 1977,
        miniatura: "http://covers.openlibrary.org/b/id/100-M.jpg",
        capas: ["http://covers.openlibrary.org/b/id/100-L.jpg"],
      },
      {
        id: "c-new-1-dup",
        fonte: "open_library",
        titulo: "A Hora da Estrela",
        autor: "Clarice Lispector",
        numero_paginas: 88,
        isbn: "9788532530837",
        genero: "Literatura Brasileira",
        ano: 1977,
        miniatura: null,
        capas: [],
      },
      {
        id: "c-new-2",
        fonte: "open_library",
        titulo: "O Avesso da Pele",
        autor: "Jeferson Tenório",
        numero_paginas: 192,
        isbn: "9788535933383",
        genero: "Ficção",
        ano: 2020,
        miniatura: "javascript:alert(1)",
        capas: ["javascript:alert(1)"],
      },
    ];

    const filtered = filterNewBookSuggestions(candidates, {
      ownedIsbn13s: new Set(["9788535914849"]),
      ownedFingerprints: new Set([ownedFp]),
      wishlistFingerprints: new Set([wishFp]),
    });

    expect(filtered.map((c) => c.id)).toEqual(["c-new-1", "c-new-2"]);
    expect(filtered[0]?.alreadyInWishlist).toBe(true);
    expect(filtered[0]?.coverUrl).toBe(
      "https://covers.openlibrary.org/b/id/100-L.jpg"
    );
    expect(filtered[1]?.alreadyInWishlist).toBe(false);
    expect(filtered[1]?.coverUrl).toBeUndefined();
    expect(normalizeSuggestionCoverUrl("javascript:alert(1)")).toBeUndefined();

    const q0 = buildNewBookDiscoveryQuery({
      genreFilter: "todos",
      ownedGenres: ["Ficção Científica"],
      batchIndex: 0,
    });
    const q1 = buildNewBookDiscoveryQuery({
      genreFilter: "todos",
      ownedGenres: ["Ficção Científica"],
      batchIndex: 1,
    });
    expect(q0).not.toBe(q1);
  });
});

describe("Item 5 — UI interativa BookSuggestionsClient (Lista de Desejos e Novos Livros)", () => {
  it("exibe estado vazio claro quando Lista de Desejos está vazia e alterna para Novos Livros salvando sem reload", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          source: "open_library",
          queryUsed: "literatura brasileira romance",
          batch: 0,
          items: [
            {
              id: "ext-1",
              source: "open_library",
              title: "O Avesso da Pele",
              author: "Jeferson Tenório",
              genre: "Literatura Brasileira",
              isbn: "9788535933383",
              pages: 192,
              year: 2020,
              coverUrl: "https://covers.openlibrary.org/b/id/555-L.jpg",
              fingerprint: "o-avesso-da-pele|jeferson-tenorio|pt-br",
              alreadyInWishlist: false,
            },
            {
              id: "ext-2",
              source: "open_library",
              title: "Água Viva",
              author: "Clarice Lispector",
              genre: "Literatura Brasileira",
              isbn: "9788532531117",
              pages: 96,
              year: 1973,
              coverUrl: "https://covers.openlibrary.org/b/id/556-L.jpg",
              fingerprint: "agua-viva|clarice-lispector|pt-br",
              alreadyInWishlist: false,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    mockSaveToWishlist.mockResolvedValueOnce({
      ok: true,
      wishId: "wish-new-1",
      alreadyExisted: false,
      item: {
        wishId: "wish-new-1",
        workId: "work-new-1",
        title: "O Avesso da Pele",
        author: "Jeferson Tenório",
        genre: "Literatura Brasileira",
        priority: 4,
        coverUrl: "https://covers.openlibrary.org/b/id/555-L.jpg",
        seed: "9788535933383",
        createdAt: "2026-11-21T00:00:00Z",
      },
    });

    render(<BookSuggestionsClient initialWishlistItems={[]} />);

    expect(screen.getByTestId("suggestion-empty-wishlist")).toBeTruthy();

    // Alterna para Novos Livros
    fireEvent.click(screen.getByRole("tab", { name: /Novos Livros/i }));

    await waitFor(() => {
      expect(screen.getByTestId("suggestion-card-new-book")).toBeTruthy();
    });
    expect(
      screen.getByRole("heading", { name: "O Avesso da Pele" })
    ).toBeTruthy();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Salva na Lista de Desejos e confirma atualização imediata sem reload
    fireEvent.click(
      screen.getByRole("button", { name: /Salvar na Lista de Desejos/i })
    );
    await waitFor(() => {
      expect(screen.getByText(/Salvo nos Desejos/i)).toBeTruthy();
      expect(
        (
          screen.getByRole("button", {
            name: /Descartar/i,
          }) as HTMLButtonElement
        ).disabled
      ).toBe(false);
    });
    expect(mockSaveToWishlist).toHaveBeenCalledTimes(1);

    // Descarta e avança para o próximo título sem nova requisição
    fireEvent.click(screen.getByRole("button", { name: /Descartar/i }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Água Viva" })).toBeTruthy();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Volta para Lista de Desejos: o livro salvo já aparece lá!
    fireEvent.click(screen.getByRole("tab", { name: /Lista de Desejos/i }));
    expect(screen.getByTestId("suggestion-card-wishlist")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "O Avesso da Pele" })
    ).toBeTruthy();
  });

  it("trata erro 503/429 no modo Novos Livros sem loop infinito e permite tentar novamente", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: false,
            serviceUnavailable: true,
            error: "Catálogo externo temporariamente indisponível.",
          }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            source: "open_library",
            queryUsed: "literatura brasileira",
            batch: 0,
            items: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    render(<BookSuggestionsClient initialWishlistItems={[]} />);
    fireEvent.click(screen.getByRole("tab", { name: /Novos Livros/i }));

    await waitFor(() => {
      expect(screen.getByTestId("suggestion-error")).toBeTruthy();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));
    await waitFor(() => {
      expect(screen.getByTestId("suggestion-empty-new-books")).toBeTruthy();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
