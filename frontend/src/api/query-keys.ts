/**
 * Query keys do TanStack Query.
 *
 * Convenção hierárquica: `[escopo, recurso, ação, parâmetros]`. Ela permite
 * invalidar por nível — `queryKeys.module("operations")` invalida tudo do
 * módulo, `queryKeys.detail("operations", id)` invalida só um registro.
 *
 * ```ts
 * queryClient.invalidateQueries({ queryKey: queryKeys.module("operations") });
 * ```
 *
 * Módulos novos não precisam de fábrica própria: reutilizam estas funções
 * com o próprio nome de recurso.
 */
import type { QueryParams } from "@/types/api";

export const ORBIT_QUERY_SCOPE = "orbit" as const;

export type QueryKey = readonly unknown[];

/** Ordena os parâmetros para que a mesma query gere sempre a mesma key. */
function stableParams(params?: QueryParams): Record<string, unknown> | null {
  if (!params) return null;
  const entries = Object.entries(params)
    .filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    )
    .sort(([a], [b]) => a.localeCompare(b));
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export const queryKeys = {
  all: [ORBIT_QUERY_SCOPE] as const,

  /** Raiz de um módulo — invalidar aqui derruba listas e detalhes. */
  module: (resource: string): QueryKey => [ORBIT_QUERY_SCOPE, resource],

  list: (resource: string, params?: QueryParams): QueryKey => [
    ORBIT_QUERY_SCOPE,
    resource,
    "list",
    stableParams(params),
  ],

  /**
   * Prefixo de **todas** as listagens de um recurso.
   *
   * `list(resource, params)` identifica uma consulta; `lists(resource)`
   * alcança todas as combinações de filtro. É a key certa para invalidar
   * depois de uma escrita que muda o que aparece na lista, sem derrubar o
   * cache dos detalhes.
   */
  lists: (resource: string): QueryKey => [ORBIT_QUERY_SCOPE, resource, "list"],

  infinite: (resource: string, params?: QueryParams): QueryKey => [
    ORBIT_QUERY_SCOPE,
    resource,
    "infinite",
    stableParams(params),
  ],

  detail: (resource: string, id: string): QueryKey => [
    ORBIT_QUERY_SCOPE,
    resource,
    "detail",
    id,
  ],

  /** Sub-recurso de um registro (ex.: anexos de uma operação). */
  nested: (
    resource: string,
    id: string,
    child: string,
    params?: QueryParams,
  ): QueryKey => [
    ORBIT_QUERY_SCOPE,
    resource,
    "detail",
    id,
    child,
    stableParams(params),
  ],

  /** Consulta avulsa de um módulo (ex.: `analytics/overview`). */
  query: (resource: string, action: string, params?: QueryParams): QueryKey => [
    ORBIT_QUERY_SCOPE,
    resource,
    action,
    stableParams(params),
  ],

  session: (): QueryKey => [ORBIT_QUERY_SCOPE, "session"],
} as const;
