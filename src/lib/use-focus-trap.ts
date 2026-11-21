"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(", ");

function isFocusableElementVisible(el: HTMLElement): boolean {
  if (el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true") {
    return false;
  }
  let node: HTMLElement | null = el;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    node = node.parentElement;
  }
  return true;
}

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const candidates = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  );
  return candidates.filter((el) => {
    if (el.tabIndex < 0) return false;
    return isFocusableElementVisible(el);
  });
}

export interface UseFocusTrapOptions {
  active: boolean;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onEscape?: () => void;
  lockScroll?: boolean;
  /** Chave opcional (ex.: id do item aberto) para refocar apenas quando o item realmente mudar. */
  activationKey?: string | number | null;
}

/**
 * Prende o foco por teclado (Tab / Shift+Tab) dentro de um diálogo modal,
 * gerencia Escape sem reiniciar o efeito em re-renders do pai, e restaura o
 * foco ao elemento de origem ao fechar.
 */
export function useFocusTrap({
  active,
  containerRef,
  initialFocusRef,
  returnFocusRef,
  onEscape,
  lockScroll = false,
  activationKey = null,
}: UseFocusTrapOptions): void {
  const onEscapeRef = useRef(onEscape);
  const returnFocusRefStable = useRef(returnFocusRef);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    returnFocusRefStable.current = returnFocusRef;
  }, [returnFocusRef]);

  useEffect(() => {
    if (!active) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    let prevOverflow: string | null = null;
    if (lockScroll) {
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    const rafId = window.requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;

      const preferred = initialFocusRef?.current;
      if (preferred && container.contains(preferred)) {
        preferred.focus();
        return;
      }

      const focusables = getFocusableElements(container);
      if (focusables.length > 0) {
        focusables[0]!.focus();
      } else {
        if (!container.hasAttribute("tabindex")) {
          container.setAttribute("tabindex", "-1");
        }
        container.focus();
      }
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (onEscapeRef.current) {
          event.preventDefault();
          event.stopPropagation();
          onEscapeRef.current();
        }
        return;
      }

      if (event.key !== "Tab") return;

      const container = containerRef.current;
      if (!container) return;

      const focusables = getFocusableElements(container);
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const current = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (!current || !container.contains(current) || current === first) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (!current || !container.contains(current) || current === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", handleKeyDown);
      if (lockScroll && prevOverflow !== null) {
        document.body.style.overflow = prevOverflow;
      }

      const explicitTarget = returnFocusRefStable.current?.current;
      const target =
        explicitTarget && explicitTarget.isConnected
          ? explicitTarget
          : previouslyFocused;

      if (target && target.isConnected) {
        target.focus();
      }
    };
  }, [active, activationKey, containerRef, initialFocusRef, lockScroll]);
}
