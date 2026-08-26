/**
 * Regras do Automation Engine.
 *
 * ## O que valida uma regra
 *
 * Gatilho no catálogo; campo de condição entre os que aquele gatilho oferece;
 * operador com o formato de valor certo; ação existente com a configuração que
 * ela exige. **Uma regra inválida é recusada na criação** — descobrir o erro
 * meses depois, quando o lembrete não apareceu, é o pior momento possível.
 *
 * ## O que este domínio não faz
 *
 * Não interpreta expressão, não executa script, não chama URL, não ramifica e
 * não repete. Uma regra é um formulário preenchido, e o motor só sabe executar
 * o que este código já sabia executar antes de ela existir.
 */
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ConflictException,
  EntityNotFoundException,
  ValidationException,
} from '../../exceptions';
import {
  ACTIONS,
  ALLOWED_JOB_QUEUES,
  CONDITION_OPERATORS,
  DELAY_UNITS,
  NOTIFICATION_TARGETS,
  TRIGGERS,
  findAction,
  findTrigger,
  type RuleAction,
} from './automation.catalog';
import type {
  AutomationActionDto,
  AutomationConditionDto,
  AutomationExecutionQueryDto,
  AutomationRuleQueryDto,
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto,
} from './automation.dto';
import type { AutomationCatalogReadModel } from './automation.read-models';
import { AutomationRepository } from './automation.repository';

export interface AutomationActor {
  id: string;
  businessUnitIds: readonly string[];
}

/**
 * Lê uma chave de configuração como texto.
 *
 * `config` é `Record<string, unknown>` por desenho — cada ação valida o que
 * aceita. Converter com `String()` direto transformaria um objeto em
 * `"[object Object]"` e a validação passaria; aqui, valor não escalar vira
 * string vazia e cai na recusa por campo obrigatório.
 */
function text(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : '';
}

@Injectable()
export class AutomationService {
  constructor(private readonly repository: AutomationRepository) {}

  /* ---------------------------------------------------------------- */
  /* Catálogo                                                          */
  /* ---------------------------------------------------------------- */

  /**
   * O que existe para escolher.
   *
   * Publicado para que a interface monte o formulário a partir do servidor —
   * uma lista de gatilhos escrita no cliente divergiria no primeiro evento
   * novo, e ofereceria automações que o motor não sabe disparar.
   */
  catalog(): AutomationCatalogReadModel {
    return {
      triggers: TRIGGERS.map((trigger) => ({
        type: trigger.type,
        label: trigger.label,
        description: trigger.description,
        entityType: trigger.entityType,
        fields: trigger.fields,
      })),
      actions: ACTIONS.map((action) => ({
        type: action.type,
        label: action.label,
        description: action.description,
        config: action.config,
        available: action.available,
        ...(action.unavailableReason
          ? { unavailableReason: action.unavailableReason }
          : {}),
      })),
      operators: CONDITION_OPERATORS,
      delayUnits: DELAY_UNITS,
    };
  }

  /* ---------------------------------------------------------------- */
  /* Leitura                                                           */
  /* ---------------------------------------------------------------- */

  list(organizationId: string, query: AutomationRuleQueryDto) {
    return this.repository.list(organizationId, query);
  }

  async get(id: string, organizationId: string) {
    const rule = await this.repository.find(id, organizationId);
    if (!rule) throw new EntityNotFoundException('AutomationRule', id);
    return rule;
  }

  executions(organizationId: string, query: AutomationExecutionQueryDto) {
    return this.repository.listExecutions(organizationId, query);
  }

  /* ---------------------------------------------------------------- */
  /* Escrita                                                           */
  /* ---------------------------------------------------------------- */

  async create(
    organizationId: string,
    actorInput: AutomationActor | string,
    input: CreateAutomationRuleDto,
  ) {
    const actor = this.actorOf(actorInput);
    const trigger = findTrigger(input.trigger);
    if (!trigger) {
      throw new ValidationException(`Unknown trigger: ${input.trigger}`);
    }
    const scopeBusinessUnitIds = await this.resolveScope(
      organizationId,
      actor,
      input.businessUnitId ?? null,
    );

    this.validateConditions(input.conditions ?? [], trigger.fields);
    const actions = await this.validateActions(organizationId, input.actions);

    return this.repository.create(
      {
        organizationId,
        businessUnitId: input.businessUnitId ?? null,
        scopeBusinessUnitIds,
        name: input.name,
        description: input.description ?? null,
        trigger: input.trigger,
        conditions: (input.conditions ??
          []) as unknown as Prisma.InputJsonValue,
        actions: actions as unknown as Prisma.InputJsonValue,
        createdById: actor.id,
      },
      actor.id,
    );
  }

