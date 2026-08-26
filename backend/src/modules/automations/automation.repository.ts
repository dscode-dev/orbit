/**
 * Persistência do Automation Engine.
 *
 * ## A idempotência mora no `claim`
 *
 * Uma ação por ocorrência é garantida pela unicidade
 * `(evento, regra, ação)` e por um `INSERT … ON CONFLICT DO UPDATE` com
 * predicado: quem tenta executar uma ação já **bem-sucedida** não recebe linha
 * e desiste. Falha continua retomável — a linha existe, mas não está fechada.
 *
 * Uma checagem prévia seguida de escrita não resolveria: entre as duas cabe
 * outra tentativa, e é exatamente aí que um lembrete de seis meses vira dois.
 *
 * ## O prazo é calculado pelo Postgres
 *
 * `make_interval` respeita calendário: 31 de janeiro mais um mês é 28 de
 * fevereiro. `setMonth` do JavaScript daria 3 de março — e um lembrete de PMOC
 * que escorrega para o mês seguinte deixa de ser lembrete.
 */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationHelper, RlsTransaction } from '../../database';
import type { PrismaTransactionClient } from '../../database/prisma.types';
import { generateUuidV7 } from '../../utils';
import type {
  AutomationExecutionQueryDto,
  AutomationRuleQueryDto,
} from './automation.dto';
import type { DelayUnit } from './automation.catalog';

const ruleView = {
  id: true,
  name: true,
  description: true,
  enabled: true,
  trigger: true,
  conditions: true,
  actions: true,
  scopeBusinessUnitIds: true,
  createdAt: true,
  updatedAt: true,
  businessUnit: { select: { id: true, legalName: true, tradeName: true } },
  createdBy: { select: { id: true, displayName: true } },
} satisfies Prisma.AutomationRuleSelect;

const executionView = {
  id: true,
  status: true,
  actionId: true,
  actionType: true,
  attempts: true,
  scheduledFor: true,
  executedAt: true,
  resultType: true,
  resultId: true,
  detail: true,
  correlationId: true,
  createdAt: true,
  event: { select: { id: true, type: true, occurredAt: true } },
  rule: { select: { id: true, name: true } },
} satisfies Prisma.AutomationExecutionSelect;

export type RuleRecord = Prisma.AutomationRuleGetPayload<{
  select: typeof ruleView;
}>;
export type ExecutionRecord = Prisma.AutomationExecutionGetPayload<{
  select: typeof executionView;
}>;

export interface ClaimedExecution {
  id: string;
  attempts: number;
}

@Injectable()
export class AutomationRepository {
  constructor(private readonly rls: RlsTransaction) {}

  /* ---------------------------------------------------------------- */
  /* Regras                                                            */
  /* ---------------------------------------------------------------- */

