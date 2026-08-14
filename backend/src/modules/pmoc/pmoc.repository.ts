/**
 * Persistência do domínio PMOC.
 *
 * ## O calendário é do Postgres
 *
 * `make_interval(months => 6)` a partir de 31 de agosto dá 28 de fevereiro —
 * `setMonth` em JavaScript daria 3 de março. Num plano semestral que roda por
 * anos, essa diferença acumula e a manutenção "semestral" escorrega de mês. A
 * rolagem da periodicidade acontece **em SQL**, sempre.
 *
 * ## Hoje é o dia do servidor
 *
 * `current_date` no banco. A conformidade não pode depender do relógio de quem
 * consulta: o mesmo plano precisa estar vencido para o técnico em campo e para
 * o gestor no escritório.
 *
 * ## Um ciclo por vencimento
 *
 * `INSERT … ON CONFLICT DO NOTHING` sobre `(plan_id, due_on)`: rolagem
 * disparada duas vezes — por retry da fila ou por dois cliques — produz um
 * ciclo, não dois. E como a ordem de serviço pendura no ciclo, não há como
 * nascerem duas ordens para a mesma manutenção.
 */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationHelper, RlsTransaction } from '../../database';
import type { PrismaTransactionClient } from '../../database/prisma.types';
import { generateUuidV7 } from '../../utils';
import { DomainEventEmitter } from '../automations/domain-event.emitter';
import type { FrequencyUnit } from './pmoc.domain';
import type {
  PmocAnalyticsQueryDto,
  PmocPlanQueryDto,
  PmocUpcomingQueryDto,
} from './pmoc.dto';

const planView = {
  id: true,
  code: true,
  name: true,
  status: true,
  notes: true,
  startsOn: true,
  endsOn: true,
  frequencyAmount: true,
  frequencyUnit: true,
  dueSoonDays: true,
  lastExecutedAt: true,
  nextDueOn: true,
  activatedAt: true,
  createdAt: true,
  updatedAt: true,
  businessUnit: { select: { id: true, legalName: true, tradeName: true } },
  customer: { select: { id: true, legalName: true, tradeName: true } },
  technician: { select: { id: true, displayName: true } },
  createdBy: { select: { id: true, displayName: true } },
  _count: { select: { coverages: true } },
} satisfies Prisma.PmocPlanSelect;

const coverageView = {
  id: true,
  startsOn: true,
  endsOn: true,
  notes: true,
  asset: {
    select: {
      id: true,
      name: true,
      category: true,
      identifier: true,
      serialNumber: true,
      status: true,
    },
  },
} satisfies Prisma.PmocEquipmentCoverageSelect;

const executionView = {
  id: true,
  dueOn: true,
  status: true,
  performedAt: true,
  notes: true,
  schedulingEventId: true,
  createdAt: true,
  completedBy: { select: { id: true, displayName: true } },
  operation: { select: { id: true, code: true, status: true } },
  artifactExecution: { select: { id: true, code: true, status: true } },
} satisfies Prisma.PmocExecutionSelect;

export type PlanRecord = Prisma.PmocPlanGetPayload<{ select: typeof planView }>;
export type CoverageRecord = Prisma.PmocEquipmentCoverageGetPayload<{
  select: typeof coverageView;
}>;
export type ExecutionRecord = Prisma.PmocExecutionGetPayload<{
  select: typeof executionView;
}>;

export interface CreatePlanData {
  organizationId: string;
  businessUnitId: string;
  customerId: string;
  code: string;
  name: string;
  startsOn: string;
  endsOn: string | null;
  frequencyAmount: number;
  frequencyUnit: FrequencyUnit;
  dueSoonDays: number;
  technicianUserId: string | null;
  notes: string | null;
  createdById: string;
}

@Injectable()
export class PmocRepository {
  constructor(
    private readonly rls: RlsTransaction,
    /**
     * Os eventos saem **de dentro da transação do domínio**.
     *
     * É o padrão outbox já usado por operações, orçamentos e estoque: ou o fato
     * e o evento acontecem juntos, ou nenhum dos dois. Emitir depois do commit
     * abriria a janela em que a manutenção foi registrada e a automação nunca
     * soube.
     */
    private readonly events: DomainEventEmitter,
  ) {}

  /* ---------------------------------------------------------------- */
  /* Planos                                                            */
  /* ---------------------------------------------------------------- */

