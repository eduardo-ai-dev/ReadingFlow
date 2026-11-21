import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/painel",
  "/estantes",
  "/estante-3d",
  "/livros",
  "/adicionar",
  "/importar",
  "/desejos",
  "/leitura",
  "/metas",
  "/estatisticas",
  "/evolucao",
  "/explorar",
  "/configuracoes",
  "/generos",
  "/onboarding",
] as const;

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.startsWith("sb-") &&
        cookie.name.includes("-auth-token") &&
        Boolean(cookie.value)
    );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedRoute = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  const isDemoSession =
    request.cookies.get("rf_demo_session")?.value === "true";
  const hasAppSession = Boolean(request.cookies.get("rf_session_id")?.value);
  const hasSupabaseSession = hasSupabaseAuthCookie(request);

  if (isDemoSession || hasAppSession || hasSupabaseSession) {
    return NextResponse.next();
  }

  const signInUrl = request.nextUrl.clone();
  signInUrl.pathname = "/entrar";
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: [
    "/painel/:path*",
    "/estantes/:path*",
    "/estante-3d/:path*",
    "/livros/:path*",
    "/adicionar/:path*",
    "/importar/:path*",
    "/desejos/:path*",
    "/leitura/:path*",
    "/metas/:path*",
    "/estatisticas/:path*",
    "/evolucao/:path*",
    "/explorar/:path*",
    "/configuracoes/:path*",
    "/generos/:path*",
    "/onboarding/:path*",
  ],
};
