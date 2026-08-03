/**
 * Invariantes do ciclo de vida de uma revisão.
 *
 * Separadas do serviço porque são a **regra**, não a orquestração — e porque
 * regra assim precisa de teste unitário sem banco.
 *
 * ```
 *  DRAFT ──emitir──▶ ISSUED ──nova revisão emitida──▶ SUPERSEDED
 *                       │
 *                       └──revogar──▶ REVOKED
 * ```
 *
 * Não há volta: uma revisão emitida nunca retorna a rascunho, e um documento
 * revogado não é reemitido. Corrigir é abrir a revisão seguinte — é isso que
 * torna o histórico auditável.
 */
import { Injectable } from '@nestjs/common';
import { ConflictException, ForbiddenException } from '../../exceptions';

export interface ManifestPolicySource {
  status: string;
  isActive: boolean;
  fileId: string | null;
}

export interface ExecutionPolicySource {
  status: string;
  organizationId: string;
}

/**
 * Estados da execução que permitem emitir documento.
 *
 * Emitir a partir de um rascunho produziria um documento oficial de algo que
 * ainda está sendo preenchido. A submissão para revisão é o primeiro momento
 * em que existe conteúdo que alguém afirmou estar pronto.
 */
const ISSUABLE_EXECUTION_STATUSES: readonly string[] = [
  'UNDER_REVIEW',
  'APPROVED',
  'COMPLETED',
  'ARCHIVED',
];

@Injectable()
export class ArtifactManifestPolicy {
  assertExecutionCanIssue(execution: ExecutionPolicySource): void {
    if (!ISSUABLE_EXECUTION_STATUSES.includes(execution.status)) {
      throw new ConflictException(
        `An execution in ${execution.status} cannot issue a document; submit it for review first`,
      );
    }
  }

  assertCanAttachFile(manifest: ManifestPolicySource): void {
    if (manifest.status !== 'DRAFT') {
      throw new ConflictException(
        'Only a draft revision accepts content; open a new revision instead',
      );
    }
    if (manifest.fileId) {
      throw new ConflictException('This revision already has a file');
    }
  }

  assertCanRevoke(manifest: ManifestPolicySource): void {
    if (manifest.status === 'REVOKED') {
      throw new ConflictException('This revision is already revoked');
    }
    if (manifest.status === 'DRAFT') {
      throw new ConflictException('A draft revision is discarded, not revoked');
    }
  }

  assertCanDownload(manifest: ManifestPolicySource): void {
    if (!manifest.fileId) {
      throw new ConflictException(
        'This revision has no issued document to download',
      );
    }
    if (manifest.status === 'REVOKED') {
      /**
       * Revogado não se baixa.
       *
       * O registro permanece para auditoria — quem precisa dele consulta o
       * manifest, que diz quando e por quê foi revogado. Distribuir o arquivo
       * de um documento invalidado é o oposto do propósito da revogação.
       */
      throw new ForbiddenException(
        'This document was revoked and is no longer distributable',
      );
    }
  }
}
