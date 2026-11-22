#!/usr/bin/env node
/**
 * Impede a criação acidental de `middleware.ts`/`middleware.js` na raiz ou em `src/`.
 * O Next.js 16 usa `src/proxy.ts`, e a coexistência dos dois arquivos quebra o build.
 */
import fs from "node:fs";
import path from "node:path";

const FORBIDDEN_FILES = [
  "src/middleware.ts",
  "src/middleware.js",
  "src/middleware.mjs",
  "middleware.ts",
  "middleware.js",
  "middleware.mjs",
];

const found = FORBIDDEN_FILES.filter((relPath) =>
  fs.existsSync(path.resolve(process.cwd(), relPath))
);

if (found.length > 0) {
  console.error(
    `[ERRO] Arquivo(s) legado(s) proibido(s) detectado(s): ${found.join(", ")}.`
  );
  console.error(
    "O Next.js 16 usa src/proxy.ts. Remova o(s) arquivo(s) middleware.* para não quebrar o build."
  );
  process.exit(1);
}

console.log(
  "[OK] Nenhum arquivo middleware.* legado presente (Next.js 16 usa src/proxy.ts)."
);
