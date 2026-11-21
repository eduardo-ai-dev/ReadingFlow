"use client";

import { useCallback, useEffect, useRef, type MouseEvent } from "react";

interface ShelfParallaxOptions {
  maxRotateX?: number;
  maxRotateY?: number;
}

/**
 * Aplica parallax sutil em perspectiva (`rotateX`/`rotateY`) ligado ao cursor,
 * atualizando variáveis CSS diretamente sem re-renderizações e respeitando
 * `prefers-reduced-motion` e dispositivos sem ponteiro fino.
 */
export function useShelfParallax<T extends HTMLElement>({
  maxRotateX = 1.4,
  maxRotateY = 1.9,
}: ShelfParallaxOptions = {}) {
  const containerRef = useRef<T | null>(null);
  const rafRef = useRef<number | null>(null);
  const enabledRef = useRef(false);

  useEffect(() => {
    const hoverQuery = window.matchMedia("(hover: hover)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const syncEnabled = () => {
      enabledRef.current = hoverQuery.matches && !motionQuery.matches;
      if (!enabledRef.current && containerRef.current) {
        containerRef.current.style.setProperty("--shelf-rx", "0deg");
        containerRef.current.style.setProperty("--shelf-ry", "0deg");
      }
    };

    syncEnabled();
    hoverQuery.addEventListener("change", syncEnabled);
    motionQuery.addEventListener("change", syncEnabled);

    return () => {
      hoverQuery.removeEventListener("change", syncEnabled);
      motionQuery.removeEventListener("change", syncEnabled);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent<T>) => {
      if (!enabledRef.current) return;
      const el = containerRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

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
        el.style.setProperty("--shelf-rx", `${rotateX}deg`);
        el.style.setProperty("--shelf-ry", `${rotateY}deg`);
      });
    },
    [maxRotateX, maxRotateY]
  );

  const handleMouseLeave = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const el = containerRef.current;
    if (!el) return;
    el.style.setProperty("--shelf-rx", "0deg");
    el.style.setProperty("--shelf-ry", "0deg");
  }, []);

  return {
    containerRef,
    handleMouseMove,
    handleMouseLeave,
  };
}
