import { Injectable } from '@nestjs/common';
import type {
  CustomerContactReadModel,
  CustomerCountsReadModel,
  CustomerListReadModel,
  CustomerReadModel,
} from './customer.read-models';

type DateValue = Date | string;

/**
 * Fonte: o registro do Prisma com o `include` do repositório.
 *
 * `deletedAt` **existe** aqui e é deliberadamente ignorado pelo mapper — é o
 * ponto da correção. Declará-lo na origem deixa explícito que o campo foi
 * visto e descartado, em vez de parecer esquecimento.
 */
interface CustomerSource {
  id: string;
  organizationId: string;
  type: string;
  legalName: string;
  tradeName: string | null;
  documentType: string | null;
  documentNumber: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  address: unknown;
  status: string;
  createdAt: DateValue;
  updatedAt: DateValue;
  deletedAt?: DateValue | null;
  contacts?: readonly ContactSource[];
  _count?: { assets: number; operations: number };
}

interface ContactSource {
  id: string;
  organizationId: string;
  businessUnitId: string | null;
  customerId: string | null;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  createdAt: DateValue;
  updatedAt: DateValue;
  deletedAt?: DateValue | null;
}

/**
 * Traduz o registro do Prisma para o contrato público do CRM.
 *
 * A exclusão lógica continua exatamente como estava no repositório; o mapper
 * apenas impede que `deletedAt` e `_count` — nomes de persistência — cruzem a
 * fronteira da API.
 */
@Injectable()
export class CustomerReadModelMapper {
  list(source: {
    data: readonly CustomerSource[];
    meta: CustomerListReadModel['meta'];
  }): CustomerListReadModel {
    return {
      data: source.data.map((customer) => this.details(customer)),
      meta: { ...source.meta },
    };
  }

  details(source: CustomerSource): CustomerReadModel {
    return {
      id: source.id,
      organizationId: source.organizationId,
      type: source.type,
      legalName: source.legalName,
      tradeName: source.tradeName,
      documentType: source.documentType,
      documentNumber: source.documentNumber,
      email: source.email,
      phone: source.phone,
      notes: source.notes,
      address: source.address ?? null,
      status: source.status,
      createdAt: this.date(source.createdAt),
      updatedAt: this.date(source.updatedAt),
      contacts: (source.contacts ?? []).map((contact) =>
        this.contact(contact),
      ),
      counts: this.counts(source._count),
    };
  }

  contact(source: ContactSource): CustomerContactReadModel {
    return {
      id: source.id,
      organizationId: source.organizationId,
      businessUnitId: source.businessUnitId,
      customerId: source.customerId,
      name: source.name,
      role: source.role,
      email: source.email,
      phone: source.phone,
      isPrimary: source.isPrimary,
      createdAt: this.date(source.createdAt),
      updatedAt: this.date(source.updatedAt),
    };
  }

  contacts(
    source: readonly ContactSource[],
  ): readonly CustomerContactReadModel[] {
    return source.map((contact) => this.contact(contact));
  }

  private counts(
    source: { assets: number; operations: number } | undefined,
  ): CustomerCountsReadModel {
    return {
      assets: source?.assets ?? 0,
      operations: source?.operations ?? 0,
    };
  }

  private date(value: DateValue): string {
    return value instanceof Date ? value.toISOString() : value;
  }
}
