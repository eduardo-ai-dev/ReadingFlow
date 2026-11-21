import { describe, expect, it } from "vitest";
import { isDemoSessionAllowed } from "@/lib/auth-demo";

describe("Segurança de produção — guarda da sessão demonstrativa", () => {
  it("bloqueia rf_demo_session em produção quando ALLOW_DEMO_SESSION não está habilitado", () => {
    expect(isDemoSessionAllowed({ NODE_ENV: "production" })).toBe(false);
    expect(
      isDemoSessionAllowed({
        NODE_ENV: "production",
        ALLOW_DEMO_SESSION: "false",
      })
    ).toBe(false);
  });

  it("permite rf_demo_session em desenvolvimento/teste ou quando ALLOW_DEMO_SESSION=true", () => {
    expect(isDemoSessionAllowed({ NODE_ENV: "development" })).toBe(true);
    expect(isDemoSessionAllowed({ NODE_ENV: "test" })).toBe(true);
    expect(
      isDemoSessionAllowed({
        NODE_ENV: "production",
        ALLOW_DEMO_SESSION: "true",
      })
    ).toBe(true);
  });
});
