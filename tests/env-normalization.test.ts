import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getServerEnv, normalizeAppUrl } from "@/lib/env";

describe("Normalização resiliente de NEXT_PUBLIC_APP_URL em src/lib/env.ts", () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    if (originalAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    }
    vi.restoreAllMocks();
  });

  it("trata undefined, vazio, espaços, 'undefined' e 'null' como ausentes (fallback seguro)", () => {
    expect(normalizeAppUrl(undefined)).toBeUndefined();
    expect(normalizeAppUrl("")).toBeUndefined();
    expect(normalizeAppUrl("   ")).toBeUndefined();
    expect(normalizeAppUrl("undefined")).toBeUndefined();
    expect(normalizeAppUrl("  UNDEFINED  ")).toBeUndefined();
    expect(normalizeAppUrl("null")).toBeUndefined();
    expect(normalizeAppUrl("  NULL ")).toBeUndefined();
  });

  it("prefixa automaticamente https:// para domínios sem protocolo e http:// para localhost/127.0.0.1", () => {
    expect(normalizeAppUrl("meudominio.com")).toBe("https://meudominio.com");
    expect(normalizeAppUrl("  readingflow.workers.dev  ")).toBe(
      "https://readingflow.workers.dev"
    );
    expect(normalizeAppUrl("meudominio.com/app")).toBe(
      "https://meudominio.com/app"
    );
    expect(normalizeAppUrl("localhost:3000")).toBe("http://localhost:3000");
    expect(normalizeAppUrl("localhost")).toBe("http://localhost");
    expect(normalizeAppUrl("127.0.0.1:8787")).toBe("http://127.0.0.1:8787");
  });

  it("preserva URLs HTTP/HTTPS já válidas", () => {
    expect(normalizeAppUrl("https://readingflow.app")).toBe(
      "https://readingflow.app"
    );
    expect(normalizeAppUrl("http://localhost:3000")).toBe(
      "http://localhost:3000"
    );
    expect(normalizeAppUrl("https://readingflow.app/biblioteca")).toBe(
      "https://readingflow.app/biblioteca"
    );
  });

  it("faz fallback seguro sem lançar exceção para URLs malformadas ou esquemas inseguros", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const invalidInputs = [
      "http://",
      "://quebrada",
      "not a valid url",
      "javascript:alert(1)",
      "ftp://files.example.com",
      "apenas-uma-palavra",
      "https://",
    ];

    for (const raw of invalidInputs) {
      expect(normalizeAppUrl(raw)).toBeUndefined();
      process.env.NEXT_PUBLIC_APP_URL = raw;
      expect(() => getServerEnv()).not.toThrow();
      expect(getServerEnv().NEXT_PUBLIC_APP_URL).toBeUndefined();
    }

    expect(warnSpy).toHaveBeenCalled();
  });

  it("integra com getServerEnv() para valores ausentes, sem protocolo e válidos", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(getServerEnv().NEXT_PUBLIC_APP_URL).toBeUndefined();

    process.env.NEXT_PUBLIC_APP_URL = "";
    expect(getServerEnv().NEXT_PUBLIC_APP_URL).toBeUndefined();

    process.env.NEXT_PUBLIC_APP_URL =
      "readingflow.eduardoeliell1106.workers.dev";
    expect(getServerEnv().NEXT_PUBLIC_APP_URL).toBe(
      "https://readingflow.eduardoeliell1106.workers.dev"
    );

    process.env.NEXT_PUBLIC_APP_URL = "localhost:3000";
    expect(getServerEnv().NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });
});
