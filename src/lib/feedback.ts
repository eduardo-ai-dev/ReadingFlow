"use client";

export type FeedbackToastTone = "success" | "error" | "info";

export interface FeedbackToastDetail {
  id?: string;
  message: string;
  tone?: FeedbackToastTone;
  undoId?: string;
  undoLabel?: string;
  retryLabel?: string;
  onRetry?: () => void;
  durationMs?: number;
}

export interface BookCompletedCardDetail {
  workId: string;
  title: string;
  author: string;
  daysCount: number;
  pagesTotal: number | null;
  pagesPerDay: number | null;
  existingRating?: number;
}

const HAPTICS_STORAGE_KEY = "rf:haptics-enabled";

/**
 * Lê preferência local de feedback tátil leve (padrão ligado; desligável em Configurações).
 */
export function isHapticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(HAPTICS_STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setHapticsEnabledLocal(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HAPTICS_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // Storage indisponível — ignora silenciosamente
  }
}

/**
 * Vibração tátil curta (10ms) no celular quando suportada, habilitada pelo usuário
 * e fora de `prefers-reduced-motion`.
 */
export function triggerLightHaptic(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  if (!isHapticsEnabled()) return false;
  if (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return false;
  }
  if (typeof navigator.vibrate !== "function") return false;
  try {
    return Boolean(navigator.vibrate(10));
  } catch {
    return false;
  }
}

export function dispatchFeedbackToast(detail: FeedbackToastDetail): void {
  if (typeof window === "undefined") return;
  if (detail.tone !== "error") {
    triggerLightHaptic();
  }
  window.dispatchEvent(
    new CustomEvent<FeedbackToastDetail>("rf:toast", {
      detail: {
        id:
          detail.id ??
          `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tone: detail.tone ?? "success",
        durationMs: detail.durationMs ?? 5000,
        ...detail,
      },
    })
  );
}

export function dispatchReadingDayPulse(ymd?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<{ ymd?: string }>("rf:reading-day-pulse", {
      detail: { ymd },
    })
  );
}

export function dispatchBookCompletedCard(
  detail: BookCompletedCardDetail
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<BookCompletedCardDetail>("rf:book-completed-card", {
      detail,
    })
  );
}
