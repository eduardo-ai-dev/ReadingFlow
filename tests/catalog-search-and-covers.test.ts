import { describe, expect, it } from "vitest";
import {
  buildCoverCandidates,
  buildOpenLibraryCoverUrlByIsbn,
  detectImageMimeFromBytes,
  pickGoogleImageLink,
  sanitizeGoogleCoverUrl,
  toHighResGoogleCoverUrl,
} from "@/features/catalog/cover-rules";
import {
  dedupeSearchResults,
  normalizeGoogleVolume,
  normalizeSearchQuery,
  pickIsbn,
} from "@/features/catalog/search-rules";

describe("Book search & high-res cover pipeline rules", () => {
  it("normalizes search query with minimum 3 chars threshold", () => {
    expect(normalizeSearchQuery("  ab ")).toBeNull();
    expect(normalizeSearchQuery("  Dom\u0007   Casmurro  ")).toBe(
      "Dom Casmurro"
    );
  });

  it("prioritizes ISBN_13 over ISBN_10 and strips hyphens/spaces", () => {
    expect(
      pickIsbn([
        { type: "ISBN_10", identifier: "85-359-1166-9" },
        { type: "ISBN_13", identifier: "978-85-359-1166-4" },
      ])
    ).toBe("9788535911664");

    expect(
      pickIsbn([{ type: "ISBN_10", identifier: "85-359-1166-9" }])
    ).toBe("8535911669");
  });

  it("sanitizes Google Books cover URLs: forces https, removes edge=curl, prefers largest size and zoom=2", () => {
    const picked = pickGoogleImageLink({
      thumbnail: "http://books.google.com/books/content?id=abc&zoom=1&edge=curl",
      large: "http://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1&edge=curl",
    });
    const clean = sanitizeGoogleCoverUrl(picked);
    expect(clean).toBe(
      "https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1"
    );
    expect(toHighResGoogleCoverUrl(clean!)).toBe(
      "https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=2"
    );
  });

  it("builds cover candidates in order: Google HD -> Google -> Open Library (?default=false)", () => {
    const candidates = buildCoverCandidates({
      googleImageLinks: {
        thumbnail: "http://books.google.com/books/content?id=xyz&zoom=1&edge=curl",
      },
      isbn: "9788535911664",
    });

    expect(candidates).toEqual([
      "https://books.google.com/books/content?id=xyz&zoom=2",
      "https://books.google.com/books/content?id=xyz&zoom=1",
      buildOpenLibraryCoverUrlByIsbn("9788535911664"),
    ]);
    expect(candidates[2]).toContain("?default=false");
  });

  it("normalizes Google Books volume metadata and dedupes search results", () => {
    const result = normalizeGoogleVolume({
      id: "vol-1",
      volumeInfo: {
        title: "Dom Casmurro",
        subtitle: "Edição Crítica",
        authors: ["Machado de Assis"],
        pageCount: 400,
        publishedDate: "2016-05-01",
        categories: ["Ficção Brasileira"],
        industryIdentifiers: [{ type: "ISBN_13", identifier: "978-85-63560-27-8" }],
        imageLinks: {
          thumbnail: "http://books.google.com/books/content?id=dom&zoom=1&edge=curl",
        },
      },
    });

    expect(result).toMatchObject({
      fonte: "google_books",
      titulo: "Dom Casmurro: Edição Crítica",
      autor: "Machado de Assis",
      numero_paginas: 400,
      isbn: "9788563560278",
      genero: "Ficção Brasileira",
      ano: 2016,
    });

    expect(dedupeSearchResults([result!, result!])).toHaveLength(1);
  });

  it("detects valid image signatures from raw bytes and rejects non-images", () => {
    expect(detectImageMimeFromBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      "image/jpeg"
    );
    expect(
      detectImageMimeFromBytes(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )
    ).toBe("image/png");
    expect(
      detectImageMimeFromBytes(new Uint8Array([0x3c, 0x73, 0x76, 0x67]))
    ).toBeNull();
  });
});
