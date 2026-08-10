"use client";

/**
 * Indicadores de estoque — do Analytics do backend.
 *
 * Os cinco números vêm de `GET /inventory/analytics/summary`. **Nenhum é
 * calculado percorrendo registros carregados**: `trackedItems`,
 * `lowStockItems` e `outOfStockItems` são contagens do banco, e os movimentos
 * são somas do período.
 *
 * Não há indicador de valor. Estoque não tem valoração no contrato — sem FIFO
 * ou custo médio, qualquer número seria invenção com cara de contabilidade.
 */
import { useInventorySummary } from "@/hooks/inventory/use-inventory";
import { MetricCard } from "@/workspace";
import type { InventoryAnalyticsQuery } from "@/types/inventory";

export function InventoryKpis({ query }: { query: InventoryAnalyticsQuery }) {
  const summary = useInventorySummary(query);
  const failed = Boolean(summary.error);
  const data = summary.data;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <MetricCard
        metricId="inventory.tracked.total"
        value={data?.trackedItems}
        isPending={summary.isPending}
        failed={failed}
      />
      <MetricCard
        metricId="inventory.low.total"
        value={data?.lowStockItems}
        isPending={summary.isPending}
        failed={failed}
        showDescription
      />
      <MetricCard
        metricId="inventory.out.total"
        value={data?.outOfStockItems}
        isPending={summary.isPending}
        failed={failed}
      />
      <MetricCard
        metricId="inventory.entries.count"
        value={data?.movements.entries.count}
        isPending={summary.isPending}
        failed={failed}
      />
      <MetricCard
        metricId="inventory.consumption.count"
        value={data?.movements.consumption.count}
        isPending={summary.isPending}
        failed={failed}
      />
    </div>
  );
}
