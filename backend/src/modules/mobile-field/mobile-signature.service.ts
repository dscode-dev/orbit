import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
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
import { STORAGE_CONFIG, type StorageConfig } from '../storage/storage.config';
import { detectImageMime } from '../storage/image-signature';
import type { MobileFieldActor } from './mobile-field.service';
import type {
  CustomerAcknowledgementInputDto,
  MobileSignaturePreviewQueryDto,
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
    @Inject(STORAGE_CONFIG) private readonly storageConfig: StorageConfig,
  ) {}

  async status(
    actor: MobileFieldActor,
  ): Promise<MobileSignatureStatusReadModel> {
    const context = await this.requireProfessional(actor);
    const signature = context.signature;
    return {
      signatureAvailable: Boolean(signature),
      version: signature?.version ?? null,
      updatedAt: signature?.updatedAt.toISOString() ?? null,
      roles: this.roles(context.profile!),
      preview: signature
        ? this.preview(actor, signature.storageObject, signature.sha256)
        : null,
    };
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
      throw new ValidationException(
        'A assinatura deve ter no máximo 2 MB',
        undefined,
        'FILE_TOO_LARGE',
      );
    const body = await this.files.read(file.bucket, file.objectKey);
    const detected = detectImageMime(body);
    if (!detected || detected !== file.mimeType)
      throw new ValidationException(
        'O conteúdo da assinatura deve ser PNG, JPEG ou WEBP válido',
        undefined,
        'FILE_INVALID',
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
      }),
    );
    return {
      signatureAvailable: true,
      version: replaced.signature.version,
      updatedAt: replaced.signature.updatedAt.toISOString(),
      roles: this.roles(context.profile!),
      preview: this.preview(actor, file, file.sha256),
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
        purpose: input.purpose ?? 'PROFESSIONAL_SIGNATURE',
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
      preview: null,
    };
  }

  /**
   * Entrega os bytes da assinatura ativa, nunca de um StorageFile indicado
   * pelo cliente. O grant é vinculado ao ator autenticado e não carrega
   * bucket, object key ou ID interno.
   */
  async previewBytes(
    actor: MobileFieldActor,
    query: MobileSignaturePreviewQueryDto,
  ): Promise<{ body: Buffer; mimeType: string }> {
    const context = await this.requireProfessional(actor);
    const signature = context.signature;
    if (
      !signature ||
      !this.previewable(signature.storageObject, signature.sha256) ||
      !this.validPreviewGrant(
        actor,
        query.expires,
        query.signature,
        signature.sha256,
      )
    ) {
      throw new ForbiddenException(
        'A prévia da assinatura expirou ou não é válida',
        'SIGNATURE_PREVIEW_INVALID',
      );
    }
    const file = signature.storageObject;
    const body = await this.files.read(file.bucket, file.objectKey);
    if (
      body.length !== Number(file.sizeBytes) ||
      this.sha(body) !== signature.sha256 ||
      detectImageMime(body) !== file.mimeType
    ) {
      throw new EntityNotFoundException('UserSignature', actor.id);
    }
    return { body, mimeType: file.mimeType };
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
      this.conflictMetric();
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
        detectImageMime(body) !== file.mimeType ||
        body.length > 2_000_000 ||
        this.sha(body) !== file.sha256
      )
        throw new ValidationException(
          'A assinatura do cliente deve ser PNG, JPEG ou WEBP válido e ter no máximo 2 MB',
          undefined,
          'FILE_INVALID',
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
  private preview(
    actor: MobileFieldActor,
    file: {
      bucket: string;
      objectKey: string;
      fileName: string;
      mimeType: string;
      sizeBytes: bigint;
      sha256: string | null;
      status: string;
    },
    signatureHash: string,
  ) {
    if (!this.previewable(file, signatureHash)) return null;
    const expires =
      Math.floor(Date.now() / 1000) + this.storageConfig.signedUrlTtlSeconds;
    const signature = this.signPreviewGrant(actor, expires, signatureHash);
    return {
      url:
        '/api/v1/mobile/field/me/signature/preview' +
        `?expires=${expires}&signature=${signature}`,
      expiresAt: new Date(expires * 1000).toISOString(),
      requiredHeaders: {},
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes.toString(),
      sha256: file.sha256,
    };
  }

  private previewable(
    file: {
      mimeType: string;
      sizeBytes: bigint;
      sha256: string | null;
      status: string;
    },
    signatureHash: string,
  ): file is typeof file & { sha256: string } {
    return (
      file.status === 'AVAILABLE' &&
      Boolean(file.sha256) &&
      file.sha256 === signatureHash &&
      file.sizeBytes > 0n &&
      file.sizeBytes <= 2_000_000n &&
      ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimeType)
    );
  }

  private signPreviewGrant(
    actor: MobileFieldActor,
    expires: number,
    signatureHash: string,
  ): string {
    return createHmac('sha256', this.previewGrantSecret())
      .update(this.previewGrantPayload(actor, expires, signatureHash), 'utf8')
      .digest('hex');
  }

  private validPreviewGrant(
    actor: MobileFieldActor,
    expires: number,
    supplied: string,
    signatureHash: string,
  ): boolean {
    if (expires <= Math.floor(Date.now() / 1000)) return false;
    const expected = Buffer.from(
      this.signPreviewGrant(actor, expires, signatureHash),
      'hex',
    );
    const actual = Buffer.from(supplied, 'hex');
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  private previewGrantPayload(
    actor: MobileFieldActor,
    expires: number,
    signatureHash: string,
  ): string {
    return `orbit/mobile-signature-preview/v1\n${actor.organizationId}\n${actor.id}\n${signatureHash}\n${expires}`;
  }

  private previewGrantSecret(): Buffer {
    return createHmac('sha256', this.storageConfig.localSigningSecret)
      .update('orbit/mobile-signature-preview/grant-key/v1', 'utf8')
      .digest();
  }
  private hash(value: unknown): string {
    return this.sha(Buffer.from(JSON.stringify(value)));
  }
  private sha(body: Buffer): string {
    return createHash('sha256').update(body).digest('hex');
  }

  private conflictMetric() {
    this.logger.warn(
      JSON.stringify({
        metric: 'mobile_customer_acknowledgement_conflict_total',
      }),
    );
  }
}
