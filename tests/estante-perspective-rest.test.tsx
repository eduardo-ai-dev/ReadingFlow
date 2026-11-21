import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { Book3D } from "@/components/Book3D";

function extractCssBlock(css: string, selectorRegex: RegExp): string {
  const match = css.match(selectorRegex);
  return match ? match[0] : "";
}

describe("Bug 2 regression — Perspective por livro e faces laterais ocultas em repouso", () => {
  it("removes shared row-level perspective from .booksRow and .rf-shelf and centers perspective on .rf-book-slot", () => {
    const moduleCss = fs.readFileSync(
      path.join(process.cwd(), "src/components/VirtualBookshelf.module.css"),
      "utf8"
    );
    const shelf3dCss = fs.readFileSync(
      path.join(process.cwd(), "src/styles/rf-shelf-3d.css"),
      "utf8"
    );

    const booksRowBlock = extractCssBlock(moduleCss, /\.booksRow\s*\{[^}]*\}/);
    expect(booksRowBlock).not.toBe("");
    expect(booksRowBlock).not.toMatch(/\bperspective\s*:/);
    expect(booksRowBlock).not.toMatch(/\bperspective-origin\s*:/);

    const rfShelfBlock = extractCssBlock(shelf3dCss, /\.rf-shelf\s*\{[^}]*\}/);
    expect(rfShelfBlock).not.toBe("");
    expect(rfShelfBlock).not.toMatch(/\bperspective\s*:/);
    expect(rfShelfBlock).not.toMatch(/\bperspective-origin\s*:/);

    const bookSlotBlock = extractCssBlock(
      shelf3dCss,
      /\.rf-book-slot\s*\{[^}]*\}/
    );
    expect(bookSlotBlock).toMatch(/\bperspective\s*:\s*1100px/);
    expect(bookSlotBlock).toMatch(/\bperspective-origin\s*:\s*50%\s+50%/);
  });

  it("does not mount side/page/cover faces at rest and mounts them only on hover/selection/covers-mode", () => {
    const { container, rerender } = render(
      <Book3D
        as="div"
        title="Dom Casmurro"
        author="Machado de Assis"
        pages={256}
        seed="book-rest-test"
      />
    );

    expect(container.querySelector(".rf-face-spine")).not.toBeNull();
    expect(container.querySelector(".rf-face-side-cover")).toBeNull();
    expect(container.querySelector(".rf-face-top-pages")).toBeNull();
    expect(container.querySelector(".rf-face-back-cover")).toBeNull();
    expect(container.querySelector(".rf-face-fore-edge-pages")).toBeNull();

    const slot = container.querySelector(".rf-book-slot");
    expect(slot).not.toBeNull();
    fireEvent.pointerEnter(slot!, { pointerType: "mouse" });
    expect(container.querySelector(".rf-face-side-cover")).not.toBeNull();

    fireEvent.pointerLeave(slot!, { pointerType: "mouse" });
    expect(container.querySelector(".rf-face-side-cover")).toBeNull();

    rerender(
      <Book3D
        as="div"
        title="Dom Casmurro"
        author="Machado de Assis"
        pages={256}
        seed="book-rest-test"
        showCoverFace
      />
    );
    expect(container.querySelector(".rf-face-side-cover")).not.toBeNull();
  });
});
