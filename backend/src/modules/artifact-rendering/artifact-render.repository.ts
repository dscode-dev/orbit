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
    return this.rls.run((tx) =>
      tx.artifactExecution.findFirst({
        where: { id: executionId, organizationId, deletedAt: null },
        include: {
          snapshot: true,
          responses: { orderBy: [{ sectionId: 'asc' }, { fieldId: 'asc' }] },
          signatures: { orderBy: { signedAt: 'asc' } },
          organization: { select: { displayName: true } },
        },
      }),
    );
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
