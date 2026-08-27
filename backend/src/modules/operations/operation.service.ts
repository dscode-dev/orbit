import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OperationStatus } from '../../contracts';
import {
  ConflictException,
  EntityNotFoundException,
  ForbiddenException,
  ValidationException,
} from '../../exceptions';
import type {
  AssignOperationUserDto,
  ChangeOperationStatusDto,
  CreateOperationDto,
  OperationQueryDto,
  UpdateOperationDto,
} from './dto/operation.dto';
import { OperationRepository } from './operation.repository';
import { OperationStorageService } from './operation-storage.service';
import { OperationStateMachine } from './operation-state-machine';
import { WorkforceRepository } from '../workforce/workforce.repository';

@Injectable()
export class OperationService {
  constructor(
    private readonly repository: OperationRepository,
    private readonly storage: OperationStorageService,
    private readonly workforce: WorkforceRepository,
  ) {}

  list(organizationId: string, query: OperationQueryDto) {
    this.validateSchedule(query.scheduledFrom, query.scheduledTo);
    return this.repository.list(organizationId, query);
  }

  async get(id: string, organizationId: string) {
    const operation = await this.repository.find(id, organizationId);
    if (!operation) throw new EntityNotFoundException('Operation', id);
    return operation;
  }

  async create(
    organizationId: string,
    actorId: string,
    input: CreateOperationDto,
  ) {
    this.validateSchedule(input.scheduledStart, input.scheduledEnd);
    const references = await this.validateReferences(
      organizationId,
      input.businessUnitId,
      input.customerId,
      input.assetId,
    );
    await this.validateTechnicianAssignments(
      organizationId,
      input.businessUnitId,
      input.responsibleFieldTechnicianId,
      input.auxiliaryTechnicianIds ?? [],
    );
    try {
      return await this.repository.create(
        {
          organizationId,
          businessUnitId: input.businessUnitId,
          customerId: input.customerId ?? references.assetCustomerId,
          assetId: input.assetId,
          code: input.code.trim().toUpperCase(),
          kind: input.kind,
          title: input.title,
          description: input.description,
          status: input.scheduledStart
            ? OperationStatus.SCHEDULED
            : OperationStatus.OPEN,
          priority: input.priority,
          scheduledStart: input.scheduledStart,
          scheduledEnd: input.scheduledEnd,
          location: input.location as Prisma.InputJsonValue | undefined,
          data: input.data as Prisma.InputJsonValue | undefined,
          createdById: actorId,
          responsibleFieldTechnicianId: input.responsibleFieldTechnicianId,
        },
        actorId,
        this.json({ code: input.code, title: input.title }),
        input.auxiliaryTechnicianIds ?? [],
      );
    } catch (error) {
      this.mapConflict(error);
    }
  }

  async update(
    id: string,
    organizationId: string,
    actorId: string,
    input: UpdateOperationDto,
  ) {
    if (
      input.responsibleFieldTechnicianId !== undefined ||
      input.auxiliaryTechnicianIds !== undefined
    )
      throw new ValidationException(
        'Use explicit assignment commands to change operation technicians',
      );
    const current = await this.get(id, organizationId);
    const businessUnitId = input.businessUnitId ?? current.businessUnitId;
    const customerId = input.customerId ?? current.customerId ?? undefined;
    const assetId = input.assetId ?? current.assetId ?? undefined;
    this.validateSchedule(
      input.scheduledStart ?? current.scheduledStart ?? undefined,
      input.scheduledEnd ?? current.scheduledEnd ?? undefined,
    );
    await this.validateReferences(
      organizationId,
      businessUnitId,
      customerId,
      assetId,
    );
    try {
      return await this.repository.update(
        id,
        {
          businessUnit: input.businessUnitId
            ? { connect: { id: input.businessUnitId } }
            : undefined,
          customer: input.customerId
            ? { connect: { id: input.customerId } }
            : undefined,
          asset: input.assetId ? { connect: { id: input.assetId } } : undefined,
          code: input.code?.trim().toUpperCase(),
          kind: input.kind,
          title: input.title,
          description: input.description,
          priority: input.priority,
          scheduledStart: input.scheduledStart,
          scheduledEnd: input.scheduledEnd,
          location: input.location as Prisma.InputJsonValue | undefined,
          data: input.data as Prisma.InputJsonValue | undefined,
        },
        actorId,
        this.json({ changedFields: Object.keys(input) }),
      );
    } catch (error) {
      this.mapConflict(error);
    }
  }

