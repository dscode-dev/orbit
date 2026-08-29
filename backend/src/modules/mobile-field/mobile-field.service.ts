/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { Injectable, Logger } from '@nestjs/common';
import { EntityNotFoundException, ForbiddenException } from '../../exceptions';
import { civilDateKey } from '../scheduling/scheduling-time';
import type { MobileWorkQueueQueryDto } from './mobile-field.dto';
import { MobileFieldRepository } from './mobile-field.repository';
import type {
  MobileArtifactSummaryReadModel,
  MobileCustomerSummaryReadModel,
  MobileDueState,
  MobileEquipmentSummaryReadModel,
  MobileFieldAction,
  MobileFieldContextReadModel,
  MobileFieldDashboardReadModel,
  MobileWorkItemReadModel,
  MobileWorkQueueReadModel,
} from './mobile-field.read-models';

export interface MobileFieldActor {
  id: string;
  organizationId: string;
  businessUnitIds: readonly string[];
  permissions: readonly string[];
}

@Injectable()
export class MobileFieldService {
  private readonly logger = new Logger(MobileFieldService.name);
  constructor(private readonly repository: MobileFieldRepository) {}

  async dashboard(
    actor: MobileFieldActor,
  ): Promise<MobileFieldDashboardReadModel> {
    const started = performance.now();
    const items = await this.items(actor);
    const visible = items.filter((item) => this.matchesPermission(item));
    const result = {
      next:
        visible.find(
          (item) =>
            item.dueState !== 'IN_PROGRESS' && item.dueState !== 'OVERDUE',
        ) ?? null,
      counters: {
        today: visible.filter((item) => item.dueState === 'DUE_TODAY').length,
        overdue: visible.filter((item) => item.dueState === 'OVERDUE').length,
        inProgress: visible.filter((item) => item.dueState === 'IN_PROGRESS')
          .length,
        upcoming: visible.filter((item) => item.dueState === 'UPCOMING').length,
      },
      today: visible
        .filter((item) => item.dueState === 'DUE_TODAY')
        .slice(0, 5),
      overdue: visible
        .filter((item) => item.dueState === 'OVERDUE')
        .slice(0, 5),
      inProgress: visible
        .filter((item) => item.dueState === 'IN_PROGRESS')
        .slice(0, 5),
      capabilities: {
        canScanEquipment: this.has(actor, 'assets.read'),
        canCreateAdHocRvt: this.has(actor, 'rvt.execute'),
      },
    };
    this.metric('dashboard', started, visible.length);
    return result;
  }

  async workQueue(
    actor: MobileFieldActor,
    query: MobileWorkQueueQueryDto,
  ): Promise<MobileWorkQueueReadModel> {
    const started = performance.now();
    const view = query.view ?? 'ALL';
    let items = (await this.items(actor)).filter(
      (item) =>
        this.matchesPermission(item) &&
        (!query.kind || item.kind === query.kind) &&
        (view === 'ALL' || this.matchesView(item.dueState, view)),
    );
    const cursor = query.cursor ? this.decodeCursor(query.cursor) : null;
    if (cursor) {
      const index = items.findIndex((item) => item.id === cursor.id);
      if (index < 0)
        throw new ForbiddenException('Cursor da fila de campo inválido');
      items = items.slice(index + 1);
    }
    const limit = query.limit ?? 20;
    const page = items.slice(0, limit + 1);
    const hasNextPage = page.length > limit;
    const data = page.slice(0, limit);
    const last = data.at(-1);
    const result = {
      data,
      meta: {
        limit,
        hasNextPage,
        nextCursor: hasNextPage && last ? this.encodeCursor(last.id) : null,
      },
    };
    this.metric('work_queue', started, data.length);
    return result;
  }

  async fieldContext(
    actor: MobileFieldActor,
    canonicalId: string,
  ): Promise<MobileFieldContextReadModel> {
    const item = (await this.items(actor)).find(
      (candidate) =>
        candidate.id === canonicalId && this.matchesPermission(candidate),
    );
    if (!item) throw new EntityNotFoundException('MobileWorkItem', canonicalId);
    return {
      workItem: item,
      request: { description: item.description },
      procedures: [],
      documentContext: item.artifacts,
      snapshotVersion: 1,
    };
  }

