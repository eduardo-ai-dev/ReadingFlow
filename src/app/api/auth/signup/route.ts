import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { signUpAction } from "@/features/auth/actions";
import { extractTrustedClientIp } from "@/server/security/secrets";

export const dynamic = "force-dynamic";

const BASE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

/**
 * Endpoint HTTP POST de cadastro anti-enumeração:
 * - Retorna exatamente o mesmo status (200), corpo e headers (sem Set-Cookie)
 *   tanto para e-mail novo quanto para e-mail já cadastrado.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const clientIp = extractTrustedClientIp(request.headers);
  const userAgent = request.headers.get("user-agent");

  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
    displayName?: unknown;
    confirmMinimumAge16?: unknown;
    acceptTerms?: unknown;
    captchaToken?: unknown;
  } | null;

  if (
    !body ||
    typeof body.email !== "string" ||
    typeof body.password !== "string"
  ) {
    return NextResponse.json(
      { ok: false, error: "Dados inválidos." },
      { status: 400, headers: BASE_HEADERS }
    );
  }

  const res = await signUpAction(
    {
      email: body.email,
      password: body.password,
      displayName:
        typeof body.displayName === "string" ? body.displayName : undefined,
      confirmMinimumAge16: body.confirmMinimumAge16 === true,
      acceptTerms: body.acceptTerms === true,
      captchaToken:
        typeof body.captchaToken === "string" ? body.captchaToken : undefined,
    },
    {
      clientIp,
      userAgent,
      requestId,
      uniformNoSession: true,
    }
  );

  if (res.ok) {
    return NextResponse.json(
      { ok: true, message: res.message },
      { status: 200, headers: BASE_HEADERS }
    );
  }

  const headersOut: Record<string, string> = { ...BASE_HEADERS };
  if (res.statusCode === 429 && res.retryAfterSeconds) {
    headersOut["Retry-After"] = String(res.retryAfterSeconds);
  }

  return NextResponse.json(
    { ok: false, error: res.error },
    { status: res.statusCode ?? 400, headers: headersOut }
  );
}
