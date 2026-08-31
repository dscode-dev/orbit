/* eslint-disable @typescript-eslint/no-base-to-string -- Prisma infere um union discriminado profundo para as três autoridades; o TypeScript valida o contrato, mas o parser type-aware do ESLint não o resolve. */
import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ConflictException, EntityNotFoundException } from '../../exceptions';
import { ArtifactManifestService } from '../artifact-manifests/artifact-manifest.service';
import { ArtifactRenderService } from '../artifact-rendering/artifact-render.service';
import type { MobileFieldActor } from './mobile-field.service';
import type { RenderFieldArtifactDto } from './mobile-field-artifact.dto';
import {
  MobileFieldArtifactRepository,
  type FreezeFieldArtifactInput,
  type FrozenFieldDocument,
} from './mobile-field-artifact.repository';
import type {
  FieldArtifactAllowedAction,
  FieldArtifactBlockedReason,
  FieldArtifactDownloadReadModel,
  FieldArtifactPreparationReadModel,
  FieldArtifactReadModel,
  FieldArtifactSourceType,
} from './mobile-field-artifact.read-models';

type Source = NonNullable<
  Awaited<ReturnType<MobileFieldArtifactRepository['source']>>
>;
type Existing = NonNullable<
  Awaited<ReturnType<MobileFieldArtifactRepository['existing']>>
>;

@Injectable()
export class MobileFieldArtifactService {
  private readonly logger = new Logger(MobileFieldArtifactService.name);

  constructor(
    private readonly repository: MobileFieldArtifactRepository,
    private readonly rendering: ArtifactRenderService,
    private readonly manifests: ArtifactManifestService,
  ) {}

  async preparation(
    actor: MobileFieldActor,
    sourceType: FieldArtifactSourceType,
    sourceId: string,
  ): Promise<FieldArtifactPreparationReadModel> {
    const started = performance.now();
    const [source, existing] = await Promise.all([
      this.repository.source(actor, sourceType, sourceId),
      this.repository.existing(actor, sourceType, sourceId),
    ]);
    if (!source) throw new EntityNotFoundException('Field source', sourceId);
    const result = this.prepare(source, existing);
    this.metric('mobile_artifact_prepare_total', started, {
      sourceType,
      eligible: result.eligibility.eligible,
      evidence: result.evidenceSummary.finalized,
    });
    return result;
  }

  async freeze(
    actor: MobileFieldActor,
    sourceType: FieldArtifactSourceType,
    sourceId: string,
  ): Promise<FieldArtifactReadModel> {
    const [source, current] = await Promise.all([
      this.repository.source(actor, sourceType, sourceId),
      this.repository.existing(actor, sourceType, sourceId),
    ]);
    if (!source) throw new EntityNotFoundException('Field source', sourceId);
    if (current) return this.map(current);
    const preparation = this.prepare(source, null);
    if (!preparation.eligibility.eligible)
      throw new ConflictException(
        `Documento indisponível: ${preparation.eligibility.blockedReasons.join(', ')}`,
      );
    if (source.kind === 'PMOC_EQUIPMENT_EXECUTION')
      throw new ConflictException(
        'O documento PMOC deve ser preparado pelo fluxo PMOC existente',
      );

    const snapshot =
      source.kind === 'OPERATION'
        ? this.operationSnapshot(source)
        : this.rvtSnapshot(source);
    const snapshotHash = this.hash(snapshot);
    const input = this.freezeInput(actor, source, snapshot, snapshotHash);
    const artifact = await this.repository.freeze(input);
    this.logger.log(
      JSON.stringify({
        metric: 'mobile_artifact_snapshot_frozen',
        sourceType,
        artifactId: artifact.id,
        snapshotHash,
        snapshotBytes: Buffer.byteLength(JSON.stringify(snapshot)),
      }),
    );
    return this.map(artifact);
  }

  async render(
    actor: MobileFieldActor,
    artifactId: string,
    input: RenderFieldArtifactDto,
  ): Promise<FieldArtifactReadModel> {
    const artifact = await this.artifact(actor, artifactId);
    if (
      ['READY', 'PENDING', 'RENDERING'].includes(
        artifact.artifactExecution.renderStatus,
      )
    )
      return this.map(artifact);
    await this.rendering.request(
      artifact.artifactExecutionId,
      { organizationId: actor.organizationId, actorId: actor.id },
      {
        renderer: input.renderer ?? 'pdf.default',
        metadata: {
          source: 'MOBILE_FIELD',
          fieldArtifactId: artifact.id,
          snapshotHash: artifact.snapshotHash,
        },
      },
    );
    return this.map(await this.artifact(actor, artifactId));
  }

