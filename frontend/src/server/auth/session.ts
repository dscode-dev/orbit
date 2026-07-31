/**
 * Sessão do lado servidor.
 *
 * Responsável por ler os cookies `HttpOnly`, conhecer o escopo ativo, renovar
 * o par de tokens (com deduplicação) e montar o estado de sessão entregue ao
 * browser — sempre sem expor tokens.
 */
import { cookies } from "next/headers";

import { ApiError } from "@/lib/api-error";
import { backendJson, jsonBody } from "@/server/backend-client";
import type {
  AccessTokenClaims,
  AuthenticatedSession,
  LoginInput,
  RegisterInput,
  SessionState,
  SessionUser,
  TokenPair,
} from "@/types/session";
import { ANONYMOUS_SESSION } from "@/types/session";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  type CookieWriter,
  clearSessionCookies,
  writeSessionCookies,
} from "./cookies";
import { claimList, decodeAccessToken, expiresAtIso, isExpired } from "./jwt";
import { refreshTokens } from "./refresh";

export { refreshTokens };

export interface StoredTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

export interface ResolvedAccess {
  accessToken: string | null;
  claims: AccessTokenClaims | null;
  /** Novo par emitido nesta chamada. O chamador precisa persistí-lo. */
  rotated: TokenPair | null;
  /** `true` quando a sessão não pôde ser recuperada e deve ser encerrada. */
  expired: boolean;
}

export async function readStoredTokens(): Promise<StoredTokens> {
  const store = await cookies();
  return {
    accessToken: store.get(ACCESS_COOKIE)?.value ?? null,
    refreshToken: store.get(REFRESH_COOKIE)?.value ?? null,
  };
}

/**
 * Resolve o access token utilizável na requisição atual.
 *
 * `allowRefresh` só deve ser habilitado onde é possível gravar cookies
 * (Route Handlers, Server Actions e middleware). Em Server Components a
 * renovação é feita antes, pelo middleware — renovar sem poder persistir o
 * novo refresh token invalidaria a sessão do usuário.
 */
export async function resolveAccess(
  options: { allowRefresh?: boolean } = {},
): Promise<ResolvedAccess> {
  const { accessToken, refreshToken } = await readStoredTokens();
  const claims = accessToken ? decodeAccessToken(accessToken) : null;
  const usable = claims && !isExpired(claims);

  if (accessToken && usable) {
    return { accessToken, claims, rotated: null, expired: false };
  }
  if (!options.allowRefresh || !refreshToken) {
    return {
      accessToken: null,
      claims: null,
      rotated: null,
      expired: Boolean(accessToken ?? refreshToken),
    };
  }

  const rotated = await refreshTokens(refreshToken);
  if (!rotated) {
    return { accessToken: null, claims: null, rotated: null, expired: true };
  }
  return {
    accessToken: rotated.accessToken,
    claims: decodeAccessToken(rotated.accessToken),
    rotated,
    expired: false,
  };
}

/** Estado de sessão entregue ao browser (sem tokens). */
export async function buildSessionState(
  accessToken: string,
  claims: AccessTokenClaims,
): Promise<SessionState> {
  try {
    const user = await backendJson<SessionUser>({
      path: "/identity/me",
      accessToken,
      retries: 0,
    });
    const session: AuthenticatedSession = {
      authenticated: true,
      user,
      scope: {
        organizationId: claims.organizationId,
        businessUnitId: claims.businessUnitId,
        businessUnitIds: claimList(claims.businessUnitIds),
      },
      roles: claimList(claims.roles),
      permissions: claimList(claims.permissions),
      sessionId: claims.sid,
      expiresAt: expiresAtIso(claims),
    };
    return session;
  } catch (error) {
    if (error instanceof ApiError && error.isUnauthorized) {
      return ANONYMOUS_SESSION;
    }
    throw error;
  }
}

/** Autentica no backend e devolve o par de tokens (sem gravar cookies). */
export function login(input: LoginInput): Promise<TokenPair> {
  return backendJson<TokenPair>({
    method: "POST",
    path: "/identity/login",
    body: jsonBody({ client: "WEB", ...input }),
    retries: 0,
  });
}

/** Cria organização + usuário e devolve o par de tokens. */
export function register(input: RegisterInput): Promise<TokenPair> {
  return backendJson<TokenPair>({
    method: "POST",
    path: "/identity/register",
    body: jsonBody({ client: "WEB", ...input }),
    retries: 0,
  });
}

/** Encerra a sessão no backend. Falhas são silenciosas: o cookie some de todo modo. */
export async function logout(tokens: StoredTokens): Promise<void> {
  if (!tokens.accessToken) return;
  await backendJson<void>({
    method: "POST",
    path: "/identity/logout",
    accessToken: tokens.accessToken,
    body: jsonBody({ refreshToken: tokens.refreshToken ?? undefined }),
    retries: 0,
  }).catch(() => undefined);
}

export function persistSession(writer: CookieWriter, tokens: TokenPair): void {
  writeSessionCookies(writer, tokens);
}

export function endSession(writer: CookieWriter): void {
  clearSessionCookies(writer);
}
