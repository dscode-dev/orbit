/**
 * Regras do domínio PMOC.
 *
 * ## O plano não é o documento
 *
 * Um `PmocPlan` existe, vale e vence sem que nenhum PDF tenha sido emitido. O
 * documento é **evidência** de um ciclo cumprido, e é vinculado quando existe
 * de verdade — nunca fabricado para "ter documento".
 *
 * ## O que este serviço não decide
 *
 * Não interpreta norma, não escolhe periodicidade por tipo de equipamento e não
 * emite parecer de conformidade legal. A periodicidade é a contratada; o Orbit
 * a cumpre, mede e registra.
 *
 * ## Autorização não atravessa domínios
 *
 * `pmoc.manage` cria plano e cobertura. **Não** cria ordem de serviço sozinha:
 * gerar a operação de um ciclo exige também `operations.manage`, e vincular a
 * evidência exige `artifact_executions.read`. Um domínio que integra outros é
 * exatamente onde as autorizações se perdem, se cada uma não for conferida no
 * seu lugar.
 */
import { Injectable } from '@nestjs/common';
import {
  ConflictException,
  EntityNotFoundException,
  ForbiddenException,
  ValidationException,
} from '../../exceptions';
import { BackgroundJobQueue } from '../jobs/background-job.queue';
import { JOB_QUEUES } from '../jobs/background-job.types';
import { generateUuidV7 } from '../../utils';
import {
  canTransition,
  EDITABLE_STATUSES,
  evaluateCompliance,
  executionEligibility,
  toDateOnly,
  type FrequencyUnit,
  type PlanStatus,
} from './pmoc.domain';
import type {
  AddPmocCoverageDto,
  AddPmocEquipmentEvidenceDto,
  CompletePmocEquipmentExecutionDto,
  GeneratePmocEquipmentArtifactDto,
  CompletePmocExecutionDto,
  CreatePmocOperationDto,
  CreatePmocPlanDto,
  LinkPmocEvidenceDto,
  PmocAnalyticsQueryDto,
  PmocPlanQueryDto,
  PmocCoveragePageQueryDto,
  PmocTimelineQueryDto,
  PmocUpcomingQueryDto,
  StartPmocEquipmentExecutionDto,
  UpdatePmocPlanDto,
} from './pmoc.dto';
import { PmocMapper } from './pmoc.mapper';
import type {
  PmocComplianceSummaryReadModel,
  PmocUpcomingReadModel,
  PmocCursorPageReadModel,
  PmocCoverageReadModel,
  PmocTimelineItemReadModel,
} from './pmoc.read-models';
import { instantFromCivilDate } from '../scheduling/scheduling-time';
import { PmocRepository } from './pmoc.repository';
import { WorkforceService } from '../workforce/workforce.service';
import { ArtifactRenderService } from '../artifact-rendering/artifact-render.service';

