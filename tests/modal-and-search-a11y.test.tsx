import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useRef, useState } from "react";
import { useFocusTrap } from "@/lib/use-focus-trap";
import {
  BookSlideOverDrawer,
  type BookDrawerData,
} from "@/components/BookSlideOverDrawer";
import { GlobalSearchBar } from "@/components/GlobalSearchBar";

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
  usePathname: () => "/painel",
}));

function TestDialogHarness() {
  const [open, setOpen] = useState(false);
  const [ticks, setTicks] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useFocusTrap({
    active: open,
    containerRef: dialogRef,
    initialFocusRef: closeRef,
    onEscape: () => setOpen(false),
    lockScroll: true,
  });

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir diálogo
      </button>
      <button type="button" onClick={() => setTicks((t) => t + 1)}>
        Re-render pai ({ticks})
      </button>
      {open ? (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Teste">
          <button ref={closeRef} type="button" onClick={() => setOpen(false)}>
            Fechar
          </button>
          <input aria-label="Campo interno" type="text" />
          <button type="button">Ação final</button>
        </div>
      ) : null}
    </div>
  );
}

describe("Acessibilidade de modais, drawer 3D e busca global", () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
  });

  it("prende Tab/Shift+Tab dentro do modal, fecha com Esc e restaura o foco ao gatilho", async () => {
    render(<TestDialogHarness />);

    const trigger = screen.getByRole("button", { name: "Abrir diálogo" });
    trigger.focus();
    fireEvent.click(trigger);

    await act(async () => {
      await new Promise((r) =>
        window.requestAnimationFrame(() => r(undefined))
      );
    });

    const closeBtn = screen.getByRole("button", { name: "Fechar" });
    const innerInput = screen.getByLabelText("Campo interno");
    const lastBtn = screen.getByRole("button", { name: "Ação final" });

    expect(document.activeElement).toBe(closeBtn);
    expect(document.body.style.overflow).toBe("hidden");

    // Shift+Tab no primeiro elemento vai para o último
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(lastBtn);

    // Tab no último elemento volta ao primeiro
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(closeBtn);

    // Re-renderizar o pai não rouba foco de um campo interno
    innerInput.focus();
    fireEvent.click(screen.getByRole("button", { name: /Re-render pai/i }));
    expect(document.activeElement).toBe(innerInput);

    // Escape fecha o modal e devolve o foco ao botão de abertura
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(trigger);
  });

  it("BookSlideOverDrawer não rouba foco do input ao re-renderizar com novo onClose inline", async () => {
    const baseBook: BookDrawerData = {
      id: "book-1",
      workId: "w-1",
      title: "Dom Casmurro",
      author: "Machado de Assis",
      genre: "Clássicos",
      pages: 256,
      readingStatus: "reading",
      progressUnit: "pages",
      progressValue: 40,
      progressTotal: 256,
      progressPercent: 16,
    };

    const { rerender } = render(
      <BookSlideOverDrawer book={baseBook} onClose={() => {}} />
    );

    await act(async () => {
      await new Promise((r) =>
        window.requestAnimationFrame(() => r(undefined))
      );
    });

    const pagesInput = screen.getByLabelText("Página atual");
    pagesInput.focus();
    expect(document.activeElement).toBe(pagesInput);

    // Simula re-render do pai passando novo objeto book (mesmo id) e nova função inline
    rerender(<BookSlideOverDrawer book={{ ...baseBook }} onClose={() => {}} />);

    await act(async () => {
      await new Promise((r) =>
        window.requestAnimationFrame(() => r(undefined))
      );
    });

    expect(document.activeElement).toBe(pagesInput);
  });

  it("GlobalSearchBar gera IDs únicos e redireciona Ctrl+K para /explorar?buscar=1 quando oculta", () => {
    const { container } = render(
      <div>
        <div style={{ display: "none" }}>
          <GlobalSearchBar />
        </div>
        <div style={{ display: "none" }}>
          <GlobalSearchBar />
        </div>
      </div>
    );

    const inputs = container.querySelectorAll<HTMLInputElement>(
      'input[data-rf-global-search-input="true"]'
    );
    expect(inputs.length).toBe(2);
    expect(inputs[0]!.id).not.toBe(inputs[1]!.id);

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/explorar?buscar=1");
  });
});
