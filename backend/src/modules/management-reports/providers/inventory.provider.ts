/**
 * Estoque — quantidade física, e só ela.
 *
 * Todo número vem de `InventoryService`, que é a autoridade sobre o que é
 * "baixo", o que conta como consumo e como a quantidade é arredondada (três
 * casas). Reimplementar a régua aqui faria o relatório discordar da tela de
 * estoque sobre quais itens estão críticos.
 *
 * ## Nenhum valor financeiro
 *
 * Não há custo, valor em prateleira, custo médio, FIFO nem valoração — e a
 * ausência é deliberada, não esquecimento: `costPrice` do Catálogo é o preço
 * de hoje, não o custo das unidades que estão lá, e sem regra autoritativa de
 * custo qualquer total em dinheiro seria um número inventado com aparência de
 * contabilidade. Um relatório gerencial é exatamente onde esse número seria
 * lido como verdade.
 */
import { Injectable } from '@nestjs/common';
import { InventoryService } from '../../inventory/inventory.service';
import type { ReportSectionReadModel } from '../report.read-models';
import {
  count,
  type ReportComposition,
  type ReportProvider,
  type ReportProviderContext,
} from './report.provider';

const SOURCE = 'inventory.analytics';

@Injectable()
export class InventoryReportProvider implements ReportProvider {
  readonly domain = 'INVENTORY';
  readonly requires = {
    capabilities: ['inventory.read'],
    permissions: ['inventory.read'],
  };

  constructor(private readonly inventory: InventoryService) {}

  async compose({ scope }: ReportProviderContext): Promise<ReportComposition> {
    const query = {
      from: scope.from,
      to: scope.to,
      businessUnitId: scope.businessUnitId ?? undefined,
    };

    const [summary, consumption] = await Promise.all([
      this.inventory.summary(scope.organizationId, query),
      this.inventory.consumptionByItem(scope.organizationId, query),
    ]);

    const sections: ReportSectionReadModel[] = [
      {
        id: 'inventory.position',
        title: 'Posição',
        description: 'Itens controlados e os que estão em situação crítica.',
        metrics: [
          {
            id: 'inventory.tracked_items',
            label: 'Itens com saldo controlado',
            value: count(summary.trackedItems),
            source: SOURCE,
            provenance: 'OBSERVED',
          },
          {
            id: 'inventory.low_stock',
            label: 'Itens com estoque baixo',
            value: count(summary.lowStockItems),
            source: SOURCE,
            provenance: 'OBSERVED',
            note: 'Saldo menor ou igual ao mínimo configurado.',
          },
          {
            id: 'inventory.out_of_stock',
            label: 'Itens zerados',
            value: count(summary.outOfStockItems),
            source: SOURCE,
            provenance: 'OBSERVED',
          },
        ],
        tables: [],
      },
      {
        id: 'inventory.movements',
        title: 'Movimentação do período',
        description: 'Quantidades físicas. Sem valor, custo ou valoração.',
        metrics: [
          {
            id: 'inventory.entries',
            label: 'Entradas',
            value: summary.movements.entries.quantity,
            source: SOURCE,
            provenance: 'OBSERVED',
            note: `${summary.movements.entries.count} movimentos.`,
          },
          {
            id: 'inventory.exits',
            label: 'Saídas',
            value: summary.movements.exits.quantity,
            source: SOURCE,
            provenance: 'OBSERVED',
            note: `${summary.movements.exits.count} movimentos.`,
          },
          {
            id: 'inventory.consumption',
            label: 'Consumo em visita',
            value: summary.movements.consumption.quantity,
            source: SOURCE,
            provenance: 'OBSERVED',
            note: `${summary.movements.consumption.count} movimentos.`,
          },
          {
            id: 'inventory.transfers',
            label: 'Transferências',
            value: count(summary.movements.transfers.count),
            source: SOURCE,
            provenance: 'OBSERVED',
          },
          {
            id: 'inventory.adjustments',
            label: 'Ajustes',
            value: count(summary.movements.adjustments.count),
            source: SOURCE,
            provenance: 'OBSERVED',
          },
        ],
        tables: [
          {
            id: 'inventory.consumption_by_item',
            title: 'Itens mais consumidos',
            columns: [
              { key: 'item', label: 'Item' },
              { key: 'quantity', label: 'Quantidade', align: 'right' },
              { key: 'movements', label: 'Movimentos', align: 'right' },
            ],
            rows: consumption.map((point) => ({
              item: point.item.name,
              quantity: point.quantity,
              movements: String(point.movements),
            })),
            source: SOURCE,
            provenance: 'OBSERVED',
            note: 'Quantidade consumida — não há valor em dinheiro associado.',
          },
        ],
      },
    ];

    return {
      sections,
      sources: [
        {
          domain: this.domain,
          source: SOURCE,
          provenance: 'OBSERVED',
          included: true,
        },
      ],
    };
  }
}