  async update(
    id: string,
    organizationId: string,
    actorInput: AutomationActor | string,
    input: UpdateAutomationRuleDto,
  ) {
    const actor = this.actorOf(actorInput);
    const rule = await this.get(id, organizationId);
    this.assertSnapshotInScope(rule.scopeBusinessUnitIds, actor);
    const trigger = findTrigger(rule.trigger);
    const changingScope = Object.prototype.hasOwnProperty.call(
      input,
      'businessUnitId',
    );
    const requestedUnit = changingScope
      ? (input.businessUnitId ?? null)
      : (rule.businessUnit?.id ?? null);
    const scopeBusinessUnitIds = changingScope
      ? await this.resolveScope(organizationId, actor, requestedUnit)
      : undefined;

    if (input.conditions) {
      this.validateConditions(input.conditions, trigger?.fields ?? []);
    }
    const actions = input.actions
      ? await this.validateActions(organizationId, input.actions, rule.actions)
      : undefined;

    return this.repository.update(
      id,
      organizationId,
      actor.id,
      {
        name: input.name,
        description: input.description,
        ...(changingScope
          ? {
              businessUnit: requestedUnit
                ? { connect: { id: requestedUnit } }
                : { disconnect: true },
              scopeBusinessUnitIds: { set: scopeBusinessUnitIds },
            }
          : {}),
        ...(input.conditions
          ? { conditions: input.conditions as unknown as Prisma.InputJsonValue }
          : {}),
        ...(actions
          ? { actions: actions as unknown as Prisma.InputJsonValue }
          : {}),
      },
      'AUTOMATION_RULE_UPDATED',
      { name: rule.name },
    );
  }

  /**
   * Ligar e desligar.
   *
   * Desligar **não cancela** o que já está agendado: as ações pendentes
   * verificam `enabled` na hora de executar e são descartadas com o motivo.
   * Cancelar jobs futuros exigiria varrer a fila, e a verificação no momento
   * certo dá o mesmo resultado com uma consulta a menos.
   */
  async toggle(
    id: string,
    organizationId: string,
    actorInput: AutomationActor | string,
    enabled: boolean,
  ) {
    const actor = this.actorOf(actorInput);
    const rule = await this.get(id, organizationId);
    if (enabled) this.assertSnapshotInScope(rule.scopeBusinessUnitIds, actor);
    return this.repository.update(
      id,
      organizationId,
      actor.id,
      { enabled },
      enabled ? 'AUTOMATION_RULE_ENABLED' : 'AUTOMATION_RULE_DISABLED',
      { enabled: rule.enabled },
    );
  }

  /** Duplicar: a cópia nasce **desligada**, com nome marcado. */
  async duplicate(
    id: string,
    organizationId: string,
    actorInput: AutomationActor | string,
  ) {
    const actor = this.actorOf(actorInput);
    const rule = await this.get(id, organizationId);
    this.assertSnapshotInScope(rule.scopeBusinessUnitIds, actor);
    return this.repository.create(
      {
        organizationId,
        businessUnitId: rule.businessUnit?.id ?? null,
        scopeBusinessUnitIds: rule.scopeBusinessUnitIds,
        name: `${rule.name} (cópia)`.slice(0, 180),
        description: rule.description,
        enabled: false,
        trigger: rule.trigger,
        conditions: rule.conditions as Prisma.InputJsonValue,
        actions: rule.actions as Prisma.InputJsonValue,
        createdById: actor.id,
      },
      actor.id,
    );
  }

  /**
   * Exclusão.
   *
   * Recusa enquanto houver ação **agendada e não executada** — é exatamente o
   * lembrete de seis meses. Apagar a regra deixaria um job órfão que, ao
   * acordar, não encontraria a regra e seria descartado em silêncio: o usuário
   * teria excluído uma automação achando que a cancelou, e ela ainda estaria
   * pendente por meses.
   *
   * Quem quer parar agora **desliga**; quem quer sumir com a regra espera as
   * pendências ou desliga e exclui depois.
   */
  async remove(
    id: string,
    organizationId: string,
    actorId: string,
  ): Promise<void> {
    await this.get(id, organizationId);
    const pending = await this.repository.pendingExecutions(id);
    if (pending > 0) {
      throw new ConflictException(
        `This rule has ${pending} scheduled action(s) not executed yet. Disable it instead, or wait for them to run.`,
      );
    }
    await this.repository.softDelete(id, organizationId, actorId);
  }

  /* ---------------------------------------------------------------- */
  /* Validação                                                         */
  /* ---------------------------------------------------------------- */

  /**
   * A condição precisa falar do que o evento carrega.
   *
   * Um campo fora da lista do gatilho nunca seria satisfeito — e uma regra que
   * nunca dispara é pior que uma regra recusada: ela parece configurada.
   */
  private async resolveScope(
    organizationId: string,
    actor: AutomationActor,
    businessUnitId: string | null,
  ): Promise<string[]> {
    if (businessUnitId) {
      if (
        actor.businessUnitIds.length > 0 &&
        !actor.businessUnitIds.includes(businessUnitId)
      )
        throw new EntityNotFoundException('BusinessUnit', businessUnitId);
      const unit = await this.repository.findBusinessUnit(
        businessUnitId,
        organizationId,
      );
      if (!unit)
        throw new EntityNotFoundException('BusinessUnit', businessUnitId);
      return [businessUnitId];
    }
    if ('legacy' in actor) return [];
    return actor.businessUnitIds.length > 0
      ? [...new Set(actor.businessUnitIds)]
      : this.repository.activeBusinessUnitIds(organizationId);
  }

