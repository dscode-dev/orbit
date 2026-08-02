/**
 * Serviços do módulo CRM.
 *
 * Espelho um-para-um do `CustomerController`, incluindo o sub-recurso de
 * contatos. Nenhuma regra vive aqui: validade de documento, unicidade e
 * transição de status são decisões do backend.
 *
 * Este serviço substitui o recorte que a PR-07 criou em
 * `scheduling-references.service.ts` para alimentar o seletor de cliente da
 * agenda — aquele arquivo continua servindo o seletor de **ativos**, e o de
 * clientes passa a usar a listagem completa daqui.
 */
import { apiClient } from "@/api/client";
import { queryKeys, type QueryKey } from "@/api/query-keys";
import type { PaginatedResult, QueryParams, RequestOptions } from "@/types/api";
import type {
  CreateContactInput,
  CreateCustomerInput,
  Customer,
  CustomerContact,
  CustomerQuery,
  UpdateContactInput,
  UpdateCustomerInput,
} from "@/types/customers";

const RESOURCE = "customers";
const BASE_PATH = "/customers";

const asParams = (query: object | undefined): QueryParams | undefined =>
  query as QueryParams | undefined;

const item = (id: string): string => `${BASE_PATH}/${encodeURIComponent(id)}`;
const contact = (id: string, contactId: string): string =>
  `${item(id)}/contacts/${encodeURIComponent(contactId)}`;

export const customersService = {
  basePath: BASE_PATH,

  list: (
    query?: CustomerQuery,
    options?: RequestOptions,
  ): Promise<PaginatedResult<Customer>> =>
    apiClient.get<PaginatedResult<Customer>>(BASE_PATH, {
      ...options,
      query: asParams(query),
    }),

  /** Detalhe com contatos embutidos e contagens de ativos e operações. */
  get: (id: string, options?: RequestOptions): Promise<Customer> =>
    apiClient.get<Customer>(item(id), options),

  create: (input: CreateCustomerInput): Promise<Customer> =>
    apiClient.post<Customer>(BASE_PATH, input),

  update: (id: string, input: UpdateCustomerInput): Promise<Customer> =>
    apiClient.patch<Customer>(item(id), input),

  remove: (id: string): Promise<void> => apiClient.delete<void>(item(id)),

  contacts: (
    id: string,
    options?: RequestOptions,
  ): Promise<readonly CustomerContact[]> =>
    apiClient.get<readonly CustomerContact[]>(`${item(id)}/contacts`, options),

  createContact: (
    id: string,
    input: CreateContactInput,
  ): Promise<CustomerContact> =>
    apiClient.post<CustomerContact>(`${item(id)}/contacts`, input),

  updateContact: (
    id: string,
    contactId: string,
    input: UpdateContactInput,
  ): Promise<CustomerContact> =>
    apiClient.patch<CustomerContact>(contact(id, contactId), input),

  removeContact: (id: string, contactId: string): Promise<void> =>
    apiClient.delete<void>(contact(id, contactId)),

  keys: {
    module: (): QueryKey => queryKeys.module(RESOURCE),
    lists: (): QueryKey => queryKeys.lists(RESOURCE),
    list: (query?: CustomerQuery): QueryKey =>
      queryKeys.list(RESOURCE, asParams(query)),
    detail: (id: string): QueryKey => queryKeys.detail(RESOURCE, id),
    contacts: (id: string): QueryKey =>
      queryKeys.nested(RESOURCE, id, "contacts"),
  },
} as const;
