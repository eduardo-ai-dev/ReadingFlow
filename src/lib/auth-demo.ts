/**
 * Sessão demonstrativa (`rf_demo_session`) é permitida apenas fora de produção
 * ou quando explicitamente habilitada via variável de ambiente de servidor
 * `ALLOW_DEMO_SESSION=true`.
 */
export function isDemoSessionAllowed(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env.NODE_ENV !== "production" || env.ALLOW_DEMO_SESSION === "true";
}
