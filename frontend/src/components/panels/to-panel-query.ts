/**
 * Adapta o resultado do TanStack Query ao contrato consumido pelos painéis.
 *
 * Existe para que os painéis dependam de um contrato mínimo — `data`,
 * `isPending`, `error`, `refetch` — e não do tipo completo do TanStack Query.
 */
import type { PanelQuery } from "./panel-frame";

export function toPanelQuery<TData>(query: {
  data: TData | undefined;
  isPending: boolean;
  error: unknown;
  refetch: () => unknown;
}): PanelQuery<TData> {
  return {
    data: query.data,
    isPending: query.isPending,
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
  };
}
