import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { signInWithEmailAction } from "@/features/auth/actions";
import {
  KNOWN_DEVICE_COOKIE_NAME,
  extractTrustedClientIp,
} from "@/server/security/secrets";

export const dynamic = "force-dynamic";

const BASE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

/**
 * Endpoint HTTP POST de login:
 * - Senhas jamais são aceitas em GET/query string (apenas corpo JSON em POST).
 * - Respostas de falha de credencial têm status HTTP, formato JSON e headers idênticos
 *   para e-mail inexistente, senha errada e e-mail não confirmado.
 * - Bloqueios retornam HTTP 429 + `Retry-After` igualmente para e-mails inexistentes.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const clientIp = extractTrustedClientIp(request.headers);
  const userAgent = request.headers.get("user-agent");
  const knownDeviceCookie =
    request.cookies.get(KNOWN_DEVICE_COOKIE_NAME)?.value ?? null;

  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
    rememberMe?: unknown;
    captchaToken?: unknown;
  } | null;

  if (
    !body ||
    typeof body.email !== "string" ||
    typeof body.password !== "string"
  ) {
    return NextResponse.json(
      { ok: false, error: "E-mail ou senha incorretos." },
      { status: 401, headers: BASE_HEADERS }
    );
  }

  const res = await signInWithEmailAction(
    {
      email: body.email,
      password: body.password,
      rememberMe: typeof body.rememberMe === "boolean" ? body.rememberMe : true,
      captchaToken:
        typeof body.captchaToken === "string" ? body.captchaToken : undefined,
    },
    {
      clientIp,
      userAgent,
      requestId,
      knownDeviceCookie,
    }
  );

  if (res.ok) {
    return NextResponse.json(
      { ok: true, needsOnboarding: res.needsOnboarding },
      { status: 200, headers: BASE_HEADERS }
    );
  }

  const headersOut: Record<string, string> = { ...BASE_HEADERS };
  if (res.statusCode === 429 && res.retryAfterSeconds) {
    headersOut["Retry-After"] = String(res.retryAfterSeconds);
  }

  // Formato de corpo rigorosamente uniforme em todos os casos de falha de credencial
  if (res.statusCode === 401 || !res.statusCode) {
    return NextResponse.json(
      { ok: false, error: "E-mail ou senha incorretos." },
      { status: 401, headers: headersOut }
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error: res.error,
      ...(res.retryAfterSeconds
        ? { retryAfterSeconds: res.retryAfterSeconds }
        : {}),
      ...(res.captchaRequired ? { captchaRequired: true } : {}),
    },
    { status: res.statusCode, headers: headersOut }
  );
}