  /** Compatibilidade somente para testes/unit callers anteriores ao controller. */
  private actorOf(actor: AutomationActor | string): AutomationActor & {
    legacy?: true;
  } {
    return typeof actor === 'string'
      ? { id: actor, businessUnitIds: [], legacy: true }
      : actor;
  }

  private assertSnapshotInScope(
    snapshot: readonly string[] | undefined,
    actor: AutomationActor,
  ): void {
    if (
      actor.businessUnitIds.length > 0 &&
      (snapshot ?? []).some((id) => !actor.businessUnitIds.includes(id))
    )
      throw new EntityNotFoundException('AutomationRule', 'scope');
  }

  private validateConditions(
    conditions: readonly AutomationConditionDto[],
    fields: readonly string[],
  ): void {
    for (const condition of conditions) {
      if (!fields.includes(condition.field)) {
        throw new ValidationException(
          `Field "${condition.field}" is not available on this trigger. Available: ${fields.join(', ')}`,
        );
      }

      if (condition.operator === 'in') {
        if (!Array.isArray(condition.value) || condition.value.length === 0) {
          throw new ValidationException(
            `Operator "in" needs a non-empty list of values on "${condition.field}"`,
          );
        }
        continue;
      }

      if (condition.operator === 'exists') continue;

      if (typeof condition.value !== 'string' || condition.value.length === 0) {
        throw new ValidationException(
          `Operator "${condition.operator}" needs a text value on "${condition.field}"`,
        );
      }
    }
  }

  /**
   * A ação precisa ser executável e estar configurada.
   *
   * Também atribui o `id` estável de cada ação — parte da chave de
   * idempotência. Reaproveita o id anterior quando a ação já existia, para que
   * editar a regra não faça uma ação já executada parecer nova.
   */
  private async validateActions(
    organizationId: string,
    actions: readonly AutomationActionDto[],
    previous?: unknown,
  ): Promise<RuleAction[]> {
    const existing = Array.isArray(previous) ? (previous as RuleAction[]) : [];

    const resolved: RuleAction[] = [];

    for (const [index, action] of actions.entries()) {
      const definition = findAction(action.type);
      if (!definition) {
        throw new ValidationException(`Unknown action: ${action.type}`);
      }

      const config = action.config ?? {};
      for (const field of definition.config) {
        if (field.required && !config[field.key]) {
          throw new ValidationException(
            `Action ${action.type} requires "${field.key}"`,
          );
        }
      }

      /**
       * Chave desconhecida é recusada.
       *
       * `config` é objeto livre na forma — `@IsObject()` não sabe o que cada
       * ação aceita —, então a checagem que o `forbidNonWhitelisted` faz nos
       * outros DTOs precisa acontecer aqui. Sem ela, um campo digitado errado
       * (`titulo` em vez de `title`) seria gravado em silêncio e a ação
       * executaria com o padrão, que é o pior dos dois desfechos: parece
       * configurado e faz outra coisa.
       */
      const accepted = new Set(definition.config.map((field) => field.key));
      for (const key of Object.keys(config)) {
        if (!accepted.has(key)) {
          throw new ValidationException(
            `Action ${action.type} does not accept "${key}". Accepted: ${[...accepted].join(', ') || '(nenhum)'}`,
          );
        }
      }

      if (action.type === 'SEND_NOTIFICATION') {
        const target = text(config, 'target');
        if (!NOTIFICATION_TARGETS.includes(target as never)) {
          throw new ValidationException(
            `Notification target must be one of: ${NOTIFICATION_TARGETS.join(', ')}`,
          );
        }
        if (target === 'USER') {
          const userId = text(config, 'userId');
          if (!userId) {
            throw new ValidationException(
              'Notification target USER requires "userId"',
            );
          }
          const member = await this.repository.findUser(userId, organizationId);
          if (!member) {
            throw new ValidationException(
              'The notification recipient is not an active member of this organization',
            );
          }
        }
      }

      if (action.type === 'TRIGGER_JOB') {
        const queue = text(config, 'queue');
        if (!ALLOWED_JOB_QUEUES.includes(queue)) {
          throw new ValidationException(
            `Job queue not allowed for automations. Allowed: ${ALLOWED_JOB_QUEUES.join(', ')}`,
          );
        }
      }

      resolved.push({
        id: existing[index]?.id ?? `a${index + 1}`,
        type: action.type,
        ...(action.delay ? { delay: action.delay } : {}),
        config,
      });
    }

    return resolved;
  }
}
