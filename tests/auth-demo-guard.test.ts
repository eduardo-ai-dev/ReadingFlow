import { describe, expect, it } from "vitest";
import { isDemoEnabled, isDemoSessionAllowed } from "@/lib/auth-demo";

describe("Segurança de produção — guarda da chave DEMO_ENABLED", () => {
  it("desativa a demonstração em produção quando DEMO_ENABLED não está habilitado ou é false", () => {
    expect(isDemoEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(
      isDemoEnabled({
        NODE_ENV: "production",
        DEMO_ENABLED: "false",
      })
    ).toBe(false);
    expect(
      isDemoSessionAllowed({
        NODE_ENV: "development",
        DEMO_ENABLED: "false",
      })
    ).toBe(false);
  });

  it("permite a demonstração em desenvolvimento/teste ou quando DEMO_ENABLED=true", () => {
    expect(isDemoEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(isDemoEnabled({ NODE_ENV: "test" })).toBe(true);
    expect(
      isDemoEnabled({
        NODE_ENV: "production",
        DEMO_ENABLED: "true",
      })
    ).toBe(true);
  });
});
