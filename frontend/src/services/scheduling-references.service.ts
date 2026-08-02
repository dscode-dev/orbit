/**
 * Referências usadas pelos filtros da agenda: clientes e ativos.
 *
 * `EventQueryDto` aceita `customerId` e `assetId`, mas o Scheduling não
 * devolve nomes — só identificadores. Sem uma fonte de nomes, os filtros de
 * cliente e ativo seriam campos de UUID cru, o que não é uma funcionalidade.
 *
 * Estes dois endpoints existem e resolvem isso. Duas ressalvas registradas em
 * `docs/scheduling-workspace.md`:
 *
 * 1. **As formas são espelhadas, não sincronizadas** — `crm` e `assets` não
 *    publicam Read Models. Só os campos usados aqui são declarados, e o acesso
 *    é tolerante a ausência.
 * 2. **Exigem capabilities próprias** (`crm.read`, `assets.read`). Quando o
 *    plano não as inclui, o backend responde 403 e o filtro correspondente
 *    fica indisponível — declarado na interface, não escondido.
 */
import { apiClient } from "@/api/client";
import { queryKeys, type QueryKey } from "@/api/query-keys";
import type { PaginatedResult, RequestOptions } from "@/types/api";

/** Recorte de cliente usado no seletor. */
export interface CustomerOption {
  id: string;
  legalName: string;
  tradeName: string | null;
}

/** Recorte de ativo usado no seletor. */
export interface AssetOption {
  id: string;
  name: string;
  identifier: string | null;
}

const PICKER_LIMIT = 100;

export const schedulingReferencesService = {
  customers: (
    search: string | undefined,
    options?: RequestOptions,
  ): Promise<PaginatedResult<CustomerOption>> =>
    apiClient.get<PaginatedResult<CustomerOption>>("/customers", {
      ...options,
      query: { limit: PICKER_LIMIT, search: search || undefined },
    }),

  assets: (
    search: string | undefined,
    options?: RequestOptions,
  ): Promise<PaginatedResult<AssetOption>> =>
    apiClient.get<PaginatedResult<AssetOption>>("/assets", {
      ...options,
      query: { limit: PICKER_LIMIT, search: search || undefined },
    }),

  keys: {
    customers: (search?: string): QueryKey =>
      queryKeys.query("customers", "picker", { search }),
    assets: (search?: string): QueryKey =>
      queryKeys.query("assets", "picker", { search }),
  },
} as const;