  async get(
    actor: MobileFieldActor,
    artifactId: string,
  ): Promise<FieldArtifactReadModel> {
    return this.map(await this.artifact(actor, artifactId));
  }

  async access(
    actor: MobileFieldActor,
    artifactId: string,
    operation: 'preview' | 'download',
  ): Promise<FieldArtifactDownloadReadModel> {
    const artifact = await this.artifact(actor, artifactId);
    const manifest = artifact.artifactExecution.manifests[0];
    if (!manifest)
      throw new ConflictException(
        'O documento final ainda não está disponível',
      );
    const signed = await this.manifests.signDownload(
      manifest.id,
      { organizationId: actor.organizationId, actorId: actor.id },
      operation,
    );
    this.logger.log(
      JSON.stringify({
        metric: 'mobile_artifact_download_total',
        artifactId,
        operation,
      }),
    );
    return {
      artifactId,
      operation,
      url: signed.url,
      expiresAt: signed.expiresAt,
      requiredHeaders: signed.requiredHeaders,
    };
  }

  private prepare(
    source: Source,
    existing: Existing | null,
  ): FieldArtifactPreparationReadModel {
    const reasons: FieldArtifactBlockedReason[] = [];
    const permission =
      source.permissions.includes('*') ||
      source.permissions.includes('artifact_rendering.render');
    if (!permission) reasons.push('NOT_AUTHORIZED');

    if (source.kind === 'PMOC_EQUIPMENT_EXECUTION') {
      if (source.source.status !== 'COMPLETED')
        reasons.push('SOURCE_NOT_COMPLETED');
      if (!source.source.artifactExecutionId)
        reasons.push('TEMPLATE_NOT_AVAILABLE');
      return {
        sourceType: source.kind,
        sourceId: source.source.id,
        documentType: 'PMOC',
        eligibility: {
          eligible: reasons.length === 0,
          blockedReasons: reasons,
        },
        templateVersion: null,
        professionalSignatures: {
          fieldTechnician: true,
          technicalResponsibleRequired: true,
          technicalResponsible: true,
        },
        customerAcknowledgement: {
          required: false,
          available: false,
          valid: true,
        },
        evidenceSummary: { finalized: 0, pending: 0 },
        snapshotVersion: 1,
        existingArtifact: existing ? this.map(existing) : null,
        allowedActions: existing ? this.actions(existing) : [],
      };
    }

    const completed = source.source.status === 'COMPLETED';
    if (!completed) reasons.push('SOURCE_NOT_COMPLETED');
    if (!source.template) reasons.push('TEMPLATE_NOT_AVAILABLE');

    let fieldSignature = false;
    let rtRequired = false;
    let rtSignature = false;
    let acknowledgementRequired = false;
    let acknowledgementAvailable = false;
    let pending = 0;
    let finalized = 0;

    if (source.kind === 'OPERATION') {
      fieldSignature = Boolean(source.signature);
      if (!fieldSignature) reasons.push('FIELD_TECHNICIAN_SIGNATURE_MISSING');
      acknowledgementRequired = this.flag(
        source.source.data,
        'customerAcknowledgementRequired',
      );
      acknowledgementAvailable = Boolean(source.acknowledgement);
      pending = source.source.fieldEvidenceUploads.length;
      finalized = source.source.fieldEvidence.length;
    } else {
      fieldSignature = Boolean(
        this.record(source.source.fieldTechnicianSignature).hash,
      );
      if (!fieldSignature) reasons.push('FIELD_TECHNICIAN_SIGNATURE_MISSING');
      rtRequired =
        source.source.occurrence.configuration.requiresTechnicalResponsible;
      rtSignature = Boolean(
        this.record(source.source.technicalResponsibleSignature).hash,
      );
      if (rtRequired && !source.source.technicalResponsibleUserId)
        reasons.push('TECHNICAL_RESPONSIBLE_MISSING');
      else if (rtRequired && !rtSignature) reasons.push('RT_SIGNATURE_MISSING');
      acknowledgementAvailable = Boolean(
        source.source.customerAcknowledgement ?? source.acknowledgement,
      );
      pending = source.source.fieldEvidenceUploads.length;
      finalized = source.source.fieldEvidence.length;
    }
    if (acknowledgementRequired && !acknowledgementAvailable)
      reasons.push('ACKNOWLEDGEMENT_REQUIRED');
    if (pending > 0) reasons.push('EVIDENCE_PENDING');

    const allowed: FieldArtifactAllowedAction[] = existing
      ? this.actions(existing)
      : reasons.length === 0
        ? ['PREPARE_DOCUMENT']
        : [];
    return {
      sourceType: source.kind,
      sourceId: source.source.id,
      documentType: source.kind === 'OPERATION' ? 'SERVICE_ORDER' : 'RVT',
      eligibility: {
        eligible: reasons.length === 0,
        blockedReasons: [...new Set(reasons)],
      },
      templateVersion: source.template?.version.version ?? null,
      professionalSignatures: {
        fieldTechnician: fieldSignature,
        technicalResponsibleRequired: rtRequired,
        technicalResponsible: rtSignature,
      },
      customerAcknowledgement: {
        required: acknowledgementRequired,
        available: acknowledgementAvailable,
        valid: acknowledgementAvailable || !acknowledgementRequired,
      },
      evidenceSummary: { finalized, pending },
      snapshotVersion: 1,
      existingArtifact: existing ? this.map(existing) : null,
      allowedActions: allowed,
    };
  }

