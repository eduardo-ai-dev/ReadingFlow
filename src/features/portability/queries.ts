import "server-only";
import { requireAuthenticatedWorkspace } from "@/server/store/memory-repository";
import type { ImportJob } from "@/lib/domain";

export async function getImportJobsHistory(): Promise<ImportJob[]> {
  const ws = await requireAuthenticatedWorkspace();
  return [...ws.importJobs].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}
