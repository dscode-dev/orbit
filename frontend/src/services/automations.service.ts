/**
 * Serviços do Automation Engine — `/automations/**`.
 *
 * Ligar e desligar é `POST /:id/toggle`, não um `PATCH` com `enabled`: o
 * backend separou os dois porque são atos diferentes — um edita a regra, o
 * outro decide se ela vale. Duplicar e excluir seguem a mesma ideia.
 *
 * `PATCH` **não aceita `trigger`**. Não há método aqui que o envie: trocar o
 * gatilho transformaria a regra em outra, com o histórico de execuções da
 * anterior pendurado nela — quem errou o gatilho duplica e ajusta.
 */
import { apiClient } from "@/api/client";
import { queryKeys, type QueryKey } from "@/api/query-keys";
import type { PaginatedResult, QueryParams, RequestOptions } from "@/types/api";
import type {
  AutomationCatalog,
  AutomationExecution,
  AutomationExecutionQuery,
  AutomationRule,
  AutomationRuleQuery,
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
} from "@/types/automations";

const AUTOMATIONS = "automations";
const PATH = "/automations";

const rule = (id: string): string => `${PATH}/${encodeURIComponent(id)}`;

const asParams = (query?: object): QueryParams | undefined =>
  query as QueryParams | undefined;

export const automationsService = {
  keys: {
    catalog: (): QueryKey => queryKeys.list(`${AUTOMATIONS}-catalog`),
    list: (query?: AutomationRuleQuery): QueryKey =>
      queryKeys.list(AUTOMATIONS, asParams(query)),
    lists: (): QueryKey => queryKeys.lists(AUTOMATIONS),
    detail: (id: string): QueryKey => queryKeys.detail(AUTOMATIONS, id),
    executions: (query?: AutomationExecutionQuery): QueryKey =>
      queryKeys.list(`${AUTOMATIONS}-executions`, asParams(query)),
    executionLists: (): QueryKey =>
      queryKeys.lists(`${AUTOMATIONS}-executions`),
    all: (): QueryKey => queryKeys.module(AUTOMATIONS),
  },

  /* ---------------------------------------------------------------- */
  /* Leitura                                                           */
  /* ---------------------------------------------------------------- */

  /** O que existe para escolher — a autoridade sobre gatilhos e ações. */
  catalog: (options?: RequestOptions): Promise<AutomationCatalog> =>
    apiClient.get<AutomationCatalog>(`${PATH}/catalog`, options),

  list: (
    query?: AutomationRuleQuery,
    options?: RequestOptions,
  ): Promise<PaginatedResult<AutomationRule>> =>
    apiClient.get<PaginatedResult<AutomationRule>>(PATH, {
      ...options,
      query: asParams(query),
    }),

  get: (id: string, options?: RequestOptions): Promise<AutomationRule> =>
    apiClient.get<AutomationRule>(rule(id), options),

  executions: (
    query?: AutomationExecutionQuery,
    options?: RequestOptions,
  ): Promise<PaginatedResult<AutomationExecution>> =>
    apiClient.get<PaginatedResult<AutomationExecution>>(`${PATH}/executions`, {
      ...options,
      query: asParams(query),
    }),

  /* ---------------------------------------------------------------- */
  /* Escrita                                                           */
  /* ---------------------------------------------------------------- */

  create: (input: CreateAutomationRuleInput): Promise<AutomationRule> =>
    apiClient.post<AutomationRule>(PATH, input),

  update: (
    id: string,
    input: UpdateAutomationRuleInput,
  ): Promise<AutomationRule> => apiClient.patch<AutomationRule>(rule(id), input),

  toggle: (id: string, enabled: boolean): Promise<AutomationRule> =>
    apiClient.post<AutomationRule>(`${rule(id)}/toggle`, { enabled }),

  duplicate: (id: string): Promise<AutomationRule> =>
    apiClient.post<AutomationRule>(`${rule(id)}/duplicate`, {}),

  /** Recusado com 409 enquanto houver ação agendada e não executada. */
  remove: (id: string): Promise<void> => apiClient.delete<void>(rule(id)),
};
