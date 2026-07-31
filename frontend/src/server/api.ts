/**
 * Cliente de API para Server Components, Server Actions e Route Handlers.
 *
 * Mesma semântica do cliente do browser (`@/api`), porém sem passar pelo
 * proxy: o servidor já tem acesso aos cookies e fala direto com o NestJS.
 *
 * ```ts
 * // app/(app)/operacoes/page.tsx  (Server Component)
 * const operations = await serverApi.get<PaginatedResult<Operation>>("/operations", {
 *   query: { page: 1, limit: 20 },
 * });
 * ```
 */
import { headers } from "next/headers";

import { ApiError } from "@/lib/api-error";
import { CONTEXT_HEADERS } from "@/lib/context-headers";
import { DEFAULT_LOCALE, DEFAULT_TIMEZONE } from "@/lib/env";
import { backendJson, jsonBody } from "@/server/backend-client";
import { resolveAccess } from "@/server/auth/session";
import type { RequestOptions, RequestOptionsWithBody } from "@/types/api";

/** Lançado quando não há sessão utilizável — trate com `redirect("/login")`. */
export class ServerSessionExpiredError extends ApiError {
  constructor() {
    super({
      kind: "http",
      status: 401,
      code: "SESSION_EXPIRED",
      message: "Sessão expirada. Faça login novamente.",
    });
    this.name = "ServerSessionExpiredError";
  }
}

async function requestContext(): Promise<{
  locale: string;
  timezone: string;
  requestId?: string;
}> {
  const incoming = await headers();
  return {
    locale: incoming.get("accept-language") ?? DEFAULT_LOCALE,
    timezone: incoming.get(CONTEXT_HEADERS.timezone) ?? DEFAULT_TIMEZONE,
    requestId: incoming.get(CONTEXT_HEADERS.requestId) ?? undefined,
  };
}

async function request<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  options: RequestOptionsWithBody = {},
): Promise<T> {
  const access = await resolveAccess();
  if (!access.accessToken || !access.claims) {
    throw new ServerSessionExpiredError();
  }
  const context = await requestContext();
  return backendJson<T>({
    method,
    path,
    query: options.query,
    headers: options.headers,
    body: jsonBody(options.body),
    accessToken: access.accessToken,
    organizationId:
      options.context?.organizationId ?? access.claims.organizationId,
    businessUnitId:
      options.context?.businessUnitId ?? access.claims.businessUnitId,
    requestId: options.context?.requestId ?? context.requestId,
    locale: options.context?.locale ?? context.locale,
    timezone: options.context?.timezone ?? context.timezone,
    signal: options.signal,
    timeoutMs: options.timeoutMs,
    retries: options.retries,
  });
}

export const serverApi = {
  get: <T>(path: string, options?: RequestOptions): Promise<T> =>
    request<T>("GET", path, options),
  post: <T>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> => request<T>("POST", path, { ...options, body }),
  put: <T>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> => request<T>("PUT", path, { ...options, body }),
  patch: <T>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> => request<T>("PATCH", path, { ...options, body }),
  delete: <T = void>(path: string, options?: RequestOptions): Promise<T> =>
    request<T>("DELETE", path, options),
} as const;
