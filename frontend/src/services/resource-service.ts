/**
 * Fábrica de serviços de recurso.
 *
 * É o atalho para os próximos módulos: em vez de escrever chamadas HTTP,
 * declare o recurso e ganhe CRUD tipado, query keys e sub-recursos.
 *
 * ```ts
 * // src/services/operations.service.ts
 * export const operationsService = createResourceService<
 *   Operation,
 *   CreateOperationInput,
 *   UpdateOperationInput,
 *   OperationQuery
 * >("operations");
 *
 * // uso
 * const page = await operationsService.list({ page: 1, status: "OPEN" });
 * const keys = operationsService.keys.detail(id);
 * ```
 *
 * Os tipos `Operation`, `CreateOperationInput` etc. vêm dos contratos do
 * backend (`@/types`) — nunca redeclare interfaces no frontend.
 */
import { apiClient } from "@/api/client";
import { queryKeys, type QueryKey } from "@/api/query-keys";
import {
  download,
  upload,
  type DownloadResult,
  type UploadOptions,
} from "@/api/transfer";
import type { PaginatedResult, QueryParams, RequestOptions } from "@/types/api";

export interface ResourceService<
  TEntity,
  TCreate = unknown,
  TUpdate = Partial<TCreate>,
  TQuery extends QueryParams = QueryParams,
> {
  /** Nome do recurso — também é a raiz da rota e da query key. */
  readonly resource: string;
  readonly basePath: string;
  readonly keys: {
    module: () => QueryKey;
    list: (query?: TQuery) => QueryKey;
    detail: (id: string) => QueryKey;
    nested: (id: string, child: string, query?: QueryParams) => QueryKey;
  };
  list: (
    query?: TQuery,
    options?: RequestOptions,
  ) => Promise<PaginatedResult<TEntity>>;
  listAll: (
    query?: TQuery,
    options?: RequestOptions,
  ) => Promise<readonly TEntity[]>;
  get: (id: string, options?: RequestOptions) => Promise<TEntity>;
  create: (input: TCreate, options?: RequestOptions) => Promise<TEntity>;
  update: (
    id: string,
    input: TUpdate,
    options?: RequestOptions,
  ) => Promise<TEntity>;
  remove: (id: string, options?: RequestOptions) => Promise<void>;
  /** Sub-recurso de um registro: `/{recurso}/{id}/{child}`. */
  child: <TChild>(
    id: string,
    child: string,
    options?: RequestOptions,
  ) => Promise<TChild>;
  /** Ação sobre um registro: `POST /{recurso}/{id}/{action}`. */
  action: <TResult>(
    id: string,
    action: string,
    body?: unknown,
    options?: RequestOptions,
  ) => Promise<TResult>;
  uploadTo: <TResult>(
    id: string,
    child: string,
    file: File | Blob,
    options?: UploadOptions,
  ) => Promise<TResult>;
  downloadFrom: (
    id: string,
    child: string,
    options?: RequestOptions,
  ) => Promise<DownloadResult>;
}

export function createResourceService<
  TEntity,
  TCreate = unknown,
  TUpdate = Partial<TCreate>,
  TQuery extends QueryParams = QueryParams,
>(
  resource: string,
  options: { basePath?: string } = {},
): ResourceService<TEntity, TCreate, TUpdate, TQuery> {
  const basePath = options.basePath ?? `/${resource}`;
  const itemPath = (id: string): string =>
    `${basePath}/${encodeURIComponent(id)}`;

  return {
    resource,
    basePath,
    keys: {
      module: () => queryKeys.module(resource),
      list: (query) => queryKeys.list(resource, query),
      detail: (id) => queryKeys.detail(resource, id),
      nested: (id, child, query) =>
        queryKeys.nested(resource, id, child, query),
    },
    list: (query, requestOptions) =>
      apiClient.get<PaginatedResult<TEntity>>(basePath, {
        ...requestOptions,
        query,
      }),
    listAll: (query, requestOptions) =>
      apiClient.get<readonly TEntity[]>(basePath, {
        ...requestOptions,
        query,
      }),
    get: (id, requestOptions) =>
      apiClient.get<TEntity>(itemPath(id), requestOptions),
    create: (input, requestOptions) =>
      apiClient.post<TEntity>(basePath, input, requestOptions),
    update: (id, input, requestOptions) =>
      apiClient.patch<TEntity>(itemPath(id), input, requestOptions),
    remove: (id, requestOptions) =>
      apiClient.delete<void>(itemPath(id), requestOptions),
    child: <TChild>(
      id: string,
      child: string,
      requestOptions?: RequestOptions,
    ) => apiClient.get<TChild>(`${itemPath(id)}/${child}`, requestOptions),
    action: <TResult>(
      id: string,
      action: string,
      body?: unknown,
      requestOptions?: RequestOptions,
    ) =>
      apiClient.post<TResult>(
        `${itemPath(id)}/${action}`,
        body,
        requestOptions,
      ),
    uploadTo: <TResult>(
      id: string,
      child: string,
      file: File | Blob,
      uploadOptions?: UploadOptions,
    ) => upload<TResult>(`${itemPath(id)}/${child}`, file, uploadOptions),
    downloadFrom: (id, child, requestOptions) =>
      download(`${itemPath(id)}/${child}`, requestOptions),
  };
}
