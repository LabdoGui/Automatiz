import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Verificação otimista: sem cookie de sessão, redireciona para o login.
 * A autorização real acontece no servidor (páginas, Server Actions e rotas).
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/entrar", request.url);
    url.searchParams.set("voltar", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/inicio/:path*",
    "/alimentacao/:path*",
    "/compras/:path*",
    "/treino/:path*",
    "/progresso/:path*",
    "/perfil/:path*",
    "/conquistas/:path*",
    "/assistente/:path*",
    "/onboarding/:path*",
  ],
};
