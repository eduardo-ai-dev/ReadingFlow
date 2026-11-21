import { describe, expect, it } from "vitest";
import { resolveSafeRedirectTarget } from "@/features/auth/rules";

describe("Redirecionamento pós-login (?next=) — preservação de origem e proteção contra Open Redirect", () => {
  it("preserva rotas internas válidas com query params e âncoras", () => {
    expect(resolveSafeRedirectTarget("/estante-3d")).toBe("/estante-3d");
    expect(resolveSafeRedirectTarget("/estantes?tipo=digital&q=clarice")).toBe(
      "/estantes?tipo=digital&q=clarice"
    );
    expect(resolveSafeRedirectTarget("/livros/work-123#avaliacao")).toBe(
      "/livros/work-123#avaliacao"
    );
  });

  it("bloqueia URLs externas, protocol-relative, backslash, javascript e loops de login", () => {
    expect(resolveSafeRedirectTarget("https://evil.example/phish")).toBe(
      "/painel"
    );
    expect(resolveSafeRedirectTarget("//evil.example/phish")).toBe("/painel");
    expect(resolveSafeRedirectTarget("/\\evil.example")).toBe("/painel");
    expect(resolveSafeRedirectTarget("javascript:alert(1)")).toBe("/painel");
    expect(resolveSafeRedirectTarget("/entrar?next=/painel")).toBe("/painel");
    expect(resolveSafeRedirectTarget("/criar-conta")).toBe("/painel");
    expect(resolveSafeRedirectTarget("/recuperar-senha")).toBe("/painel");
    expect(resolveSafeRedirectTarget(null)).toBe("/painel");
    expect(resolveSafeRedirectTarget("")).toBe("/painel");
  });
});
