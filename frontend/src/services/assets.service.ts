/**
 * Serviços do módulo Assets.
 *
 * Espelho um-para-um do `AssetController`. Nenhuma regra vive aqui: unicidade
 * de identificador, validade das referências e transição de status são
 * decisões do backend.
 *
 * `resolve/:identifier` merece nota: é a rota que o aplicativo de campo usa
 * depois de ler um QR ou uma etiqueta NFC. Ela existe no contrato e é o que
 * torna o identificador do ativo útil fora da tela.
 */
import { apiClient } from "@/api/client";
import { queryKeys, type QueryKey } from "@/api/query-keys";
import type { PaginatedResult, QueryParams, RequestOptions } from "@/types/api";
import type {
  Asset,
  AssetQuery,
  CreateAssetInput,
  UpdateAssetInput,
} from "@/types/assets";

const RESOURCE = "assets";
const BASE_PATH = "/assets";

const asParams = (query: object | undefined): QueryParams | undefined =>
  query as QueryParams | undefined;

const item = (id: string): string => `${BASE_PATH}/${encodeURIComponent(id)}`;

export const assetsService = {
  basePath: BASE_PATH,

  list: (
    query?: AssetQuery,
    options?: RequestOptions,
  ): Promise<PaginatedResult<Asset>> =>
    apiClient.get<PaginatedResult<Asset>>(BASE_PATH, {
      ...options,
      query: asParams(query),
    }),

  get: (id: string, options?: RequestOptions): Promise<Asset> =>
    apiClient.get<Asset>(item(id), options),

  /** Resolve pelo identificador gravado no QR, NFC ou etiqueta. */
  resolve: (identifier: string, options?: RequestOptions): Promise<Asset> =>
    apiClient.get<Asset>(
      `${BASE_PATH}/resolve/${encodeURIComponent(identifier)}`,
      options,
    ),

  create: (input: CreateAssetInput): Promise<Asset> =>
    apiClient.post<Asset>(BASE_PATH, input),

  update: (id: string, input: UpdateAssetInput): Promise<Asset> =>
    apiClient.patch<Asset>(item(id), input),

  remove: (id: string): Promise<void> => apiClient.delete<void>(item(id)),

  keys: {
    module: (): QueryKey => queryKeys.module(RESOURCE),
    lists: (): QueryKey => queryKeys.lists(RESOURCE),
    list: (query?: AssetQuery): QueryKey =>
      queryKeys.list(RESOURCE, asParams(query)),
    detail: (id: string): QueryKey => queryKeys.detail(RESOURCE, id),
  },
} as const;
