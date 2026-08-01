/**
 * Rotação do par de tokens.
 *
 * Isolado de `session.ts` porque o middleware (Edge Runtime) precisa renovar
 * a sessão sem importar `next/headers`, indisponível naquele contexto.
 */
import { backendJson, jsonBody } from "@/server/backend-client";
import type { TokenPair } from "@/types/session";

/**
 * Janela em que o resultado de uma rotação continua sendo devolvido para o
 * refresh token antigo.
 *
 * O backend consome o refresh token a cada uso. Sem essa janela, uma página
 * que dispara várias chamadas em paralelo com o access token vencido perderia
 * a sessão: a primeira requisição rotaciona, e as demais — que partiram do
 * browser com o mesmo cookie antigo — chegariam ao backend com um token já
 * consumido, levando 401 e derrubando o usuário.
 *
 * O intervalo é curto e o par devolvido é o mesmo que o browser já receberia
 * na resposta da primeira requisição, então não amplia o que um portador do
 * token antigo conseguiria fazer.
 */
const ROTATION_GRACE_MS = 15_000;

/** Teto defensivo para a memória do processo. */
const MAX_CACHED_ROTATIONS = 500;

const inFlight = new Map<string, Promise<TokenPair | null>>();
const rotated = new Map<string, { pair: TokenPair; expiresAt: number }>();

function remember(refreshToken: string, pair: TokenPair): void {
  if (rotated.size >= MAX_CACHED_ROTATIONS) prune(true);
  rotated.set(refreshToken, {
    pair,
    expiresAt: Date.now() + ROTATION_GRACE_MS,
  });
}

function prune(force = false): void {
  const now = Date.now();
  for (const [token, entry] of rotated) {
    if (force || entry.expiresAt <= now) rotated.delete(token);
    if (force && rotated.size < MAX_CACHED_ROTATIONS / 2) break;
  }
}

/**
 * Renova o par de tokens; `null` quando o refresh token não é mais válido.
 *
 * Chamadas concorrentes com o mesmo token compartilham a mesma promessa, e as
 * que chegam logo depois da rotação recebem o par recém-emitido.
 */
export function refreshTokens(refreshToken: string): Promise<TokenPair | null> {
  const recent = rotated.get(refreshToken);
  if (recent && recent.expiresAt > Date.now()) {
    return Promise.resolve(recent.pair);
  }

  const pending = inFlight.get(refreshToken);
  if (pending) return pending;

  const request = backendJson<TokenPair>({
    method: "POST",
    path: "/identity/refresh",
    body: jsonBody({ refreshToken }),
    retries: 0,
  })
    .then((pair) => {
      remember(refreshToken, pair);
      prune();
      return pair;
    })
    .catch(() => null)
    .finally(() => {
      inFlight.delete(refreshToken);
    });

  inFlight.set(refreshToken, request);
  return request;
}