  async changeStatus(
    id: string,
    organizationId: string,
    actorId: string,
    input: ChangeOperationStatusDto,
    permissions?: readonly string[],
  ) {
    const current = await this.get(id, organizationId);
    if (
      current.responsibleFieldTechnicianId &&
      permissions &&
      !permissions.includes('operations.assign') &&
      !permissions.includes('operations.update')
    ) {
      const assigned =
        current.responsibleFieldTechnicianId === actorId ||
        current.auxiliaryTechnicians.some(
          (assignment) => assignment.userId === actorId,
        );
      if (!assigned)
        throw new ForbiddenException(
          'Operation execution requires assignment and permission',
        );
    }
    const from = current.status;
    if (!OperationStateMachine.allows(from, input.status)) {
      throw new ValidationException(
        `Status transition from ${from} to ${input.status} is not allowed`,
      );
    }
    const now = new Date();
    const result = await this.repository.changeStatus(
      id,
      from,
      input.status,
      {
        status: input.status,
        startedAt:
          input.status === OperationStatus.IN_PROGRESS
            ? (current.startedAt ?? now)
            : undefined,
        startedByUserId:
          input.status === OperationStatus.IN_PROGRESS &&
          !current.startedByUserId
            ? actorId
            : undefined,
        completedAt:
          input.status === OperationStatus.COMPLETED ? now : undefined,
        completedByUserId:
          input.status === OperationStatus.COMPLETED ? actorId : undefined,
      },
      actorId,
      this.json({ reason: input.reason }),
    );
    if (!result) {
      throw new ConflictException(
        'Operation status changed concurrently; reload and try again',
      );
    }
    return result;
  }

  async assign(
    id: string,
    organizationId: string,
    actorId: string,
    input: AssignOperationUserDto,
  ) {
    const operation = await this.get(id, organizationId);
    await this.assertFieldTechnician(
      organizationId,
      operation.businessUnitId,
      input.userId,
    );
    return operation.responsibleFieldTechnicianId
      ? this.addAuxiliaryTechnician(id, organizationId, actorId, input.userId)
      : this.replaceResponsibleFieldTechnician(
          id,
          organizationId,
          actorId,
          input.userId,
        );
  }

  async unassign(
    id: string,
    userId: string,
    organizationId: string,
    actorId: string,
  ): Promise<void> {
    const operation = await this.get(id, organizationId);
    if (operation.responsibleFieldTechnicianId === userId)
      throw new ValidationException(
        'Responsible field technician must be replaced explicitly',
      );
    const removed = await this.repository.removeAuxiliaryTechnician(
      id,
      organizationId,
      userId,
      actorId,
    );
    if (!removed)
      throw new EntityNotFoundException('Operation auxiliary technician');
  }

  async replaceResponsibleFieldTechnician(
    id: string,
    organizationId: string,
    actorId: string,
    userId: string,
  ) {
    const operation = await this.get(id, organizationId);
    await this.assertFieldTechnician(
      organizationId,
      operation.businessUnitId,
      userId,
    );
    if (operation.responsibleFieldTechnicianId === userId)
      throw new ConflictException(
        'User is already the responsible field technician',
      );
    return this.repository.replaceResponsibleFieldTechnician(
      id,
      organizationId,
      operation.responsibleFieldTechnicianId,
      userId,
      actorId,
    );
  }

  async addAuxiliaryTechnician(
    id: string,
    organizationId: string,
    actorId: string,
    userId: string,
  ) {
    const operation = await this.get(id, organizationId);
    if (operation.responsibleFieldTechnicianId === userId)
      throw new ValidationException(
        'Responsible field technician cannot also be an auxiliary technician',
      );
    await this.assertFieldTechnician(
      organizationId,
      operation.businessUnitId,
      userId,
    );
    const result = await this.repository.addAuxiliaryTechnician(
      id,
      organizationId,
      userId,
      actorId,
    );
    if (!result)
      throw new ConflictException('Auxiliary technician is already assigned');
    return result;
  }

  async removeAuxiliaryTechnician(
    id: string,
    organizationId: string,
    actorId: string,
    userId: string,
  ) {
    await this.get(id, organizationId);
    const result = await this.repository.removeAuxiliaryTechnician(
      id,
      organizationId,
      userId,
      actorId,
    );
    if (!result)
      throw new EntityNotFoundException(
        'Operation auxiliary technician',
        userId,
      );
    return result;
  }

  async history(id: string, organizationId: string) {
    await this.get(id, organizationId);
    return (await this.repository.timeline(id)).history;
  }

  async timeline(id: string, organizationId: string) {
    await this.get(id, organizationId);
    const timeline = await this.repository.timeline(id);
    return {
      events: timeline.history,
      attachments: timeline.attachments.map((attachment) => ({
        id: attachment.id,
        operationId: attachment.operationId,
        uploadedById: attachment.uploadedById,
        uploadedBy: attachment.uploadedBy,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        size: attachment.size,
        checksum: attachment.checksum,
        createdAt: attachment.createdAt,
      })),
    };
  }

