import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  ConflictException,
  EntityNotFoundException,
  ForbiddenException,
  ValidationException,
} from '../../exceptions';
import {
  FileObjectService,
  STORAGE_NAMESPACES,
} from '../storage/file-object.service';
import type { MobileFieldActor } from './mobile-field.service';
import type {
  CustomerAcknowledgementInputDto,
  MobileSignatureUploadDto,
  MobileSignatureUploadReservationDto,
} from './mobile-signature.dto';
import type {
  CustomerAcknowledgementPreparationReadModel,
  CustomerAcknowledgementResultReadModel,
  MobileProfessionalRole,
  MobileSignatureStatusReadModel,
  MobileSignatureUploadResultReadModel,
  MobileSignatureUploadReservationReadModel,
} from './mobile-signature.read-models';
import { MobileSignatureRepository } from './mobile-signature.repository';

@Injectable()
export class MobileSignatureService {
  private readonly logger = new Logger(MobileSignatureService.name);
  constructor(
    private readonly repository: MobileSignatureRepository,
    private readonly files: FileObjectService,
  ) {}

  async status(
    actor: MobileFieldActor,
  ): Promise<MobileSignatureStatusReadModel> {
    const context = await this.requireProfessional(actor);
    return this.toStatus(context);
  }

  async upload(
    actor: MobileFieldActor,
    input: MobileSignatureUploadDto,
  ): Promise<MobileSignatureUploadResultReadModel> {
    const context = await this.requireProfessional(actor);
    const reserved = await this.repository.signatureUploadFile(
      actor.organizationId,
      input.storageObjectId,
    );
    if (!reserved || reserved.createdById !== actor.id)
      throw new EntityNotFoundException('StorageFile', input.storageObjectId);
    await this.files.confirm(input.storageObjectId, actor.organizationId);
    const file = await this.repository.storageFile(
      actor.organizationId,
      input.storageObjectId,
    );
    if (!file || file.createdById !== actor.id || !file.sha256)
      throw new ValidationException(
        'O arquivo de assinatura deve pertencer ao usuário autenticado e estar disponível',
      );
    if (file.sizeBytes > 2_000_000n)
      throw new ValidationException('A assinatura deve ter no máximo 2 MB');
    const body = await this.files.read(file.bucket, file.objectKey);
    const detected = this.detectImageMime(body);
    if (!detected || detected !== file.mimeType)
      throw new ValidationException(
        'O conteúdo da assinatura deve ser PNG, JPEG ou WEBP válido',
      );
    if (body.length > 2_000_000 || this.sha(body) !== file.sha256)
      throw new ValidationException(
        'O conteúdo da assinatura não corresponde ao arquivo confirmado',
      );
    const replaced = await this.repository.replace(
      actor.organizationId,
      actor.id,
      file.id,
      file.sha256,
    );
    this.logger.log(
      JSON.stringify({
        metric: 'mobile_signature_upload_total',
        organizationId: actor.organizationId,
      }),
    );
    return {
      signatureAvailable: true,
      version: replaced.signature.version,
      updatedAt: replaced.signature.updatedAt.toISOString(),
      roles: this.roles(context.profile!),
      replacedVersion: replaced.replacedVersion,
    };
  }

  async reserveUpload(
    actor: MobileFieldActor,
    input: MobileSignatureUploadReservationDto,
  ): Promise<MobileSignatureUploadReservationReadModel> {
    await this.requireProfessional(actor);
    const { file, signed } = await this.files.reserve({
      organizationId: actor.organizationId,
      businessUnitId: null,
      namespace: STORAGE_NAMESPACES.signature,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      metadata: {
        purpose: 'PROFESSIONAL_SIGNATURE',
        ownerUserId: actor.id,
      },
      createdById: actor.id,
    });
    return {
      fileId: file.id,
      upload: {
        url: signed.url,
        expiresAt: signed.expiresAt.toISOString(),
        method: 'PUT',
        requiredHeaders: signed.requiredHeaders,
      },
    };
  }

