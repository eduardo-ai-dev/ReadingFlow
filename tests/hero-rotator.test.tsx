import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ImgHTMLAttributes } from "react";
import type { LandingHeroLayout } from "@/lib/landing-layouts";
import {
  HERO_LAST_INDEX_STORAGE_KEY,
  pickRandomHeroIndex,
} from "@/hooks/useHeroRotator";
import { HeroRotator } from "@/components/HeroRotator";

vi.mock("next/image", () => ({
  default: ({
    fill,
    preload,
    priority: _priority,
    fetchPriority: _fp,
    quality,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    preload?: boolean;
    priority?: boolean;
    fetchPriority?: string;
    quality?: number;
  }) => {
    void _priority;
    void _fp;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        {...props}
        alt={props.alt ?? ""}
        data-fill={fill ? "true" : undefined}
        data-preload={preload ? "true" : undefined}
        data-quality={quality !== undefined ? String(quality) : undefined}
      />
    );
  },
}));

function makeLayout(
  idx: number,
  overrides?: Partial<LandingHeroLayout>
): LandingHeroLayout {
  const num = String(idx).padStart(2, "0");
  return {
    id: `layout-${idx}`,
    filename: `${num}-cenario.webp`,
    src: `/landing-layouts/${num}-cenario.webp`,
    label: `Cenário ${idx}`,
    alt: `Descrição do cenário ${idx}`,
    objectPosition: "50% 50%",
    mobileObjectPosition: "40% 50%",
    hasEmbeddedBrandText: false,
    hotspots: [],
    ...overrides,
  };
}

function mockMatchMedia(reducedMotion: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? reducedMotion : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("pickRandomHeroIndex (pure rule)", () => {
  it("returns null for empty array and 0 for single item", () => {
    expect(pickRandomHeroIndex(0, null)).toBeNull();
    expect(pickRandomHeroIndex(1, null)).toBe(0);
    expect(pickRandomHeroIndex(1, 0)).toBe(0);
  });

  it("never repeats lastIndex when count > 1", () => {
    for (let last = 0; last < 5; last += 1) {
      for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
        const picked = pickRandomHeroIndex(5, last, () => r);
        expect(picked).not.toBe(last);
        expect(picked).toBeGreaterThanOrEqual(0);
        expect(picked).toBeLessThan(5);
      }
    }
  });
});

