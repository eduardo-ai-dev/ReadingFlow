import "server-only";
import { getAuthenticatedWorkspace } from "@/server/store/memory-repository";
import type { UserProfile } from "@/lib/domain";

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const ws = await getAuthenticatedWorkspace();
  return ws?.profile ?? null;
}

export async function getUndoBannerInfo(): Promise<{
  id: string;
  label: string;
} | null> {
  const ws = await getAuthenticatedWorkspace();
  if (!ws?.lastUndoAction) return null;
  // Exibe o toast de desfazer por 6 segundos após a ação recente
  if (Date.now() - ws.lastUndoAction.createdAtMs > 6 * 1000) {
    return null;
  }
  return {
    id: ws.lastUndoAction.id,
    label: ws.lastUndoAction.label,
  };
}