  async revoke(
    actor: MobileFieldActor,
  ): Promise<MobileSignatureStatusReadModel> {
    const context = await this.requireProfessional(actor);
    await this.repository.revoke(actor.organizationId, actor.id);
    return {
      signatureAvailable: false,
      version: null,
      updatedAt: null,
      roles: this.roles(context.profile!),
    };
  }

  async acknowledgementPreparation(
    actor: MobileFieldActor,
    operationId: string,
  ): Promise<CustomerAcknowledgementPreparationReadModel> {
    const operation = await this.visibleOperation(actor, operationId);
    const summary = this.summary(operation);
    const existing = await this.repository.acknowledgement(
      actor.organizationId,
      operationId,
    );
    return {
      ...summary,
      existingAcknowledgement: existing
        ? {
            signerName: existing.signerName,
            acknowledgedAt: existing.acknowledgedAt.toISOString(),
            hasSignature: Boolean(existing.signatureStorageFileId),
          }
        : null,
      contentVersion: operation.updatedAt.toISOString(),
      contentHash: this.hash(summary),
    };
  }

  async acknowledge(
    actor: MobileFieldActor,
    operationId: string,
    input: CustomerAcknowledgementInputDto,
  ): Promise<CustomerAcknowledgementResultReadModel> {
    const operation = await this.visibleOperation(actor, operationId);
    const summary = this.summary(operation);
    const currentHash = this.hash(summary);
    if (
      input.expectedVersion !== operation.updatedAt.toISOString() ||
      input.contentHash !== currentHash
    ) {
      this.conflictMetric(actor);
      throw new ConflictException(
        'O atendimento foi alterado. Revise os dados antes de coletar uma nova assinatura.',
      );
    }
    let signatureSha256: string | undefined;
    if (input.signatureStorageFileId) {
      const reserved = await this.repository.signatureUploadFile(
        actor.organizationId,
        input.signatureStorageFileId,
      );
      if (!reserved || reserved.createdById !== actor.id)
        throw new EntityNotFoundException(
          'StorageFile',
          input.signatureStorageFileId,
        );
      await this.files.confirm(
        input.signatureStorageFileId,
        actor.organizationId,
      );
      const file = await this.repository.storageFile(
        actor.organizationId,
        input.signatureStorageFileId,
      );
      if (!file || file.createdById !== actor.id || !file.sha256)
        throw new ValidationException(
          'A assinatura do cliente deve usar um upload válido deste atendimento',
        );
      const body = await this.files.read(file.bucket, file.objectKey);
      if (
        this.detectImageMime(body) !== file.mimeType ||
        body.length > 2_000_000 ||
        this.sha(body) !== file.sha256
      )
        throw new ValidationException(
          'A assinatura do cliente deve ser PNG, JPEG ou WEBP válido e ter no máximo 2 MB',
        );
      signatureSha256 = file.sha256;
    }
    const payloadHash = this.hash({
      executionId: operationId,
      signerName: input.signerName,
      signatureSha256: signatureSha256 ?? null,
      contentHash: input.contentHash,
      contactId: input.contactId ?? null,
    });
    const result = await this.repository.capture({
      organizationId: actor.organizationId,
      businessUnitId: operation.businessUnitId,
      executionId: operation.id,
      customerId: operation.customerId,
      contactId: input.contactId,
      signerName: input.signerName,
      signatureStorageFileId: input.signatureStorageFileId,
      signatureSha256,
      contentVersion: input.expectedVersion,
      contentHash: input.contentHash,
      summary: summary,
      commandId: input.commandId,
      payloadHash,
      actorId: actor.id,
      occurredAt: input.occurredAt,
    });
    this.logger.log(
      JSON.stringify({
        metric: 'mobile_customer_acknowledgement_total',
        organizationId: actor.organizationId,
        idempotentReplay: result.idempotentReplay,
      }),
    );
    const value = result.acknowledgement;
    return {
      id: value.id,
      executionType: 'OPERATION',
      executionId: value.executionId,
      signerName: value.signerName,
      hasSignature: Boolean(value.signatureStorageFileId),
      acknowledgedAt: value.acknowledgedAt.toISOString(),
      contentVersion: value.contentVersion,
      contentHash: value.contentHash,
      idempotentReplay: result.idempotentReplay,
    };
  }