/** Quem pediu, e o que ele pode. */
export interface PmocActor {
  organizationId: string;
  actorId: string;
  permissions: readonly string[];
  businessUnitIds: readonly string[];
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class PmocService {
  constructor(
    private readonly repository: PmocRepository,
    private readonly mapper: PmocMapper,
    private readonly jobs: BackgroundJobQueue,
    private readonly workforce: WorkforceService,
    private readonly rendering: ArtifactRenderService,
  ) {}

  /* ---------------------------------------------------------------- */
  /* Planos                                                            */
  /* ---------------------------------------------------------------- */

  async create(actor: PmocActor, input: CreatePmocPlanDto) {
    const unit = await this.repository.findBusinessUnit(
      input.businessUnitId,
      actor.organizationId,
    );
    if (!unit) {
      throw new EntityNotFoundException('BusinessUnit', input.businessUnitId);
    }
    this.assertUnitInScope(actor, input.businessUnitId);

    const customer = await this.repository.findCustomer(
      input.customerId,
      actor.organizationId,
    );
    if (!customer) {
      throw new EntityNotFoundException('Customer', input.customerId);
    }

    if (input.technicianUserId) {
      const member = await this.repository.findMember(
        input.technicianUserId,
        actor.organizationId,
      );
      if (!member) {
        throw new ValidationException(
          'The technician must be an active member of this organization',
        );
      }
    }
    if (input.technicalResponsibleUserId) {
      await this.assertTechnicalResponsible(
        input.technicalResponsibleUserId,
        actor,
        input.businessUnitId,
      );
    }

    this.assertValidity(input.startsOn, input.endsOn ?? null);

    if (await this.repository.planCodeTaken(actor.organizationId, input.code)) {
      throw new ConflictException(
        `A PMOC plan with code "${input.code}" already exists`,
      );
    }

    const plan = await this.repository.create(
      {
        organizationId: actor.organizationId,
        businessUnitId: input.businessUnitId,
        customerId: input.customerId,
        code: input.code,
        name: input.name,
        startsOn: input.startsOn,
        endsOn: input.endsOn ?? null,
        frequencyAmount: input.frequencyAmount,
        frequencyUnit: input.frequencyUnit,
        dueSoonDays: input.dueSoonDays ?? 15,
        technicianUserId: input.technicianUserId ?? null,
        technicalResponsibleUserId: input.technicalResponsibleUserId ?? null,
        serviceLocation: input.serviceLocation as never,
        scope: input.scope as never,
        serviceTypes: input.serviceTypes ?? [],
        procedure: (input.procedure ?? {}) as never,
        schedulingPaused: input.schedulingPaused ?? false,
        reviewRequired: input.reviewRequired ?? false,
        notes: input.notes ?? null,
        createdById: actor.actorId,
      },
      actor.actorId,
    );

    return this.mapper.summary(plan);
  }

  async update(id: string, actor: PmocActor, input: UpdatePmocPlanDto) {
    const plan = await this.plan(id, actor);

    if (!EDITABLE_STATUSES.includes(plan.status)) {
      throw new ConflictException(
        `A ${plan.status.toLowerCase()} plan cannot be edited`,
      );
    }

    const startsOn = input.startsOn ?? toDateOnly(plan.startsOn);
    const endsOn =
      input.endsOn ?? (plan.endsOn ? toDateOnly(plan.endsOn) : null);
    this.assertValidity(startsOn, endsOn ?? null);

    if (input.technicianUserId) {
      const member = await this.repository.findMember(
        input.technicianUserId,
        actor.organizationId,
      );
      if (!member) {
        throw new ValidationException(
          'The technician must be an active member of this organization',
        );
      }
    }
    if (input.technicalResponsibleUserId) {
      await this.assertTechnicalResponsible(
        input.technicalResponsibleUserId,
        actor,
        plan.businessUnit.id,
      );
    }

    const updated = await this.repository.update(
      id,
      actor.organizationId,
      actor.actorId,
      {
        ...(input.name ? { name: input.name } : {}),
        ...(input.notes === undefined ? {} : { notes: input.notes }),
        ...(input.startsOn
          ? { startsOn: new Date(`${input.startsOn}T00:00:00.000Z`) }
          : {}),
        ...(input.endsOn
          ? { endsOn: new Date(`${input.endsOn}T00:00:00.000Z`) }
          : {}),
        ...(input.frequencyAmount
          ? { frequencyAmount: input.frequencyAmount }
          : {}),
        ...(input.frequencyUnit ? { frequencyUnit: input.frequencyUnit } : {}),
        ...(input.dueSoonDays ? { dueSoonDays: input.dueSoonDays } : {}),
        ...(input.technicianUserId
          ? { technician: { connect: { id: input.technicianUserId } } }
          : {}),
        ...(input.technicalResponsibleUserId
          ? {
              technicalResponsible: {
                connect: { id: input.technicalResponsibleUserId },
              },
            }
          : {}),
        ...(input.serviceLocation === undefined
          ? {}
          : { serviceLocation: input.serviceLocation as never }),
        ...(input.scope === undefined ? {} : { scope: input.scope as never }),
        ...(input.serviceTypes === undefined
          ? {}
          : { serviceTypes: input.serviceTypes }),
        ...(input.procedure === undefined
          ? {}
          : { procedure: input.procedure as never }),
        ...(input.schedulingPaused === undefined
          ? {}
          : { schedulingPaused: input.schedulingPaused }),
        ...(input.reviewRequired === undefined
          ? {}
          : { reviewRequired: input.reviewRequired }),
      },
      'PMOC_PLAN_UPDATED',
      { name: plan.name, status: plan.status },
    );

    return this.mapper.summary(updated);
  }

  list(actor: PmocActor, query: PmocPlanQueryDto) {
    return this.repository.list(actor.organizationId, query).then((result) => ({
      data: result.data.map((plan) => this.mapper.summary(plan)),
      meta: result.meta,
    }));
  }

  async get(id: string, actor: PmocActor) {
    const plan = await this.plan(id, actor);
    /**
     * Paralelo de propósito: cada chamada abre a **própria** transação, então
     * não há conexão compartilhada. O que a PR-26.6.1 proíbe é concorrência de
     * consultas sobre o mesmo cliente transacional — outra coisa.
     */
    const [coverages, current, recent] = await Promise.all([
      this.repository.listCoverages(id, actor.organizationId),
      this.repository.currentExecution(id, actor.organizationId),
      this.repository.listExecutions(id, actor.organizationId),
    ]);

    return this.mapper.details(plan, {
      coverages,
      currentExecution: current,
      recentExecutions: recent,
    });
  }

  /* ---------------------------------------------------------------- */
  /* Máquina de estados                                                */
  /* ---------------------------------------------------------------- */

  /**
   * Ativar é o que faz o plano começar a valer.
   *
   * Três coisas acontecem juntas, e nesta ordem: o plano ganha o primeiro
   * vencimento, o ciclo correspondente é aberto e o compromisso entra na
   * **Agenda existente**. Sem a terceira, o plano só existiria para quem abrisse
   * a tela de PMOC — e a manutenção é trabalho de campo, que se organiza pela
   * agenda.
   */
  async activate(id: string, actor: PmocActor) {
    const plan = await this.plan(id, actor);
    if (plan.status === 'ACTIVE') {
      const cycle = await this.repository.currentExecution(
        plan.id,
        actor.organizationId,
      );
      if (!cycle)
        throw new ConflictException('Active PMOC plan has no current cycle');
      await this.ensureSchedulingEvent(plan, cycle.id, actor);
      await this.scheduleDueChecks(plan, actor);
      return this.mapper.summary(plan);
    }
    this.assertTransition(plan.status, 'ACTIVE');

    if (plan.endsOn && plan.endsOn < this.today()) {
      throw new ConflictException(
        'This plan cannot be activated: its validity has already ended',
      );
    }

    const activated = await this.repository.activate(
      id,
      actor.organizationId,
      actor.actorId,
    );
    if (!activated) {
      throw new ConflictException('This plan is no longer activatable');
    }

    await this.ensureSchedulingEvent(
      activated.plan,
      activated.executionId,
      actor,
    );
    await this.scheduleDueChecks(activated.plan, actor);
    return this.mapper.summary(activated.plan);
  }

  async suspend(id: string, actor: PmocActor) {
    const plan = await this.plan(id, actor);
    this.assertTransition(plan.status, 'SUSPENDED');

    const updated = await this.repository.update(
      id,
      actor.organizationId,
      actor.actorId,
      { status: 'SUSPENDED' },
      'PMOC_PLAN_SUSPENDED',
      { status: plan.status },
    );
    return this.mapper.summary(updated);
  }

  /**
   * Cancelar é terminal, e não apaga o histórico.
   *
   * Os ciclos cumpridos continuam registrados: eles são a prova de que a
   * manutenção aconteceu, e um cancelamento posterior não a desfaz.
   */
  async cancel(id: string, actor: PmocActor) {
    const plan = await this.plan(id, actor);
    this.assertTransition(plan.status, 'CANCELLED');

    const updated = await this.repository.update(
      id,
      actor.organizationId,
      actor.actorId,
      { status: 'CANCELLED', nextDueOn: null },
      'PMOC_PLAN_CANCELLED',
      { status: plan.status },
    );
    return this.mapper.summary(updated);
  }

  /* ---------------------------------------------------------------- */
  /* Cobertura                                                         */
  /* ---------------------------------------------------------------- */

  async addCoverage(id: string, actor: PmocActor, input: AddPmocCoverageDto) {
    const plan = await this.plan(id, actor);
    if (plan.status === 'CANCELLED' || plan.status === 'EXPIRED') {
      throw new ConflictException(
        `Equipment cannot be added to a ${plan.status.toLowerCase()} plan`,
      );
    }

    const asset = await this.repository.findAsset(
      input.assetId,
      actor.organizationId,
    );
    /**
     * Equipamento de outro tenant, ou inexistente: a mesma resposta.
     *
     * Um 404 e um 403 diferentes contariam a quem tentou que aquele
     * identificador existe em algum lugar.
     */
    if (!asset) throw new EntityNotFoundException('Asset', input.assetId);

    /**
     * A unidade precisa bater.
     *
     * Quem executa a manutenção é a equipe da unidade do plano; cobrir um
     * equipamento de outra filial produziria uma ordem de serviço que ninguém
     * daquela unidade consegue abrir.
     */
    if (asset.businessUnitId !== plan.businessUnit.id) {
      throw new ValidationException(
        'The equipment belongs to a different business unit than the plan',
      );
    }

    const startsOn = input.startsOn ?? toDateOnly(plan.startsOn);
    this.assertValidity(startsOn, input.endsOn ?? null);

    try {
      const coverage = await this.repository.addCoverage({
        organizationId: actor.organizationId,
        planId: id,
        assetId: input.assetId,
        startsOn: new Date(`${startsOn}T00:00:00.000Z`),
        endsOn: input.endsOn ? new Date(`${input.endsOn}T00:00:00.000Z`) : null,
        notes: input.notes ?? null,
        actorId: actor.actorId,
      });
      return this.mapper.coverage(coverage);
    } catch (error) {
      /** O índice único é a autoridade sobre duplicidade, não uma checagem. */
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'This equipment is already covered by the plan',
        );
      }
      throw error;
    }
  }

  async removeCoverage(id: string, coverageId: string, actor: PmocActor) {
    await this.plan(id, actor);
    const removed = await this.repository.removeCoverage(
      coverageId,
      id,
      actor.organizationId,
      actor.actorId,
    );
    if (!removed) {
      throw new EntityNotFoundException('PmocEquipmentCoverage', coverageId);
    }
  }

  coverages(id: string, actor: PmocActor) {
    return this.plan(id, actor).then(() =>
      this.repository
        .listCoverages(id, actor.organizationId)
        .then((rows) => rows.map((row) => this.mapper.coverage(row))),
    );
  }

  async coveragesPage(
    id: string,
    actor: PmocActor,
    query: PmocCoveragePageQueryDto,
  ): Promise<PmocCursorPageReadModel<PmocCoverageReadModel>> {
    await this.plan(id, actor);
    const cursor = this.decodeCursor<{ name: string; id: string }>(
      query.cursor,
    );
    const rows = await this.repository.listCoveragesPage({
      planId: id,
      organizationId: actor.organizationId,
      limit: query.limit,
      cursor,
      search: query.search,
      status: query.status,
    });
    const hasNextPage = rows.length > query.limit;
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      data: page.map((row) => this.mapper.coverage(row)),
      hasNextPage,
      nextCursor:
        hasNextPage && last
          ? this.encodeCursor({ name: last.asset.name, id: last.id })
          : null,
    };
  }

  async timeline(
    id: string,
    actor: PmocActor,
    query: PmocTimelineQueryDto,
  ): Promise<PmocCursorPageReadModel<PmocTimelineItemReadModel>> {
    await this.plan(id, actor);
    const decoded = this.decodeCursor<{ occurredAt: string; id: string }>(
      query.cursor,
    );
    const cursor = decoded
      ? { occurredAt: new Date(decoded.occurredAt), id: decoded.id }
      : null;
    if (cursor && Number.isNaN(cursor.occurredAt.getTime()))
      throw new ValidationException('Invalid timeline cursor');
    const result = await this.repository.listTimelinePage({
      planId: id,
      organizationId: actor.organizationId,
      limit: query.limit,
      cursor,
    });
    const hasNextPage = result.rows.length > query.limit;
    const rows = result.rows.slice(0, query.limit);
    const assets = new Map(result.assets.map((asset) => [asset.id, asset]));
    const data = rows.map((row) => {
      const values = (row.after ?? {}) as Record<string, unknown>;
      const equipment =
        typeof values.assetId === 'string'
          ? (assets.get(values.assetId) ?? null)
          : null;
      return {
        id: row.id,
        type: row.action,
        message: this.timelineMessage(row.action, equipment?.name),
        occurredAt: row.createdAt.toISOString(),
        actor: row.user,
        equipment,
        data: values,
      };
    });
    const last = rows.at(-1);
    return {
      data,
      hasNextPage,
      nextCursor:
        hasNextPage && last
          ? this.encodeCursor({
              occurredAt: last.createdAt.toISOString(),
              id: last.id,
            })
          : null,
    };
  }

  /* ---------------------------------------------------------------- */
  /* Ciclos                                                            */
  /* ---------------------------------------------------------------- */

  executions(id: string, actor: PmocActor) {
    return this.plan(id, actor).then(() =>
      this.repository
        .listExecutions(id, actor.organizationId, 50)
        .then((rows) => rows.map((row) => this.mapper.execution(row))),
    );
  }

  /**
   * Conclui o ciclo e rola a periodicidade.
   *
   * `performedAt` é quando a manutenção aconteceu — o padrão é agora, mas uma
   * visita de ontem registrada hoje conta como ontem, e a próxima é contada a
   * partir dali.
   */
  async completeExecution(
    planId: string,
    executionId: string,
    actor: PmocActor,
    input: CompletePmocExecutionDto,
  ) {
    const plan = await this.plan(planId, actor);
    const execution = await this.repository.findExecution(
      executionId,
      actor.organizationId,
    );
    if (!execution || execution.planId !== planId) {
      throw new EntityNotFoundException('PmocExecution', executionId);
    }
    if (execution.status !== 'PENDING') {
      throw new ConflictException(
        `This cycle is already ${execution.status.toLowerCase()}`,
      );
    }

    const performedAt = input.performedAt ?? new Date();
    if (performedAt.getTime() > Date.now() + 60_000) {
      throw new ValidationException(
        'A maintenance cannot be recorded in the future',
      );
    }

    if (input.artifactExecutionId) {
      await this.assertEvidence(
        input.artifactExecutionId,
        actor,
        plan.businessUnit.id,
      );
    }

    const rolled = await this.repository.completeExecution({
      executionId,
      planId,
      organizationId: actor.organizationId,
      actorId: actor.actorId,
      performedAt,
      artifactExecutionId: input.artifactExecutionId ?? null,
      notes: input.notes ?? null,
    });

    if (!rolled) {
      throw new ConflictException('This cycle was completed by someone else');
    }

    const refreshed = await this.plan(planId, actor);
    await this.openCycleAndSchedule(refreshed, actor);

    return this.get(planId, actor);
  }

  /**
   * Vincula a evidência documental a um ciclo.
   *
   * A execução de artefato precisa **existir** e ser do tipo PMOC. Criar uma
   * aqui para "ter documento" produziria um formulário que ninguém preencheu —
   * e um PMOC assinado por ninguém é pior que um PMOC ausente.
   */
  async linkEvidence(
    planId: string,
    executionId: string,
    actor: PmocActor,
    input: LinkPmocEvidenceDto,
  ) {
    const plan = await this.plan(planId, actor);
    const execution = await this.repository.findExecution(
      executionId,
      actor.organizationId,
    );
    if (!execution || execution.planId !== planId) {
      throw new EntityNotFoundException('PmocExecution', executionId);
    }

    await this.assertEvidence(
      input.artifactExecutionId,
      actor,
      plan.businessUnit.id,
    );

    try {
      await this.repository.attachEvidence(
        executionId,
        input.artifactExecutionId,
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'This artifact execution is already linked to another PMOC cycle',
        );
      }
      throw error;
    }

    return this.get(planId, actor);
  }

  /**
   * Gera a ordem de serviço do ciclo.
   *
   * **Idempotente**: chamada duas vezes devolve a mesma ordem. O ciclo guarda
   * `operationId` sob trava consultiva — dois cliques, um retry da fila e uma
   * automação disparando ao mesmo tempo convergem para uma ordem só.
   *
   * Técnico e agendamento **não** são atribuídos: são decisões de quem organiza
   * o dia, e escolher por eles produziria uma ordem que ninguém combinou.
   */
  async createOperation(
    planId: string,
    executionId: string,
    actor: PmocActor,
    input: CreatePmocOperationDto,
  ) {
    this.assertPermission(
      actor,
      'operations.create',
      'Generating an operation requires permission to create operations',
    );

    const plan = await this.plan(planId, actor);
    const execution = await this.repository.findExecution(
      executionId,
      actor.organizationId,
    );
    if (!execution || execution.planId !== planId) {
      throw new EntityNotFoundException('PmocExecution', executionId);
    }
    if (execution.status === 'CANCELLED') {
      throw new ConflictException('This cycle was cancelled');
    }

    const asset = await this.repository.firstCoveredAsset(
      planId,
      actor.organizationId,
    );

    const code = await this.operationCode(
      actor.organizationId,
      plan.code,
      execution.dueOn,
    );

    const result = await this.repository.createOperation({
      executionId,
      organizationId: actor.organizationId,
      businessUnitId: plan.businessUnit.id,
      customerId: plan.customer.id,
      assetId: asset?.assetId ?? null,
      actorId: actor.actorId,
      code,
      kind: input.kind ?? 'MAINTENANCE',
      title: `${plan.name} — manutenção ${toDateOnly(execution.dueOn)}`,
      description: `Gerada pelo plano PMOC ${plan.code}.`,
      scheduledStart: input.scheduledStart ?? null,
      scheduledEnd: input.scheduledEnd ?? null,
    });

    return {
      operationId: result.operationId,
      created: result.created,
      plan: await this.get(planId, actor),
    };
  }

  async equipmentExecutionPreparation(
    planId: string,
    cycleId: string,
    assetId: string,
    actor: PmocActor,
  ) {
    const data = await this.repository.executionPreparation(
      actor.organizationId,
      planId,
      cycleId,
      assetId,
    );
    if (!data)
      throw new EntityNotFoundException('PmocEquipmentCoverage', assetId);
    this.assertUnitInScope(actor, data.plan.businessUnitId);
    const technicalResponsibleEligibility = data.plan.technicalResponsibleUserId
      ? await this.workforce.professionalEligibility(
          actor.organizationId,
          data.plan.technicalResponsibleUserId,
          {
            signedAs: 'TECHNICAL_RESPONSIBLE',
            documentType: 'PMOC',
            businessUnitId: data.plan.businessUnitId,
          },
        )
      : null;
    const [fieldTechnicians, auxiliaryTechnicians] = await Promise.all([
      this.workforce.listProfessionals(
        actor.organizationId,
        'FIELD_TECHNICIAN',
        data.plan.businessUnitId,
      ),
      this.workforce.listProfessionals(
        actor.organizationId,
        'FIELD_TECHNICIAN',
        data.plan.businessUnitId,
      ),
    ]);
    const eligibility = executionEligibility({
      planStatus: data.plan.status,
      cycleStatus: data.cycle.status,
      equipmentStatus: data.coverage.asset.status,
      technicalResponsibleUserId: data.plan.technicalResponsibleUserId,
      technicalResponsible: technicalResponsibleEligibility,
    });
    const blockedReasons = eligibility.blockedReasons;
    return {
      plan: {
        id: data.plan.id,
        code: data.plan.code,
        name: data.plan.name,
        reviewRequired: data.plan.reviewRequired,
      },
      cycle: { ...data.cycle, dueOn: toDateOnly(data.cycle.dueOn) },
      customer: {
        id: data.plan.customer.id,
        name: data.plan.customer.tradeName ?? data.plan.customer.legalName,
      },
      equipment: data.coverage.asset,
      serviceLocation: data.plan.serviceLocation,
      scope: data.plan.scope,
      serviceTypes: data.plan.serviceTypes,
      procedure: data.plan.procedure,
      technicalResponsible: data.plan.technicalResponsible,
      technicalResponsibleEligibility,
      fieldTechnicians,
      auxiliaryTechnicians,
      evidencePolicy: {
        minimumPhotos: 0,
        maximumPhotos: 6,
        acceptedKinds: ['PHOTO', 'VIDEO', 'DOCUMENT'],
      },
      documentPolicy: {
        artifactType: 'PMOC',
        signatory: 'TECHNICAL_RESPONSIBLE',
        fieldTechnicianAutoSigns: false,
      },
      suggestedExecutionTime: {
        dueOn: toDateOnly(data.cycle.dueOn),
        timezone: 'America/Recife',
      },
      eligibility,
      existingExecution: data.existing
        ? this.mapper.equipmentExecution(data.existing)
        : null,
      allowedActions: data.existing
        ? data.existing.status === 'IN_PROGRESS'
          ? ['COMPLETE', 'ADD_EVIDENCE']
          : ['VIEW']
        : blockedReasons.length
          ? []
          : ['START'],
    };
  }

  /**
   * Os equipamentos cobertos por um ciclo, com o que cada um pode fazer agora.
   *
   * `eligibility` é a **mesma** função que a preparação usa. Publicá-la aqui
   * existe por um motivo medido: sem ela, a tela pedia a preparação inteira
   * para cada equipamento sem execução — vinte requisições para desenhar vinte
   * linhas. Quatro dos cinco motivos são do plano e do ciclo e se calculam uma
   * vez; o quinto é o estado do próprio equipamento, que já vem na consulta.
   *
   * É uma leitura, e leitura envelhece: entre ver "pronto" e clicar em iniciar,
   * o plano pode ter sido suspenso. Quem decide continua sendo
   * `startEquipmentExecution`, que revalida contra o estado do momento e
   * recusa. O que está aqui informa a tela; não autoriza nada.
   */
  async equipmentExecutions(planId: string, cycleId: string, actor: PmocActor) {
    const plan = await this.plan(planId, actor);
    const [rows, cycle, technicalResponsible] = await Promise.all([
      this.repository.listEquipmentExecutions(
        actor.organizationId,
        planId,
        cycleId,
      ),
      this.repository.findCycle(actor.organizationId, planId, cycleId),
      plan.technicalResponsibleUserId
        ? this.workforce.professionalEligibility(
            actor.organizationId,
            plan.technicalResponsibleUserId,
            {
              signedAs: 'TECHNICAL_RESPONSIBLE',
              documentType: 'PMOC',
              businessUnitId: plan.businessUnit.id,
            },
          )
        : Promise.resolve(null),
    ]);
    if (!cycle) throw new EntityNotFoundException('PmocExecution', cycleId);

    return rows.map((row) => ({
      coverageId: row.id,
      equipment: row.asset,
      execution: row.equipmentExecutions[0]
        ? this.mapper.equipmentExecution(row.equipmentExecutions[0])
        : null,
      status: row.equipmentExecutions[0]?.status ?? 'NOT_STARTED',
      eligibility: executionEligibility({
        planStatus: plan.status,
        cycleStatus: cycle.status,
        equipmentStatus: row.asset.status,
        technicalResponsibleUserId: plan.technicalResponsibleUserId,
        technicalResponsible,
      }),
    }));
  }

  async startEquipmentExecution(
    planId: string,
    cycleId: string,
    assetId: string,
    actor: PmocActor,
    input: StartPmocEquipmentExecutionDto,
  ) {
    this.assertPermission(
      actor,
      'operations.create',
      'Starting PMOC equipment execution requires operations.create',
    );
    const preparation = await this.repository.executionPreparation(
      actor.organizationId,
      planId,
      cycleId,
      assetId,
    );
    if (!preparation)
      throw new EntityNotFoundException('PmocEquipmentCoverage', assetId);
    if (
      preparation.plan.status !== 'ACTIVE' ||
      preparation.cycle.status !== 'PENDING'
    )
      throw new ConflictException(
        'PMOC plan and cycle must be active and pending',
      );
    if (preparation.coverage.asset.status !== 'ACTIVE')
      throw new ConflictException('Equipment is inactive');
    if (!preparation.plan.technicalResponsibleUserId)
      throw new ValidationException('TECHNICAL_RESPONSIBLE_MISSING');
    await this.assertTechnicalResponsible(
      preparation.plan.technicalResponsibleUserId,
      actor,
      preparation.plan.businessUnitId,
      true,
    );
    const professionals = await this.workforce.listProfessionals(
      actor.organizationId,
      'FIELD_TECHNICIAN',
      preparation.plan.businessUnitId,
    );
    const eligible = new Set(professionals.map((item) => item.id));
    if (!eligible.has(input.responsibleFieldTechnicianId))
      throw new ValidationException(
        'Responsible field technician is not eligible for this business unit',
      );
    const auxiliaries = [...new Set(input.auxiliaryTechnicianIds ?? [])].filter(
      (id) => id !== input.responsibleFieldTechnicianId,
    );
    if (auxiliaries.some((id) => !eligible.has(id)))
      throw new ValidationException(
        'One or more auxiliary technicians are not eligible for this business unit',
      );
    const result = await this.repository.startEquipmentExecution({
      organizationId: actor.organizationId,
      planId,
      cycleId,
      coverageId: preparation.coverage.id,
      assetId,
      businessUnitId: preparation.plan.businessUnitId,
      customerId: preparation.plan.customer.id,
      responsibleFieldTechnicianId: input.responsibleFieldTechnicianId,
      auxiliaryTechnicianIds: auxiliaries,
      actorId: actor.actorId,
      procedureSnapshot: preparation.plan.procedure as never,
      technicalResponsibleSnapshot: {
        userId: preparation.plan.technicalResponsible!.id,
        displayName: preparation.plan.technicalResponsible!.displayName,
        signature: preparation.technicalResponsibleSignature,
        credential: preparation.technicalResponsibleCredential,
      },
      code: await this.operationCode(
        actor.organizationId,
        `${preparation.plan.code}-${preparation.coverage.asset.identifier ?? preparation.coverage.asset.id.slice(0, 8)}`,
        preparation.cycle.dueOn,
      ),
      title: `${preparation.plan.name} — ${preparation.coverage.asset.name}`,
    });
    return {
      created: result.created,
      execution: this.mapper.equipmentExecution(result.execution),
    };
  }

  async addEquipmentEvidence(
    executionId: string,
    actor: PmocActor,
    input: AddPmocEquipmentEvidenceDto,
  ) {
    const result = await this.repository.addEquipmentEvidence({
      organizationId: actor.organizationId,
      executionId,
      storageFileId: input.storageFileId,
      kind: input.kind ?? 'PHOTO',
      caption: input.caption ?? null,
      actorId: actor.actorId,
    });
    if (!result)
      throw new EntityNotFoundException(
        'PmocEquipmentExecutionOrStorageFile',
        executionId,
      );
    if (result.limitReached)
      throw new ConflictException(
        'A PMOC equipment execution accepts at most 6 evidence files',
      );
    return { id: result.evidence.id };
  }

  async linkEquipmentArtifact(
    executionId: string,
    actor: PmocActor,
    input: LinkPmocEvidenceDto,
  ) {
    this.assertPermission(
      actor,
      'artifact_executions.read',
      'Linking the PMOC document requires artifact_executions.read',
    );
    const result = await this.repository.linkEquipmentArtifact(
      actor.organizationId,
      executionId,
      input.artifactExecutionId,
    );
    if (!result)
      throw new EntityNotFoundException('PmocEquipmentExecution', executionId);
    if (result.invalidArtifact)
      throw new ValidationException(
        'Artifact must be a PMOC execution for the same equipment and business unit',
      );
    return { executionId, artifactExecutionId: input.artifactExecutionId };
  }

  async generateEquipmentArtifact(
    executionId: string,
    actor: PmocActor,
    input: GeneratePmocEquipmentArtifactDto,
  ) {
    this.assertPermission(
      actor,
      'artifact_rendering.render',
      'Generating the PMOC document requires artifact_rendering.render',
    );
    const result = await this.repository.createEquipmentArtifact(
      actor.organizationId,
      executionId,
      actor.actorId,
    );
    if (!result)
      throw new EntityNotFoundException(
        'CompletedPmocEquipmentExecutionOrTemplate',
        executionId,
      );
    if (
      result.renderStatus === 'NOT_RENDERED' ||
      result.renderStatus === 'FAILED'
    ) {
      await this.rendering.request(
        result.artifactExecutionId,
        { organizationId: actor.organizationId, actorId: actor.actorId },
        {
          renderer: input.renderer,
          metadata: {
            sourceType: 'PMOC_EQUIPMENT_EXECUTION',
            sourceEntityId: executionId,
          },
        },
      );
    }
    return {
      artifactExecutionId: result.artifactExecutionId,
      created: result.created,
      sourceType: 'PMOC_EQUIPMENT_EXECUTION',
      sourceEntityId: executionId,
    };
  }

  async completeEquipmentExecution(
    planId: string,
    cycleId: string,
    executionId: string,
    actor: PmocActor,
    input: CompletePmocEquipmentExecutionDto,
  ) {
    const performedAt = input.performedAt ?? new Date();
    if (performedAt.getTime() > Date.now() + 60_000)
      throw new ValidationException(
        'A maintenance cannot be recorded in the future',
      );
    const result = await this.repository.completeEquipmentExecution({
      organizationId: actor.organizationId,
      planId,
      cycleId,
      executionId,
      actorId: actor.actorId,
      performedAt,
      notes: input.notes ?? null,
    });
    if (!result)
      throw new ConflictException('Equipment execution is not in progress');
    if (result.allResolved) {
      const refreshed = await this.plan(planId, actor);
      await this.openCycleAndSchedule(refreshed, actor);
    }
    return {
      execution: this.mapper.equipmentExecution(result.execution),
      cycleCompleted: result.allResolved,
    };
  }

  /* ---------------------------------------------------------------- */
  /* Conformidade                                                      */
  /* ---------------------------------------------------------------- */

  async compliance(
    actor: PmocActor,
    query: PmocAnalyticsQueryDto,
  ): Promise<PmocComplianceSummaryReadModel> {
    const summary = await this.repository.complianceSummary(
      actor.organizationId,
      query,
    );

    const upToDate = Number(summary.plans?.up_to_date ?? 0);
    const dueSoon = Number(summary.plans?.due_soon ?? 0);
    const overdue = Number(summary.plans?.overdue ?? 0);
    const evaluated = upToDate + dueSoon + overdue;

    return {
      period: {
        from: summary.period.from.toISOString(),
        to: summary.period.to.toISOString(),
      },
      plans: {
        total: Number(summary.plans?.total ?? 0),
        draft: Number(summary.plans?.draft ?? 0),
        active: Number(summary.plans?.active ?? 0),
        suspended: Number(summary.plans?.suspended ?? 0),
        expired: Number(summary.plans?.expired ?? 0),
        cancelled: Number(summary.plans?.cancelled ?? 0),
      },
      compliance: {
        upToDate,
        dueSoon,
        overdue,
        /**
         * `em dia ÷ avaliados`, com uma casa.
         *
         * `null` quando não há plano ativo: "100%" de nada afirmaria uma
         * conformidade que ninguém está mantendo — e é justamente o número que
         * alguém levaria para uma reunião.
         */
        upToDateRate:
          evaluated === 0 ? null : ((upToDate / evaluated) * 100).toFixed(1),
      },
      equipment: { covered: Number(summary.equipment?.covered ?? 0) },
      executions: {
        completedInPeriod: Number(summary.executions?.completed ?? 0),
        pending: Number(summary.executions?.pending ?? 0),
        overdue: Number(summary.executions?.overdue ?? 0),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async upcoming(
    actor: PmocActor,
    query: PmocUpcomingQueryDto,
  ): Promise<PmocUpcomingReadModel[]> {
    const rows = await this.repository.upcoming(actor.organizationId, query);
    const now = new Date();

    return rows.map((row) => {
      const evaluated = evaluateCompliance({
        planStatus: 'ACTIVE',
        nextDueOn: row.due_on,
        dueSoonDays: row.due_soon_days,
        today: now,
      });

      return {
        planId: row.plan_id,
        planCode: row.plan_code,
        planName: row.plan_name,
        executionId: row.execution_id,
        dueOn: toDateOnly(row.due_on),
        daysUntilDue: evaluated.daysUntilDue,
        compliance: evaluated.status,
        businessUnit: {
          id: row.business_unit_id,
          name: row.business_unit_name,
        },
        customer: { id: row.customer_id, name: row.customer_name },
        coveredEquipment: Number(row.covered),
      };
    });
  }

  /* ---------------------------------------------------------------- */
  /* Internos                                                          */
  /* ---------------------------------------------------------------- */

  private async plan(id: string, actor: PmocActor) {
    const plan = await this.repository.find(id, actor.organizationId);
    if (!plan) throw new EntityNotFoundException('PmocPlan', id);
    return plan;
  }

  /**
   * Abre o ciclo do vencimento atual, põe na Agenda e agenda o aviso.
   *
   * Idempotente de ponta a ponta: o ciclo tem índice único por vencimento, o
   * evento de agenda só é criado quando o ciclo ainda não tem um, e o job de
   * aviso usa uma `jobKey` derivada do vencimento.
   */
  private async openCycleAndSchedule(
    plan: Awaited<ReturnType<PmocRepository['find']>>,
    actor: PmocActor,
  ): Promise<void> {
    if (!plan || plan.status !== 'ACTIVE' || !plan.nextDueOn) return;

    const executionId = await this.repository.openCycle(
      actor.organizationId,
      plan.id,
      plan.nextDueOn,
    );
    if (!executionId) return;

    await this.ensureSchedulingEvent(plan, executionId, actor);
    await this.scheduleDueChecks(plan, actor);
  }

  /**
   * O compromisso entra na **Agenda existente**.
   *
   * Um `SchedulingEvent` com `sourceModule: 'pmoc'` — não uma agenda paralela,
   * não uma recorrência própria. A recorrência do PMOC é o próprio plano: cada
   * ciclo cria o evento do seu vencimento, e o seguinte nasce quando este for
   * cumprido. Uma regra de recorrência no Scheduling duplicaria a periodicidade
   * em dois lugares, e elas divergiriam no primeiro atraso.
   */
  private async ensureSchedulingEvent(
    plan: NonNullable<Awaited<ReturnType<PmocRepository['find']>>>,
    executionId: string,
    actor: PmocActor,
  ): Promise<void> {
    if (plan.schedulingPaused) return;
    const execution = await this.repository.findExecution(
      executionId,
      actor.organizationId,
    );
    if (!execution || execution.schedulingEventId) return;

    const calendar = await this.repository.defaultCalendar(
      actor.organizationId,
      plan.businessUnit.id,
    );
    /** Sem calendário não há onde marcar — e o plano continua válido. */
    if (!calendar || !plan.nextDueOn) return;

    const startsAt = instantFromCivilDate(
      toDateOnly(plan.nextDueOn),
      calendar.timezone,
      12,
    );
    const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);

    await this.repository.ensureSchedulingEvent(executionId, {
      id: generateUuidV7(),
      organizationId: actor.organizationId,
      businessUnitId: plan.businessUnit.id,
      calendarId: calendar.id,
      customerId: plan.customer.id,
      createdById: actor.actorId,
      title: `PMOC ${plan.code} — manutenção prevista`,
      description: plan.name,
      type: 'MAINTENANCE',
      status: 'TENTATIVE',
      startsAt,
      endsAt,
      timezone: calendar.timezone,
      sourceModule: 'pmoc',
      sourceEntityType: 'PMOC_PLAN',
      sourceEntityId: plan.id,
      metadata: { executionId, dueOn: toDateOnly(plan.nextDueOn) },
    });
  }

  /**
   * Agenda os dois avisos deste vencimento, na fila que já existe.
   *
   * Um job para o momento em que o plano entra em "próximo do vencimento" e
   * outro para o dia seguinte ao vencimento. **Não é um cron**: são dois jobs
   * com `available_at`, derivados do vencimento do plano, e a `jobKey` os torna
   * idempotentes — reativar o plano dez vezes não cria vinte avisos.
   *
   * O que torna isso correto sem varredura global: o próximo ciclo agenda os
   * seus próprios avisos quando é criado. Ninguém precisa abrir tela nenhuma.
   */
  private async scheduleDueChecks(
    plan: NonNullable<Awaited<ReturnType<PmocRepository['find']>>>,
    actor: PmocActor,
  ): Promise<void> {
    if (!plan.nextDueOn || plan.schedulingPaused) return;

    const dueOn = toDateOnly(plan.nextDueOn);
    const dueAt = new Date(`${dueOn}T09:00:00.000Z`);
    const warnAt = new Date(
      dueAt.getTime() - plan.dueSoonDays * 24 * 60 * 60 * 1000,
    );
    const overdueAt = new Date(dueAt.getTime() + 24 * 60 * 60 * 1000);

    for (const [phase, availableAt] of [
      ['DUE_SOON', warnAt],
      ['OVERDUE', overdueAt],
    ] as const) {
      await this.jobs.enqueue({
        queue: JOB_QUEUES.pmocDueCheck,
        jobKey: `pmoc:${plan.id}:${dueOn}:${phase}`,
        organizationId: actor.organizationId,
        /** O aviso é do plano, e o plano é de uma unidade. */
        scope: 'BUSINESS_UNIT',
        businessUnitId: plan.businessUnit.id,
        payload: { planId: plan.id, dueOn, phase },
        correlationId: generateUuidV7(),
        actorUserId: actor.actorId,
        /** No passado significa "agora": a fila não olha para trás. */
        availableAt: availableAt < new Date() ? new Date() : availableAt,
      });
    }
  }

  private assertTransition(from: string, to: PlanStatus): void {
    if (!canTransition(from, to)) {
      throw new ConflictException(
        `A ${from.toLowerCase()} plan cannot become ${to.toLowerCase()}`,
      );
    }
  }

  private async assertTechnicalResponsible(
    userId: string,
    actor: PmocActor,
    businessUnitId: string,
    requireSignature = false,
  ): Promise<void> {
    const professionals = await this.workforce.listProfessionals(
      actor.organizationId,
      'TECHNICAL_RESPONSIBLE',
      businessUnitId,
    );
    const professional = professionals.find((item) => item.id === userId);
    if (
      !professional ||
      (requireSignature && !professional.signatureAvailable)
    ) {
      throw new ValidationException(
        `Technical responsible is not eligible for PMOC: ${professional ? 'SIGNATURE_MISSING' : 'PROFESSIONAL_ROLE_OR_SCOPE_MISSING'}`,
      );
    }
  }

  private assertValidity(startsOn: string, endsOn: string | null): void {
    if (!DATE_ONLY.test(startsOn)) {
      throw new ValidationException('startsOn must be YYYY-MM-DD');
    }
    if (!endsOn) return;
    if (!DATE_ONLY.test(endsOn)) {
      throw new ValidationException('endsOn must be YYYY-MM-DD');
    }
    if (endsOn < startsOn) {
      throw new ValidationException('The validity ends before it starts');
    }
  }

  /**
   * A unidade precisa estar no recorte da sessão.
   *
   * A RLS já recusaria a escrita, mas com um erro de banco. Aqui a recusa é de
   * negócio, com a razão dita.
   */
  private assertUnitInScope(actor: PmocActor, businessUnitId: string): void {
    if (
      actor.businessUnitIds.length > 0 &&
      !actor.businessUnitIds.includes(businessUnitId)
    ) {
      throw new ForbiddenException('This business unit is out of your scope');
    }
  }

  private assertPermission(
    actor: PmocActor,
    permission: string,
    message: string,
  ): void {
    const granted = new Set(actor.permissions);
    if (!granted.has('*') && !granted.has(permission)) {
      throw new ForbiddenException(message);
    }
  }

  /**
   * A evidência precisa ser uma execução de artefato **de PMOC**.
   *
   * Vincular um checklist de instalação como evidência de PMOC produziria um
   * histórico que parece conforme e não é. O tipo vem do template, que é a
   * autoridade sobre o que aquele documento é.
   */
  private async assertEvidence(
    artifactExecutionId: string,
    actor: PmocActor,
    businessUnitId: string,
  ): Promise<void> {
    this.assertPermission(
      actor,
      'artifact_executions.read',
      'Linking evidence requires access to artifact executions',
    );

    const execution = await this.repository.findArtifactExecution(
      artifactExecutionId,
      actor.organizationId,
    );
    if (!execution) {
      throw new EntityNotFoundException(
        'ArtifactExecution',
        artifactExecutionId,
      );
    }
    if (execution.businessUnitId !== businessUnitId) {
      throw new ValidationException(
        'The evidence belongs to a different business unit than the plan',
      );
    }
    if (!execution.template.artifactType.toUpperCase().includes('PMOC')) {
      throw new ValidationException(
        `The evidence must be a PMOC artifact execution (received: ${execution.template.artifactType})`,
      );
    }
  }

  /**
   * Código da ordem gerada.
   *
   * Deriva do plano e do vencimento — `OS-PMOC-2026-001-2026-07-01` — para que a
   * origem seja legível na listagem de operações sem abrir nada. Ocupado, um
   * sufixo curto resolve; o índice único do banco continua sendo a autoridade.
   */
  private async operationCode(
    organizationId: string,
    planCode: string,
    dueOn: Date,
  ): Promise<string> {
    const seed = `OS-${planCode}-${toDateOnly(dueOn)}`
      .toUpperCase()
      .slice(0, 60);
    const taken = await this.repository.operationCodeTaken(
      organizationId,
      seed,
    );
    if (!taken) return seed;
    return `${seed}-${Date.now().toString(36).slice(-4)}`
      .toUpperCase()
      .slice(0, 60);
  }

  private encodeCursor(value: Record<string, string>): string {
    return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  }

  private decodeCursor<T>(cursor?: string): T | null {
    if (!cursor) return null;
    try {
      const value = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as T;
      if (!value || typeof value !== 'object') throw new Error('invalid');
      return value;
    } catch {
      throw new ValidationException('Invalid pagination cursor');
    }
  }

  private timelineMessage(action: string, equipmentName?: string): string {
    const equipment = equipmentName ? ` ${equipmentName}` : '';
    const messages: Record<string, string> = {
      PMOC_PLAN_CREATED: 'Plano PMOC criado.',
      PMOC_PLAN_ACTIVATED: 'Plano PMOC ativado e primeiro ciclo criado.',
      PMOC_COVERAGE_ADDED: `Equipamento${equipment} adicionado à cobertura.`,
      PMOC_COVERAGE_REMOVED: 'Equipamento removido da cobertura.',
      PMOC_EQUIPMENT_EXECUTION_STARTED: `Execução do equipamento${equipment} iniciada.`,
      PMOC_EQUIPMENT_EXECUTION_COMPLETED: `Execução do equipamento${equipment} concluída.`,
      PMOC_EQUIPMENT_ARTIFACT_CREATED: `Documento do equipamento${equipment} gerado.`,
      PMOC_EXECUTION_COMPLETED:
        'Ciclo PMOC concluído e próximo ciclo programado.',
    };
    return messages[action] ?? 'Plano PMOC atualizado.';
  }

  private today(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }
}

/** Reexportado para o processador do job, que compõe o mesmo tipo. */
export type { FrequencyUnit };
