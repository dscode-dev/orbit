/**
 * Contratos do módulo CRM (clientes e contatos).
 *
 * Os **literais** (`CustomerType`, `CustomerStatus`) vêm dos contratos
 * sincronizados. A forma do cliente é **espelhada**: o módulo não publica Read
 * Model — o controller devolve o registro do Prisma com `contacts` e `_count`.
 *
 * Duas coisas que essa leitura já entrega e que valem notar:
 *
 * - **`contacts` vem embutido**, ordenado por `isPrimary desc, name asc` — não
 *   é preciso uma segunda consulta para exibi-los;
 * - **`_count` traz `assets` e `operations` contados no banco**. São
 *   indicadores observados, publicados pelo backend; a tela não os soma.
 *
 * O que o contrato **não** tem: unidade de negócio (o cliente é da
 * organização, não da unidade), cidade como coluna (fica em `address`, que é
 * JSON livre) e responsável pela conta.
 */
import type { CustomerStatus, CustomerType } from "./contracts";

export type { CustomerStatus, CustomerType };

export interface CustomerContact {
  id: string;
  organizationId: string;
  businessUnitId: string | null;
  customerId: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Contagens que o backend calcula no `include` da consulta.
 *
 * `assets` e `operations` excluem registros removidos — o recorte é do
 * repositório, não da tela.
 */
export interface CustomerCounts {
  assets: number;
  operations: number;
}

export interface Customer {
  id: string;
  organizationId: string;
  type: CustomerType;
  legalName: string;
  tradeName: string | null;
  documentType: string | null;
  documentNumber: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  /** JSON livre — o backend não define esquema de endereço. */
  address: Record<string, unknown> | null;
  status: CustomerStatus;
  createdAt: string;
  updatedAt: string;
  contacts: readonly CustomerContact[];
  _count: CustomerCounts;
}

/**
 * `GET /customers` (`CustomerQueryDto`).
 *
 * Aceita **apenas** estes campos. Não há filtro por unidade, cidade ou
 * responsável — verificado: `?city=Recife` devolve
 * `['property city should not exist']`.
 */
export interface CustomerQuery {
  search?: string;
  type?: CustomerType;
  status?: CustomerStatus;
  page?: number;
  limit?: number;
}

/** `POST /customers` (`CreateCustomerDto`). */
export interface CreateCustomerInput {
  type: CustomerType;
  legalName: string;
  tradeName?: string;
  documentType?: "CPF" | "CNPJ";
  documentNumber?: string;
  email?: string;
  phone?: string;
  notes?: string;
  address?: Record<string, unknown>;
}

/** `PATCH /customers/:id` (`UpdateCustomerDto`) — acrescenta `status`. */
export interface UpdateCustomerInput extends Partial<CreateCustomerInput> {
  status?: CustomerStatus;
}

/** `POST /customers/:id/contacts` (`CreateContactDto`). */
export interface CreateContactInput {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
  notes?: string;
  businessUnitId?: string;
}

export type UpdateContactInput = Partial<CreateContactInput>;

/** Limites declarados pelo `class-validator`. */
export const CUSTOMER_LIMITS = {
  legalNameMinLength: 2,
  legalNameMaxLength: 255,
  tradeNameMaxLength: 255,
  contactNameMaxLength: 180,
  contactRoleMaxLength: 120,
  phoneMaxLength: 32,
  notesMaxLength: 5000,
  searchMaxLength: 180,
} as const;

/**
 * Chaves reconhecidas em `address`.
 *
 * `address` é `Json?` sem esquema no backend. A leitura aceita as grafias
 * usuais e mostra o restante como está — não há campo obrigatório a exigir
 * nem formato a impor.
 */
export const ADDRESS_KEYS = [
  "street",
  "number",
  "complement",
  "district",
  "city",
  "state",
  "stateCode",
  "postalCode",
  "country",
] as const;
