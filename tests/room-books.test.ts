import { describe, expect, it } from "vitest";
import { ROOM_BOOKS } from "@/features/shelves/room-books";

function hexToLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = hexToLuminance(fg);
  const l2 = hexToLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("ROOM_BOOKS — Estante interativa do quarto noturno", () => {
  it("possui exatamente 11 livros verticais + 1 livro escuro inclinado no nicho superior esquerdo", () => {
    const topLeft = ROOM_BOOKS.filter((b) => b.shelf === "top-left");
    expect(topLeft).toHaveLength(12);

    const upright = topLeft.filter((b) => !b.isLeaning);
    const leaning = topLeft.filter((b) => b.isLeaning);
    expect(upright).toHaveLength(11);
    expect(leaning).toHaveLength(1);
    expect(topLeft[topLeft.length - 1]?.isLeaning).toBe(true);
  });

  it("garante IDs únicos e contraste WCAG 2.2 AA (>= 4.5:1) em todas as lombadas", () => {
    const ids = new Set(ROOM_BOOKS.map((b) => b.id));
    expect(ids.size).toBe(ROOM_BOOKS.length);

    for (const book of ROOM_BOOKS) {
      expect(book.pages).toBeGreaterThan(0);
      const ratio = contrastRatio(book.textColor, book.color);
      expect(
        ratio,
        `Contraste insuficiente (${ratio.toFixed(2)}:1) na lombada de ${book.title}`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});

