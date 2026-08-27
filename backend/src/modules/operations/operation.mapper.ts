import { Injectable } from '@nestjs/common';
import type {
  OperationKind,
  OperationPriority,
  OperationStatus,
} from '../../contracts';
import type {
  OperationAssignmentReadModel,
  OperationAttachmentReadModel,
  OperationDetailsReadModel,
  OperationHistoryReadModel,
  OperationListItemReadModel,
  OperationListReadModel,
  OperationTimelineAttachmentReadModel,
  OperationTimelineReadModel,
  OperationAllowedAction,
  OperationUserReadModel,
} from './operation.read-models';
import { OperationStateMachine } from './operation-state-machine';

type DateValue = Date | string;

interface UserSource {
  id: string;
  displayName: string;
  email?: string;
  avatarUrl: string | null;
}

interface AssignmentSource {
  operationId: string;
  userId: string;
  assignedById: string | null;
  assignedAt: DateValue;
  user: UserSource;
}

interface AttachmentSource {
  id: string;
  operationId?: string;
  fileName: string;
  mimeType: string;
  size: number;
  checksum: string;
  uploadedById: string;
  createdAt: DateValue;
  uploadedBy?: UserSource | null;
}

interface HistorySource {
  id: string;
  operationId: string;
  userId: string | null;
  action: string;
  fromStatus: OperationStatus | null;
  toStatus: OperationStatus | null;
  details: unknown;
  createdAt: DateValue;
  user: UserSource | null;
}

interface OperationSource {
  id: string;
  organizationId: string;
  businessUnitId: string;
  customerId: string | null;
  assetId: string | null;
  code: string;
  kind: OperationKind;
  title: string;
  description: string | null;
  status: OperationStatus;
  priority: OperationPriority;
  scheduledStart: DateValue | null;
  scheduledEnd: DateValue | null;
  startedAt: DateValue | null;
  completedAt: DateValue | null;
  responsibleFieldTechnicianId?: string | null;
  responsibleFieldTechnician?: UserSource | null;
  auxiliaryTechnicians?: ReadonlyArray<{
    userId: string;
    assignedById: string | null;
    assignedAt: DateValue;
    user: UserSource;
  }>;
  startedBy?: UserSource | null;
  completedBy?: UserSource | null;
  location: unknown;
  data: unknown;
  createdById: string | null;
  createdAt: DateValue;
  updatedAt: DateValue;
  businessUnit: { id: string; legalName: string; tradeName: string | null };
  customer: {
    id: string;
    legalName: string;
    tradeName: string | null;
  } | null;
  asset: {
    id: string;
    name: string;
    identifier: string | null;
    status: string;
  } | null;
  users: readonly AssignmentSource[];
  attachments: readonly AttachmentSource[];
  checklistExecutions: ReadonlyArray<{
    id: string;
    templateId: string;
    templateVersion: number;
    status: string;
    progress: number;
    completedAt: DateValue | null;
    updatedAt: DateValue;
  }>;
}

interface ActorContext {
  id: string;
  permissions: readonly string[];
}

interface PaginationSource {
  data: readonly OperationSource[];
  meta: OperationListReadModel['meta'];
}

@Injectable()
export class OperationReadModelMapper {
  list(source: PaginationSource, actor?: ActorContext): OperationListReadModel {
    return {
      data: source.data.map((operation) => this.listItem(operation, actor)),
      meta: { ...source.meta },
    };
  }

  listItem(
    source: OperationSource,
    actor?: ActorContext,
  ): OperationListItemReadModel {
    return this.base(source, actor);
  }

  details(
    source: OperationSource,
    actor?: ActorContext,
  ): OperationDetailsReadModel {
    return {
      ...this.base(source, actor),
      transitions: OperationStateMachine.allowedTransitions(source.status),
    };
  }