  private operationSnapshot(
    source: Extract<Source, { kind: 'OPERATION' }>,
  ): FrozenFieldDocument {
    const operation = source.source;
    const signature = source.signature!;
    const signatory =
      operation.completedBy ??
      operation.startedBy ??
      operation.responsibleFieldTechnician!;
    return {
      schemaVersion: 1,
      sourceType: 'OPERATION',
      sourceId: operation.id,
      documentType: 'SERVICE_ORDER',
      locale: 'pt-BR',
      sections: [
        this.section('atendimento', 'Atendimento', 1, {
          Número: operation.code,
          Título: operation.title,
          Solicitação: operation.description,
          Status: 'Concluída',
          Início: this.date(operation.startedAt),
          Conclusão: this.date(operation.completedAt),
          Local: operation.location,
        }),
        this.section('cliente', 'Cliente e unidade', 2, {
          Cliente:
            operation.customer?.tradeName ?? operation.customer?.legalName,
          Documento: operation.customer?.documentNumber,
          Unidade:
            operation.businessUnit.tradeName ??
            operation.businessUnit.legalName,
          'Município/UF': [
            operation.businessUnit.city,
            operation.businessUnit.stateCode,
          ]
            .filter(Boolean)
            .join(' / '),
        }),
        this.section('equipe', 'Equipe técnica', 3, {
          'Técnico em Campo': signatory.displayName,
          'Responsável atual':
            operation.responsibleFieldTechnician?.displayName,
          'Auxiliares técnico': operation.auxiliaryTechnicians.map(
            (item) => item.user.displayName,
          ),
        }),
        this.section('equipamento', 'Equipamento', 4, operation.asset ?? {}),
        this.section('materiais', 'Materiais utilizados', 5, {
          Materiais: operation.inventoryMovements.map((item) => ({
            produto: item.catalogItem.name,
            quantidade: item.quantity.toString(),
            unidade: item.catalogItem.unit,
          })),
        }),
      ],
      signatures: [
        {
          slotId: 'field_technician',
          label: 'Técnico em Campo',
          signerRole: 'Técnico em Campo',
          signedAs: 'FIELD_TECHNICIAN',
          userId: signatory.id,
          signerName: signatory.displayName,
          signatureHash: signature.sha256,
          signatureAssetId: signature.storageObjectId,
          signedAt: (operation.completedAt ?? new Date()).toISOString(),
        },
      ],
      evidence: operation.fieldEvidence.map((item) => this.evidence(item)),
      customerAcknowledgement: source.acknowledgement
        ? this.acknowledgement(source.acknowledgement)
        : null,
      frozenAt: new Date().toISOString(),
    };
  }

