/**
 * Configuração do TanStack Query.
 *
 * A política de retry é a mesma do cliente HTTP (`@/lib/retry`): nada de
 * reenviar erro de validação, 401, 403 ou 404 — apenas falhas transitórias.
 * Sessão expirada (401) nunca é reenviada; o proxy já tentou renovar o token.
 */
import { QueryClient, type QueryClientConfig } from "@tanstack/react-query";

import { isRetryableError, retryDelay } from "@/lib/retry";

const STALE_TIME_MS = 30_000;
const GC_TIME_MS = 5 * 60_000;
const MAX_QUERY_RETRIES = 2;

export const queryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME_MS,
      gcTime: GC_TIME_MS,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: (failureCount, error) =>
        failureCount < MAX_QUERY_RETRIES && isRetryableError(error),
      retryDelay: (attempt) => retryDelay(attempt),
    },
    mutations: {
      /** Mutações não são reenviadas automaticamente: o usuário decide. */
      retry: false,
    },
  },
};

export function createQueryClient(): QueryClient {
  return new QueryClient(queryClientConfig);
}

let browserQueryClient: QueryClient | undefined;

/**
 * No servidor cada render precisa de um cliente novo; no browser mantemos um
 * único cliente entre navegações para preservar o cache.
 */
export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") return createQueryClient();
  browserQueryClient ??= createQueryClient();
  return browserQueryClient;
}
