import { NextRequest, NextResponse } from "next/server";

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  backendUrl,
  refreshCookieOptions,
  type TokenPair,
} from "./src/lib/auth";

const protectedRoutes = ["/dashboard"];
const guestRoutes = ["/login", "/cadastro"];

async function validate(accessToken: string) {
  return fetch(backendUrl("/identity/me"), {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
}

async function refresh(refreshToken: string) {
  const response = await fetch(backendUrl("/identity/refresh"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as TokenPair;
}

export async function proxy(request: NextRequest) {
  const isProtected = protectedRoutes.some((route) => request.nextUrl.pathname.startsWith(route));
  const isGuest = guestRoutes.some((route) => request.nextUrl.pathname.startsWith(route));
  if (!isProtected && !isGuest) return NextResponse.next();

  let accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  let tokens: TokenPair | null = null;
  let authenticated = accessToken ? (await validate(accessToken)).ok : false;

  if (!authenticated && refreshToken) {
    tokens = await refresh(refreshToken);
    accessToken = tokens?.accessToken;
    authenticated = accessToken ? (await validate(accessToken)).ok : false;
  }

  const destination = authenticated && isGuest ? "/dashboard" : !authenticated && isProtected ? "/login" : null;
  const response = destination
    ? NextResponse.redirect(new URL(destination, request.url))
    : NextResponse.next();

  if (tokens) {
    response.cookies.set(ACCESS_COOKIE, tokens.accessToken, accessCookieOptions);
    response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions);
  } else if (!authenticated) {
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
  }
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/cadastro"],
};