  private async items(
    actor: MobileFieldActor,
  ): Promise<MobileWorkItemReadModel[]> {
    if (!actor.organizationId || !actor.businessUnitIds.length) return [];
    const source = await this.repository.project(
      actor.organizationId,
      actor.id,
      actor.businessUnitIds,
    );
    const units = new Map(source.businessUnits.map((unit) => [unit.id, unit]));
    const customers = new Map(
      source.customers.map((customer) => [customer.id, customer]),
    );
    const assets = new Map(source.rvtAssets.map((asset) => [asset.id, asset]));
    const result: MobileWorkItemReadModel[] = [];

    for (const operation of source.operations) {
      const unit = units.get(operation.businessUnitId);
      if (!unit) continue;
      const actions = this.operationActions(operation, actor);
      result.push({
        id: `SERVICE_OPERATION:${operation.id}`,
        kind: 'SERVICE_OPERATION',
        sourceId: operation.id,
        schedulingId: null,
        title: operation.title,
        description: operation.description,
        businessUnit: this.party(unit),
        customer: this.customer(customers.get(operation.customerId), actor),
        location:
          operation.location ??
          customers.get(operation.customerId)?.address ??
          null,
        scheduledFor: operation.scheduledStart?.toISOString() ?? null,
        scheduledEnd: operation.scheduledEnd?.toISOString() ?? null,
        timezone: unit.timezone,
        dueState: this.dueState(
          operation.status,
          operation.scheduledStart,
          unit.timezone,
        ),
        operationalStatus: operation.status,
        priority: operation.priority,
        responsibleFieldTechnician: operation.responsibleFieldTechnician
          ? this.party(operation.responsibleFieldTechnician)
          : null,
        auxiliaryTechnicians: operation.auxiliaryTechnicians.map((value: any) =>
          this.party(value.user),
        ),
        equipmentSummary: operation.asset
          ? [this.equipment(operation.asset)]
          : [],
        artifacts: operation.artifactExecutions.map((value: any) =>
          this.artifact(value),
        ),
        allowedActions: actions,
        primaryAction: this.primary(actions),
        navigationContext: {
          kind: 'SERVICE_OPERATION',
          sourceId: operation.id,
          executionId: null,
          occurrenceId: null,
          cycleId: null,
          equipmentId: operation.assetId,
        },
        updatedAt: operation.updatedAt.toISOString(),
      });
    }

    for (const cycle of source.pmocCycles) {
      const unit = units.get(cycle.plan.businessUnitId);
      if (!unit) continue;
      for (const coverage of cycle.plan.coverages) {
        const execution = cycle.equipmentExecutions.find(
          (value: any) => value.coverageId === coverage.id,
        );
        if (
          execution &&
          execution.responsibleFieldTechnician.id !== actor.id &&
          !execution.operation?.auxiliaryTechnicians.some(
            (value: any) => value.user.id === actor.id,
          )
        )
          continue;
        const actions = this.pmocActions(cycle, execution, actor);
        result.push({
          id: `PMOC:${cycle.id}:${coverage.asset.id}`,
          kind: 'PMOC',
          sourceId: cycle.id,
          schedulingId: cycle.schedulingEventId,
          title: `${cycle.plan.name} — ${coverage.asset.name}`,
          description: `Ciclo PMOC ${cycle.plan.code}`,
          businessUnit: this.party(unit),
          customer: this.customer(customers.get(cycle.plan.customerId), actor),
          location:
            cycle.plan.serviceLocation ??
            customers.get(cycle.plan.customerId)?.address ??
            null,
          scheduledFor: cycle.dueOn.toISOString(),
          scheduledEnd: null,
          timezone: unit.timezone,
          dueState: this.dueState(
            execution?.status ?? cycle.status,
            cycle.dueOn,
            unit.timezone,
            true,
          ),
          operationalStatus: execution?.status ?? cycle.status,
          priority: null,
          responsibleFieldTechnician: execution?.responsibleFieldTechnician
            ? this.party(execution.responsibleFieldTechnician)
            : cycle.plan.technician
              ? this.party(cycle.plan.technician)
              : null,
          auxiliaryTechnicians: (
            execution?.operation?.auxiliaryTechnicians ?? []
          ).map((value: any) => this.party(value.user)),
          equipmentSummary: [this.equipment(coverage.asset)],
          artifacts: cycle.artifactExecution
            ? [this.artifact(cycle.artifactExecution)]
            : [],
          allowedActions: actions,
          primaryAction: this.primary(actions),
          navigationContext: {
            kind: 'PMOC',
            sourceId: cycle.id,
            executionId: execution?.id ?? null,
            occurrenceId: null,
            cycleId: cycle.id,
            equipmentId: coverage.asset.id,
          },
          updatedAt: cycle.updatedAt.toISOString(),
        });
      }
    }

    for (const occurrence of source.rvtOccurrences) {
      const unit = units.get(occurrence.businessUnitId);
      if (!unit) continue;
      const configuration = occurrence.configuration;
      const actions = this.rvtActions(occurrence, actor);
      result.push({
        id: `RVT:${occurrence.id}`,
        kind: 'RVT',
        sourceId: occurrence.id,
        schedulingId: occurrence.schedulingEventId,
        title: configuration.name,
        description: configuration.visitType,
        businessUnit: this.party(unit),
        customer: this.customer(customers.get(configuration.customerId), actor),
        location:
          configuration.serviceLocation ??
          customers.get(configuration.customerId)?.address ??
          null,
        scheduledFor: occurrence.scheduledFor?.toISOString() ?? null,
        scheduledEnd: null,
        timezone: configuration.timezone || unit.timezone,
        dueState: this.dueState(
          occurrence.execution?.status ?? occurrence.status,
          occurrence.scheduledFor,
          configuration.timezone || unit.timezone,
        ),
        operationalStatus: occurrence.execution?.status ?? occurrence.status,
        priority: null,
        responsibleFieldTechnician:
          configuration.defaultResponsibleFieldTechnicianId
            ? {
                id: configuration.defaultResponsibleFieldTechnicianId,
                name: 'Técnico responsável',
              }
            : null,
        auxiliaryTechnicians: [],
        equipmentSummary: configuration.equipment
          .map((value: any) => assets.get(value.assetId))
          .filter(Boolean)
          .slice(0, 20)
          .map((value: any) => this.equipment(value)),
        artifacts: [],
        allowedActions: actions,
        primaryAction: this.primary(actions),
        navigationContext: {
          kind: 'RVT',
          sourceId: occurrence.id,
          executionId: occurrence.execution?.id ?? null,
          occurrenceId: occurrence.id,
          cycleId: null,
          equipmentId: null,
        },
        updatedAt: occurrence.updatedAt.toISOString(),
      });
    }
    return result.sort((a, b) => this.compare(a, b));
  }

