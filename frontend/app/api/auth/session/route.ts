/**
 * Estado da sessão para o `SessionProvider` do browser.
 *
 * Devolve perfil, escopo, papéis e permissões — nunca tokens.
 */
import {
  buildSessionState,
  endSession,
  persistSession,
  resolveAccess,
} from "@/server/auth/session";
import { bffJson } from "@/server/bff/responses";
import { createRouteHandler } from "@/server/bff/route-handler";
import { ANONYMOUS_SESSION } from "@/types/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = createRouteHandler(async ({ requestId }) => {
  const access = await resolveAccess({ allowRefresh: true });
  if (!access.accessToken || !access.claims) {
    const response = bffJson(ANONYMOUS_SESSION, requestId);
    if (access.expired) endSession(response.cookies);
    return response;
  }
  const state = await buildSessionState(access.accessToken, access.claims);
  const response = bffJson(state, requestId);
  if (access.rotated) persistSession(response.cookies, access.rotated);
  if (!state.authenticated) endSession(response.cookies);
  return response;
});
