export type FocusSessionMode = "free" | "pomodoro" | "target_50";

export const FOCUS_POMODORO_SECONDS = 25 * 60;
export const FOCUS_SESSION_STORAGE_KEY = "readingflow_focus_session_v1";

export interface PersistedFocusSession {
  readingId: string;
  focusMode: FocusSessionMode;
  accumulatedSeconds: number;
  startedAtMs: number | null;
  isRunning: boolean;
  hasStarted: boolean;
  sessionNotes: string;
  updatedAtMs: number;
}

/**
 * Calcula o tempo decorrido real via relógio de parede (`startedAtMs`),
 * evitando perda de tempo ao recarregar, minimizar ou trocar de aba.
 */
export function computeElapsedFocusSeconds(
  state: Pick<
    PersistedFocusSession,
    "accumulatedSeconds" | "startedAtMs" | "isRunning" | "focusMode"
  >,
  nowMs: number = Date.now()
): number {
  const base = Math.max(0, Math.floor(state.accumulatedSeconds || 0));
  const runningDelta =
    state.isRunning &&
    typeof state.startedAtMs === "number" &&
    Number.isFinite(state.startedAtMs)
      ? Math.max(0, Math.floor((nowMs - state.startedAtMs) / 1000))
      : 0;
  const total = base + runningDelta;
  if (state.focusMode === "pomodoro") {
    return Math.min(FOCUS_POMODORO_SECONDS, total);
  }
  return total;
}

export function parsePersistedFocusSession(
  raw: string | null
): PersistedFocusSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedFocusSession>;
    if (
      typeof parsed.readingId !== "string" ||
      !parsed.readingId ||
      (parsed.focusMode !== "free" &&
        parsed.focusMode !== "pomodoro" &&
        parsed.focusMode !== "target_50")
    ) {
      return null;
    }
    return {
      readingId: parsed.readingId,
      focusMode: parsed.focusMode,
      accumulatedSeconds:
        typeof parsed.accumulatedSeconds === "number" &&
        Number.isFinite(parsed.accumulatedSeconds) &&
        parsed.accumulatedSeconds >= 0
          ? Math.floor(parsed.accumulatedSeconds)
          : 0,
      startedAtMs:
        typeof parsed.startedAtMs === "number" &&
        Number.isFinite(parsed.startedAtMs)
          ? parsed.startedAtMs
          : null,
      isRunning: Boolean(parsed.isRunning),
      hasStarted: Boolean(parsed.hasStarted),
      sessionNotes:
        typeof parsed.sessionNotes === "string"
          ? parsed.sessionNotes.slice(0, 2000)
          : "",
      updatedAtMs:
        typeof parsed.updatedAtMs === "number" &&
        Number.isFinite(parsed.updatedAtMs)
          ? parsed.updatedAtMs
          : Date.now(),
    };
  } catch {
    return null;
  }
}

export function readPersistedFocusSession(): PersistedFocusSession | null {
  if (typeof window === "undefined") return null;
  try {
    return parsePersistedFocusSession(
      window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

export function writePersistedFocusSession(
  session: PersistedFocusSession
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      FOCUS_SESSION_STORAGE_KEY,
      JSON.stringify(session)
    );
  } catch {
    // Armazenamento local indisponível ou bloqueado pelo navegador
  }
}

export function clearPersistedFocusSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(FOCUS_SESSION_STORAGE_KEY);
  } catch {
    // Armazenamento local indisponível
  }
}
