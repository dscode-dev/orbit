/**
 * Estado de renderização da execução.
 *
 * **O backend é a autoridade sobre `renderStatus`** — nenhum cliente o escreve,
 * e nenhuma rota o aceita como entrada. As transições acontecem só por aqui,
 * dentro da RLS do tenant.
 *
 * ```
 * NOT_RENDERED ──solicitar──▶ PENDING ──worker pega──▶ RENDERING
 *      ▲                                                   │
 *      │                                          ┌────────┴────────┐
 *      └──────────nova solicitação───────────  FAILED            READY
 * ```
 */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransaction } from '../../database';

const renderSource = {
  id: true,
  organizationId: true,
  businessUnitId: true,
  code: true,
  title: true,
  status: true,
  renderStatus: true,
  renderRequestedAt: true,
  renderStartedAt: true,
  renderCompletedAt: true,
  renderError: true,
  startedAt: true,
  completedAt: true,
} satisfies Prisma.ArtifactExecutionSelect;

@Injectable()
export class ArtifactRenderRepository {
  constructor(private readonly rls: RlsTransaction) {}

  /** Estado atual, para responder consulta de status. */
  findState(executionId: string, organizationId: string) {
    return this.rls.run((tx) =>
      tx.artifactExecution.findFirst({
        where: { id: executionId, organizationId, deletedAt: null },
        select: renderSource,
      }),
    );
  }

  /** Tudo que a montagem da entrada precisa, em uma leitura. */
  findRenderSource(executionId: string, organizationId: string) {
    return this.rls.run(async (tx) => {
      const source = await tx.artifactExecution.findFirst({
        where: { id: executionId, organizationId, deletedAt: null },
        include: {
          snapshot: true,
          responses: { orderBy: [{ sectionId: 'asc' }, { fieldId: 'asc' }] },
          signatures: { orderBy: { signedAt: 'asc' } },
          fieldArtifact: true,
          manifests: {
            where: { isActive: true, status: 'ISSUED', deletedAt: null },
            orderBy: { revision: 'desc' },
            take: 1,
          },
          pmocEquipmentExecution: {
            include: {
              evidence: {
                orderBy: { createdAt: 'asc' },
                include: { storageFile: true },
              },
              fieldEvidence: {
                where: { status: 'FINALIZED' },
                orderBy: [
                  { category: 'asc' },
                  { capturedAt: 'asc' },
                  { id: 'asc' },
                ],
                include: { storageFile: true },
              },
            },
          },
          organization: { select: { displayName: true } },
        },
      });
      if (!source) return null;
      const signatureAssetIds = source.signatures.flatMap((signature) =>
        signature.signatureAssetId ? [signature.signatureAssetId] : [],
      );
      const signatureAssets = signatureAssetIds.length
        ? await tx.storageFile.findMany({
            where: {
              organizationId,
              id: { in: signatureAssetIds },
              status: 'AVAILABLE',
              deletedAt: null,
            },
          })
        : [];
      const frozen = this.record(source.fieldArtifact?.snapshot);
      const frozenEvidence = Array.isArray(frozen.evidence)
        ? frozen.evidence
        : [];
      const frozenSignatures = Array.isArray(frozen.signatures)
        ? frozen.signatures
        : [];
      const frozenAcknowledgement = this.record(frozen.customerAcknowledgement);
      const fieldAssetIds = [
        ...frozenEvidence.flatMap((item) => {
          const id = this.record(item).storageFileId;
          return typeof id === 'string' ? [id] : [];
        }),
        ...frozenSignatures.flatMap((item) => {
          const id = this.record(item).signatureAssetId;
          return typeof id === 'string' ? [id] : [];
        }),
        ...(typeof frozenAcknowledgement.signatureStorageFileId === 'string'
          ? [frozenAcknowledgement.signatureStorageFileId]
          : []),
      ];
      const fieldAssets = fieldAssetIds.length
        ? await tx.storageFile.findMany({
            where: {
              organizationId,
              id: { in: [...new Set(fieldAssetIds)] },
              status: 'AVAILABLE',
              deletedAt: null,
            },
          })
        : [];
      return { ...source, signatureAssets, fieldAssets };
    });
  }

  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  /**
   * `organizationId` não entra no `where`.
   *
   * O `update` do Prisma exige chave única, e a RLS já recusa a linha de outra
   * organização — o parâmetro fica na assinatura para o chamador declarar o
   * escopo, e é a política do banco que o impõe.
   */
  markPending(executionId: string, organizationId: string) {
    void organizationId;
    return this.rls.run((tx) =>
      tx.artifactExecution.update({
        where: { id: executionId },
        data: {
          renderStatus: 'PENDING',
          renderRequestedAt: new Date(),
          renderStartedAt: null,
          renderCompletedAt: null,
          renderError: null,
        },
        select: renderSource,
      }),
    );
  }

  markRendering(executionId: string) {
    return this.rls.run((tx) =>
      tx.artifactExecution.update({
        where: { id: executionId },
        data: { renderStatus: 'RENDERING', renderStartedAt: new Date() },
        select: renderSource,
      }),
    );
  }

  markReady(executionId: string) {
    return this.rls.run((tx) =>
      tx.artifactExecution.update({
        where: { id: executionId },
        data: {
          renderStatus: 'READY',
          renderCompletedAt: new Date(),
          renderError: null,
        },
        select: renderSource,
      }),
    );
  }

  /**
   * Falha.
   *
   * `reason` é mensagem de negócio, truncada — nunca stack, caminho de arquivo
   * ou credencial. O detalhe técnico fica no log, com o mesmo `correlationId`.
   */
  markFailed(executionId: string, reason: string) {
    return this.rls.run((tx) =>
      tx.artifactExecution.update({
        where: { id: executionId },
        data: {
          renderStatus: 'FAILED',
          renderCompletedAt: new Date(),
          renderError: reason.slice(0, 500),
        },
        select: renderSource,
      }),
    );
  }

  /** Auditoria da solicitação e do desfecho. */
  audit(
    organizationId: string,
    businessUnitId: string,
    actorId: string | null,
    action: string,
    executionId: string,
    after: Prisma.InputJsonValue,
  ) {
    return this.rls.run((tx) =>
      tx.auditLog.create({
        data: {
          organizationId,
          businessUnitId,
          userId: actorId,
          action,
          entityType: 'ARTIFACT_EXECUTION',
          entityId: executionId,
          after,
        },
      }),
    );
  }
}
