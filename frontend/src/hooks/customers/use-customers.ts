"use client";

/**
 * Query Layer do Customer Workspace.
 *
 * Reúne o módulo próprio e as **quatro consultas cruzadas** que dão ao cliente
 * a visão de 360°. `customerId` é filtro real nos cinco contratos —
 * `AssetQueryDto`, `OperationQueryDto`, `EventQueryDto`,
 * `ArtifactExecutionQueryDto` e `AiExecutionQueryDto` —, então nada é
 * recortado no cliente e todos os serviços já existiam.
 *
 * ## Sem atualização otimista
 *
 * `POST`/`PATCH /customers` podem ser recusados por validação de documento
 * (`IsDocument`) e por regra do servidor. As escritas **semeiam o cache com a
 * resposta**, que é o estado confirmado.
 *
 * Contato é sub-recurso: criar, editar ou remover um contato muda o cliente
 * (que devolve `contacts` embutido), então essas escritas invalidam o detalhe.
 */
import { useQueryClient } from "@tanstack/react-query";

import { useApiMutation } from "@/hooks/api/use-api-mutation";
import { useApiQuery } from "@/hooks/api/use-api-query";
import { artifactExecutionsService } from "@/services/artifact-executions.service";
import { assetsService } from "@/services/assets.service";
import { customersService } from "@/services/customers.service";
import { operationsService } from "@/services/operations.service";
import { operationIntelligenceService } from "@/services/operations.service";
import { schedulingService } from "@/services/scheduling.service";
import type {
  CreateContactInput,
  CreateCustomerInput,
  Customer,
  CustomerQuery,
  UpdateContactInput,
  UpdateCustomerInput,
} from "@/types/customers";

const MINUTE = 60_000;

/**
 * Cadência por leitura.
 *
 * Cadastro muda por ato deliberado; as listas cruzadas acompanham a cadência
 * do módulo dono. Nenhuma se atualiza sozinha.
 */
export const CUSTOMERS_REFRESH = {
  list: { staleTime: MINUTE },
  detail: { staleTime: 30_000 },
  related: { staleTime: 30_000 },
} as const;

/** Horizonte da agenda futura do cliente, em dias. */
const SCHEDULE_HORIZON_DAYS = 90;
/** Quantos registros relacionados cada painel mostra. */
export const RELATED_PAGE_SIZE = 5;

export function useCustomersList(query: CustomerQuery) {
  return useApiQuery(
    customersService.keys.list(query),
    ({ signal }) => customersService.list(query, { signal }),
    {
      ...CUSTOMERS_REFRESH.list,
      /** Mantém a página anterior visível durante a troca de página. */
      placeholderData: (previous) => previous,
    },
  );
}

export function useCustomer(id: string) {
  return useApiQuery(
    customersService.keys.detail(id),
    ({ signal }) => customersService.get(id, { signal }),
    CUSTOMERS_REFRESH.detail,
  );
}

export function useCustomerAssets(customerId: string) {
  const query = { customerId, limit: RELATED_PAGE_SIZE, page: 1 } as const;
  return useApiQuery(
    assetsService.keys.list(query),
    ({ signal }) => assetsService.list(query, { signal }),
    CUSTOMERS_REFRESH.related,
  );
}

export function useCustomerOperations(customerId: string) {
  const query = { customerId, limit: RELATED_PAGE_SIZE, page: 1 } as const;
  return useApiQuery(
    operationsService.keys.list(query),
    ({ signal }) => operationsService.list(query, { signal }),
    CUSTOMERS_REFRESH.related,
  );
}

/**
 * Agenda futura do cliente.
 *
 * Janela de 90 dias — recorte de apresentação. As ocorrências vêm expandidas
 * pelo motor de recorrência do backend; nada de conflito, disponibilidade ou
 * recorrência é calculado aqui.
 */
export function useCustomerSchedule(customerId: string) {
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + SCHEDULE_HORIZON_DAYS);

  const query = {
    customerId,
    from: from.toISOString(),
    to: to.toISOString(),
  };

  return useApiQuery(
    schedulingService.keys.occurrences(query),
    ({ signal }) => schedulingService.occurrences(query, { signal }),
    CUSTOMERS_REFRESH.related,
  );
}

export function useCustomerExecutions(customerId: string) {
  const query = { customerId, limit: RELATED_PAGE_SIZE, page: 1 } as const;
  return useApiQuery(
    artifactExecutionsService.keys.list(query),
    ({ signal }) => artifactExecutionsService.list(query, { signal }),
    CUSTOMERS_REFRESH.related,
  );
}

/**
 * Orbit Intelligence do cliente.
 *
 * `AiExecutionQueryDto` aceita `customerId` — este é o **primeiro Workspace de
 * entidade com fonte de IA de verdade**. O serviço é o mesmo que a operação
 * usa; só muda o filtro.
 */
export function useCustomerIntelligence(customerId: string, enabled = true) {
  const query = { customerId, limit: 10, page: 1 };
  return useApiQuery(
    operationIntelligenceService.keys.byCustomer(customerId),
    ({ signal }) => operationIntelligenceService.list(query, { signal }),
    { ...CUSTOMERS_REFRESH.related, enabled },
  );
}

function useCustomerWriteOptions(id?: string) {
  const queryClient = useQueryClient();

  return {
    onSuccess: async (customer: Customer) => {
      const key = customersService.keys.detail(id ?? customer.id);
      await queryClient.cancelQueries({ queryKey: key });
      /** Estado confirmado pelo servidor — não antecipação. */
      queryClient.setQueryData(key, customer);
      await queryClient.invalidateQueries({
        queryKey: customersService.keys.lists(),
      });
    },
  } as const;
}

export function useCreateCustomer() {
  const options = useCustomerWriteOptions();
  return useApiMutation(
    (input: CreateCustomerInput) => customersService.create(input),
    options,
  );
}

export function useUpdateCustomer(id: string) {
  const options = useCustomerWriteOptions(id);
  return useApiMutation(
    (input: UpdateCustomerInput) => customersService.update(id, input),
    { ...options, scope: { id: `customers:${id}` } },
  );
}

/** Escritas de contato refletem no cliente, que devolve `contacts` embutido. */
function useContactInvalidation(customerId: string) {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({
      queryKey: customersService.keys.detail(customerId),
    });
    await queryClient.invalidateQueries({
      queryKey: customersService.keys.contacts(customerId),
    });
  };
}

export function useCreateContact(customerId: string) {
  const invalidate = useContactInvalidation(customerId);
  return useApiMutation(
    (input: CreateContactInput) =>
      customersService.createContact(customerId, input),
    { onSuccess: invalidate },
  );
}

export function useUpdateContact(customerId: string) {
  const invalidate = useContactInvalidation(customerId);
  return useApiMutation(
    (variables: { contactId: string; input: UpdateContactInput }) =>
      customersService.updateContact(
        customerId,
        variables.contactId,
        variables.input,
      ),
    { onSuccess: invalidate },
  );
}

export function useRemoveContact(customerId: string) {
  const invalidate = useContactInvalidation(customerId);
  return useApiMutation(
    (contactId: string) =>
      customersService.removeContact(customerId, contactId),
    { onSuccess: invalidate },
  );
}