  async attach(
    id: string,
    organizationId: string,
    actorId: string,
    file: Express.Multer.File | undefined,
  ) {
    await this.get(id, organizationId);
    if (!file || file.size === 0) {
      throw new ValidationException('Attachment file is required');
    }
    const stored = await this.storage.store(file);
    try {
      return await this.repository.createAttachment(
        {
          operationId: id,
          uploadedById: actorId,
          fileName: this.fileName(file.originalname),
          mimeType: file.mimetype || 'application/octet-stream',
          size: stored.size,
          storageKey: stored.storageKey,
          checksum: stored.checksum,
        },
        actorId,
      );
    } catch (error) {
      await this.storage.remove(stored.storageKey).catch(() => undefined);
      throw error;
    }
  }

  async download(
    operationId: string,
    attachmentId: string,
    organizationId: string,
  ) {
    await this.get(operationId, organizationId);
    const attachment = await this.repository.findAttachment(
      attachmentId,
      operationId,
    );
    if (!attachment) {
      throw new EntityNotFoundException('Operation attachment', attachmentId);
    }
    return {
      attachment,
      buffer: await this.storage.read(attachment.storageKey),
    };
  }

  async removeAttachment(
    operationId: string,
    attachmentId: string,
    organizationId: string,
    actorId: string,
  ): Promise<void> {
    await this.get(operationId, organizationId);
    const attachment = await this.repository.findAttachment(
      attachmentId,
      operationId,
    );
    if (!attachment) {
      throw new EntityNotFoundException('Operation attachment', attachmentId);
    }
    await this.repository.softDeleteAttachment(
      attachmentId,
      operationId,
      actorId,
    );
    await this.storage.remove(attachment.storageKey).catch(() => undefined);
  }

  async remove(
    id: string,
    organizationId: string,
    actorId: string,
  ): Promise<void> {
    const operation = await this.get(id, organizationId);
    if (operation.status === OperationStatus.IN_PROGRESS) {
      throw new ValidationException(
        'An in-progress operation cannot be deleted',
      );
    }
    await this.repository.softDelete(id, actorId);
  }

  private async validateReferences(
    organizationId: string,
    businessUnitId: string,
    customerId?: string,
    assetId?: string,
  ) {
    const unit = await this.repository.findBusinessUnit(
      businessUnitId,
      organizationId,
    );
    if (!unit) throw new ValidationException('Invalid business unit');
    if (customerId) {
      const customer = await this.repository.findCustomer(
        customerId,
        organizationId,
      );
      if (!customer) throw new ValidationException('Invalid customer');
    }
    const asset = assetId
      ? await this.repository.findAsset(assetId, organizationId, businessUnitId)
      : null;
    if (assetId && !asset) {
      throw new ValidationException(
        'Asset is not available in the operation business unit',
      );
    }
    if (asset?.customerId && customerId && asset.customerId !== customerId) {
      throw new ValidationException('Asset belongs to another customer');
    }
    return { assetCustomerId: asset?.customerId };
  }

  private validateSchedule(start?: Date, end?: Date) {
    if (start && end && end.getTime() < start.getTime()) {
      throw new ValidationException(
        'Scheduled end cannot precede scheduled start',
      );
    }
  }

  private async validateTechnicianAssignments(
    organizationId: string,
    businessUnitId: string,
    responsibleUserId?: string,
    auxiliaryUserIds: readonly string[] = [],
  ) {
    if (responsibleUserId && auxiliaryUserIds.includes(responsibleUserId))
      throw new ValidationException(
        'Responsible field technician cannot also be an auxiliary technician',
      );
    if (!responsibleUserId && auxiliaryUserIds.length)
      throw new ValidationException(
        'Auxiliary technicians require a responsible field technician',
      );
    const ids = [responsibleUserId, ...auxiliaryUserIds].filter(
      (value): value is string => Boolean(value),
    );
    if (!ids.length) return;
    const eligible = await this.workforce.listProfessionals(
      organizationId,
      'FIELD_TECHNICIAN',
      businessUnitId,
    );
    const eligibleIds = new Set(eligible.map((profile) => profile.userId));
    if (ids.some((id) => !eligibleIds.has(id)))
      throw new ValidationException(
        'Every assigned technician must be an active FIELD_TECHNICIAN in the operation business unit',
      );
  }

  private assertFieldTechnician(
    organizationId: string,
    businessUnitId: string,
    userId: string,
  ) {
    return this.validateTechnicianAssignments(
      organizationId,
      businessUnitId,
      userId,
    );
  }

  private fileName(value: string): string {
    const sanitized = Array.from(value.normalize('NFKC'))
      .map((character) => {
        const code = character.codePointAt(0) ?? 0;
        return code < 32 ||
          code === 127 ||
          character === '/' ||
          character === '\\'
          ? '_'
          : character;
      })
      .join('')
      .trim();
    return (sanitized || 'attachment').slice(0, 255);
  }

  private json(value: Record<string, unknown>): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private mapConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Operation code is already in use');
    }
    throw error;
  }
}
