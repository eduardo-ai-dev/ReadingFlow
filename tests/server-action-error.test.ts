import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  handleServerActionError,
  isUnrecognizedServerActionError,
  STALE_DEPLOY_ACTION_MESSAGE,
} from "@/lib/server-action-error";

describe("Tratamento seguro de UnrecognizedActionError (version skew HTTP 409)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    if (typeof window !== "undefined") {
      window.sessionStorage.clear();
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("identifica UnrecognizedActionError por name, message ou digest", () => {
    const byName = new Error("Action failed");
    byName.name = "UnrecognizedActionError";
    expect(isUnrecognizedServerActionError(byName)).toBe(true);

    const byMessage = new Error(
      'Server Action "abc123" was not found on the server.'
    );
    expect(isUnrecognizedServerActionError(byMessage)).toBe(true);

    const byFailedMessage = new Error("Failed to find Server Action");
    expect(isUnrecognizedServerActionError(byFailedMessage)).toBe(true);

    const byDigest = Object.assign(new Error("409"), {
      digest: "NEXT_UNRECOGNIZED_ACTION",
    });
    expect(isUnrecognizedServerActionError(byDigest)).toBe(true);

    expect(isUnrecognizedServerActionError(new Error("Network error"))).toBe(
      false
    );
    expect(isUnrecognizedServerActionError(null)).toBe(false);
  });

  it("retorna mensagem de atualização controlada em UnrecognizedActionError e fallback nos demais erros", () => {
    const generic = handleServerActionError(
      new Error("Timeout"),
      "Tente novamente."
    );
    expect(generic).toEqual({
      isVersionSkew: false,
      message: "Tente novamente.",
    });

    const skewErr = new Error("Server Action was not found on the server");
    skewErr.name = "UnrecognizedActionError";
    const handled = handleServerActionError(skewErr, "Tente novamente.");
    expect(handled).toEqual({
      isVersionSkew: true,
      message: STALE_DEPLOY_ACTION_MESSAGE,
    });
  });
});
