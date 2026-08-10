/**
 * Serviços do Inventory Engine — `/inventory/**`.
 *
 * Cada movimento tem endpoint próprio, como no backend. **Não existe método
 * que escreva quantidade**: não há `updateBalance`, porque não há rota. Saldo é
 * consequência de movimentos, e expor um atalho aqui sugeriria o contrário.
 *
 * O mínimo é a única escrita que não é movimento — `PUT`, porque mandar o
 * mesmo mínimo duas vezes é o mesmo estado.
 */
import { apiClient } from "@/api/client";
import { queryKeys, type QueryKey } from "@/api/query-keys";
import type { PaginatedResult, QueryParams, RequestOptions } from "@/types/api";
import type {
  InventoryAdjustmentInput,
  InventoryAnalyticsQuery,
  InventoryBalance,
  InventoryBalanceQuery,
  InventoryConsumptionPoint,
  InventoryItemView,
  InventoryMinimumInput,
  InventoryMovement,
  InventoryMovementInput,
  InventoryMovementQuery,
  InventoryMovementResult,
  InventoryOperationMovementInput,
  InventorySummary,
  InventoryTransferInput,
  InventoryTransferResult,
} from "@/types/inventory";

const INVENTORY = "inventory";
const PATH = "/inventory";

const asParams = (query?: object): QueryParams | undefined =>
  query as QueryParams | undefined;

export const inventoryService = {
  keys: {
    balances: (query?: InventoryBalanceQuery): QueryKey =>
      queryKeys.list(`${INVENTORY}-balances`, asParams(query)),
    balanceLists: (): QueryKey => queryKeys.lists(`${INVENTORY}-balances`),
    movements: (query?: InventoryMovementQuery): QueryKey =>
      queryKeys.list(`${INVENTORY}-movements`, asParams(query)),
    movementLists: (): QueryKey => queryKeys.lists(`${INVENTORY}-movements`),
    item: (id: string): QueryKey => queryKeys.detail(INVENTORY, id),
    summary: (query?: InventoryAnalyticsQuery): QueryKey =>
      queryKeys.list(`${INVENTORY}-summary`, asParams(query)),
    consumption: (query?: InventoryAnalyticsQuery): QueryKey =>
      queryKeys.list(`${INVENTORY}-consumption`, asParams(query)),
    all: (): QueryKey => queryKeys.module(INVENTORY),
  },

  /* ---------------------------------------------------------------- */
  /* Leitura                                                           */
  /* ---------------------------------------------------------------- */

  balances: (
    query?: InventoryBalanceQuery,
    options?: RequestOptions,
  ): Promise<PaginatedResult<InventoryBalance>> =>
    apiClient.get<PaginatedResult<InventoryBalance>>(`${PATH}/balances`, {
      ...options,
      query: asParams(query),
    }),

  /** Saldos de um item, unidade a unidade. Sem total da organização. */
  item: (
    catalogItemId: string,
    options?: RequestOptions,
  ): Promise<InventoryItemView> =>
    apiClient.get<InventoryItemView>(
      `${PATH}/items/${encodeURIComponent(catalogItemId)}`,
      options,
    ),

  movements: (
    query?: InventoryMovementQuery,
    options?: RequestOptions,
  ): Promise<PaginatedResult<InventoryMovement>> =>
    apiClient.get<PaginatedResult<InventoryMovement>>(`${PATH}/movements`, {
      ...options,
      query: asParams(query),
    }),

  summary: (
    query?: InventoryAnalyticsQuery,
    options?: RequestOptions,
  ): Promise<InventorySummary> =>
    apiClient.get<InventorySummary>(`${PATH}/analytics/summary`, {
      ...options,
      query: asParams(query),
    }),

  consumption: (
    query?: InventoryAnalyticsQuery,
    options?: RequestOptions,
  ): Promise<InventoryConsumptionPoint[]> =>
    apiClient.get<InventoryConsumptionPoint[]>(`${PATH}/analytics/consumption`, {
      ...options,
      query: asParams(query),
    }),

  /* ---------------------------------------------------------------- */
  /* Movimentos                                                        */
  /* ---------------------------------------------------------------- */

  entry: (input: InventoryMovementInput): Promise<InventoryMovementResult> =>
    apiClient.post<InventoryMovementResult>(`${PATH}/entries`, input),

  consume: (
    input: InventoryOperationMovementInput,
  ): Promise<InventoryMovementResult> =>
    apiClient.post<InventoryMovementResult>(`${PATH}/consumptions`, input),

  giveBack: (
    input: InventoryOperationMovementInput,
  ): Promise<InventoryMovementResult> =>
    apiClient.post<InventoryMovementResult>(`${PATH}/returns`, input),

  adjust: (
    input: InventoryAdjustmentInput,
  ): Promise<InventoryMovementResult> =>
    apiClient.post<InventoryMovementResult>(`${PATH}/adjustments`, input),

  /** Atômica no servidor: as duas pontas ou nenhuma. */
  transfer: (
    input: InventoryTransferInput,
  ): Promise<InventoryTransferResult> =>
    apiClient.post<InventoryTransferResult>(`${PATH}/transfers`, input),

  /* ---------------------------------------------------------------- */
  /* Estoque mínimo                                                    */
  /* ---------------------------------------------------------------- */

  setMinimum: (input: InventoryMinimumInput): Promise<InventoryBalance> =>
    apiClient.put<InventoryBalance>(`${PATH}/minimums`, input),
};
