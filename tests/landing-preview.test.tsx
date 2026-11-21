import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LandingProductPreview } from "@/components/LandingProductPreview";
import { BookCover } from "@/components/BookCover";

beforeAll(() => {
  if (typeof globalThis.IntersectionObserver === "undefined") {
    globalThis.IntersectionObserver = class IntersectionObserver {
      readonly root: Element | Document | null = null;
      readonly rootMargin = "0px";
      readonly thresholds: ReadonlyArray<number> = [0];
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    };
  }
});

describe("Bug 1 regression — Landing preview tokens, contrast semantics and fallback cover", () => {
  it("defines dedicated tab-active and progress-bar contrast tokens in all 4 themes", () => {
    const themeFiles = [
      "caderno.css",
      "dark-academia.css",
      "escandinavo.css",
      "gotico.css",
    ];
    for (const file of themeFiles) {
      const css = fs.readFileSync(
        path.join(process.cwd(), "src/styles/themes", file),
        "utf8"
      );
      expect(css).toContain("--rf-tab-active-bg:");
      expect(css).toContain("--rf-tab-active-text:");
      expect(css).toContain("--rf-progress-track:");
      expect(css).toContain("--rf-progress-fill:");
    }
  });

  it("renders LandingProductPreview with semantic tab and progress tokens and interactive tabs", () => {
    const { container } = render(<LandingProductPreview />);

    const physicalTab = screen.getByRole("tab", { name: /Física/i });
    expect(physicalTab.getAttribute("aria-selected")).toBe("true");
    expect(physicalTab.className).toContain("--rf-tab-active-text");

    const progressBars = screen.getAllByRole("progressbar");
    expect(progressBars.length).toBeGreaterThanOrEqual(2);
    for (const bar of progressBars) {
      expect(bar.className).toContain("--rf-progress-track");
      const fill = bar.firstElementChild;
      expect(fill?.className).toContain("--rf-progress-fill");
    }

    const statusBadge = container.querySelector('[data-badge="status"]');
    expect(statusBadge?.textContent).toContain("Lendo agora");
    expect(statusBadge?.className).toContain("--rf-status-success-bg");

    const digitalTab = screen.getByRole("tab", { name: /Digital/i });
    fireEvent.click(digitalTab);
    expect(digitalTab.getAttribute("aria-selected")).toBe("true");
  });

  it("applies compact container-query scaling up to 72px so size='sm' fallback covers do not clip", () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), "src/styles/rf-shelf-3d.css"),
      "utf8"
    );
    expect(css).toContain("@container (max-width: 72px)");

    const { container } = render(
      <BookCover
        size="sm"
        title="Grande Sertão: Veredas"
        author="João Guimarães Rosa"
        coverUrl={null}
      />
    );
    expect(
      container.querySelector('.rf-book-cover-2d[data-cover-state="fallback"]')
    ).not.toBeNull();
    expect(screen.getByText("Grande Sertão: Veredas")).toBeTruthy();
  });
});
