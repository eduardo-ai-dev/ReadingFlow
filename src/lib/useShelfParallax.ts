"use client";

import { useCallback, useEffect, useRef, type MouseEvent } from "react";

interface ShelfParallaxOptions {
  maxRotateX?: number;
  maxRotateY?: number;
  disabled?: boolean;
}

interface CachedRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Aplica parallax sutil em perspectiva (`rotateX`/`rotateY`) ligado ao cursor:
 * - Cacheia `getBoundingClientRect()` em `mouseenter` e invalida apenas em `resize`/`scroll`
 *   (nunca força layout síncrono em `mousemove`).
 * - Aplica `el.style.transform` diretamente em rAF (nunca muta variáveis CSS no ancestral
 *   da estante, evitando `RecalcStyle` em milhares de nós filhos).
 * - Desativa automaticamente quando `disabled` (ex.: > 40 livros), `data-fx="min"`,
 *   `data-motion="reduced"`, `prefers-reduced-motion` ou dispositivo sem hover fino.
 */
export function useShelfParallax<T extends HTMLElement>({
  maxRotateX = 1.4,
  maxRotateY = 1.9,
  disabled = false,
}: ShelfParallaxOptions = {}) {
  const containerRef = useRef<T | null>(null);
  const rafRef = useRef<number | null>(null);
  const rectRef = useRef<CachedRect | null>(null);
  const enabledRef = useRef(false);

  useEffect(() => {
    const hoverQuery = window.matchMedia("(hover: hover)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const syncEnabled = () => {
      const rootData = document.documentElement.dataset;
      enabledRef.current =
        !disabled &&
        hoverQuery.matches &&
        !motionQuery.matches &&
        rootData.fx !== "min" &&
        rootData.motion !== "reduced";

      if (!enabledRef.current && containerRef.current) {
        containerRef.current.style.transform = "";
        rectRef.current = null;
      }
    };

    const invalidateRect = () => {
      rectRef.current = null;
    };

    syncEnabled();
    hoverQuery.addEventListener("change", syncEnabled);
    motionQuery.addEventListener("change", syncEnabled);
    window.addEventListener("resize", invalidateRect, { passive: true });
    window.addEventListener("scroll", invalidateRect, { passive: true });

    const observer = new MutationObserver(syncEnabled);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-fx", "data-motion"],
    });

    return () => {
      hoverQuery.removeEventListener("change", syncEnabled);
      motionQuery.removeEventListener("change", syncEnabled);
      window.removeEventListener("resize", invalidateRect);
      window.removeEventListener("scroll", invalidateRect);
      observer.disconnect();
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, [disabled]);

  const handleMouseEnter = useCallback(() => {
    if (!enabledRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      rectRef.current = {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      };
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent<T>) => {
      if (!enabledRef.current) return;
      const el = containerRef.current;
      if (!el) return;

      let rect = rectRef.current;
      if (!rect) {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;
        rect = { left: r.left, top: r.top, width: r.width, height: r.height };
        rectRef.current = rect;
      }

      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;

      const clampedX = Math.max(-1, Math.min(1, nx));
      const clampedY = Math.max(-1, Math.min(1, ny));

      const rotateY = (clampedX * maxRotateY).toFixed(2);
      const rotateX = (-clampedY * maxRotateX).toFixed(2);

      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        el.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      });
    },
    [maxRotateX, maxRotateY]
  );

  const handleMouseLeave = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    rectRef.current = null;
    const el = containerRef.current;
    if (!el) return;
    el.style.transform = "";
  }, []);

  return {
    containerRef,
    handleMouseEnter,
    handleMouseMove,
    handleMouseLeave,
  };
}
