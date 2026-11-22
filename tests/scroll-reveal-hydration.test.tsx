import { act } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CountUp,
  Item,
  ScrollReveal,
  Stagger,
} from "@/components/MotionPrimitives";

describe("ScrollReveal e MotionPrimitives — hidratação determinística (sem suppressHydrationWarning)", () => {
  const roots: Root[] = [];
  const originalMatchMedia = window.matchMedia;
  const originalIO = globalThis.IntersectionObserver;

  afterEach(async () => {
    while (roots.length > 0) {
      const root = roots.pop();
      await act(async () => {
        root?.unmount();
      });
    }
    window.matchMedia = originalMatchMedia;
    globalThis.IntersectionObserver = originalIO;
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("produz HTML idêntico no SSR e na hidratação inicial com prefers-reduced-motion: reduce (zero erro de hidratação)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ioSpy = vi.fn();

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion: reduce"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    globalThis.IntersectionObserver = vi.fn().mockImplementation(() => {
      ioSpy();
      return { observe: vi.fn(), disconnect: vi.fn(), unobserve: vi.fn() };
    }) as unknown as typeof IntersectionObserver;

    const tree = (
      <ScrollReveal className="editorial-block" delay={0.1}>
        <Stagger className="stagger-grid" aria-label="Resumo">
          <Item className="stagger-item">
            <CountUp to={42} />
          </Item>
        </Stagger>
      </ScrollReveal>
    );

    const ssrHtml = renderToString(tree);
    expect(ssrHtml).not.toContain("opacity");
    expect(ssrHtml).not.toContain("translateY");
    expect(ssrHtml).not.toContain("style=");

    const container = document.createElement("div");
    container.innerHTML = ssrHtml;
    document.body.appendChild(container);

    let root: Root | null = null;
    await act(async () => {
      root = hydrateRoot(container, tree);
    });
    if (root) roots.push(root);

    expect(errorSpy).not.toHaveBeenCalled();
    expect(ioSpy).not.toHaveBeenCalled();
    expect(container.firstElementChild?.getAttribute("style")).toBeNull();
  });

  it("hidrata sem erros com movimento ativo e anima apenas após useEffect via IntersectionObserver", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let observerCallback: IntersectionObserverCallback | null = null;
    const disconnectMock = vi.fn();

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    class MockIntersectionObserver {
      constructor(cb: IntersectionObserverCallback) {
        observerCallback = cb;
      }
      observe = vi.fn();
      disconnect = disconnectMock;
      unobserve = vi.fn();
    }

    globalThis.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;

    const tree = (
      <ScrollReveal className="below-fold" delay={0.08}>
        <p>Conteúdo editorial</p>
      </ScrollReveal>
    );

    const ssrHtml = renderToString(tree);
    expect(ssrHtml).not.toContain("style=");

    const container = document.createElement("div");
    container.innerHTML = ssrHtml;
    document.body.appendChild(container);

    let root: Root | null = null;
    await act(async () => {
      root = hydrateRoot(container, tree);
    });
    if (root) roots.push(root);

    // Zero erro de hidratação
    expect(errorSpy).not.toHaveBeenCalled();
    expect(observerCallback).toBeTypeOf("function");

    const wrapper = container.firstElementChild as HTMLElement;

    // 1. Elemento abaixo da dobra -> entra em estado oculto fora da tela
    await act(async () => {
      observerCallback?.(
        [
          {
            isIntersecting: false,
            boundingClientRect: { top: 820 } as DOMRectReadOnly,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver
      );
    });
    expect(wrapper.style.opacity).toBe("0");
    expect(wrapper.style.transform).toBe("translateY(12px)");

    // 2. Ao entrar no viewport -> revela suavemente e desconecta observer
    await act(async () => {
      observerCallback?.(
        [
          {
            isIntersecting: true,
            boundingClientRect: { top: 120 } as DOMRectReadOnly,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver
      );
    });
    expect(wrapper.style.opacity).toBe("1");
    expect(wrapper.style.transform).toMatch(/^translateY\(0(px)?\)$/);
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });
});