  create(data: CreatePlanData, actorId: string) {
    return this.rls.run(async (tx) => {
      const plan = await tx.pmocPlan.create({
        data: {
          organizationId: data.organizationId,
          businessUnitId: data.businessUnitId,
          customerId: data.customerId,
          code: data.code,
          name: data.name,
          startsOn: new Date(`${data.startsOn}T00:00:00.000Z`),
          endsOn: data.endsOn ? new Date(`${data.endsOn}T00:00:00.000Z`) : null,
          frequencyAmount: data.frequencyAmount,
          frequencyUnit: data.frequencyUnit,
          dueSoonDays: data.dueSoonDays,
          technicianUserId: data.technicianUserId,
          notes: data.notes,
          createdById: data.createdById,
        },
        select: planView,
      });
      await this.audit(
        tx,
        plan.id,
        data.organizationId,
        actorId,
        'PMOC_PLAN_CREATED',
        {
          code: data.code,
          name: data.name,
        },
      );
      return plan;
    });
  }

  update(
    id: string,
    organizationId: string,
    actorId: string,
    data: Prisma.PmocPlanUpdateInput,
    action: string,
    before: Record<string, unknown>,
  ) {
    return this.rls.run(async (tx) => {
      const plan = await tx.pmocPlan.update({
        where: { id },
        data,
        select: planView,
      });
      await this.audit(tx, id, organizationId, actorId, action, before, {
        status: plan.status,
        nextDueOn: plan.nextDueOn,
      });
      return plan;
    });
  }

