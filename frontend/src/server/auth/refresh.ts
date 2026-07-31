/**
 * Rotação do par de tokens.
 *
 * Isolado de `session.ts` porque o middleware (Edge Runtime) precisa renovar
 * a sessão sem importar `next/headers`, indisponível naquele contexto.
 */
import { backendJson, jsonBody } from "@/server/backend-client";
import type { TokenPair } from "@/types/session";

const inFlight = new Map<string, Promise<TokenPair | null>>();

/**
 * Renova o par de tokens; `null` quando o refresh token não é mais válido.
 *
 * O backend rotaciona o refresh token a cada uso, então chamadas concorrentes
 * com o mesmo token compartilham a mesma promessa — sem isso, a segunda
 * chamada invalidaria a sessão recém-renovada.
 */
export function refreshTokens(refreshToken: string): Promise<TokenPair | null> {
  const pending = inFlight.get(refreshToken);
  if (pending) return pending;

  const request = backendJson<TokenPair>({
    method: "POST",
    path: "/identity/refresh",
    body: jsonBody({ refreshToken }),
    retries: 0,
  })
    .catch(() => null)
    .finally(() => {
      inFlight.delete(refreshToken);
    });

  inFlight.set(refreshToken, request);
  return request;
}
