import { getAuthSecurityConfig } from "@/server/security/auth-config";

export interface CaptchaVerificationResult {
  ok: boolean;
  reason?: string;
}

export const MOCK_VALID_CAPTCHA_TOKEN = "rf-valid-captcha-token";

export async function verifyCaptchaTokenServer(params: {
  token?: string | null;
  remoteIp?: string;
}): Promise<CaptchaVerificationResult> {
  const cfg = getAuthSecurityConfig();
  const cleanToken = params.token?.trim() ?? "";

  if (cfg.captchaProvider === "none") {
    return { ok: true, reason: "captcha_disabled" };
  }

  if (!cleanToken) {
    return { ok: false, reason: "captcha_missing_token" };
  }

  if (cfg.captchaProvider === "mock") {
    return cleanToken === MOCK_VALID_CAPTCHA_TOKEN
      ? { ok: true }
      : { ok: false, reason: "captcha_invalid_mock_token" };
  }

  if (!cfg.captchaSecretKey) {
    return { ok: false, reason: "captcha_secret_unconfigured" };
  }

  const endpoint =
    cfg.captchaProvider === "turnstile"
      ? "https://challenges.cloudflare.com/turnstile/v0/siteverify"
      : "https://api.hcaptcha.com/siteverify";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const form = new URLSearchParams();
    form.set("secret", cfg.captchaSecretKey);
    form.set("response", cleanToken);
    if (params.remoteIp && params.remoteIp !== "unknown") {
      form.set("remoteip", params.remoteIp);
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      return { ok: false, reason: `captcha_provider_http_${res.status}` };
    }
    const payload = (await res.json()) as { success?: boolean };
    return payload.success === true
      ? { ok: true }
      : { ok: false, reason: "captcha_provider_rejected" };
  } catch {
    return { ok: false, reason: "captcha_provider_timeout" };
  } finally {
    clearTimeout(timer);
  }
}