  private rvtSnapshot(
    source: Extract<Source, { kind: 'RVT_EXECUTION' }>,
  ): FrozenFieldDocument {
    const execution = source.source;
    const field = this.record(execution.fieldTechnicianSignature);
    const technical = this.record(execution.technicalResponsibleSignature);
    const signatures: FrozenFieldDocument['signatures'][number][] = [
      this.snapshotSignature(
        'field_technician',
        'Técnico em Campo',
        'FIELD_TECHNICIAN',
        field,
        execution.completedAt,
      ),
    ];
    if (execution.occurrence.configuration.requiresTechnicalResponsible)
      signatures.push(
        this.snapshotSignature(
          'technical_responsible',
          'Responsável Técnico',
          'TECHNICAL_RESPONSIBLE',
          technical,
          execution.completedAt,
        ),
      );
    return {
      schemaVersion: 1,
      sourceType: 'RVT_EXECUTION',
      sourceId: execution.id,
      documentType: 'RVT',
      locale: 'pt-BR',
      sections: [
        this.section('visita', 'Relatório de Visita Técnica', 1, {
          Configuração: execution.occurrence.configuration.name,
          Código: execution.occurrence.configuration.code,
          Ocorrência: execution.occurrence.sequenceNumber,
          'Realizada em': this.date(execution.performedAt),
          Local: execution.occurrence.configuration.serviceLocation,
        }),
        this.section('equipamentos', 'Equipamentos', 2, {
          Equipamentos: execution.equipment.map((item) => item.assetSnapshot),
        }),
        this.section('procedimento', 'Procedimento e constatações', 3, {
          Procedimento: execution.procedureSnapshot,
          Observações: execution.observations,
          Recomendações: execution.recommendations,
          'Recomendação complementar': execution.freeTextRecommendation,
        }),
      ],
      signatures,
      evidence: execution.fieldEvidence.map((item) => this.evidence(item)),
      customerAcknowledgement:
        this.recordOrNull(execution.customerAcknowledgement) ??
        (source.acknowledgement
          ? this.acknowledgement(source.acknowledgement)
          : null),
      frozenAt: new Date().toISOString(),
    };
  }

  private freezeInput(
    actor: MobileFieldActor,
    source: Extract<Source, { kind: 'OPERATION' | 'RVT_EXECUTION' }>,
    snapshot: FrozenFieldDocument,
    snapshotHash: string,
  ): FreezeFieldArtifactInput {
    if (!source.template)
      throw new ConflictException('Template documental indisponível');
    if (source.kind === 'OPERATION') {
      const value = source.source;
      return {
        actor,
        sourceType: source.kind,
        sourceId: value.id,
        documentType: 'SERVICE_ORDER',
        businessUnitId: value.businessUnitId,
        operationId: value.id,
        customerId: value.customerId,
        assetId: value.assetId,
        responsibleUserId: source.signatoryId,
        code: `OS-${value.code}`,
        title: `Ordem de Serviço — ${value.code}`,
        startedAt: value.startedAt,
        completedAt: value.completedAt,
        template: source.template,
        snapshot,
        snapshotHash,
      };
    }
    const value = source.source;
    return {
      actor,
      sourceType: source.kind,
      sourceId: value.id,
      documentType: 'RVT',
      businessUnitId: value.businessUnitId,
      operationId: value.operationId,
      customerId: value.occurrence.configuration.customerId,
      assetId: null,
      responsibleUserId: value.responsibleFieldTechnicianId,
      code: `RVT-${value.occurrence.configuration.code}-${String(value.occurrence.sequenceNumber).padStart(3, '0')}`,
      title: `${value.occurrence.configuration.name} — Relatório de Visita Técnica`,
      startedAt: value.startedAt,
      completedAt: value.completedAt,
      template: source.template,
      snapshot,
      snapshotHash,
      existingArtifactExecutionId: value.artifactExecutionId,
    };
  }

  private map(value: Existing): FieldArtifactReadModel {
    const rawStatus = value.artifactExecution.renderStatus;
    const status: FieldArtifactReadModel['status'] =
      rawStatus === 'NOT_RENDERED'
        ? 'PREPARED'
        : (rawStatus as FieldArtifactReadModel['status']);
    const ready =
      status === 'READY' && value.artifactExecution.manifests.length > 0;
    return {
      id: value.id,
      artifactExecutionId: value.artifactExecutionId,
      sourceType: value.sourceType as FieldArtifactSourceType,
      sourceId: value.sourceId,
      documentType:
        value.documentType as FieldArtifactReadModel['documentType'],
      status,
      snapshotVersion: value.snapshotVersion,
      snapshotHash: value.snapshotHash,
      templateVersion: value.artifactExecution.snapshot.templateVersion,
      generatedAt:
        value.artifactExecution.manifests[0]?.issuedAt?.toISOString() ?? null,
      previewAvailable: ready,
      downloadAvailable: ready,
      allowedActions: this.actions(value),
    };
  }

