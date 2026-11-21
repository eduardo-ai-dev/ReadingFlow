import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { changePasswordAction } from "@/features/auth/actions";
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
    currentPassword?: unknown;
    newPassword?: unknown;
  } | null;

  if (!body || typeof body.newPassword !== "string") {
    return NextResponse.json(
      { ok: false, error: "Dados inválidos." },
      { status: 400, headers: BASE_HEADERS }
    );
  }

  try {
    const res = await changePasswordAction(
      {
        currentPassword:
          typeof body.currentPassword === "string"
            ? body.currentPassword
            : undefined,
        newPassword: body.newPassword,
      },
      { clientIp, userAgent, requestId }
    );

    if (res.ok) {
      return NextResponse.json(
        { ok: true, revokedOtherSessions: res.revokedOtherSessions },
        { status: 200, headers: BASE_HEADERS }
      );
    }

    return NextResponse.json(
      { ok: false, error: res.error },
      { status: res.statusCode ?? 400, headers: BASE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Autenticação necessária." },
      { status: 401, headers: BASE_HEADERS }
    );
  }
}