  private operationActions(
    source: any,
    actor: MobileFieldActor,
  ): MobileFieldAction[] {
    const actions: MobileFieldAction[] = [];
    if (this.has(actor, 'operations.read')) actions.push('VIEW');
    if (source.location) actions.push('OPEN_ROUTE');
    if (
      source.status === 'IN_PROGRESS' &&
      this.has(actor, 'operations.status.update')
    )
      actions.push('RESUME');
    if (
      ['OPEN', 'SCHEDULED'].includes(source.status) &&
      this.has(actor, 'operations.status.update')
    )
      actions.push('START');
    if (
      source.status === 'IN_PROGRESS' &&
      this.has(actor, 'operations.status.update')
    )
      actions.push('COMPLETE');
    if (this.has(actor, 'operations.attachments.create'))
      actions.push('ADD_EVIDENCE');
    if (
      source.artifactExecutions.length &&
      this.has(actor, 'artifact_executions.read')
    )
      actions.push('VIEW_DOCUMENT', 'DOWNLOAD_DOCUMENT');
    if (source.asset && this.has(actor, 'assets.read'))
      actions.push('SCAN_EQUIPMENT');
    return actions;
  }

  private pmocActions(
    cycle: any,
    execution: any,
    actor: MobileFieldActor,
  ): MobileFieldAction[] {
    const actions: MobileFieldAction[] = [];
    if (this.has(actor, 'pmoc.read')) actions.push('VIEW');
    if (execution?.status === 'IN_PROGRESS' && this.has(actor, 'pmoc.execute'))
      actions.push('RESUME', 'ADD_EVIDENCE', 'COMPLETE');
    if (
      !execution &&
      cycle.plan.technicalResponsibleUserId &&
      this.has(actor, 'pmoc.execute')
    )
      actions.push('EXECUTE_PMOC');
    if (cycle.artifactExecution && this.has(actor, 'artifact_executions.read'))
      actions.push('VIEW_DOCUMENT', 'DOWNLOAD_DOCUMENT');
    if (this.has(actor, 'assets.read')) actions.push('SCAN_EQUIPMENT');
    return actions;
  }

  private rvtActions(
    source: any,
    actor: MobileFieldActor,
  ): MobileFieldAction[] {
    const actions: MobileFieldAction[] = [];
    if (this.has(actor, 'rvt.read')) actions.push('VIEW');
    if (
      !source.execution &&
      source.status === 'SCHEDULED' &&
      this.has(actor, 'rvt.execute')
    )
      actions.push('EXECUTE_RVT');
    if (
      source.execution?.status === 'IN_PROGRESS' &&
      this.has(actor, 'rvt.execute')
    )
      actions.push('RESUME', 'ADD_EVIDENCE', 'COMPLETE');
    if (this.has(actor, 'assets.read')) actions.push('SCAN_EQUIPMENT');
    return actions;
  }