  find(id: string, organizationId: string) {
    return this.rls.run(async (tx) => {
      await this.expireStale(tx, organizationId);
      return tx.pmocPlan.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: planView,
      });
    });
  }

  /**
   * Listagem, com o filtro de conformidade **resolvido no banco**.
   *
   * `compliance` não é coluna: é a comparação entre `next_due_on`,
   * `current_date` e a antecedência do plano. Filtrar por ela em memória
   * exigiria trazer todos os planos para descartar a maioria — e a página
   * devolvida seria a errada.
   */
  list(organizationId: string, query: PmocPlanQueryDto) {
    const pagination = PaginationHelper.normalize(query.page, query.limit);

    return this.rls.run(async (tx) => {
      await this.expireStale(tx, organizationId);

      const filters = Prisma.sql`
        p.organization_id = ${organizationId}::uuid
        AND p.deleted_at IS NULL
        ${query.status ? Prisma.sql`AND p.status = ${query.status}` : Prisma.empty}
        ${query.businessUnitId ? Prisma.sql`AND p.business_unit_id = ${query.businessUnitId}::uuid` : Prisma.empty}
        ${query.customerId ? Prisma.sql`AND p.customer_id = ${query.customerId}::uuid` : Prisma.empty}
        ${
          query.search
            ? Prisma.sql`AND (p.name ILIKE ${`%${query.search}%`} OR p.code ILIKE ${`%${query.search}%`})`
            : Prisma.empty
        }
        ${
          query.dueUntil
            ? Prisma.sql`AND p.next_due_on IS NOT NULL AND p.next_due_on <= ${query.dueUntil}::date`
            : Prisma.empty
        }
        ${
          query.assetId
            ? Prisma.sql`AND EXISTS (
                SELECT 1 FROM pmoc_equipment_coverages c
                 WHERE c.plan_id = p.id AND c.deleted_at IS NULL
                   AND c.asset_id = ${query.assetId}::uuid
              )`
            : Prisma.empty
        }
        ${query.compliance ? Prisma.sql`AND ${this.complianceFilter(query.compliance)}` : Prisma.empty}
      `;

      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT p.id
          FROM pmoc_plans p
         WHERE ${filters}
         ORDER BY p.next_due_on ASC NULLS LAST, p.created_at DESC
         LIMIT ${pagination.limit} OFFSET ${(pagination.page - 1) * pagination.limit}
      `;
      const counted = await tx.$queryRaw<{ total: bigint }[]>`
        SELECT COUNT(*) AS total FROM pmoc_plans p WHERE ${filters}
      `;
      const total = counted[0]?.total ?? 0n;

      const ids = rows.map((row) => row.id);
      const plans = ids.length
        ? await tx.pmocPlan.findMany({
            where: { id: { in: ids } },
            select: planView,
          })
        : [];

      /** A ordem é a do SQL; `findMany` não a preserva. */
      const byId = new Map(plans.map((plan) => [plan.id, plan]));
      const ordered = ids
        .map((id) => byId.get(id))
        .filter((plan): plan is PlanRecord => Boolean(plan));

      return PaginationHelper.result(ordered, Number(total), pagination);
    });
  }

  /** O predicado de conformidade, em SQL — a mesma régua de `evaluateCompliance`. */
  private complianceFilter(status: string) {
    switch (status) {
      case 'OVERDUE':
        return Prisma.sql`(p.status = 'ACTIVE' AND p.next_due_on IS NOT NULL AND p.next_due_on < current_date)`;
      case 'DUE_SOON':
        return Prisma.sql`(
          p.status = 'ACTIVE' AND p.next_due_on IS NOT NULL
          AND p.next_due_on >= current_date
          AND p.next_due_on <= current_date + (p.due_soon_days || ' days')::interval
        )`;
      case 'UP_TO_DATE':
        return Prisma.sql`(
          p.status = 'ACTIVE' AND p.next_due_on IS NOT NULL
          AND p.next_due_on > current_date + (p.due_soon_days || ' days')::interval
        )`;
      default:
        return Prisma.sql`(p.status <> 'ACTIVE' OR p.next_due_on IS NULL)`;
    }
  }

  /**
   * Vencimento de vigência, aplicado na leitura.
   *
   * Um plano cuja vigência acabou não pode continuar `ACTIVE` só porque ninguém
   * abriu a tela. A varredura é barata — atinge apenas o que já passou — e roda
   * antes de listar e de detalhar, como o Commercial Engine faz com propostas
   * vencidas.
   */
  private async expireStale(
    tx: PrismaTransactionClient,
    organizationId: string,
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE pmoc_plans
         SET status = 'EXPIRED', updated_at = now()
       WHERE organization_id = ${organizationId}::uuid
         AND deleted_at IS NULL
         AND status = 'ACTIVE'
         AND ends_on IS NOT NULL
         AND ends_on < current_date
    `;
  }

  /** Planos cuja vigência acabou — devolvidos para o job emitir os eventos. */
  expireDue(organizationId: string) {
    return this.rls.run((tx) => this.expireStale(tx, organizationId));
  }

  /* ---------------------------------------------------------------- */
  /* Periodicidade e vencimento                                        */
  /* ---------------------------------------------------------------- */

  /**
   * Ativa o plano e define o primeiro vencimento.
   *
   * O primeiro vencimento é o **início da vigência**, não "hoje mais um
   * período": um plano que começou em janeiro e foi cadastrado em março já
   * devia uma manutenção de janeiro, e mostrá-lo em dia esconderia o atraso.
   */
  activate(id: string, organizationId: string, actorId: string) {
    return this.rls.run(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string; next_due_on: Date }[]>`
        UPDATE pmoc_plans
           SET status = 'ACTIVE',
               activated_at = COALESCE(activated_at, now()),
               next_due_on = COALESCE(next_due_on, starts_on),
               updated_at = now()
         WHERE id = ${id}::uuid
           AND organization_id = ${organizationId}::uuid
           AND deleted_at IS NULL
           AND status IN ('DRAFT', 'SUSPENDED')
        RETURNING id, next_due_on
      `;
      if (rows.length === 0) return null;

      await this.audit(
        tx,
        id,
        organizationId,
        actorId,
        'PMOC_PLAN_ACTIVATED',
        {},
        {
          nextDueOn: rows[0]?.next_due_on,
        },
      );

      const plan = await tx.pmocPlan.findFirstOrThrow({
        where: { id },
        select: planView,
      });

      await this.events.emit(tx, {
        type: 'pmoc.plan.activated',
        organizationId,
        businessUnitId: plan.businessUnit.id,
        actorId,
        entityType: 'PMOC_PLAN',
        entityId: plan.id,
        payload: {
          code: plan.code,
          businessUnitId: plan.businessUnit.id,
          customerId: plan.customer.id,
          frequencyUnit: plan.frequencyUnit,
          nextDueOn: plan.nextDueOn
            ? plan.nextDueOn.toISOString().slice(0, 10)
            : '',
        },
      });

      return plan;
    });
  }

  /**
   * Fecha um ciclo e rola a periodicidade.
   *
   * Tudo numa transação: o ciclo vira `COMPLETED`, o plano recebe a data da
   * execução e o próximo vencimento **calculado pelo Postgres a partir dessa
   * data**, e o ciclo seguinte nasce. Em três instruções separadas, uma falha
   * no meio deixaria um plano concluído sem próximo vencimento — em dia para
   * sempre.
   */
  completeExecution(input: {
    executionId: string;
    planId: string;
    organizationId: string;
    actorId: string;
    performedAt: Date;
    artifactExecutionId: string | null;
    notes: string | null;
  }) {
    return this.rls.run(async (tx) => {
      const claimed = await tx.$queryRaw<{ id: string }[]>`
        UPDATE pmoc_executions
           SET status = 'COMPLETED',
               performed_at = ${input.performedAt},
               completed_by_id = ${input.actorId}::uuid,
               notes = COALESCE(${input.notes}, notes),
               artifact_execution_id = COALESCE(${input.artifactExecutionId}::uuid, artifact_execution_id),
               updated_at = now()
         WHERE id = ${input.executionId}::uuid
           AND organization_id = ${input.organizationId}::uuid
           AND status = 'PENDING'
        RETURNING id
      `;

      /** Já concluído: outra requisição chegou primeiro. */
      if (claimed.length === 0) return null;

      const rolled = await tx.$queryRaw<{ next_due_on: Date }[]>`
        UPDATE pmoc_plans
           SET last_executed_at = ${input.performedAt},
               next_due_on = (${input.performedAt}::date + make_interval(
                 years  => CASE WHEN frequency_unit = 'YEARS'  THEN frequency_amount ELSE 0 END,
                 months => CASE WHEN frequency_unit = 'MONTHS' THEN frequency_amount ELSE 0 END,
                 weeks  => CASE WHEN frequency_unit = 'WEEKS'  THEN frequency_amount ELSE 0 END,
                 days   => CASE WHEN frequency_unit = 'DAYS'   THEN frequency_amount ELSE 0 END
               ))::date,
               /** O aviso do vencimento novo ainda não foi dado. */
               due_soon_notified_for = NULL,
               overdue_notified_for = NULL,
               updated_at = now()
         WHERE id = ${input.planId}::uuid
           AND organization_id = ${input.organizationId}::uuid
        RETURNING next_due_on
      `;

      const nextDueOn = rolled[0]?.next_due_on ?? null;

      /**
       * O ciclo seguinte nasce junto — mas só enquanto a vigência alcançar.
       *
       * Um plano que termina em dezembro não abre ciclo para janeiro: seria uma
       * manutenção prevista para depois do fim do contrato.
       */
      if (nextDueOn) {
        await tx.$executeRaw`
          INSERT INTO pmoc_executions (
            id, organization_id, plan_id, due_on, status, updated_at
          )
          SELECT ${generateUuidV7()}::uuid, ${input.organizationId}::uuid,
                 ${input.planId}::uuid, ${nextDueOn}::date, 'PENDING', now()
            FROM pmoc_plans p
           WHERE p.id = ${input.planId}::uuid
             AND (p.ends_on IS NULL OR p.ends_on >= ${nextDueOn}::date)
          ON CONFLICT DO NOTHING
        `;
      }

      await this.audit(
        tx,
        input.planId,
        input.organizationId,
        input.actorId,
        'PMOC_EXECUTION_COMPLETED',
        {},
        { executionId: input.executionId, nextDueOn },
      );

      const plan = await tx.pmocPlan.findFirstOrThrow({
        where: { id: input.planId },
        select: planView,
      });

      await this.events.emit(tx, {
        type: 'pmoc.execution.completed',
        organizationId: input.organizationId,
        businessUnitId: plan.businessUnit.id,
        actorId: input.actorId,
        entityType: 'PMOC_PLAN',
        entityId: plan.id,
        payload: {
          code: plan.code,
          businessUnitId: plan.businessUnit.id,
          customerId: plan.customer.id,
          nextDueOn: nextDueOn ? nextDueOn.toISOString().slice(0, 10) : '',
        },
      });

      return { nextDueOn };
    });
  }

  /* ---------------------------------------------------------------- */
  /* Ciclos                                                            */
  /* ---------------------------------------------------------------- */

  /** Abre o ciclo do vencimento atual, se ainda não existir. */
  openCycle(organizationId: string, planId: string, dueOn: Date) {
    return this.rls.run(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO pmoc_executions (
          id, organization_id, plan_id, due_on, status, updated_at
        ) VALUES (
          ${generateUuidV7()}::uuid, ${organizationId}::uuid,
          ${planId}::uuid, ${dueOn}::date, 'PENDING', now()
        )
        ON CONFLICT DO NOTHING
        RETURNING id
      `;
      if (rows[0]) return rows[0].id;

      const existing = await tx.pmocExecution.findFirst({
        where: { planId, dueOn, status: { not: 'CANCELLED' } },
        select: { id: true },
      });
      return existing?.id ?? null;
    });
  }

  currentExecution(planId: string, organizationId: string) {
    return this.rls.run((tx) =>
      tx.pmocExecution.findFirst({
        where: { planId, organizationId, status: 'PENDING' },
        select: executionView,
        orderBy: { dueOn: 'asc' },
      }),
    );
  }

  findExecution(id: string, organizationId: string) {
    return this.rls.run((tx) =>
      tx.pmocExecution.findFirst({
        where: { id, organizationId },
        select: { ...executionView, planId: true },
      }),
    );
  }

  listExecutions(planId: string, organizationId: string, limit = 20) {
    return this.rls.run((tx) =>
      tx.pmocExecution.findMany({
        where: { planId, organizationId },
        select: executionView,
        orderBy: [{ dueOn: 'desc' }, { createdAt: 'desc' }],
        take: limit,
      }),
    );
  }

  attachEvidence(executionId: string, artifactExecutionId: string) {
    return this.rls
      .run((tx) =>
        tx.pmocExecution.update({
          where: { id: executionId },
          data: { artifactExecutionId },
          select: { id: true },
        }),
      )
      .then(() => undefined);
  }

  attachSchedulingEvent(executionId: string, schedulingEventId: string) {
    return this.rls
      .run((tx) =>
        tx.pmocExecution.update({
          where: { id: executionId },
          data: { schedulingEventId },
          select: { id: true },
        }),
      )
      .then(() => undefined);
  }

  /**
   * Cria a ordem de serviço do ciclo, uma vez só.
   *
   * `pg_advisory_xact_lock` serializa duas chamadas concorrentes para o mesmo
   * ciclo; a segunda encontra `operation_id` preenchido e devolve o que existe.
   * Sem a trava, as duas passariam pela checagem e o índice único de código de
   * operação derrubaria uma delas com 500 em vez do resultado certo — é a mesma
   * defesa da conversão de orçamento.
   */
  createOperation(input: {
    executionId: string;
    organizationId: string;
    businessUnitId: string;
    customerId: string;
    assetId: string | null;
    actorId: string;
    code: string;
    kind: string;
    title: string;
    description: string;
    scheduledStart: Date | null;
    scheduledEnd: Date | null;
  }) {
    return this.rls.run(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pmoc:operation:${input.executionId}`}))`;

      const current = await tx.pmocExecution.findFirstOrThrow({
        where: { id: input.executionId },
        select: { operationId: true },
      });
      if (current.operationId) {
        return { operationId: current.operationId, created: false };
      }

      const operation = await tx.operation.create({
        data: {
          organizationId: input.organizationId,
          businessUnitId: input.businessUnitId,
          customerId: input.customerId,
          assetId: input.assetId,
          code: input.code,
          kind: input.kind,
          title: input.title,
          description: input.description,
          status: input.scheduledStart ? 'SCHEDULED' : 'OPEN',
          priority: 'NORMAL',
          scheduledStart: input.scheduledStart,
          scheduledEnd: input.scheduledEnd,
          createdById: input.actorId,
        },
        select: { id: true, code: true, status: true },
      });

      await tx.operationHistory.create({
        data: {
          operationId: operation.id,
          userId: input.actorId,
          action: 'CREATED',
          toStatus: operation.status,
          details: { source: 'pmoc', executionId: input.executionId },
        },
      });

      await tx.pmocExecution.update({
        where: { id: input.executionId },
        data: { operationId: operation.id },
      });

      return { operationId: operation.id, created: true, operation };
    });
  }

  /* ---------------------------------------------------------------- */
  /* Cobertura                                                         */
  /* ---------------------------------------------------------------- */

  addCoverage(input: {
    organizationId: string;
    planId: string;
    assetId: string;
    startsOn: Date;
    endsOn: Date | null;
    notes: string | null;
    actorId: string;
  }) {
    return this.rls.run(async (tx) => {
      const coverage = await tx.pmocEquipmentCoverage.create({
        data: {
          organizationId: input.organizationId,
          planId: input.planId,
          assetId: input.assetId,
          startsOn: input.startsOn,
          endsOn: input.endsOn,
          notes: input.notes,
        },
        select: coverageView,
      });
      await this.audit(
        tx,
        input.planId,
        input.organizationId,
        input.actorId,
        'PMOC_COVERAGE_ADDED',
        {},
        { assetId: input.assetId },
      );
      return coverage;
    });
  }

  removeCoverage(
    id: string,
    planId: string,
    organizationId: string,
    actorId: string,
  ) {
    return this.rls.run(async (tx) => {
      const removed = await tx.pmocEquipmentCoverage.updateMany({
        where: { id, planId, organizationId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (removed.count === 0) return false;
      await this.audit(
        tx,
        planId,
        organizationId,
        actorId,
        'PMOC_COVERAGE_REMOVED',
        {},
        { coverageId: id },
      );
      return true;
    });
  }

  listCoverages(planId: string, organizationId: string) {
    return this.rls.run((tx) =>
      tx.pmocEquipmentCoverage.findMany({
        where: { planId, organizationId, deletedAt: null },
        select: coverageView,
        orderBy: { createdAt: 'asc' },
      }),
    );
  }

  /** O equipamento coberto há mais tempo — vira o `assetId` da ordem gerada. */
  firstCoveredAsset(planId: string, organizationId: string) {
    return this.rls.run((tx) =>
      tx.pmocEquipmentCoverage.findFirst({
        where: { planId, organizationId, deletedAt: null },
        select: { assetId: true },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }

  /* ---------------------------------------------------------------- */
  /* Analytics                                                         */
  /* ---------------------------------------------------------------- */

  /**
   * O painel de conformidade, numa varredura por tabela.
   *
   * Contagens com `FILTER`, e a conformidade calculada com a **mesma** régua do
   * filtro de listagem. Duas fórmulas para "vencido" divergiriam no primeiro
   * caso de borda, e o painel discordaria da lista logo abaixo dele.
   */
  complianceSummary(organizationId: string, query: PmocAnalyticsQueryDto) {
    const from = query.from ?? new Date(Date.now() - 30 * 24 * 3600_000);
    const to = query.to ?? new Date();

    return this.rls.run(async (tx) => {
      await this.expireStale(tx, organizationId);

      const unit = query.businessUnitId
        ? Prisma.sql`AND p.business_unit_id = ${query.businessUnitId}::uuid`
        : Prisma.empty;

      const [plans] = await tx.$queryRaw<
        {
          total: bigint;
          draft: bigint;
          active: bigint;
          suspended: bigint;
          expired: bigint;
          cancelled: bigint;
          up_to_date: bigint;
          due_soon: bigint;
          overdue: bigint;
        }[]
      >`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE p.status = 'DRAFT') AS draft,
          COUNT(*) FILTER (WHERE p.status = 'ACTIVE') AS active,
          COUNT(*) FILTER (WHERE p.status = 'SUSPENDED') AS suspended,
          COUNT(*) FILTER (WHERE p.status = 'EXPIRED') AS expired,
          COUNT(*) FILTER (WHERE p.status = 'CANCELLED') AS cancelled,
          COUNT(*) FILTER (
            WHERE p.status = 'ACTIVE' AND p.next_due_on IS NOT NULL
              AND p.next_due_on > current_date + (p.due_soon_days || ' days')::interval
          ) AS up_to_date,
          COUNT(*) FILTER (
            WHERE p.status = 'ACTIVE' AND p.next_due_on IS NOT NULL
              AND p.next_due_on >= current_date
              AND p.next_due_on <= current_date + (p.due_soon_days || ' days')::interval
          ) AS due_soon,
          COUNT(*) FILTER (
            WHERE p.status = 'ACTIVE' AND p.next_due_on IS NOT NULL
              AND p.next_due_on < current_date
          ) AS overdue
        FROM pmoc_plans p
        WHERE p.organization_id = ${organizationId}::uuid
          AND p.deleted_at IS NULL
          ${unit}
      `;

      const [equipment] = await tx.$queryRaw<{ covered: bigint }[]>`
        SELECT COUNT(DISTINCT c.asset_id) AS covered
          FROM pmoc_equipment_coverages c
          JOIN pmoc_plans p ON p.id = c.plan_id
         WHERE c.organization_id = ${organizationId}::uuid
           AND c.deleted_at IS NULL
           AND p.deleted_at IS NULL
           AND p.status = 'ACTIVE'
           ${unit}
      `;

      const [executions] = await tx.$queryRaw<
        { completed: bigint; pending: bigint; overdue: bigint }[]
      >`
        SELECT
          COUNT(*) FILTER (
            WHERE e.status = 'COMPLETED' AND e.performed_at BETWEEN ${from} AND ${to}
          ) AS completed,
          COUNT(*) FILTER (WHERE e.status = 'PENDING') AS pending,
          COUNT(*) FILTER (
            WHERE e.status = 'PENDING' AND e.due_on < current_date
          ) AS overdue
        FROM pmoc_executions e
        JOIN pmoc_plans p ON p.id = e.plan_id
       WHERE e.organization_id = ${organizationId}::uuid
         AND p.deleted_at IS NULL
         ${unit}
      `;

      return { plans, equipment, executions, period: { from, to } };
    });
  }

  /** As próximas manutenções, em ordem de vencimento. */
  upcoming(organizationId: string, query: PmocUpcomingQueryDto) {
    return this.rls.run(async (tx) => {
      await this.expireStale(tx, organizationId);
      return tx.$queryRaw<
        {
          plan_id: string;
          plan_code: string;
          plan_name: string;
          execution_id: string | null;
          due_on: Date;
          days_until_due: number;
          due_soon_days: number;
          business_unit_id: string;
          business_unit_name: string;
          customer_id: string;
          customer_name: string;
          covered: bigint;
        }[]
      >`
        SELECT p.id AS plan_id,
               p.code AS plan_code,
               p.name AS plan_name,
               e.id AS execution_id,
               p.next_due_on AS due_on,
               (p.next_due_on - current_date) AS days_until_due,
               p.due_soon_days,
               b.id AS business_unit_id,
               COALESCE(b.trade_name, b.legal_name) AS business_unit_name,
               c.id AS customer_id,
               COALESCE(c.trade_name, c.legal_name) AS customer_name,
               (
                 SELECT COUNT(*) FROM pmoc_equipment_coverages cov
                  WHERE cov.plan_id = p.id AND cov.deleted_at IS NULL
               ) AS covered
          FROM pmoc_plans p
          JOIN business_units b ON b.id = p.business_unit_id
          JOIN customers c ON c.id = p.customer_id
          LEFT JOIN pmoc_executions e
            ON e.plan_id = p.id AND e.due_on = p.next_due_on AND e.status = 'PENDING'
         WHERE p.organization_id = ${organizationId}::uuid
           AND p.deleted_at IS NULL
           AND p.status = 'ACTIVE'
           AND p.next_due_on IS NOT NULL
           AND p.next_due_on <= current_date + (${query.days} || ' days')::interval
           ${query.businessUnitId ? Prisma.sql`AND p.business_unit_id = ${query.businessUnitId}::uuid` : Prisma.empty}
         ORDER BY p.next_due_on ASC
         LIMIT ${query.limit}
      `;
    });
  }

  /* ---------------------------------------------------------------- */
  /* Avisos de vencimento                                              */
  /* ---------------------------------------------------------------- */

  /**
   * Marca que o aviso deste vencimento já foi dado.
   *
   * O `WHERE` compara com o vencimento atual: se a manutenção foi feita e o
   * vencimento rolou, a marca não bate e o aviso do novo ciclo acontece. É o
   * que impede o mesmo "vence em 15 dias" todo dia durante quinze dias.
   */
  notify(input: {
    planId: string;
    organizationId: string;
    phase: 'DUE_SOON' | 'OVERDUE';
    dueOn: Date;
    days: number;
    actorId: string | null;
  }): Promise<boolean> {
    const column =
      input.phase === 'DUE_SOON'
        ? 'due_soon_notified_for'
        : 'overdue_notified_for';

    return this.rls.run(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        UPDATE pmoc_plans
           SET ${Prisma.raw(column)} = ${input.dueOn}::date, updated_at = now()
         WHERE id = ${input.planId}::uuid
           AND organization_id = ${input.organizationId}::uuid
           AND status = 'ACTIVE'
           AND next_due_on = ${input.dueOn}::date
           AND (${Prisma.raw(column)} IS DISTINCT FROM ${input.dueOn}::date)
        RETURNING id
      `;

      /**
       * Nada atualizado: ou a manutenção já foi feita e o vencimento rolou, ou
       * o aviso deste vencimento já saiu. Nos dois casos, não há evento.
       */
      if (rows.length === 0) return false;

      const plan = await tx.pmocPlan.findFirstOrThrow({
        where: { id: input.planId },
        select: planView,
      });

      await this.events.emit(tx, {
        type: input.phase === 'DUE_SOON' ? 'pmoc.due_soon' : 'pmoc.overdue',
        organizationId: input.organizationId,
        businessUnitId: plan.businessUnit.id,
        actorId: input.actorId,
        entityType: 'PMOC_PLAN',
        entityId: plan.id,
        payload: {
          code: plan.code,
          businessUnitId: plan.businessUnit.id,
          customerId: plan.customer.id,
          dueOn: input.dueOn.toISOString().slice(0, 10),
          ...(input.phase === 'DUE_SOON'
            ? { daysUntilDue: input.days }
            : { daysOverdue: input.days }),
        },
      });

      return true;
    });
  }

  /** O plano como o job precisa dele: situação, vencimento e antecedência. */
  findForNotification(planId: string, organizationId: string) {
    return this.rls.run((tx) =>
      tx.pmocPlan.findFirst({
        where: { id: planId, organizationId, deletedAt: null },
        select: {
          id: true,
          status: true,
          nextDueOn: true,
          dueSoonDays: true,
          endsOn: true,
        },
      }),
    );
  }

  /* ---------------------------------------------------------------- */
  /* Referências                                                       */
  /* ---------------------------------------------------------------- */

  findBusinessUnit(id: string, organizationId: string) {
    return this.rls.run((tx) =>
      tx.businessUnit.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: { id: true, legalName: true, tradeName: true },
      }),
    );
  }

  findCustomer(id: string, organizationId: string) {
    return this.rls.run((tx) =>
      tx.customer.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: { id: true, legalName: true, tradeName: true },
      }),
    );
  }

  /** O equipamento precisa ser do tenant **e** da mesma unidade do plano. */
  findAsset(id: string, organizationId: string) {
    return this.rls.run((tx) =>
      tx.asset.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: {
          id: true,
          businessUnitId: true,
          customerId: true,
          name: true,
        },
      }),
    );
  }

  findMember(userId: string, organizationId: string) {
    return this.rls.run((tx) =>
      tx.organizationMembership.findFirst({
        where: { userId, organizationId, status: 'ACTIVE' },
        select: { userId: true },
      }),
    );
  }

  /** A execução de artefato que serve de evidência — precisa existir de verdade. */
  findArtifactExecution(id: string, organizationId: string) {
    return this.rls.run((tx) =>
      tx.artifactExecution.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: {
          id: true,
          code: true,
          status: true,
          businessUnitId: true,
          template: { select: { artifactType: true } },
        },
      }),
    );
  }

  defaultCalendar(organizationId: string, businessUnitId: string) {
    return this.rls.run((tx) =>
      tx.schedulingCalendar.findFirst({
        where: {
          organizationId,
          isActive: true,
          deletedAt: null,
          OR: [{ businessUnitId }, { businessUnitId: null }],
        },
        select: { id: true, timezone: true },
        orderBy: [{ isDefault: 'desc' }, { businessUnitId: 'desc' }],
      }),
    );
  }

  createSchedulingEvent(data: Prisma.SchedulingEventUncheckedCreateInput) {
    return this.rls.run((tx) =>
      tx.schedulingEvent.create({ data, select: { id: true } }),
    );
  }

  /** Próximo código de operação livre — a autoridade é o índice único. */
  operationCodeTaken(organizationId: string, code: string) {
    return this.rls.run(async (tx) => {
      const taken = await tx.operation.findFirst({
        where: { organizationId, code, deletedAt: null },
        select: { id: true },
      });
      return Boolean(taken);
    });
  }

  planCodeTaken(organizationId: string, code: string) {
    return this.rls.run(async (tx) => {
      const taken = await tx.pmocPlan.findFirst({
        where: { organizationId, code, deletedAt: null },
        select: { id: true },
      });
      return Boolean(taken);
    });
  }

  /* ---------------------------------------------------------------- */
  /* Auditoria                                                         */
  /* ---------------------------------------------------------------- */

  private audit(
    tx: PrismaTransactionClient,
    planId: string,
    organizationId: string,
    actorId: string,
    action: string,
    before: Record<string, unknown>,
    after: Record<string, unknown> = {},
  ) {
    return tx.auditLog.create({
      data: {
        organizationId,
        userId: actorId,
        action,
        entityType: 'PMOC_PLAN',
        entityId: planId,
        before: before as Prisma.InputJsonValue,
        after: after as Prisma.InputJsonValue,
      },
    });
  }
}
