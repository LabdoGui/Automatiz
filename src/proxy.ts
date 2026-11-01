import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { buildCsp, createNonce } from "@/lib/csp";

const PROTECTED = ["/inicio", "/alimentacao", "/compras", "/treino", "/progresso", "/perfil", "/conquistas", "/assistente", "/onboarding"];

function isProtected(pathname: string): boolean {
  return PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * 1. Verificação otimista de sessão nas áreas logadas (a autorização real
 *    acontece no servidor: páginas, Server Actions e rotas).
 * 2. Content-Security-Policy com nonce por requisição em todas as páginas.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isProtected(pathname) && !getSessionCookie(request)) {
    const url = new URL("/entrar", request.url);
    url.searchParams.set("voltar", pathname);
    return NextResponse.redirect(url);
  }

  const nonce = createNonce();
  const csp = buildCsp(nonce, {
    dev: process.env.NODE_ENV === "development",
    https: (process.env.BETTER_AUTH_URL ?? "").startsWith("https://"),
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Páginas (exclui API, arquivos estáticos, ícones, manifest e service worker)
      source: "/((?!api|_next/static|_next/image|icons|sw\\.js|manifest\\.webmanifest|modelo-precos\\.csv|favicon\\.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
