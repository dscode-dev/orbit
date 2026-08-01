/**
 * Cookies de sessão.
 *
 * Access e refresh tokens vivem exclusivamente em cookies `HttpOnly`,
 * `SameSite=Lax` e `Secure` em produção. Nenhum token é entregue ao
 * JavaScript do browser em qualquer momento.
 */
import { serverEnv } from "@/lib/env";
import type { TokenPair } from "@/types/session";

export const ACCESS_COOKIE = "orbit_access";
export const REFRESH_COOKIE = "orbit_refresh";

const ACCESS_FALLBACK_MAX_AGE = 15 * 60;
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;

export interface CookieOptions {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
}

/**
 * Superfície mínima compartilhada por `NextResponse.cookies` e pelo store
 * retornado por `cookies()` em Route Handlers e Server Actions.
 */
export interface CookieWriter {
  set(name: string, value: string, options: CookieOptions): unknown;
  delete(name: string): unknown;
}

function baseOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: serverEnv.authCookieSecure,
    path: "/",
    maxAge,
  };
}

export function accessCookieOptions(expiresInSeconds?: number): CookieOptions {
  const maxAge =
    typeof expiresInSeconds === "number" && expiresInSeconds > 0
      ? Math.floor(expiresInSeconds)
      : ACCESS_FALLBACK_MAX_AGE;
  return baseOptions(maxAge);
}

export function refreshCookieOptions(): CookieOptions {
  return baseOptions(REFRESH_MAX_AGE);
}

/** Grava o par de tokens no destino informado. */
export function writeSessionCookies(
  writer: CookieWriter,
  tokens: TokenPair,
): void {
  writer.set(
    ACCESS_COOKIE,
    tokens.accessToken,
    accessCookieOptions(tokens.expiresIn),
  );
  writer.set(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions());
}

/** Remove os cookies de sessão. */
export function clearSessionCookies(writer: CookieWriter): void {
  writer.delete(ACCESS_COOKIE);
  writer.delete(REFRESH_COOKIE);
}
