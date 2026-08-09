/**
 * Mapeadores do Financeiro.
 *
 * Nenhum modelo Prisma sai daqui. O que a API publica é o Read Model — e a
 * diferença mais importante entre os dois é o dinheiro: `Decimal` vira
 * **string**, nunca `number`, porque `JSON.stringify` de um float já é a
 * primeira oportunidade de perder um centavo.
 *
 * Também é aqui que se decide o que é vencido e o que é editável. As duas
 * respostas são do servidor: um navegador com a data errada não define atraso,
 * e um cliente não decide se pode alterar um lançamento vindo de recibo.
 */
import { Injectable } from '@nestjs/common';
import type {
  FinancialCategoryReadModel,
  FinancialEntryReadModel,
  FinancialSettingsReadModel,
} from './financial.read-models';
import type {
  FinancialCategoryRecord,
  FinancialEntryRecord,
} from './financial.repository';

/** Aceita `Prisma.Decimal` sem importar o runtime do cliente gerado. */
type DecimalValue = { toString(): string } | number | string;

interface SettingsRecord {
  autoRecordReceipts: boolean;
  defaultCurrency: string;
  updatedAt: Date;
}

@Injectable()
export class FinancialMapper {
  entry(source: FinancialEntryRecord): FinancialEntryReadModel {
    return {
      id: source.id,
      type: source.type,
      status: source.status,
      origin: {
        source: source.source,
        entityId: source.sourceEntityId,
      },
      amount: this.money(source.amount),
      currency: source.currency,
      description: source.description,
      notes: source.notes,
      competenceDate: this.day(source.competenceDate),
      dueDate: source.dueDate ? this.day(source.dueDate) : null,
      isOverdue: this.overdue(source.status, source.dueDate),
      category: source.category
        ? {
            id: source.category.id,
            name: source.category.name,
            slug: source.category.slug,
            color: source.category.color,
          }
        : null,
      businessUnit: {
        id: source.businessUnit.id,
        name: source.businessUnit.tradeName ?? source.businessUnit.legalName,
      },
      customer: source.customer
        ? {
            id: source.customer.id,
            displayName: source.customer.tradeName ?? source.customer.legalName,
          }
        : null,
      operation: source.operation
        ? {
            id: source.operation.id,
            code: source.operation.code,
            title: source.operation.title,
          }
        : null,
      createdBy: {
        id: source.createdBy.id,
        displayName: source.createdBy.displayName,
      },
      confirmedBy: source.confirmedBy
        ? {
            id: source.confirmedBy.id,
            displayName: source.confirmedBy.displayName,
          }
        : null,
      confirmedAt: source.confirmedAt?.toISOString() ?? null,
      cancelledBy: source.cancelledBy
        ? {
            id: source.cancelledBy.id,
            displayName: source.cancelledBy.displayName,
          }
        : null,
      cancelledAt: source.cancelledAt?.toISOString() ?? null,
      cancelReason: source.cancelReason,
      editable: source.source === 'MANUAL' && source.status !== 'CANCELLED',
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString(),
    };
  }

  category(source: FinancialCategoryRecord): FinancialCategoryReadModel {
    return {
      id: source.id,
      type: source.type,
      name: source.name,
      slug: source.slug,
      description: source.description,
      color: source.color,
      isSystem: source.isSystem,
      sortOrder: source.sortOrder,
      entryCount: source._count.entries,
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString(),
    };
  }

  settings(source: SettingsRecord): FinancialSettingsReadModel {
    return {
      autoRecordReceipts: source.autoRecordReceipts,
      defaultCurrency: source.defaultCurrency,
      updatedAt: source.updatedAt.toISOString(),
    };
  }

  /**
   * Dinheiro como string com duas casas.
   *
   * `Decimal(14,2)` já chega assim do Postgres; a normalização protege quem
   * construir o Read Model a partir de um número em teste.
   */
  money(value: DecimalValue | null | undefined): string {
    if (value === null || value === undefined) return '0.00';
    const raw = typeof value === 'string' ? value : value.toString();
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
  }

  /** `YYYY-MM-DD`. Coluna `DATE` não carrega hora, e publicá-la com fuso convidaria o cliente a deslocá-la um dia. */
  day(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private overdue(status: string, dueDate: Date | null): boolean {
    if (status !== 'PENDING' || !dueDate) return false;
    const now = new Date();
    const today = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );
    return dueDate.getTime() < today;
  }
}
