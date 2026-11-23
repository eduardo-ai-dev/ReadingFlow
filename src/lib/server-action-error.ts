export const STALE_DEPLOY_ACTION_MESSAGE =
  "A aplicação foi atualizada. Recarregando a página para sincronizar...";

/**
 * Detecta `UnrecognizedActionError` (ou version skew HTTP 409 em Server Actions do Next.js)
 * sem depender de APIs privadas do runtime.
 */
export function isUnrecognizedServerActionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const record = err as { name?: unknown; message?: unknown; digest?: unknown };
  const name = typeof record.name === "string" ? record.name : "";
  const message = typeof record.message === "string" ? record.message : "";
  const digest = typeof record.digest === "string" ? record.digest : "";
  return (
    name === "UnrecognizedActionError" ||
    /UnrecognizedActionError/i.test(message) ||
    /Server Action .+ was not found on the server/i.test(message) ||
    /Failed to find Server Action/i.test(message) ||
    /UNRECOGNIZED_ACTION/i.test(digest)
  );
}

/**
 * Trata exceções de Server Actions no cliente sem `Uncaught (in promise)`.
 * Em caso de version skew (`UnrecognizedActionError` / 409 após novo deploy),
 * agenda um recarregamento controlado com trava anti-loop (15s) em `sessionStorage`.
 */
export function handleServerActionError(
  err: unknown,
  fallbackMessage: string
): { isVersionSkew: boolean; message: string } {
  if (!isUnrecognizedServerActionError(err)) {
    return { isVersionSkew: false, message: fallbackMessage };
  }

  if (typeof window !== "undefined") {
    try {
      const key = "rf_action_skew_reload_at";
      const now = Date.now();
      const last = Number(window.sessionStorage.getItem(key) ?? "0");
      if (!Number.isFinite(last) || now - last > 15_000) {
        window.sessionStorage.setItem(key, String(now));
        window.setTimeout(() => {
          window.location.reload();
        }, 600);
      }
    } catch {
      // sessionStorage indisponível — apenas exibe a mensagem orientativa
    }
  }

  return {
    isVersionSkew: true,
    message: STALE_DEPLOY_ACTION_MESSAGE,
  };
}