describe("HeroRotator component behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
    mockMatchMedia(false);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      return window.setTimeout(() => cb(performance.now()), 16);
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      window.clearTimeout(id);
    });
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders Onyx fallback with title, CTA, scroll-down button and zero images when layouts is empty", () => {
    const { container } = render(<HeroRotator layouts={[]} />);
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(screen.getByRole("heading", { name: "ReadingFlow" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Abrir Minha Estante" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Rolar para a próxima seção" })
    ).toBeTruthy();
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.querySelector('[data-hero-controls="true"]')).toBeNull();
  });

  it("starts with null image (no hydration mismatch) and smoothly fades in the randomly picked image on mount", () => {
    const layouts = [makeLayout(1), makeLayout(2), makeLayout(3)];
    const { container } = render(<HeroRotator layouts={layouts} />);

    // Before client effect commits: 0 images mounted (keeps #141514 base, zero hydration mismatch)
    expect(container.querySelectorAll("img")).toHaveLength(0);

    // After client effect runs: picks an image and persists index in sessionStorage
    act(() => {
      vi.advanceTimersByTime(32);
    });

    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(1);

    const layer = container.querySelector("[data-hero-layout]");
    expect(layer?.className).toContain("opacity-0");
    expect(layer?.className).toContain("duration-500");

    // Once the image finishes loading, fades to opacity-100 and mounts at most the 2nd layer (next)
    fireEvent.load(imgs[0]!);
    expect(layer?.className).toContain("opacity-100");
    expect(layer?.className).not.toContain("opacity-0");

    const afterLoadImgs = container.querySelectorAll("img");
    expect(afterLoadImgs).toHaveLength(2);
    expect(afterLoadImgs[0]?.getAttribute("data-preload")).toBe("true");
    expect(afterLoadImgs[0]?.getAttribute("data-quality")).toBe("85");
    expect(afterLoadImgs[0]?.getAttribute("sizes")).toBe("100vw");
    expect(afterLoadImgs[1]?.getAttribute("data-preload")).toBeNull();
    expect(afterLoadImgs[1]?.getAttribute("data-quality")).toBe("85");

    // No carousel arrows or pagination dots exist; scroll-down button stays intact
    expect(container.querySelector('[data-hero-controls="true"]')).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Cenário anterior/i })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Próximo cenário/i })
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Rolar para a próxima seção" })
    ).toBeTruthy();
  });

  it("reads sessionStorage on reload (F5) and never repeats the previous image index", () => {
    const layouts = [makeLayout(1), makeLayout(2)];

    // First page load: pretend previous session showed index 0
    window.sessionStorage.setItem(HERO_LAST_INDEX_STORAGE_KEY, "0");
    const first = render(<HeroRotator layouts={layouts} />);
    act(() => {
      vi.advanceTimersByTime(32);
    });
    expect(
      first.container
        .querySelector('[data-hero-rotator="true"]')
        ?.getAttribute("data-hero-active-index")
    ).toBe("1");
    expect(window.sessionStorage.getItem(HERO_LAST_INDEX_STORAGE_KEY)).toBe(
      "1"
    );
    first.unmount();

    // Simulated reload (F5): must pick index 0 (different from 1)
    const second = render(<HeroRotator layouts={layouts} />);
    act(() => {
      vi.advanceTimersByTime(32);
    });
    expect(
      second.container
        .querySelector('[data-hero-rotator="true"]')
        ?.getAttribute("data-hero-active-index")
    ).toBe("0");
    expect(window.sessionStorage.getItem(HERO_LAST_INDEX_STORAGE_KEY)).toBe(
      "0"
    );
  });

  it("does not auto-rotate over time (no carousel timer)", () => {
    const layouts = [makeLayout(1), makeLayout(2), makeLayout(3)];
    const { container } = render(<HeroRotator layouts={layouts} />);

    act(() => {
      vi.advanceTimersByTime(32);
    });
    const initialIndex = container
      .querySelector('[data-hero-rotator="true"]')
      ?.getAttribute("data-hero-active-index");
    expect(initialIndex).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    const afterWaitIndex = container
      .querySelector('[data-hero-rotator="true"]')
      ?.getAttribute("data-hero-active-index");
    expect(afterWaitIndex).toBe(initialIndex);
  });

  it("renders hotspots and sr-only h1 when the selected layout declares them", () => {
    window.sessionStorage.setItem(HERO_LAST_INDEX_STORAGE_KEY, "1");
    const layouts = [
      makeLayout(1, {
        hasEmbeddedBrandText: true,
        hotspots: [{ id: "h1", label: "Nicho Clássicos", x: 35, y: 42 }],
      }),
      makeLayout(2, {
        hasEmbeddedBrandText: false,
        hotspots: [],
      }),
    ];

    render(<HeroRotator layouts={layouts} />);
    act(() => {
      vi.advanceTimersByTime(32);
    });

    const h1 = screen.getByRole("heading", { name: "ReadingFlow" });
    expect(h1.className).toContain("sr-only");
    expect(
      screen.getByRole("button", { name: "Nicho Clássicos" })
    ).toBeTruthy();
  });

  it("uses dedicated mobile portrait crop (mobileSrc) on viewports <= 767px", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("max-width: 767px"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const layouts = [
      makeLayout(1, {
        src: "/landing-layouts/01-cenario.webp",
        mobileSrc: "/landing-layouts/mobile/01-cenario.webp",
      }),
    ];

    const { container } = render(<HeroRotator layouts={layouts} />);
    act(() => {
      vi.advanceTimersByTime(32);
    });

    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe(
      "/landing-layouts/mobile/01-cenario.webp"
    );
    expect(
      container
        .querySelector('[data-hero-layer="active"]')
        ?.getAttribute("data-hero-variant")
    ).toBe("mobile-portrait");
  });
});
