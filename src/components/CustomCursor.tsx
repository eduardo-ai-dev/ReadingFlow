"use client";

import { useEffect, useRef } from "react";

const INTERACTIVE_SELECTOR =
  "a, button, [role='button'], input, select, textarea, .rf-book-prism, .lr-book-prism, [tabindex]:not([tabindex='-1']), .interactive-card, .card";

/**
 * Cursor editorial leve e orientado a demanda:
 * - Zero `useState` em `mousemove` (nenhum re-render React durante o movimento do ponteiro).
 * - `requestAnimationFrame` roda somente enquanto o anel persegue o ponto e para imediatamente
 *   quando o ponteiro estabiliza (CPU 0% em repouso).
 * - `target.closest(...)` avaliado no máximo uma vez por quadro (1x/frame).
 * - Respeita `pointer: coarse`, `prefers-reduced-motion`, `data-motion="reduced"` e `data-fx="min"`.
 */
export function CustomCursor() {
  const rootRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isDisabled = () =>
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.dataset.motion === "reduced" ||
      document.documentElement.dataset.fx === "min";

    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;
    let isVisible = false;
    let isHovered = false;
    let pendingTarget: HTMLElement | null = null;
    let targetDirty = false;
    let rafId: number | null = null;
    let disabled = isDisabled();

    const setRootVisible = (next: boolean) => {
      if (isVisible === next) return;
      isVisible = next;
      if (rootRef.current) {
        rootRef.current.style.opacity = next ? "1" : "0";
      }
    };

    const setRingHovered = (next: boolean) => {
      if (isHovered === next) return;
      isHovered = next;
      const ring = ringRef.current;
      if (!ring) return;
      ring.dataset.hovered = next ? "true" : "false";
    };

    const stopLoop = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const tick = () => {
      rafId = null;
      if (disabled || !isVisible) return;

      if (targetDirty) {
        targetDirty = false;
        const target = pendingTarget;
        const hit =
          target instanceof Element &&
          target.closest(INTERACTIVE_SELECTOR) !== null;
        setRingHovered(hit);
      }

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
      }

      ringX += (mouseX - ringX) * 0.22;
      ringY += (mouseY - ringY) * 0.22;

      const dx = mouseX - ringX;
      const dy = mouseY - ringY;
      const settled = Math.abs(dx) < 0.35 && Math.abs(dy) < 0.35;
      if (settled) {
        ringX = mouseX;
        ringY = mouseY;
      }

      if (ringRef.current) {
        const scale = isHovered ? 1.35 : 1;
        ringRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) scale(${scale})`;
      }

      if (!settled) {
        rafId = requestAnimationFrame(tick);
      }
    };

    const scheduleTick = () => {
      if (rafId === null && !disabled) {
        rafId = requestAnimationFrame(tick);
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (disabled) return;
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!isVisible) {
        ringX = mouseX;
        ringY = mouseY;
        setRootVisible(true);
      }
      pendingTarget = e.target as HTMLElement | null;
      targetDirty = true;
      scheduleTick();
    };

    const onMouseLeave = () => {
      setRootVisible(false);
      stopLoop();
    };

    const onMouseEnter = () => {
      if (disabled) return;
      setRootVisible(true);
    };

    const observer = new MutationObserver(() => {
      const nextDisabled = isDisabled();
      if (nextDisabled === disabled) return;
      disabled = nextDisabled;
      if (disabled) {
        setRootVisible(false);
        stopLoop();
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-fx", "data-motion"],
    });

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseenter", onMouseEnter);

    return () => {
      stopLoop();
      observer.disconnect();
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseenter", onMouseEnter);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden opacity-0"
    >
      <div
        ref={dotRef}
        className="pointer-events-none absolute -top-1 -left-1 h-2 w-2 rounded-[var(--rf-radius-full)] bg-[var(--rf-cursor-dot)] shadow-[var(--rf-cursor-glow)]"
        style={{ willChange: "transform" }}
      />
      <div
        ref={ringRef}
        data-hovered="false"
        className="pointer-events-none absolute -top-4 -left-4 h-8 w-8 rounded-[var(--rf-radius-full)] border border-[var(--rf-cursor-ring)] bg-transparent transition-[border-color,box-shadow] duration-150 ease-out data-[hovered=true]:border-[var(--rf-cursor-ring-hover)] data-[hovered=true]:shadow-[var(--rf-cursor-ring-glow)]"
        style={{ willChange: "transform" }}
      />
    </div>
  );
}
