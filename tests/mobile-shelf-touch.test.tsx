import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { VirtualBookshelf } from "@/components/VirtualBookshelf";
import type { VirtualBookItem } from "@/features/shelves/virtual-bookshelf";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("@/features/settings/actions", () => ({
  saveShelfCustomizationAction: vi.fn(async () => ({
    ok: true,
    layout: {
      organizationMode: "color",
      shelfOrder: [],
      customShelves: [],
      shelfMeta: {},
      bookShelfMap: {},
      customOrderByShelf: {},
      bookColorOverrides: {},
      bookDisplayModes: {},
      bookTiltDirections: {},
      shelfDecorByRow: {},
      shelfMaterial: "classic-wood",
    },
  })),
}));

vi.mock("@/features/reading/actions", () => ({
  startReadingAction: vi.fn(async () => ({ ok: true, readingId: "r-1" })),
  updateReadingProgressAction: vi.fn(async () => ({
    ok: true,
    progressUnit: "pages",
    progressValue: 20,
    progressTotal: 256,
  })),
  finishReadingAction: vi.fn(async () => ({
    ok: true,
    undoId: "u-1",
    label: "Concluído",
  })),
}));

const SAMPLE_BOOKS: VirtualBookItem[] = [
  {
    id: "book-1",
    workId: "work-1",
    editionId: "ed-1",
    title: "Dom Casmurro",
    author: "Machado de Assis",
    genre: "Clássicos",
    pages: 256,
    format: "capa_dura",
    readingStatus: "reading",
    progressPercent: 45,
    href: "/livros/work-1",
  },
  {
    id: "book-2",
    workId: "work-2",
    editionId: "ed-2",
    title: "Grande Sertão: Veredas",
    author: "João Guimarães Rosa",
    genre: "Clássicos",
    pages: 600,
    format: "brochura",
    readingStatus: "not_started",
    progressPercent: 0,
    href: "/livros/work-2",
  },
];

function mockMatchMedia(hoverNone: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query === "(hover: none)" ? hoverNone : !hoverNone,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("Etapa 3 — Estante 3D no toque (1º toque seleciona, 2º toque abre ficha)", () => {
  afterEach(() => {
    cleanup();
  });

  it("em dispositivos de toque (hover: none), 1º toque seleciona na ficha rápida sem abrir o drawer e 2º toque abre o drawer", () => {
    mockMatchMedia(true);

    const { container } = render(<VirtualBookshelf books={SAMPLE_BOOKS} />);
    const buttons = container.querySelectorAll<HTMLButtonElement>(
      "button.rf-book-prism"
    );
    expect(buttons.length).toBeGreaterThanOrEqual(2);

    const secondBookBtn = buttons[1]!;

    // 1º toque: seleciona o livro e atualiza o BookQuickPanel, mas NÃO abre o BookSlideOverDrawer
    fireEvent.click(secondBookBtn);
    expect(secondBookBtn.getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getAllByText("Grande Sertão: Veredas").length
    ).toBeGreaterThan(0);

    // 2º toque no mesmo livro já selecionado: abre o drawer lateral
    fireEvent.click(secondBookBtn);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("em dispositivos com mouse (hover: hover), 1º clique abre o drawer imediatamente", () => {
    mockMatchMedia(false);

    const { container } = render(<VirtualBookshelf books={SAMPLE_BOOKS} />);
    const firstBookBtn = container.querySelector<HTMLButtonElement>(
      "button.rf-book-prism"
    )!;

    fireEvent.click(firstBookBtn);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
