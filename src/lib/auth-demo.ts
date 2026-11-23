/**
 * Configuração e constantes da Biblioteca Demonstrativa (somente leitura, stateless).
 *
 * Chave de desligamento: `DEMO_ENABLED`:
 * - Em produção (`NODE_ENV === "production"`): habilitada somente quando `DEMO_ENABLED === "true"`.
 * - Fora de produção (dev/test): habilitada por padrão, exceto quando `DEMO_ENABLED === "false"`.
 */

export const DEMO_SESSION_COOKIE_NAME = "rf_demo_session";
export const DEMO_SESSION_TTL_SECONDS = 2 * 60 * 60; // 2 horas
export const DEMO_READONLY_CODE = "DEMO_READONLY" as const;
export const DEMO_READONLY_CTA_MESSAGE = "Crie sua conta para salvar";
export const DEMO_READONLY_ERROR =
  "Demonstração somente leitura. Crie sua conta para salvar.";

export function isDemoEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.DEMO_ENABLED === "false") return false;
  if (env.DEMO_ENABLED === "true") return true;
  return env.NODE_ENV !== "production";
}

/** Alias mantido para compatibilidade com módulos/testes internos. */
export const isDemoSessionAllowed = isDemoEnabled;
