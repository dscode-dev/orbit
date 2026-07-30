import { NextResponse } from "next/server";

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  backendRequest,
  isTrustedBrowserRequest,
  readApiError,
  refreshCookieOptions,
  type TokenPair,
} from "@/lib/auth";

export async function POST(request: Request) {
  if (!isTrustedBrowserRequest(request)) {
    return NextResponse.json({ message: "Origem da solicitação não permitida." }, { status: 403 });
  }
  const body: unknown = await request.json();
  const response = await backendRequest("/identity/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    return NextResponse.json({ message: await readApiError(response) }, { status: response.status });
  }

  const tokens = (await response.json()) as TokenPair;
  const result = NextResponse.json({ authenticated: true }, { status: 201 });
  result.cookies.set(ACCESS_COOKIE, tokens.accessToken, accessCookieOptions);
  result.cookies.set(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions);
  return result;
}
