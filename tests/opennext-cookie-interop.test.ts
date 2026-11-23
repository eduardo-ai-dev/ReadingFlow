import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * Regressão para opennextjs/opennextjs-cloudflare#1506:
 * Em Next.js 16 com `src/proxy.ts` (Node.js middleware), `bundleNodeMiddleware`
 * empacota `@opennextjs/aws/dist/overrides/converters/edge.js` (`import cookieParser from "cookie"`)
 * emitindo `__toESM(require_cookie())` com `isNodeMode` falsy.
 * Com `cookie@1.x` (que define `exports.__esModule = true` sem `exports.default`),
 * `import_cookie.default` vira `undefined` e toda requisição com header `Cookie`
 * falha na Cloudflare Workers com:
 *   TypeError: Cannot read properties of undefined (reading 'parse')
 *     at Object.convertFrom (.open-next/middleware/handler.mjs:28:...)
 */
describe("OpenNext Cloudflare middleware cookie interop (issue #1506)", () => {
  it("resolve `cookie` a partir de `@opennextjs/aws` com interop __toESM(mod, 0) preservando `.default.parse`", () => {
    const awsEdgeConverterPath = path.resolve(
      "node_modules/@opennextjs/aws/dist/overrides/converters/edge.js"
    );
    const awsRequire = createRequire(awsEdgeConverterPath);
    const cookieMod = awsRequire("cookie") as Record<string, unknown>;

    // Simula exatamente o helper `__toESM(mod, isNodeMode = undefined)` do esbuild
    const simulateEsbuildToEsm = (mod: Record<string, unknown>) => {
      const target: Record<string, unknown> = Object.create(
        Object.getPrototypeOf(mod)
      );
      if (!mod.__esModule) {
        Object.defineProperty(target, "default", {
          value: mod,
          enumerable: true,
        });
      }
      for (const key of Object.getOwnPropertyNames(mod)) {
        if (!Object.prototype.hasOwnProperty.call(target, key)) {
          const desc = Object.getOwnPropertyDescriptor(mod, key);
          if (desc) {
            Object.defineProperty(target, key, desc);
          }
        }
      }
      return target as {
        default?: { parse?: (header: string) => Record<string, string> };
      };
    };

    const imported = simulateEsbuildToEsm(cookieMod);
    expect(imported.default).toBeDefined();
    expect(typeof imported.default?.parse).toBe("function");
    expect(
      imported.default!.parse!("rf_demo_session=true; theme=caderno")
    ).toEqual({
      rf_demo_session: "true",
      theme: "caderno",
    });
  });
});
