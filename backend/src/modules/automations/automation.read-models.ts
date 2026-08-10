/**
 * Read Models do Automation Engine.
 *
 * Uma regra publicada é **descrição de intenção**, não código: gatilho,
 * condições e ações aparecem como dados estruturados, e nenhuma delas carrega
 * expressão a ser avaliada por um cliente.
 *
 * Os conjuntos fechados vêm de `contracts/literals`, não do catálogo do módulo:
 * este arquivo é sincronizado com os clientes e precisa ser TypeScript puro,
 * sem alcançar código de servidor.
 */

import type {
  AutomationActionType,
  AutomationConditionOperator,
  AutomationDelayUnit,
  AutomationExecutionStatus,
} from '../../contracts';

export interface AutomationConditionReadModel {
  field: string;
  operator: AutomationConditionOperator;
  value?: string | readonly string[];
}

export interface AutomationActionReadModel {
  id: string;
  type: AutomationActionType;
  delay: { amount: number; unit: AutomationDelayUnit } | null;
  config: Record<string, unknown>;
  /** `false` quando o motor ainda não executa este tipo — ver o catálogo. */
  available: boolean;
}

export interface AutomationRuleReadModel {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  trigger: string;
  /** Rótulo do gatilho; `null` quando a regra aponta para um tipo desconhecido. */
  triggerLabel: string | null;
  conditions: AutomationConditionReadModel[];
  actions: AutomationActionReadModel[];
  businessUnit: { id: string; name: string } | null;
  createdBy: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
}

/**
 * Uma ação executada — ou descartada, ou falhada.
 *
 * É a prova de que a automação fez o que disse: `resultType`/`resultId`
 * apontam para o lembrete, a notificação ou o trabalho criado.
 */
export interface AutomationExecutionReadModel {
  id: string;
  status: AutomationExecutionStatus;
  actionId: string;
  actionType: string;
  attempts: number;
  scheduledFor: string | null;
  executedAt: string | null;
  result: { type: string; id: string } | null;
  detail: string | null;
  correlationId: string;
  event: { id: string; type: string; occurredAt: string };
  rule: { id: string; name: string };
  createdAt: string;
}

/** Catálogo publicado: o que a interface pode oferecer. */
export interface AutomationCatalogReadModel {
  triggers: {
    type: string;
    label: string;
    description: string;
    entityType: string;
    fields: readonly string[];
  }[];
  actions: {
    type: string;
    label: string;
    description: string;
    config: readonly { key: string; required: boolean; description: string }[];
    available: boolean;
    unavailableReason?: string;
  }[];
  operators: readonly string[];
  delayUnits: readonly string[];
}
