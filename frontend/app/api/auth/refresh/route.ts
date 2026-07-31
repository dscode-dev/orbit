/**
 * Renovação explícita da sessão.
 *
 * O fluxo normal é automático (middleware e proxy renovam sob demanda); esta
 * rota existe para o cliente forçar a rotação — por exemplo ao voltar de uma
 * aba inativa por muito tempo.
 */
import {
  endSession,
  persistSession,
  readStoredTokens,
  refreshTokens,
} from "@/server/auth/session";
import { bffError, bffJson } from "@/server/bff/responses";
import { createRouteHandler } from "@/server/bff/route-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = createRouteHandler(async ({ requestId }) => {
  const { refreshToken } = await readStoredTokens();
  const tokens = refreshToken ? await refreshTokens(refreshToken) : null;
  if (!tokens) {
    const failure = bffError({
      status: 401,
      code: "SESSION_EXPIRED",
      message: "Sessão expirada. Faça login novamente.",
      requestId,
    });
    endSession(failure.cookies);
    return failure;
  }
  const response = bffJson({ authenticated: true }, requestId);
  persistSession(response.cookies, tokens);
  return response;
});
