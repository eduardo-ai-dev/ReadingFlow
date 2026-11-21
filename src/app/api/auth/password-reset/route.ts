import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requestPasswordResetAction } from "@/features/auth/actions";
import { extractTrustedClientIp } from "@/server/security/secrets";

export const dynamic = "force-dynamic";

const BASE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const clientIp = extractTrustedClientIp(request.headers);
  const userAgent = request.headers.get("user-agent");

  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    captchaToken?: unknown;
  } | null;

  if (!body || typeof body.email !== "string") {
    return NextResponse.json(
      { ok: false, error: "Informe um e-mail válido." },
      { status: 400, headers: BASE_HEADERS }
    );
  }

  const res = await requestPasswordResetAction(
    {
      email: body.email,
      captchaToken:
        typeof body.captchaToken === "string" ? body.captchaToken : undefined,
    },
    { clientIp, userAgent, requestId }
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
