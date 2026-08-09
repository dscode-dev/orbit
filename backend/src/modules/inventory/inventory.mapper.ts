/**
 * Mapeadores do Inventory Engine.
 *
 * Nenhum modelo Prisma sai daqui. Quantidade vira **string** com três casas,
 * pela mesma razão do dinheiro no Financeiro — e porque estoque em HVAC-R se
 * mede em fração: quilos de gás, metros de tubo.
 *
 * Duas respostas são calculadas aqui, e as duas são do **servidor**: a direção
 * que o tipo implica, e o estado do saldo diante do mínimo. Comparar saldo com
 * mínimo no cliente daria a duas telas a chance de discordar sobre o que é
 * "baixo".
 */
import { Injectable } from '@nestjs/common';
import type { InventoryStockStatus } from '../../contracts';
import type {
  InventoryBalanceReadModel,
  InventoryItemRefReadModel,
  InventoryMovementReadModel,
} from './inventory.read-models';
import {
  isInbound,
  type BalanceRecord,
  type MovementRecord,
} from './inventory.repository';

/** Aceita `Prisma.Decimal` sem importar o runtime do cliente gerado. */
type DecimalValue = { toString(): string } | number | string;

interface ItemRecord {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  kind: string;
}

interface UnitRecord {
  id: string;
  legalName: string;
  tradeName: string | null;
}

@Injectable()
export class InventoryMapper {
  balance(source: BalanceRecord): InventoryBalanceReadModel {
    const onHand = Number(source.onHand);
    const reserved = Number(source.reserved);
    const minimum = Number(source.minimumStock);

    return {
      id: source.id,
      item: this.itemRef(source.catalogItem),
      businessUnit: this.unitRef(source.businessUnit),
      onHand: this.quantity(source.onHand),
      reserved: this.quantity(source.reserved),
      available: this.quantity(onHand - reserved),
      minimumStock: this.quantity(source.minimumStock),
      status: this.status(onHand, minimum),
      lastMovementAt: source.lastMovementAt?.toISOString() ?? null,
      updatedAt: source.updatedAt.toISOString(),
    };
  }

  movement(source: MovementRecord): InventoryMovementReadModel {
    return {
      id: source.id,
      type: source.type,
      direction: isInbound(source.type) ? 'IN' : 'OUT',
      quantity: this.quantity(source.quantity),
      balanceAfter: this.quantity(source.balanceAfter),
      reason: source.reason,
      notes: source.notes,
      item: this.itemRef(source.catalogItem),
      businessUnit: this.unitRef(source.businessUnit),
      operation: source.operation
        ? {
            id: source.operation.id,
            code: source.operation.code,
            title: source.operation.title,
          }
        : null,
      origin: { source: source.source, entityId: source.sourceEntityId },
      /** As duas colunas andam juntas — o `CHECK` da tabela garante. */
      transfer:
        source.transferId && source.counterpartUnitId
          ? {
              id: source.transferId,
              counterpartUnitId: source.counterpartUnitId,
            }
          : null,
      createdBy: {
        id: source.createdBy.id,
        displayName: source.createdBy.displayName,
      },
      createdAt: source.createdAt.toISOString(),
    };
  }

  itemRef(source: ItemRecord): InventoryItemRefReadModel {
    return {
      id: source.id,
      name: source.name,
      sku: source.sku,
      unit: source.unit,
      kind: source.kind,
    };
  }

  private unitRef(source: UnitRecord): { id: string; name: string } {
    return {
      id: source.id,
      name: source.tradeName ?? source.legalName,
    };
  }

  /**
   * O estado do saldo.
   *
   * Zerado é `OUT_OF_STOCK` mesmo sem mínimo configurado: não ter a peça é um
   * fato, independentemente de alguém ter dito quanto queria ter. `LOW` só
   * existe quando há mínimo — sem ele não há régua, e chamar de baixo o que
   * ninguém definiu seria opinião do sistema.
   */
  private status(onHand: number, minimum: number): InventoryStockStatus {
    if (onHand <= 0) return 'OUT_OF_STOCK';
    if (minimum > 0 && onHand <= minimum) return 'LOW';
    return 'OK';
  }

  /** Três casas, em string. Nunca `number` no contrato. */
  quantity(value: DecimalValue | null | undefined): string {
    if (value === null || value === undefined) return '0.000';
    const raw = typeof value === 'string' ? value : value.toString();
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed.toFixed(3) : '0.000';
  }
}
