"use client";

import { useEffect, useState } from "react";

export const HERO_LAST_INDEX_STORAGE_KEY = "readingflow_last_hero_index";

/**
 * Sorteia um índice válido em `0..count-1` garantindo que, quando houver
 * mais de 1 imagem, o índice sorteado seja sempre diferente de `lastIndex`.
 */
export function pickRandomHeroIndex(
  count: number,
  lastIndex: number | null,
  randomFn: () => number = Math.random
): number | null {
  if (count <= 0) return null;
  if (count === 1) return 0;

  const hasValidLast =
    lastIndex !== null &&
    Number.isInteger(lastIndex) &&
    lastIndex >= 0 &&
    lastIndex < count;

  if (!hasValidLast) {
    return Math.min(count - 1, Math.floor(randomFn() * count));
  }

  const offset = Math.min(count - 2, Math.floor(randomFn() * (count - 1)));
  return offset >= lastIndex ? offset + 1 : offset;
}

function readLastHeroIndex(): number | null {
  try {
    const raw = window.sessionStorage.getItem(HERO_LAST_INDEX_STORAGE_KEY);
    if (raw === null) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isInteger(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeLastHeroIndex(index: number): void {
  try {
    window.sessionStorage.setItem(HERO_LAST_INDEX_STORAGE_KEY, String(index));
  } catch {
    // Ignora silenciosamente se sessionStorage estiver indisponível
  }
}

export interface UseHeroRotatorResult {
  /** Índice sorteado no cliente após a montagem (`null` no SSR/render inicial). */
  activeIndex: number | null;
  /** Verdadeiro quando `prefers-reduced-motion: reduce` está ativo. */
  prefersReducedMotion: boolean;
}

/**
 * Seleciona aleatoriamente uma imagem do hero a cada recarregamento da página (F5),
 * sem repetir a última exibida (via `sessionStorage`) e sem erro de hidratação:
 * - Começa com `activeIndex = null` no render inicial (fundo #141514).
 * - Sorteia e persiste o novo índice apenas no cliente (`useEffect`).
 */
export function useHeroRotator(count: number): UseHeroRotatorResult {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Detecta `prefers-reduced-motion` dinamicamente
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  // Sorteia no cliente após montar, garantindo índice diferente do anterior salvo em sessionStorage
  useEffect(() => {
    if (typeof window === "undefined" || count <= 0) return;

    const frameId = window.requestAnimationFrame(() => {
      const lastIndex = readLastHeroIndex();
      const nextIndex = pickRandomHeroIndex(count, lastIndex);
      if (nextIndex !== null) {
        writeLastHeroIndex(nextIndex);
        setActiveIndex(nextIndex);
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [count]);

  return {
    activeIndex,
    prefersReducedMotion,
  };
}