  private dueState(
    status: string,
    at: Date | null,
    timezone: string,
    dateOnly = false,
  ): MobileDueState {
    if (['IN_PROGRESS', 'STARTED', 'PAUSED'].includes(status))
      return 'IN_PROGRESS';
    if (!at) return 'UNSCHEDULED';
    const itemDate = dateOnly
      ? at.toISOString().slice(0, 10)
      : civilDateKey(at, timezone);
    const today = civilDateKey(new Date(), timezone);
    if (itemDate < today) return 'OVERDUE';
    if (itemDate === today) return 'DUE_TODAY';
    return 'UPCOMING';
  }

  private matchesPermission(item: MobileWorkItemReadModel): boolean {
    return item.allowedActions.includes('VIEW');
  }
  private matchesView(state: MobileDueState, view: string): boolean {
    return (
      (view === 'TODAY' && state === 'DUE_TODAY') ||
      (view === 'OVERDUE' && state === 'OVERDUE') ||
      (view === 'IN_PROGRESS' && state === 'IN_PROGRESS') ||
      (view === 'UPCOMING' && state === 'UPCOMING')
    );
  }
  private compare(
    a: MobileWorkItemReadModel,
    b: MobileWorkItemReadModel,
  ): number {
    const rank = {
      IN_PROGRESS: 0,
      OVERDUE: 1,
      DUE_TODAY: 2,
      UPCOMING: 3,
      UNSCHEDULED: 4,
    };
    return (
      rank[a.dueState] - rank[b.dueState] ||
      (a.scheduledFor ?? '9999').localeCompare(b.scheduledFor ?? '9999') ||
      a.id.localeCompare(b.id)
    );
  }
  private has(actor: MobileFieldActor, permission: string): boolean {
    return (
      actor.permissions.includes('*') || actor.permissions.includes(permission)
    );
  }
  private party(value: any) {
    return {
      id: value.id,
      name: value.displayName ?? value.tradeName ?? value.legalName,
    };
  }
  private customer(
    value: any,
    actor: MobileFieldActor,
  ): MobileCustomerSummaryReadModel | null {
    if (!value) return null;
    const revealContact = this.has(actor, 'customers.read');
    return {
      id: value.id,
      name: value.tradeName ?? value.legalName,
      address: value.address ?? null,
      contact:
        revealContact && value.contacts[0] ? { ...value.contacts[0] } : null,
    };
  }
  private equipment(value: any): MobileEquipmentSummaryReadModel {
    return {
      id: value.id,
      code: value.identifier,
      name: value.name,
      type: value.category,
      brand: value.manufacturer,
      model: value.model,
      sector: value.location,
      status: value.status,
      qrAvailable: value.qrIdentities.length > 0,
    };
  }
  private artifact(value: any): MobileArtifactSummaryReadModel {
    return {
      id: value.id,
      type: value.snapshot.artifactType,
      status: value.status,
      previewAvailable: value.renderStatus === 'COMPLETED',
      downloadAvailable: value.renderStatus === 'COMPLETED',
    };
  }
  private primary(
    actions: readonly MobileFieldAction[],
  ): MobileFieldAction | null {
    return (
      (['RESUME', 'EXECUTE_PMOC', 'EXECUTE_RVT', 'START', 'VIEW'].find(
        (value) => actions.includes(value as MobileFieldAction),
      ) as MobileFieldAction | undefined) ?? null
    );
  }
  private encodeCursor(id: string): string {
    return Buffer.from(JSON.stringify({ v: 1, id }), 'utf8').toString(
      'base64url',
    );
  }
  private decodeCursor(value: string): { id: string } {
    try {
      const result = JSON.parse(
        Buffer.from(value, 'base64url').toString('utf8'),
      ) as { v?: unknown; id?: unknown };
      if (result.v !== 1 || typeof result.id !== 'string') throw new Error();
      return { id: result.id };
    } catch {
      throw new ForbiddenException('Cursor da fila de campo inválido');
    }
  }
  private metric(operation: string, started: number, count: number): void {
    this.logger.log(
      JSON.stringify({
        metric: `mobile_field_${operation}_requests`,
        durationMs: Number((performance.now() - started).toFixed(2)),
        itemsReturned: count,
      }),
    );
  }
}
