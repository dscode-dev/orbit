"use client";

/**
 * O que mais sai da prateleira.
 *
 * `GET /inventory/analytics/consumption` devolve consumo por item no período,
 * já agrupado e ordenado pelo banco. A tela não soma nada — e não compara
 * itens entre si por quantidade: quilos de gás e unidades de filtro não são a
 * mesma grandeza, e a barra existe só para dar proporção **dentro** da lista.
 */
import { PackageMinus } from "lucide-react";

import { PanelFrame, PanelState, toPanelQuery } from "@/components/panels";
import { useInventoryConsumption } from "@/hooks/inventory/use-inventory";
import type { InventoryAnalyticsQuery } from "@/types/inventory";
import { Quantity } from "./inventory-presentation";

export function InventoryConsumptionPanel({
  query,
}: {
  query: InventoryAnalyticsQuery;
}) {
  const consumption = useInventoryConsumption(query);

  return (
    <PanelFrame
      panelId="inventory-consumption"
      title="Mais consumidos no período"
      description="Material usado em trabalhos, por item"
    >
      <PanelState
        query={toPanelQuery(consumption)}
        isEmpty={(rows) => rows.length === 0}
        emptyMessage="Nenhum consumo registrado no período."
      >
        {(rows) => {
          /** Proporção relativa ao maior — leitura visual, não indicador. */
          const top = Math.max(...rows.map((row) => Number(row.quantity)), 1);

          return (
            <ul className="space-y-3">
              {rows.map((row) => {
                const amount = Number(row.quantity);
                return (
                  <li key={row.item.id} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">
                        {row.item.name}
                        {row.item.sku ? (
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {row.item.sku}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0">
                        <Quantity value={row.quantity} unit={row.item.unit} />
                        <span className="ml-2 text-xs text-muted-foreground">
                          {row.movements}{" "}
                          {row.movements === 1 ? "saída" : "saídas"}
                        </span>
                      </span>
                    </div>
                    <div
                      className="h-1.5 overflow-hidden rounded-full bg-surface-strong"
                      aria-hidden
                    >
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max((amount / top) * 100, 2)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          );
        }}
      </PanelState>

      <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
        <PackageMinus className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          As barras comparam itens dentro desta lista. Quantidades de unidades
          diferentes — quilos, metros, peças — não são somáveis entre si, e
          nenhum total geral é publicado.
        </span>
      </p>
    </PanelFrame>
  );
}
