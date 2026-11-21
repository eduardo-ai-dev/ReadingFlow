import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { enforceLoadtestSafety } from "./safety-guard.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(REPO_ROOT, ".loadtest-data");

export async function runLoadtestCleanup(options = {}) {
  const { appBaseUrl } = enforceLoadtestSafety({
    appUrl: options.appUrl,
    env: options.env ?? process.env,
  });

  let serverCleanup = { removedUsers: 0, removedSessions: 0 };
  try {
    const res = await fetch(`${appBaseUrl}/api/internal/loadtest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cleanup" }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      serverCleanup = await res.json();
    }
  } catch {
    // Servidor pode já estar parado quando `npm run loadtest:cleanup` é executado offline
  }

  if (fs.existsSync(DATA_DIR)) {
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  }

  console.log(
    `[ReadingFlow/cleanup] Limpeza concluída: ${serverCleanup.removedUsers ?? 0} usuários loadtest+N@example.test e ${serverCleanup.removedSessions ?? 0} sessões removidas; diretório .loadtest-data limpo.`
  );
  return serverCleanup;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runLoadtestCleanup().catch((err) => {
    console.error("[ReadingFlow/cleanup] Erro:", err);
    process.exit(1);
  });
}
