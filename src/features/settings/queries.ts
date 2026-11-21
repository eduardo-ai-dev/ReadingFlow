import "server-only";
import {
  cachedWorkspaceQuery,
  ensureWorkspaceSettings,
  requireAuthenticatedWorkspace,
} from "@/server/store/memory-repository";
import type { UserSettings } from "@/lib/domain";

/**
 * Lê as preferências consolidadas da conta autenticada (`user_settings`).
 * Sempre vinculado ao `user_id` da sessão atual, sem vazar entre usuários.
 */
export async function getUserSettings(): Promise<UserSettings> {
  const ws = await requireAuthenticatedWorkspace();
  return cachedWorkspaceQuery(ws, "settings:current", () => {
    const settings = ensureWorkspaceSettings(ws);
    return structuredClone(settings);
  });
}
