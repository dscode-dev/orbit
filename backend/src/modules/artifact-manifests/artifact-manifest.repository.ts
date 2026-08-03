/**
 * Persistência do Manifest.
 *
 * ## Numeração de revisão
 *
 * `revision` é atribuída sob `pg_advisory_xact_lock` por execução: duas
 * emissões simultâneas não recebem o mesmo número. A trava usa `$executeRaw` —
 * `pg_advisory_xact_lock` retorna `void` e `$queryRaw` falha ao desserializar,
 * defeito que a PR-13 corrigiu nos demais pontos da plataforma.
 *
 * ## Revisão ativa
 *
 * A troca de ativa acontece na **mesma transação**: a anterior vira
 * `SUPERSEDED` e perde a bandeira antes de a nova recebê-la. O índice único
 * parcial do banco garante o invariante mesmo que a ordem falhe.
 */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransaction } from '../../database';
import { generateUuidV7 } from '../../utils';

const actor = { select: { id: true, displayName: true } } as const;

const details = Prisma.validator<Prisma.ArtifactManifestInclude>()({
  file: true,
  issuedBy: actor,
  createdBy: actor,
});

export interface OpenRevisionData {
  organizationId: string;
  businessUnitId: string;
  executionId: string;
  snapshotId: string;
  templateId: string;
  templateVersion: number;
  renderer: string;
  rendererVersion?: string | null;
  format: string;
  sourceHash: string;
  metadata?: Record<string, unknown>;
  createdById: string;
}

export interface IssueData {
  fileId: string;
  contentHash: string;
  rendererVersion?: string | null;
  issuedById: string;
}

@Injectable()
export class ArtifactManifestRepository {
  constructor(private readonly rls: RlsTransaction) {}

  listByExecution(executionId: string, organizationId: string) {
    return this.rls.run((tx) =>
      tx.artifactManifest.findMany({
        where: { executionId, organizationId, deletedAt: null },
        orderBy: { revision: 'desc' },
        include: details,
      }),
    );
  }

  find(id: string, organizationId: string) {
    return this.rls.run((tx) =>
      tx.artifactManifest.findFirst({
        where: { id, organizationId, deletedAt: null },
        include: details,
      }),
    );
  }

  /** Abre a próxima revisão da execução, em rascunho. */
  openRevision(data: OpenRevisionData) {
    return this.rls.run(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`manifest:${data.executionId}`}))`;

      const latest = await tx.artifactManifest.aggregate({
        where: { executionId: data.executionId },
        _max: { revision: true },
      });
      const revision = (latest._max.revision ?? 0) + 1;

      const manifest = await tx.artifactManifest.create({
        data: {
          id: generateUuidV7(),
          organizationId: data.organizationId,
          businessUnitId: data.businessUnitId,
          executionId: data.executionId,
          snapshotId: data.snapshotId,
          templateId: data.templateId,
          templateVersion: data.templateVersion,
          revision,
          status: 'DRAFT',
          renderer: data.renderer,
          rendererVersion: data.rendererVersion ?? null,
          format: data.format,
          sourceHash: data.sourceHash,
          metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
          createdById: data.createdById,
        },
        include: details,
      });

      await this.audit(
        tx,
        data.organizationId,
        data.businessUnitId,
        data.createdById,
        'ARTIFACT_MANIFEST_REVISION_OPENED',
        manifest.id,
        null,
        { executionId: data.executionId, revision, renderer: data.renderer },
      );

      return manifest;
    });
  }

  /**
   * Emite a revisão: registra o arquivo, marca como ativa e aposenta a
   * anterior — tudo em uma transação.
   */
  issue(
    id: string,
    organizationId: string,
    businessUnitId: string,
    executionId: string,
    data: IssueData,
  ) {
    return this.rls.run(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`manifest:${executionId}`}))`;

      await tx.artifactManifest.updateMany({
        where: { executionId, isActive: true, deletedAt: null },
        data: {
          isActive: false,
          status: 'SUPERSEDED',
          supersededAt: new Date(),
        },
      });

      const manifest = await tx.artifactManifest.update({
        where: { id },
        data: {
          status: 'ISSUED',
          fileId: data.fileId,
          contentHash: data.contentHash,
          rendererVersion: data.rendererVersion ?? undefined,
          isActive: true,
          issuedAt: new Date(),
          issuedById: data.issuedById,
        },
        include: details,
      });

      await this.audit(
        tx,
        organizationId,
        businessUnitId,
        data.issuedById,
        'ARTIFACT_MANIFEST_ISSUED',
        manifest.id,
        null,
        {
          executionId,
          revision: manifest.revision,
          contentHash: data.contentHash,
        },
      );

      return manifest;
    });
  }

  revoke(
    id: string,
    organizationId: string,
    businessUnitId: string,
    actorId: string,
    reason: string,
  ) {
    return this.rls.run(async (tx) => {
      const before = await tx.artifactManifest.findFirstOrThrow({
        where: { id, organizationId },
      });

      const manifest = await tx.artifactManifest.update({
        where: { id },
        data: {
          status: 'REVOKED',
          isActive: false,
          revokedAt: new Date(),
          revokedReason: reason,
        },
        include: details,
      });

      await this.audit(
        tx,
        organizationId,
        businessUnitId,
        actorId,
        'ARTIFACT_MANIFEST_REVOKED',
        manifest.id,
        { status: before.status, isActive: before.isActive },
        { revision: manifest.revision, reason },
      );

      return manifest;
    });
  }

  /** Registra o acesso ao documento — quem baixou o quê, e quando. */
  auditDownload(
    organizationId: string,
    businessUnitId: string,
    actorId: string,
    manifestId: string,
    revision: number,
    operation: string,
  ) {
    return this.rls.run((tx) =>
      this.audit(
        tx,
        organizationId,
        businessUnitId,
        actorId,
        'ARTIFACT_MANIFEST_DOWNLOAD_SIGNED',
        manifestId,
        null,
        { revision, operation },
      ),
    );
  }

  private audit(
    tx: Prisma.TransactionClient,
    organizationId: string,
    businessUnitId: string,
    actorId: string,
    action: string,
    entityId: string,
    before: Prisma.InputJsonValue | null,
    after: Prisma.InputJsonValue | null,
  ) {
    return tx.auditLog.create({
      data: {
        organizationId,
        businessUnitId,
        userId: actorId,
        action,
        entityType: 'ARTIFACT_MANIFEST',
        entityId,
        before: before ?? undefined,
        after: after ?? undefined,
      },
    });
  }
}
