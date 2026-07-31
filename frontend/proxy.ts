/**
 * Middleware de autenticação (Next 16 — antigo `middleware.ts`).
 *
 * Portão de navegação: decide se a rota pode renderizar e mantém os cookies
 * de sessão rotacionados antes de qualquer Server Component executar — por
 * isso Server Components nunca precisam renovar tokens por conta própria.
 *
 * A expiração do access token é avaliada localmente (sem round-trip ao
 * backend) e a renovação usa o refresh token, que o NestJS valida de fato. A
 * autoridade sobre autenticação e permissões continua sendo do backend: toda
 * chamada de dados passa pelo BFF e é verificada lá. Aqui a decisão é apenas
 * de navegação.
 */
import { NextResponse, type NextRequest } from "next/server";

import { ROUTES, isGuestPath, isProtectedPath } from "@/lib/routes";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearSessionCookies,
  writeSessionCookies,
} from "@/server/auth/cookies";
import { decodeAccessToken, isExpired } from "@/server/auth/jwt";
import { refreshTokens } from "@/server/auth/refresh";
import type { TokenPair } from "@/types/session";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const isProtected = isProtectedPath(pathname);
  const isGuest = isGuestPath(pathname);
  if (!isProtected && !isGuest) return NextResponse.next();

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const claims = accessToken ? decodeAccessToken(accessToken) : null;

  let rotated: TokenPair | null = null;
  let authenticated = Boolean(claims && !isExpired(claims));

  if (!authenticated && refreshToken) {
    rotated = await refreshTokens(refreshToken);
    authenticated = Boolean(rotated);
  }

  const destination = authenticated
    ? isGuest
      ? ROUTES.dashboard
      : null
    : isProtected
      ? ROUTES.login
      : null;

  const response = destination
    ? NextResponse.redirect(new URL(destination, request.url))
    : NextResponse.next();

  if (rotated) {
    writeSessionCookies(response.cookies, rotated);
  } else if (!authenticated && (accessToken ?? refreshToken)) {
    clearSessionCookies(response.cookies);
  }
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/cadastro"],
};