  private actions(value: Existing): FieldArtifactAllowedAction[] {
    const status = value.artifactExecution.renderStatus;
    if (status === 'READY' && value.artifactExecution.manifests.length)
      return ['VIEW_DOCUMENT', 'DOWNLOAD_DOCUMENT'];
    if (status === 'PENDING' || status === 'RENDERING') return [];
    return ['GENERATE_DOCUMENT'];
  }

  private async artifact(
    actor: MobileFieldActor,
    id: string,
  ): Promise<Existing> {
    const artifact = await this.repository.get(actor, id);
    if (!artifact) throw new EntityNotFoundException('Field artifact', id);
    return artifact;
  }

  private section(
    id: string,
    title: string,
    order: number,
    values: Record<string, unknown>,
  ): FrozenFieldDocument['sections'][number] {
    return {
      id,
      title,
      order,
      fields: Object.entries(values).map(([label, value], index) => ({
        id: `${id}_${index + 1}`,
        label,
        order: index + 1,
        value: value ?? null,
      })),
    };
  }

  private evidence(item: {
    id: string;
    storageFileId: string;
    sha256: string;
    mimeType: string;
    category: string;
    fileName: string;
    capturedAt: Date | null;
  }) {
    return {
      id: item.id,
      storageFileId: item.storageFileId,
      sha256: item.sha256,
      mimeType: item.mimeType,
      category: item.category,
      fileName: item.fileName,
      capturedAt: item.capturedAt?.toISOString() ?? null,
    };
  }

  private snapshotSignature(
    slotId: string,
    label: string,
    signedAs: string,
    value: Record<string, unknown>,
    completedAt: Date | null,
  ): FrozenFieldDocument['signatures'][number] {
    const credential = this.record(value.credential);
    return {
      slotId,
      label,
      signerRole: label,
      signedAs,
      userId: String(value.userId),
      signerName: String(value.name ?? ''),
      signatureHash: String(value.hash),
      signatureAssetId: String(value.signatureAssetId),
      credentialType:
        typeof credential.type === 'string' ? credential.type : null,
      credentialNumber:
        typeof credential.registrationNumber === 'string'
          ? credential.registrationNumber
          : null,
      credentialRegion:
        typeof credential.region === 'string' ? credential.region : null,
      signedAt: (completedAt ?? new Date()).toISOString(),
    };
  }

  private acknowledgement(value: {
    signerName: string;
    acknowledgedAt: Date;
    contentVersion: string;
    contentHash: string;
    signatureStorageFileId: string | null;
    signatureSha256: string | null;
    capturedByUserId: string;
  }): Record<string, unknown> {
    return {
      signerName: value.signerName,
      acknowledgedAt: value.acknowledgedAt.toISOString(),
      contentVersion: value.contentVersion,
      contentHash: value.contentHash,
      signatureStorageFileId: value.signatureStorageFileId,
      signatureSha256: value.signatureSha256,
      capturedBy: value.capturedByUserId,
    };
  }

  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private recordOrNull(value: unknown): Record<string, unknown> | null {
    const result = this.record(value);
    return Object.keys(result).length ? result : null;
  }

  private flag(value: unknown, key: string): boolean {
    const root = this.record(value);
    return this.record(root.documentPolicy)[key] === true || root[key] === true;
  }

  private date(value: Date | null): string | null {
    return value
      ? new Intl.DateTimeFormat('pt-BR', {
          dateStyle: 'short',
          timeStyle: 'short',
          timeZone: 'America/Recife',
        }).format(value)
      : null;
  }

  private canonical(value: unknown): string {
    if (value === null || typeof value !== 'object')
      return JSON.stringify(value);
    if (Array.isArray(value))
      return `[${value.map((item) => this.canonical(item)).join(',')}]`;
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${this.canonical(item)}`)
      .join(',')}}`;
  }

  private hash(value: unknown): string {
    return createHash('sha256').update(this.canonical(value)).digest('hex');
  }

  private metric(
    metric: string,
    started: number,
    data: Record<string, unknown>,
  ): void {
    this.logger.log(
      JSON.stringify({
        metric,
        ...data,
        durationMs: Number((performance.now() - started).toFixed(2)),
      }),
    );
  }
}
