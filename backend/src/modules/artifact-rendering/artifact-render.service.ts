/**
 * Solicitação de renderização.
 *
 * ```
 * POST /render ──▶ valida ──▶ marca PENDING ──▶ enfileira ──▶ 202
 *                                                    │
 *                                            (worker, adiante)
 * ```
 *
 * A requisição HTTP **não espera o documento**. Renderizar leva de dezenas de
 * milissegundos a segundos, e prender uma conexão por isso é o que a PR pede
 * para evitar. O cliente recebe o estado e consulta depois.
 *
 * ## Idempotência
 *
 * A chave do job é a execução. Pedir renderização duas vezes enquanto a
 * primeira não terminou devolve **o mesmo job** — não há dois documentos, nem
 * duas revisões, para o mesmo pedido. Verificado em teste.
 */
import { Injectable } from '@nestjs/common';
import { ConflictException, EntityNotFoundException } from '../../exceptions';
import { ArtifactManifestPolicy } from '../artifact-manifests/artifact-manifest.policy';
import { BackgroundJobQueue } from '../jobs/background-job.queue';
import { BackgroundJobWorker } from '../jobs/background-job.worker';
import { JOB_QUEUES } from '../jobs/background-job.types';
import { ArtifactRenderMetrics } from './artifact-render.metrics';
import { ArtifactRenderRepository } from './artifact-render.repository';
import { ArtifactRendererRegistry } from './renderers/renderer.registry';
import type {
  ArtifactRenderStateReadModel,
  RenderMetricsReadModel,
} from './artifact-render.read-models';
import type { RequestArtifactRenderDto } from './dto/artifact-render.dto';

export interface RenderActor {
  organizationId: string;
  actorId: string;
}

export interface RenderJobPayload extends Record<string, unknown> {
  executionId: string;
  renderer: string;
  metadata: Record<string, unknown>;
}

@Injectable()
export class ArtifactRenderService {
  constructor(
    private readonly repository: ArtifactRenderRepository,
    private readonly queue: BackgroundJobQueue,
    private readonly renderers: ArtifactRendererRegistry,
    private readonly manifestPolicy: ArtifactManifestPolicy,
    private readonly metrics: ArtifactRenderMetrics,
  ) {}

  /**
   * Pede a renderização.
   *
   * Valida antes de enfileirar: renderer desconhecido e execução em estado que
   * não emite documento viram recusa imediata, com mensagem. Um job que morre
   * em segundo plano por erro previsível é pior do que um 4xx.
   */
  async request(
    executionId: string,
    actor: RenderActor,
    input: RequestArtifactRenderDto,
  ): Promise<ArtifactRenderStateReadModel> {
    const execution = await this.repository.findState(
      executionId,
      actor.organizationId,
    );
    if (!execution) {
      throw new EntityNotFoundException('Artifact execution', executionId);
    }

    /** Recusa cedo: o registry conhece os renderers disponíveis. */
    this.renderers.get(input.renderer);

    /**
     * A mesma regra da emissão manual.
     *
     * Reaproveitar a política do manifest evita duas verdades sobre quando um
     * documento pode existir.
     */
    this.manifestPolicy.assertExecutionCanIssue({
      status: execution.status,
      organizationId: execution.organizationId,
    });

    if (execution.renderStatus === 'RENDERING') {
      throw new ConflictException(
        'A rendering is already in progress for this execution',
      );
    }

    const correlationId = BackgroundJobWorker.correlationId();

    const job = await this.queue.enqueue({
      queue: JOB_QUEUES.artifactRender,
      /** A execução é a chave: um pedido pendente por execução. */
      jobKey: executionId,
      organizationId: actor.organizationId,
      businessUnitId: execution.businessUnitId,
      payload: {
        executionId,
        renderer: input.renderer,
        metadata: input.metadata,
      } satisfies RenderJobPayload,
      correlationId,
      actorUserId: actor.actorId,
    });

    const state = await this.repository.markPending(
      executionId,
      actor.organizationId,
    );

    await this.repository.audit(
      actor.organizationId,
      execution.businessUnitId,
      actor.actorId,
      'ARTIFACT_RENDER_REQUESTED',
      executionId,
      {
        renderer: input.renderer,
        jobId: job.id,
        correlationId: job.correlationId,
      },
    );

    this.metrics.recordStart(input.renderer, job.correlationId, executionId);

    return this.toState(state, job.id, job.correlationId);
  }

  /** Estado atual. O cliente consulta aqui em vez de esperar na conexão. */
  async status(
    executionId: string,
    actor: RenderActor,
  ): Promise<ArtifactRenderStateReadModel> {
    const state = await this.repository.findState(
      executionId,
      actor.organizationId,
    );
    if (!state) {
      throw new EntityNotFoundException('Artifact execution', executionId);
    }
    return this.toState(state, null, null);
  }

  metricsSnapshot(): RenderMetricsReadModel {
    return {
      ...this.metrics.snapshot(),
      renderers: this.renderers.available(),
    };
  }

  private toState(
    state: {
      id: string;
      renderStatus: string;
      renderRequestedAt: Date | null;
      renderStartedAt: Date | null;
      renderCompletedAt: Date | null;
      renderError: string | null;
    },
    jobId: string | null,
    correlationId: string | null,
  ): ArtifactRenderStateReadModel {
    return {
      executionId: state.id,
      renderStatus:
        state.renderStatus as ArtifactRenderStateReadModel['renderStatus'],
      requestedAt: state.renderRequestedAt?.toISOString() ?? null,
      startedAt: state.renderStartedAt?.toISOString() ?? null,
      completedAt: state.renderCompletedAt?.toISOString() ?? null,
      error: state.renderError,
      jobId,
      correlationId,
    };
  }
}
