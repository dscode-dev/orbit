import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  OperationStatus,
  type OperationStatus as OperationStatusType,
} from '../../contracts';
import {
  ConflictException,
  EntityNotFoundException,
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

const transitions: Readonly<
  Record<OperationStatusType, OperationStatusType[]>
> = {
  OPEN: [
    OperationStatus.SCHEDULED,
    OperationStatus.IN_PROGRESS,
    OperationStatus.CANCELLED,
  ],
  SCHEDULED: [
    OperationStatus.OPEN,
    OperationStatus.IN_PROGRESS,
    OperationStatus.CANCELLED,
  ],
  IN_PROGRESS: [
    OperationStatus.PAUSED,
    OperationStatus.COMPLETED,
    OperationStatus.CANCELLED,
  ],
  PAUSED: [OperationStatus.IN_PROGRESS, OperationStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [OperationStatus.OPEN],
};

@Injectable()
export class OperationService {
  constructor(
    private readonly repository: OperationRepository,
    private readonly storage: OperationStorageService,
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
        },
        actorId,
        this.json({ code: input.code, title: input.title }),
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
  ) {
    const current = await this.get(id, organizationId);
    const from = current.status;
    if (!transitions[from]?.includes(input.status)) {
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
        completedAt:
          input.status === OperationStatus.COMPLETED ? now : undefined,
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
    const member = await this.repository.findAssignableUser(
      input.userId,
      organizationId,
      operation.businessUnitId,
    );
    if (!member) {
      throw new ValidationException(
        'User is not active in the operation business unit',
      );
    }
    await this.repository.assign(id, input.userId, actorId);
    return this.get(id, organizationId);
  }

  async unassign(
    id: string,
    userId: string,
    organizationId: string,
    actorId: string,
  ): Promise<void> {
    await this.get(id, organizationId);
    const removed = await this.repository.unassign(id, userId, actorId);
    if (!removed) throw new EntityNotFoundException('Operation assignment');
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
