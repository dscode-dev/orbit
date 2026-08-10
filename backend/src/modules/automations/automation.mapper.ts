/**
 * Mapeadores do Automation Engine.
 *
 * Nenhum modelo Prisma sai daqui. As colunas `Json` de condições e ações são
 * traduzidas para forma explícita — e cada ação carrega `available`, resolvido
 * pelo catálogo, para que a interface saiba quando a regra tem uma etapa que o
 * motor não executa.
 */
import { Injectable } from '@nestjs/common';
import {
  findAction,
  findTrigger,
  type RuleAction,
  type RuleCondition,
} from './automation.catalog';
import type {
  AutomationActionReadModel,
  AutomationExecutionReadModel,
  AutomationRuleReadModel,
} from './automation.read-models';
import type { ExecutionRecord, RuleRecord } from './automation.repository';

@Injectable()
export class AutomationMapper {
  rule(source: RuleRecord): AutomationRuleReadModel {
    const conditions = (source.conditions ?? []) as unknown as RuleCondition[];
    const actions = (source.actions ?? []) as unknown as RuleAction[];

    return {
      id: source.id,
      name: source.name,
      description: source.description,
      enabled: source.enabled,
      trigger: source.trigger,
      /** `null` quando a regra aponta para um gatilho que saiu do catálogo. */
      triggerLabel: findTrigger(source.trigger)?.label ?? null,
      conditions: conditions.map((condition) => ({
        field: condition.field,
        operator: condition.operator,
        ...(condition.value === undefined ? {} : { value: condition.value }),
      })),
      actions: actions.map((action) => this.action(action)),
      businessUnit: source.businessUnit
        ? {
            id: source.businessUnit.id,
            name:
              source.businessUnit.tradeName ?? source.businessUnit.legalName,
          }
        : null,
      createdBy: {
        id: source.createdBy.id,
        displayName: source.createdBy.displayName,
      },
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString(),
    };
  }

  private action(source: RuleAction): AutomationActionReadModel {
    return {
      id: source.id,
      type: source.type,
      delay: source.delay
        ? { amount: source.delay.amount, unit: source.delay.unit }
        : null,
      config: source.config ?? {},
      available: findAction(source.type)?.available ?? false,
    };
  }

  execution(source: ExecutionRecord): AutomationExecutionReadModel {
    return {
      id: source.id,
      /**
       * A coluna é `VARCHAR`, mas o conjunto é garantido pelo banco:
       * `automation_executions_status_valid` recusa qualquer outro valor. A
       * asserção repete o que o `CHECK` já impõe, em vez de aceitar `string` no
       * contrato publicado.
       */
      status: source.status as AutomationExecutionReadModel['status'],
      actionId: source.actionId,
      actionType: source.actionType,
      attempts: source.attempts,
      scheduledFor: source.scheduledFor?.toISOString() ?? null,
      executedAt: source.executedAt?.toISOString() ?? null,
      /** As duas colunas andam juntas: um resultado sem tipo não é navegável. */
      result:
        source.resultType && source.resultId
          ? { type: source.resultType, id: source.resultId }
          : null,
      detail: source.detail,
      correlationId: source.correlationId,
      event: {
        id: source.event.id,
        type: source.event.type,
        occurredAt: source.event.occurredAt.toISOString(),
      },
      rule: { id: source.rule.id, name: source.rule.name },
      createdAt: source.createdAt.toISOString(),
    };
  }
}
