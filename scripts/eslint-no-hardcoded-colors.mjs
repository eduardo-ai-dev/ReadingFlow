/**
 * Regra ESLint `readingflow/no-hardcoded-colors`:
 * Bloqueia cores literais (hex `#...`, `rgb(...)`, `rgba(...)`, `hsl(...)`, `hsla(...)`)
 * em componentes novos, layouts e telas migradas.
 *
 * Exceções inevitáveis podem ser marcadas na mesma linha ou na linha anterior com:
 *   `/* theme-exempt: motivo *\/`
 *
 * Fora do escopo de temas: cores de capas e lombadas de livros
 * (`BookCover.tsx`, `Book3D.tsx`, `cover-color.ts`, `spine-color-rules.ts`).
 */

const HARDCODED_COLOR_RE =
  /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|\b(?:rgba?|hsla?)\s*\(/;

const THEME_EXEMPT_RE = /\/\*\s*theme-exempt\s*:\s*[^*]+\*\//i;

function isLineExempt(sourceCode, lineNumber) {
  if (!lineNumber || lineNumber < 1) return false;
  const lines = sourceCode.lines;
  const currentLine = lines[lineNumber - 1] ?? "";
  const prevLine = lineNumber >= 2 ? (lines[lineNumber - 2] ?? "") : "";
  return THEME_EXEMPT_RE.test(currentLine) || THEME_EXEMPT_RE.test(prevLine);
}

export const readingFlowThemePlugin = {
  rules: {
    "no-hardcoded-colors": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Proíbe cores literais (hex/rgb/hsl) em componentes tokenizados; use tokens semânticos `var(--rf-*)` ou marque exceções inevitáveis com `/* theme-exempt: motivo */`.",
        },
        schema: [],
        messages: {
          noHardcodedColor:
            "Cor literal '{{match}}' detectada. Use um token semântico `var(--rf-*)` definido em `src/styles/design-tokens.css` (ou marque exceção inevitável com `/* theme-exempt: motivo */`).",
        },
      },
      create(context) {
        const sourceCode = context.sourceCode;

        const checkString = (node, value) => {
          if (typeof value !== "string") return;
          const found = HARDCODED_COLOR_RE.exec(value);
          if (!found) return;
          const line = node.loc?.start?.line;
          if (isLineExempt(sourceCode, line)) return;
          context.report({
            node,
            messageId: "noHardcodedColor",
            data: { match: found[0] },
          });
        };

        return {
          Literal(node) {
            if (typeof node.value === "string") {
              checkString(node, node.value);
            }
          },
          TemplateElement(node) {
            checkString(node, node.value?.raw ?? "");
          },
        };
      },
    },
  },
};