  private base(
    source: OperationSource,
    actor?: ActorContext,
  ): OperationListItemReadModel {
    return {
      id: source.id,
      organizationId: source.organizationId,
      businessUnitId: source.businessUnitId,
      customerId: source.customerId,
      assetId: source.assetId,
      code: source.code,
      kind: source.kind,
      title: source.title,
      description: source.description,
      status: source.status,
      priority: source.priority,
      scheduledStart: this.nullableDate(source.scheduledStart),
      scheduledEnd: this.nullableDate(source.scheduledEnd),
      startedAt: this.nullableDate(source.startedAt),
      completedAt: this.nullableDate(source.completedAt),
      responsibleFieldTechnicianId: source.responsibleFieldTechnicianId ?? null,
      responsibleFieldTechnician: source.responsibleFieldTechnician
        ? this.user(source.responsibleFieldTechnician)
        : null,
      auxiliaryTechnicians: (source.auxiliaryTechnicians ?? []).map(
        (assignment) => ({
          userId: assignment.userId,
          assignedById: assignment.assignedById,
          assignedAt: this.date(assignment.assignedAt),
          user: this.user(assignment.user),
        }),
      ),
      startedBy: source.startedBy ? this.user(source.startedBy) : null,
      completedBy: source.completedBy ? this.user(source.completedBy) : null,
      location: source.location,
      data: source.data,
      createdById: source.createdById,
      createdAt: this.date(source.createdAt),
      updatedAt: this.date(source.updatedAt),
      businessUnit: { ...source.businessUnit },
      customer: source.customer ? { ...source.customer } : null,
      asset: source.asset ? { ...source.asset } : null,
      users: source.users.map((assignment) => this.assignment(assignment)),
      attachments: source.attachments.map((attachment) =>
        this.attachment(attachment),
      ),
      checklistExecutions: source.checklistExecutions.map((checklist) => ({
        id: checklist.id,
        templateId: checklist.templateId,
        templateVersion: checklist.templateVersion,
        status: checklist.status,
        progress: checklist.progress,
        completedAt: this.nullableDate(checklist.completedAt),
        updatedAt: this.date(checklist.updatedAt),
      })),
      allowedActions: this.allowedActions(source, actor),
    };
  }

  private allowedActions(
    source: OperationSource,
    actor?: ActorContext,
  ): readonly OperationAllowedAction[] {
    if (!actor) return [];
    const permissions = new Set(actor.permissions);
    const participant =
      source.responsibleFieldTechnicianId === actor.id ||
      (source.auxiliaryTechnicians ?? []).some(
        (assignment) => assignment.userId === actor.id,
      );
    const manager =
      permissions.has('operations.assign') ||
      permissions.has('operations.update');
    const canExecute = participant || manager;
    const actions: OperationAllowedAction[] = [];
    if (permissions.has('operations.read')) actions.push('VIEW');
    if (permissions.has('operations.update')) actions.push('EDIT');
    if (manager) actions.push('MANAGE_ASSIGNMENTS');
    if (permissions.has('operations.status.update') && canExecute) {
      actions.push('CHANGE_STATUS');
      if (
        OperationStateMachine.allowedTransitions(source.status).includes(
          'IN_PROGRESS',
        )
      )
        actions.push('START');
    }
    if (permissions.has('operations.attachments.create') && canExecute)
      actions.push('ADD_EVIDENCE');
    if (permissions.has('reports.create') && canExecute)
      actions.push('GENERATE_REPORT');
    return actions;
  }

  assignment(source: AssignmentSource): OperationAssignmentReadModel {
    return {
      operationId: source.operationId,
      userId: source.userId,
      assignedById: source.assignedById,
      assignedAt: this.date(source.assignedAt),
      user: this.user(source.user),
    };
  }

  attachment(source: AttachmentSource): OperationAttachmentReadModel {
    return {
      id: source.id,
      fileName: source.fileName,
      mimeType: source.mimeType,
      size: source.size,
      checksum: source.checksum,
      uploadedById: source.uploadedById,
      createdAt: this.date(source.createdAt),
    };
  }

  history(source: HistorySource): OperationHistoryReadModel {
    return {
      id: source.id,
      operationId: source.operationId,
      userId: source.userId,
      action: source.action,
      fromStatus: source.fromStatus,
      toStatus: source.toStatus,
      details: source.details,
      createdAt: this.date(source.createdAt),
      user: source.user ? this.user(source.user) : null,
    };
  }

  timeline(source: {
    events: readonly HistorySource[];
    attachments: readonly AttachmentSource[];
  }): OperationTimelineReadModel {
    return {
      events: source.events.map((event) => this.history(event)),
      attachments: source.attachments.map((attachment) =>
        this.timelineAttachment(attachment),
      ),
    };
  }

  private timelineAttachment(
    source: AttachmentSource,
  ): OperationTimelineAttachmentReadModel {
    if (!source.operationId) {
      throw new Error('Timeline attachment requires operationId');
    }
    return {
      ...this.attachment(source),
      operationId: source.operationId,
      uploadedBy: source.uploadedBy ? this.user(source.uploadedBy) : null,
    };
  }

  private user(source: UserSource): OperationUserReadModel {
    return {
      id: source.id,
      displayName: source.displayName,
      ...(source.email === undefined ? {} : { email: source.email }),
      avatarUrl: source.avatarUrl,
    };
  }

  private date(value: DateValue): string {
    return value instanceof Date ? value.toISOString() : value;
  }

  private nullableDate(value: DateValue | null): string | null {
    return value === null ? null : this.date(value);
  }
}
