import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/features/auth/queries";
import { DEMO_USER_ID } from "@/server/store/memory-repository";

/**
 * Estado mínimo de sessão para a ilha cliente do cabeçalho da landing.
 * - Expõe apenas `authenticated` e `displayName` (nunca e-mail, id ou tokens).
 * - Nunca é cacheado: a landing é estática e este endpoint decide o estado do visitante.
 * - A sessão demonstrativa (`rf_demo_session`) não conta como conta pessoal.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const profile = await getCurrentProfile();
  const authenticated = Boolean(profile && profile.id !== DEMO_USER_ID);

  return NextResponse.json(
    {
      authenticated,
      displayName: authenticated && profile ? profile.displayName : null,
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        Vary: "Cookie",
      },
    }
  );
}
