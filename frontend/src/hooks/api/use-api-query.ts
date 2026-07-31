"use client";

/**
 * Hooks de leitura.
 *
 * Sobre o `useQuery` padrão, acrescentam: `AbortSignal` repassado ao cliente
 * HTTP (a query cancelada aborta a requisição), erro tipado como `ApiError` e
 * a política de retry do Frontend Core.
 */
import {
  useInfiniteQuery,
  useQuery,
  type UseInfiniteQueryOptions,
  type UseInfiniteQueryResult,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";

import { apiClient } from "@/api/client";
import type { QueryKey } from "@/api/query-keys";
import type { ApiError } from "@/lib/api-error";
import type {
  CursorResult,
  PaginatedResult,
  QueryParams,
  RequestOptions,
} from "@/types/api";

export interface ApiQueryContext {
  signal: AbortSignal;
}

export type ApiFetcher<TData> = (context: ApiQueryContext) => Promise<TData>;

export type ApiQueryOptions<TData> = Omit<
  UseQueryOptions<TData, ApiError, TData, QueryKey>,
  "queryKey" | "queryFn"
>;

/** Base de todas as leituras: recebe a key e um fetcher que honra o `signal`. */
export function useApiQuery<TData>(
  queryKey: QueryKey,
  fetcher: ApiFetcher<TData>,
  options?: ApiQueryOptions<TData>,
): UseQueryResult<TData, ApiError> {
  return useQuery<TData, ApiError, TData, QueryKey>({
    queryKey,
    queryFn: ({ signal }) => fetcher({ signal }),
    ...options,
  });
}

/** Atalho para `GET` direto em uma rota do backend. */
export function useApiResource<TData>(
  queryKey: QueryKey,
  path: string,
  request?: RequestOptions,
  options?: ApiQueryOptions<TData>,
): UseQueryResult<TData, ApiError> {
  return useApiQuery<TData>(
    queryKey,
    ({ signal }) => apiClient.get<TData>(path, { ...request, signal }),
    options,
  );
}

/** Listagem paginada por página (`{ data, meta }`). */
export function usePaginatedQuery<TEntity>(
  queryKey: QueryKey,
  path: string,
  query?: QueryParams,
  options?: ApiQueryOptions<PaginatedResult<TEntity>>,
): UseQueryResult<PaginatedResult<TEntity>, ApiError> {
  return useApiQuery<PaginatedResult<TEntity>>(
    queryKey,
    ({ signal }) =>
      apiClient.get<PaginatedResult<TEntity>>(path, { query, signal }),
    { placeholderData: (previous) => previous, ...options },
  );
}

export type InfiniteApiQueryOptions<TEntity> = Omit<
  UseInfiniteQueryOptions<
    PaginatedResult<TEntity>,
    ApiError,
    PaginatedResult<TEntity>[],
    QueryKey,
    number
  >,
  "queryKey" | "queryFn" | "getNextPageParam" | "initialPageParam"
>;

/** Rolagem infinita sobre listagens paginadas por página. */
export function useInfiniteApiQuery<TEntity>(
  queryKey: QueryKey,
  path: string,
  query?: QueryParams,
  options?: InfiniteApiQueryOptions<TEntity>,
): UseInfiniteQueryResult<PaginatedResult<TEntity>[], ApiError> {
  return useInfiniteQuery({
    queryKey,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      apiClient.get<PaginatedResult<TEntity>>(path, {
        query: { ...query, page: pageParam },
        signal,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.page + 1 : undefined,
    ...options,
  });
}

/** Rolagem infinita sobre listagens por cursor (`{ data, nextCursor }`). */
export function useCursorQuery<TEntity>(
  queryKey: QueryKey,
  path: string,
  query?: QueryParams,
): UseInfiniteQueryResult<CursorResult<TEntity>[], ApiError> {
  return useInfiniteQuery({
    queryKey,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      apiClient.get<CursorResult<TEntity>>(path, {
        query: { ...query, cursor: pageParam },
        signal,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}