  list(organizationId: string, query: AutomationRuleQueryDto) {
    const pagination = PaginationHelper.normalize(query.page, query.limit);
    const where: Prisma.AutomationRuleWhereInput = {
      organizationId,
      deletedAt: null,
      trigger: query.trigger,
      businessUnitId: query.businessUnitId,
      enabled: query.enabled,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.rls.run(async (tx) => {
      const data = await tx.automationRule.findMany({
        where,
        select: ruleView,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...PaginationHelper.toPrisma(pagination),
      });
      const total = await tx.automationRule.count({ where });
      return PaginationHelper.result(data, total, pagination);
    });
  }

  find(id: string, organizationId: string) {
    return this.rls.run((tx) =>
      tx.automationRule.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: ruleView,
      }),
    );
  }

  create(data: Prisma.AutomationRuleUncheckedCreateInput, actorId: string) {
    return this.rls.run(async (tx) => {
      const rule = await tx.automationRule.create({
        data: { id: generateUuidV7(), ...data },
        select: ruleView,
      });
      await this.audit(
        tx,
        rule.id,
        data.organizationId,
        actorId,
        'AUTOMATION_RULE_CREATED',
        null,
        {
          name: rule.name,
          trigger: rule.trigger,
          enabled: rule.enabled,
        },
      );
      return rule;
    });
  }

  update(
    id: string,
    organizationId: string,
    actorId: string,
    data: Prisma.AutomationRuleUpdateInput,
    action: string,
    before: Record<string, unknown>,
  ) {
    return this.rls.run(async (tx) => {
      const rule = await tx.automationRule.update({
        where: { id },
        data,
        select: ruleView,
      });
      await this.audit(tx, id, organizationId, actorId, action, before, {
        name: rule.name,
        enabled: rule.enabled,
      });
      return rule;
    });
  }

  softDelete(id: string, organizationId: string, actorId: string) {
    return this.rls
      .run(async (tx) => {
        await tx.automationRule.update({
          where: { id },
          data: { deletedAt: new Date(), enabled: false },
        });
        await this.audit(
          tx,
          id,
          organizationId,
          actorId,
          'AUTOMATION_RULE_DELETED',
          null,
          null,
        );
      })
      .then(() => undefined);
  }

  /** Execuções vivas de uma regra — o que impede excluí-la sem pensar. */
  pendingExecutions(ruleId: string) {
    return this.rls.run((tx) =>
      tx.automationExecution.count({
        where: { ruleId, status: { in: ['PENDING', 'RUNNING'] } },
      }),
    );
  }

  /* ---------------------------------------------------------------- */
  /* Despacho                                                          */
  /* ---------------------------------------------------------------- */

  findEvent(id: string, organizationId: string) {
    return this.rls.run((tx) =>
      tx.domainEvent.findFirst({
        where: { id, organizationId },
      }),
    );
  }

  /**
   * Regras candidatas a um evento.
   *
   * `businessUnitId` nulo é regra da organização inteira; preenchido só vale
   * para aquela unidade. Um evento sem unidade só aciona regras da
   * organização — não há como aplicar uma regra de filial a um fato que não
   * pertence a nenhuma.
   */
  matchingRules(
    organizationId: string,
    trigger: string,
    businessUnitId: string | null,
  ) {
    return this.rls.run((tx) =>
      tx.automationRule.findMany({
        where: {
          organizationId,
          trigger,
          enabled: true,
          deletedAt: null,
          OR: businessUnitId
            ? [
                {
                  businessUnitId: null,
                  scopeBusinessUnitIds: { has: businessUnitId },
                },
                { businessUnitId },
              ]
            : [{ businessUnitId: null }],
        },
        select: ruleView,
        orderBy: { createdAt: 'asc' },
      }),
    );
  }

  /* ---------------------------------------------------------------- */
  /* Execuções                                                         */
  /* ---------------------------------------------------------------- */

  /**
   * Registra a intenção de executar uma ação — antes de ela rodar.
   *
   * Chamado no despacho, com o prazo já calculado. `ON CONFLICT DO NOTHING`
   * porque um despacho reentregue não deve criar a segunda linha.
   */
  schedule(input: {
    organizationId: string;
    eventId: string;
    ruleId: string;
    actionId: string;
    actionType: string;
    scheduledFor: Date | null;
    correlationId: string;
  }): Promise<boolean> {
    return this.rls.run(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO automation_executions (
          id, organization_id, event_id, rule_id, action_id, action_type,
          status, scheduled_for, correlation_id, updated_at
        ) VALUES (
          ${generateUuidV7()}::uuid,
          ${input.organizationId}::uuid,
          ${input.eventId}::uuid,
          ${input.ruleId}::uuid,
          ${input.actionId},
          ${input.actionType},
          'PENDING',
          ${input.scheduledFor}::timestamptz,
          ${input.correlationId},
          now()
        )
        ON CONFLICT (event_id, rule_id, action_id) DO NOTHING
        RETURNING id
      `;
      return rows.length > 0;
    });
  }

  /**
   * Reivindica a execução, se ela ainda não foi bem-sucedida.
   *
   * `WHERE automation_executions.status <> 'SUCCEEDED'` no `DO UPDATE`: uma
   * ação já concluída não devolve linha, e o processador desiste sem repetir o
   * efeito. Falha e pendência continuam retomáveis — que é o que uma fila com
   * retry precisa.
   */
  claim(
    eventId: string,
    ruleId: string,
    actionId: string,
  ): Promise<ClaimedExecution | null> {
    return this.rls.run(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string; attempts: number }[]>`
        UPDATE automation_executions
           SET status = 'RUNNING',
               attempts = attempts + 1,
               updated_at = now()
         WHERE event_id = ${eventId}::uuid
           AND rule_id = ${ruleId}::uuid
           AND action_id = ${actionId}
           AND status <> 'SUCCEEDED'
        RETURNING id, attempts
      `;
      return rows[0] ?? null;
    });
  }

  finish(input: {
    id: string;
    status: 'SUCCEEDED' | 'FAILED' | 'SKIPPED';
    resultType?: string | null;
    resultId?: string | null;
    detail?: string | null;
  }) {
    return this.rls
      .run((tx) =>
        tx.automationExecution.update({
          where: { id: input.id },
          data: {
            status: input.status,
            executedAt: new Date(),
            resultType: input.resultType ?? null,
            resultId: input.resultId ?? null,
            detail: input.detail ?? null,
          },
        }),
      )
      .then(() => undefined);
  }

  listExecutions(organizationId: string, query: AutomationExecutionQueryDto) {
    const pagination = PaginationHelper.normalize(query.page, query.limit);
    const where: Prisma.AutomationExecutionWhereInput = {
      organizationId,
      ruleId: query.ruleId,
      status: query.status,
    };

    return this.rls.run(async (tx) => {
      const data = await tx.automationExecution.findMany({
        where,
        select: executionView,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...PaginationHelper.toPrisma(pagination),
      });
      const total = await tx.automationExecution.count({ where });
      return PaginationHelper.result(data, total, pagination);
    });
  }

  /* ---------------------------------------------------------------- */
  /* Prazo                                                             */
  /* ---------------------------------------------------------------- */

  /**
   * Quando a ação deve acontecer.
   *
   * O cálculo é do Postgres, com `make_interval`. Meses e semanas têm
   * semântica de **calendário**: um mês depois de 31 de janeiro é 28 de
   * fevereiro, não 2 de março. Aproximar mês como trinta dias faria um
   * lembrete semestral escorregar cinco dias por ano.
   */
  resolveDelay(delay: { amount: number; unit: DelayUnit } | null) {
    if (!delay) return Promise.resolve(null);

    const months = delay.unit === 'MONTHS' ? delay.amount : 0;
    const weeks = delay.unit === 'WEEKS' ? delay.amount : 0;
    const days = delay.unit === 'DAYS' ? delay.amount : 0;
    const hours = delay.unit === 'HOURS' ? delay.amount : 0;
    const minutes = delay.unit === 'MINUTES' ? delay.amount : 0;

    return this.rls.run(async (tx) => {
      const rows = await tx.$queryRaw<{ at: Date }[]>`
        SELECT now() + make_interval(
          months => ${months}::int,
          weeks  => ${weeks}::int,
          days   => ${days}::int,
          hours  => ${hours}::int,
          mins   => ${minutes}::int
        ) AS at
      `;
      return rows[0]?.at ?? null;
    });
  }

  /* ---------------------------------------------------------------- */
  /* Alvos das ações                                                   */
  /* ---------------------------------------------------------------- */

  /** Calendário onde o lembrete entra: o padrão da unidade, ou o da organização. */
  defaultCalendar(organizationId: string, businessUnitId: string | null) {
    return this.rls.run((tx) =>
      tx.schedulingCalendar.findFirst({
        where: {
          organizationId,
          isActive: true,
          deletedAt: null,
          ...(businessUnitId
            ? { OR: [{ businessUnitId }, { businessUnitId: null }] }
            : {}),
        },
        select: { id: true, timezone: true },
        orderBy: [{ isDefault: 'desc' }, { businessUnitId: 'desc' }],
      }),
    );
  }

  createReminder(data: Prisma.SchedulingEventUncheckedCreateInput) {
    return this.rls.run((tx) =>
      tx.schedulingEvent.create({ data, select: { id: true, title: true } }),
    );
  }

  createNotification(data: Prisma.NotificationUncheckedCreateInput) {
    return this.rls.run((tx) =>
      tx.notification.create({ data, select: { id: true } }),
    );
  }

  findUser(id: string, organizationId: string) {
    return this.rls.run((tx) =>
      tx.organizationMembership.findFirst({
        where: { userId: id, organizationId, status: 'ACTIVE' },
        select: { userId: true },
      }),
    );
  }

  findBusinessUnit(id: string, organizationId: string) {
    return this.rls.run((tx) =>
      tx.businessUnit.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: { id: true },
      }),
    );
  }

  activeBusinessUnitIds(organizationId: string) {
    return this.rls.run(async (tx) =>
      (
        await tx.businessUnit.findMany({
          where: { organizationId, deletedAt: null, status: 'ACTIVE' },
          select: { id: true },
          orderBy: { id: 'asc' },
        })
      ).map((unit) => unit.id),
    );
  }

  /* ---------------------------------------------------------------- */
  /* Internos                                                          */
  /* ---------------------------------------------------------------- */

  private audit(
    tx: PrismaTransactionClient,
    entityId: string,
    organizationId: string,
    actorId: string,
    action: string,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
  ) {
    return tx.auditLog.create({
      data: {
        organizationId,
        userId: actorId,
        action,
        entityType: 'AUTOMATION_RULE',
        entityId,
        before: (before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (after ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
