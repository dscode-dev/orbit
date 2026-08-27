import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { RlsTransaction } from '../../database';
import { DomainEventEmitter } from '../automations/domain-event.emitter';
import { PaginationHelper } from '../../database/helpers/database.helpers';
import type { OperationQueryDto } from './dto/operation.dto';

const operationInclude = {
  businessUnit: {
    select: { id: true, legalName: true, tradeName: true },
  },
  customer: {
    select: { id: true, legalName: true, tradeName: true },
  },
  asset: {
    select: { id: true, name: true, identifier: true, status: true },
  },
  responsibleFieldTechnician: {
    select: { id: true, displayName: true, avatarUrl: true },
  },
  startedBy: { select: { id: true, displayName: true, avatarUrl: true } },
  completedBy: { select: { id: true, displayName: true, avatarUrl: true } },
  auxiliaryTechnicians: {
    where: { removedAt: null },
    select: {
      id: true,
      userId: true,
      assignedById: true,
      assignedAt: true,
      user: { select: { id: true, displayName: true, avatarUrl: true } },
    },
    orderBy: { assignedAt: 'asc' as const },
  },
  users: {
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { assignedAt: 'asc' },
  },
  attachments: {
    where: { deletedAt: null },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      size: true,
      checksum: true,
      uploadedById: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  },
  checklistExecutions: {
    select: {
      id: true,
      templateId: true,
      templateVersion: true,
      status: true,
      progress: true,
      completedAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.OperationInclude;

@Injectable()
export class OperationRepository {
  constructor(
    private readonly rls: RlsTransaction,
    private readonly events: DomainEventEmitter,
  ) {}

  list(organizationId: string, query: OperationQueryDto) {
    const pagination = PaginationHelper.normalize(query.page, query.limit);
    const where: Prisma.OperationWhereInput = {
      organizationId,
      deletedAt: null,
      businessUnitId: query.businessUnitId,
      customerId: query.customerId,
      assetId: query.assetId,
      kind: query.kind,
      status: query.status,
      priority: query.priority,
      ...(query.assignedUserId
        ? {
            OR: [
              { responsibleFieldTechnicianId: query.assignedUserId },
              {
                auxiliaryTechnicians: {
                  some: { userId: query.assignedUserId, removedAt: null },
                },
              },
              { users: { some: { userId: query.assignedUserId } } },
            ],
          }
        : {}),
      scheduledStart:
        query.scheduledFrom || query.scheduledTo
          ? { gte: query.scheduledFrom, lte: query.scheduledTo }
          : undefined,
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return this.rls.run(async (transaction) => {
      const data = await transaction.operation.findMany({
        where,
        include: operationInclude,
        orderBy: [{ scheduledStart: 'asc' }, { createdAt: 'desc' }],
        ...PaginationHelper.toPrisma(pagination),
      });
      const total = await transaction.operation.count({ where });
      return PaginationHelper.result(data, total, pagination);
    });
  }

  find(id: string, organizationId: string) {
    return this.rls.run((transaction) =>
      transaction.operation.findFirst({
        where: { id, organizationId, deletedAt: null },
        include: operationInclude,
      }),
    );
  }

  create(
    data: Prisma.OperationUncheckedCreateInput,
    userId: string,
    details: Prisma.InputJsonValue,
    auxiliaryUserIds: string[] = [],
  ) {
    return this.rls.run(async (transaction) => {
      const operation = await transaction.operation.create({
        data: {
          ...data,
          auxiliaryTechnicians: auxiliaryUserIds.length
            ? {
                create: auxiliaryUserIds.map((auxiliaryUserId) => ({
                  organizationId: data.organizationId,
                  userId: auxiliaryUserId,
                  assignedById: userId,
                })),
              }
            : undefined,
        },
        include: operationInclude,
      });
      await transaction.operationHistory.create({
        data: {
          operationId: operation.id,
          userId,
          action: 'CREATED',
          toStatus: operation.status,
          details,
        },
      });

      /** Ponto autoritativo: é aqui que uma ordem de serviço passa a existir. */
      await this.events.emit(transaction, {
        type: 'operation.created',
        organizationId: operation.organizationId,
        businessUnitId: operation.businessUnitId,
        actorId: userId,
        entityType: 'OPERATION',
        entityId: operation.id,
        payload: {
          kind: operation.kind,
          status: operation.status,
          priority: operation.priority,
          businessUnitId: operation.businessUnitId,
          customerId: operation.customerId,
          createdById: operation.createdById,
        },
      });

      return operation;
    });
  }

  replaceResponsibleFieldTechnician(
    id: string,
    organizationId: string,
    previousUserId: string | null,
    newUserId: string,
    actorId: string,
  ) {
    return this.rls.run(async (tx) => {
      await tx.operationAuxiliaryTechnician.updateMany({
        where: { operationId: id, userId: newUserId, removedAt: null },
        data: { removedAt: new Date(), removedById: actorId },
      });
      const operation = await tx.operation.update({
        where: { id },
        data: { responsibleFieldTechnicianId: newUserId },
        include: operationInclude,
      });
      const eventIds = (
        await tx.schedulingEvent.findMany({
          where: {
            organizationId,
            sourceModule: 'operations',
            sourceEntityType: 'OPERATION',
            sourceEntityId: id,
            deletedAt: null,
          },
          select: { id: true },
        })
      ).map((event) => event.id);
      if (eventIds.length) {
        await tx.schedulingResourceAllocation.updateMany({
          where: {
            eventId: { in: eventIds },
            deletedAt: null,
            OR: [
              { role: 'RESPONSIBLE_FIELD_TECHNICIAN' },
              { userId: newUserId, role: 'AUXILIARY_TECHNICIAN' },
            ],
          },
          data: { deletedAt: new Date(), status: 'RELEASED' },
        });
        await tx.schedulingResourceAllocation.createMany({
          data: eventIds.map((eventId) => ({
            eventId,
            resourceType: 'USER',
            userId: newUserId,
            role: 'RESPONSIBLE_FIELD_TECHNICIAN',
          })),
        });
      }
      const details = { previousUserId, newUserId };
      await tx.operationHistory.create({
        data: {
          operationId: id,
          userId: actorId,
          action: 'RESPONSIBLE_FIELD_TECHNICIAN_REPLACED',
          details,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          businessUnitId: operation.businessUnitId,
          userId: actorId,
          action: 'operation.responsible.changed',
          entityType: 'OPERATION',
          entityId: id,
          before: previousUserId
            ? { responsibleFieldTechnicianId: previousUserId }
            : undefined,
          after: { responsibleFieldTechnicianId: newUserId },
        },
      });
      await this.events.emit(tx, {
        type: 'operation.responsible.changed',
        organizationId,
        businessUnitId: operation.businessUnitId,
        actorId,
        entityType: 'OPERATION',
        entityId: id,
        payload: details,
      });
      return operation;
    });
  }

  addAuxiliaryTechnician(
    id: string,
    organizationId: string,
    userId: string,
    actorId: string,
  ) {
    return this.rls.run(async (tx) => {
      const operation = await tx.operation.findFirstOrThrow({
        where: { id, organizationId, deletedAt: null },
      });
      if (
        await tx.operationAuxiliaryTechnician.findFirst({
          where: { operationId: id, userId, removedAt: null },
        })
      )
        return null;
      await tx.operationAuxiliaryTechnician.create({
        data: {
          organizationId,
          operationId: id,
          userId,
          assignedById: actorId,
        },
      });
      const events = await tx.schedulingEvent.findMany({
        where: {
          organizationId,
          sourceModule: 'operations',
          sourceEntityType: 'OPERATION',
          sourceEntityId: id,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (events.length)
        await tx.schedulingResourceAllocation.createMany({
          data: events.map((event) => ({
            eventId: event.id,
            resourceType: 'USER',
            userId,
            role: 'AUXILIARY_TECHNICIAN',
          })),
        });
      await tx.operationHistory.create({
        data: {
          operationId: id,
          userId: actorId,
          action: 'AUXILIARY_TECHNICIAN_ADDED',
          details: { auxiliaryUserId: userId },
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          businessUnitId: operation.businessUnitId,
          userId: actorId,
          action: 'operation.auxiliary.added',
          entityType: 'OPERATION',
          entityId: id,
          after: { auxiliaryUserId: userId },
        },
      });
      await this.events.emit(tx, {
        type: 'operation.auxiliary.added',
        organizationId,
        businessUnitId: operation.businessUnitId,
        actorId,
        entityType: 'OPERATION',
        entityId: id,
        payload: { auxiliaryUserId: userId },
      });
      return tx.operation.findUniqueOrThrow({
        where: { id },
        include: operationInclude,
      });
    });
  }

  removeAuxiliaryTechnician(
    id: string,
    organizationId: string,
    userId: string,
    actorId: string,
  ) {
    return this.rls.run(async (tx) => {
      const operation = await tx.operation.findFirstOrThrow({
        where: { id, organizationId, deletedAt: null },
      });
      const changed = await tx.operationAuxiliaryTechnician.updateMany({
        where: { operationId: id, userId, removedAt: null },
        data: { removedAt: new Date(), removedById: actorId },
      });
      if (!changed.count) return null;
      await tx.schedulingResourceAllocation.updateMany({
        where: {
          userId,
          role: 'AUXILIARY_TECHNICIAN',
          deletedAt: null,
          event: {
            organizationId,
            sourceModule: 'operations',
            sourceEntityType: 'OPERATION',
            sourceEntityId: id,
            deletedAt: null,
          },
        },
        data: { deletedAt: new Date(), status: 'RELEASED' },
      });
      await tx.operationHistory.create({
        data: {
          operationId: id,
          userId: actorId,
          action: 'AUXILIARY_TECHNICIAN_REMOVED',
          details: { auxiliaryUserId: userId },
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          businessUnitId: operation.businessUnitId,
          userId: actorId,
          action: 'operation.auxiliary.removed',
          entityType: 'OPERATION',
          entityId: id,
          before: { auxiliaryUserId: userId },
        },
      });
      await this.events.emit(tx, {
        type: 'operation.auxiliary.removed',
        organizationId,
        businessUnitId: operation.businessUnitId,
        actorId,
        entityType: 'OPERATION',
        entityId: id,
        payload: { auxiliaryUserId: userId },
      });
      return tx.operation.findUniqueOrThrow({
        where: { id },
        include: operationInclude,
      });
    });
  }

  update(
    id: string,
    data: Prisma.OperationUpdateInput,
    userId: string,
    details: Prisma.InputJsonValue,
  ) {
    return this.rls.run(async (transaction) => {
      const operation = await transaction.operation.update({
        where: { id },
        data,
        include: operationInclude,
      });
      await transaction.operationHistory.create({
        data: { operationId: id, userId, action: 'UPDATED', details },
      });
      return operation;
    });
  }

  changeStatus(
    id: string,
    fromStatus: string,
    toStatus: string,
    data: Prisma.OperationUncheckedUpdateManyInput,
    userId: string,
    details: Prisma.InputJsonValue,
  ) {
    return this.rls.run(async (transaction) => {
      const changed = await transaction.operation.updateMany({
        where: { id, status: fromStatus, deletedAt: null },
        data,
      });
      if (changed.count !== 1) return null;
      await transaction.operationHistory.create({
        data: {
          operationId: id,
          userId,
          action: 'STATUS_CHANGED',
          fromStatus,
          toStatus,
          details,
        },
      });

      const operation = await transaction.operation.findUniqueOrThrow({
        where: { id },
        include: operationInclude,
      });

      /**
       * Dois eventos, de propósito.
       *
       * `status.changed` cobre qualquer transição; `completed` é publicado à
       * parte porque "quando concluir" é a regra que a operação de campo mais
       * escreve — e obrigá-la a lembrar da condição faria a automação disparar
       * em toda pausa.
       */
      const base = {
        organizationId: operation.organizationId,
        businessUnitId: operation.businessUnitId,
        actorId: userId,
        entityType: 'OPERATION' as const,
        entityId: operation.id,
      };
      const payload = {
        kind: operation.kind,
        status: operation.status,
        fromStatus,
        priority: operation.priority,
        businessUnitId: operation.businessUnitId,
        customerId: operation.customerId,
        assetId: operation.assetId,
        createdById: operation.createdById,
      };

      await this.events.emit(transaction, {
        ...base,
        type: 'operation.status.changed',
        payload,
      });

      if (toStatus === 'COMPLETED') {
        await this.events.emit(transaction, {
          ...base,
          type: 'operation.completed',
          payload,
        });
      }

      return operation;
    });
  }

  assign(id: string, userId: string, assignedById: string) {
    return this.rls.run(async (transaction) => {
      const existing = await transaction.operationUser.findUnique({
        where: { operationId_userId: { operationId: id, userId } },
      });
      if (existing) return existing;
      const assignment = await transaction.operationUser.create({
        data: { operationId: id, userId, assignedById },
      });
      await transaction.operationHistory.create({
        data: {
          operationId: id,
          userId: assignedById,
          action: 'USER_ASSIGNED',
          details: { assignedUserId: userId },
        },
      });
      return assignment;
    });
  }

  unassign(id: string, userId: string, assignedById: string): Promise<boolean> {
    return this.rls.run(async (transaction) => {
      const removed = await transaction.operationUser.deleteMany({
        where: { operationId: id, userId },
      });
      if (removed.count !== 1) return false;
      await transaction.operationHistory.create({
        data: {
          operationId: id,
          userId: assignedById,
          action: 'USER_UNASSIGNED',
          details: { assignedUserId: userId },
        },
      });
      return true;
    });
  }

  timeline(id: string) {
    return this.rls.run(async (transaction) => {
      const history = await transaction.operationHistory.findMany({
        where: { operationId: id },
        include: {
          user: {
            select: { id: true, displayName: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      const attachments = await transaction.operationAttachment.findMany({
        where: { operationId: id, deletedAt: null },
        include: {
          uploadedBy: {
            select: { id: true, displayName: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return { history, attachments };
    });
  }

  createAttachment(
    data: Prisma.OperationAttachmentUncheckedCreateInput,
    actorId: string,
  ) {
    return this.rls.run(async (transaction) => {
      const attachment = await transaction.operationAttachment.create({
        data,
        omit: { storageKey: true, deletedAt: true },
      });
      await transaction.operationHistory.create({
        data: {
          operationId: data.operationId,
          userId: actorId,
          action: 'ATTACHMENT_ADDED',
          details: {
            attachmentId: attachment.id,
            fileName: attachment.fileName,
          },
        },
      });
      return attachment;
    });
  }

  findAttachment(id: string, operationId: string) {
    return this.rls.run((transaction) =>
      transaction.operationAttachment.findFirst({
        where: { id, operationId, deletedAt: null },
      }),
    );
  }

  softDeleteAttachment(
    id: string,
    operationId: string,
    actorId: string,
  ): Promise<void> {
    return this.rls
      .run(async (transaction) => {
        await transaction.operationAttachment.update({
          where: { id },
          data: { deletedAt: new Date() },
        });
        await transaction.operationHistory.create({
          data: {
            operationId,
            userId: actorId,
            action: 'ATTACHMENT_REMOVED',
            details: { attachmentId: id },
          },
        });
      })
      .then(() => undefined);
  }

  softDelete(id: string, userId: string): Promise<void> {
    return this.rls
      .run(async (transaction) => {
        await transaction.operationHistory.create({
          data: { operationId: id, userId, action: 'DELETED' },
        });
        await transaction.operation.update({
          where: { id },
          data: { deletedAt: new Date() },
        });
      })
      .then(() => undefined);
  }

  findBusinessUnit(id: string, organizationId: string) {
    return this.rls.run((transaction) =>
      transaction.businessUnit.findFirst({
        where: { id, organizationId, deletedAt: null, status: 'ACTIVE' },
        select: { id: true },
      }),
    );
  }

  findCustomer(id: string, organizationId: string) {
    return this.rls.run((transaction) =>
      transaction.customer.findFirst({
        where: { id, organizationId, deletedAt: null, status: 'ACTIVE' },
        select: { id: true },
      }),
    );
  }

  findAsset(id: string, organizationId: string, businessUnitId: string) {
    return this.rls.run((transaction) =>
      transaction.asset.findFirst({
        where: {
          id,
          organizationId,
          businessUnitId,
          deletedAt: null,
          status: { not: 'RETIRED' },
        },
        select: { id: true, customerId: true },
      }),
    );
  }

  findAssignableUser(
    userId: string,
    organizationId: string,
    businessUnitId: string,
  ) {
    return this.rls.run((transaction) =>
      transaction.businessUnitMembership.findFirst({
        where: {
          userId,
          organizationId,
          businessUnitId,
          status: 'ACTIVE',
          deletedAt: null,
          user: { status: 'ACTIVE', deletedAt: null },
        },
        select: { userId: true },
      }),
    );
  }
}