  private async requireProfessional(actor: MobileFieldActor) {
    const context = await this.repository.context(
      actor.organizationId,
      actor.id,
    );
    if (
      !context.membership ||
      !context.profile?.active ||
      this.roles(context.profile).length === 0
    )
      throw new ForbiddenException(
        'Perfil profissional ativo é obrigatório para cadastrar assinatura',
      );
    return context;
  }

  private async visibleOperation(actor: MobileFieldActor, id: string) {
    if (
      !actor.permissions.includes('*') &&
      !actor.permissions.includes('operations.read')
    )
      throw new ForbiddenException('Permissão de operações obrigatória');
    const operation = await this.repository.operation(actor.organizationId, id);
    if (!operation || !actor.businessUnitIds.includes(operation.businessUnitId))
      throw new ForbiddenException('Atendimento fora do contexto permitido');
    const actual =
      operation.completedByUserId ??
      operation.startedByUserId ??
      operation.responsibleFieldTechnicianId;
    if (actual !== actor.id)
      throw new ForbiddenException(
        'Somente o Técnico em Campo efetivo pode coletar o reconhecimento',
      );
    return operation;
  }

  private summary(
    operation: Awaited<
      ReturnType<MobileSignatureRepository['operation']>
    > extends infer T
      ? NonNullable<T>
      : never,
  ) {
    return {
      executionType: 'OPERATION' as const,
      executionId: operation.id,
      customer: operation.customer
        ? {
            id: operation.customer.id,
            name: operation.customer.tradeName ?? operation.customer.legalName,
          }
        : null,
      equipment: operation.asset
        ? [
            {
              id: operation.asset.id,
              code: operation.asset.identifier ?? operation.asset.id,
              name: operation.asset.name,
            },
          ]
        : [],
      serviceSummary: operation.description?.trim() || operation.title,
      performedAt:
        operation.completedAt?.toISOString() ??
        operation.startedAt?.toISOString() ??
        null,
      signerPolicy: {
        acknowledgementAllowed: true as const,
        signatureRequired: false as const,
        signatureOptional: true as const,
      },
    };
  }

  private roles(profile: {
    fieldTechnicianEnabled: boolean;
    technicalResponsibleEnabled: boolean;
  }): MobileProfessionalRole[] {
    const roles: MobileProfessionalRole[] = [];
    if (profile.fieldTechnicianEnabled) roles.push('FIELD_TECHNICIAN');
    if (profile.technicalResponsibleEnabled)
      roles.push('TECHNICAL_RESPONSIBLE');
    return roles;
  }
  private toStatus(
    context: Awaited<ReturnType<MobileSignatureRepository['context']>>,
  ): MobileSignatureStatusReadModel {
    return {
      signatureAvailable: Boolean(context.signature),
      version: context.signature?.version ?? null,
      updatedAt: context.signature?.updatedAt.toISOString() ?? null,
      roles: this.roles(context.profile!),
    };
  }
  private hash(value: unknown): string {
    return this.sha(Buffer.from(JSON.stringify(value)));
  }
  private sha(body: Buffer): string {
    return createHash('sha256').update(body).digest('hex');
  }
  private detectImageMime(body: Buffer): string | null {
    if (
      body.length >= 8 &&
      body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      return 'image/png';
    if (
      body.length >= 3 &&
      body[0] === 0xff &&
      body[1] === 0xd8 &&
      body[2] === 0xff
    )
      return 'image/jpeg';
    if (
      body.length >= 12 &&
      body.toString('ascii', 0, 4) === 'RIFF' &&
      body.toString('ascii', 8, 12) === 'WEBP'
    )
      return 'image/webp';
    return null;
  }
  private conflictMetric(actor: MobileFieldActor) {
    this.logger.warn(
      JSON.stringify({
        metric: 'mobile_customer_acknowledgement_conflict_total',
        organizationId: actor.organizationId,
      }),
    );
  }
}
