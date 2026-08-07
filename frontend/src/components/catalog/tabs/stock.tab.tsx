"use client";

/**
 * Estoque — a ausência, declarada.
 *
 * ## O que foi verificado
 *
 * Não há **nada** de estoque na plataforma:
 *
 * - nenhum modelo no `schema.prisma` (sem `Stock`, `Inventory`,
 *   `StockMovement`);
 * - nenhuma coluna de quantidade em `Product`;
 * - nenhuma rota — `/catalog/stock`, `/catalog/products/:id/stock`, `/stock` e
 *   `/inventory` respondem 404.
 *
 * Não é permissão faltando nem recurso de plano: o domínio não existe.
 *
 * ## Por que a tela não estima
 *
 * Daria para derivar algo de `metadata`, que é JSON livre, ou de contagens de
 * operações. Seria invenção. Estoque errado não é um número impreciso — é uma
 * compra que não se faz, uma visita que sai sem a peça, um contrato que
 * atrasa. A ausência honesta é mais útil que um número inventado.
 *
 * ## O que a aba oferece enquanto isso
 *
 * O recorte do catálogo que **seria** controlado por estoque quando o domínio
 * existir: produtos e peças, que são itens físicos. É informação real, e serve
 * para quem precisa saber o que há para controlar.
 */
import { Boxes } from "lucide-react";

import { PanelFrame } from "@/components/panels";
import { useCatalogCount } from "@/hooks/catalog/use-catalog";
import { ProductKind } from "@/types/contracts";
import { MetricCard } from "@/workspace";
import { CATALOG_METRIC_IDS } from "../catalog-kpis";

export function CatalogStockTab() {
  const products = useCatalogCount({ kind: ProductKind.PRODUCT });
  const parts = useCatalogCount({ kind: ProductKind.PART });

  return (
    <div className="space-y-5">
      <PanelFrame
        panelId="catalog-stock"
        title="Controle de estoque"
        description="Quantidades, movimentações e situação"
      >
        <div className="flex min-h-32 flex-col items-center justify-center gap-3 text-center">
          <Boxes className="size-6 text-muted-foreground" aria-hidden />
          <div className="max-w-lg space-y-2">
            <p className="text-sm font-medium">
              O backend ainda não tem controle de estoque
            </p>
            <p className="text-sm text-muted-foreground">
              Não existe modelo, coluna de quantidade nem endpoint de
              movimentação em nenhum módulo da plataforma. Não é uma permissão
              faltando: o domínio ainda não foi construído.
            </p>
            <p className="text-xs text-muted-foreground">
              Nenhuma quantidade é estimada aqui. Estoque errado não é um número
              impreciso — é uma visita que sai sem a peça.
            </p>
          </div>
        </div>
      </PanelFrame>

      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-medium">O que haveria para controlar</h3>
          <p className="text-xs text-muted-foreground">
            Itens físicos do catálogo — o recorte que passaria a ter quantidade
            quando o domínio existir. Serviços não entram: não se estocam.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard
            metricId={CATALOG_METRIC_IDS.products}
            value={products.total}
            isPending={products.isPending}
            failed={Boolean(products.error)}
            showDescription
          />
          <MetricCard
            metricId={CATALOG_METRIC_IDS.parts}
            value={parts.total}
            isPending={parts.isPending}
            failed={Boolean(parts.error)}
            showDescription
          />
        </div>
      </section>
    </div>
  );
}
