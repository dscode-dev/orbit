/**
 * Worker de jobs.
 *
 * Um laço que reivindica um job por vez, roda o processador **dentro do
 * contexto do tenant dono do job** e fecha o resultado. A cadência é lenta de
 * propósito: renderização é ato deliberado, não fluxo contínuo.
 *
 * ## RLS no trabalho de fundo
 *
 * Este é o ponto delicado. O worker não atende requisição, então não há
 * `RequestContext` — e sem ele a `RlsTransaction` não sabe qual organização
 * declarar ao Postgres.
 *
 * A solução **não** é rodar como administrador da plataforma: isso desligaria o
 * isolamento justamente no caminho que roda sem ninguém olhando. O job carrega
 * organização, unidade e ator, e o worker reabre exatamente esse contexto com
 * `RequestContextStorage.run`. A política do banco é a mesma da requisição que
 * enfileirou.
 *
 * ## Desligável
 *
 * `JOBS_WORKER_ENABLED=false` desliga o laço sem tirar a fila do ar — é como o
 * E2E controla o momento de processar, e como uma réplica pode ficar só
 * atendendo HTTP.
 */
import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { hostname } from 'node:os';
import type { UUID } from '../../contracts';
import { RequestContext, RequestContextStorage } from '../../context';
import { generateUuidV7 } from '../../utils';
import { BackgroundJobQueue } from './background-job.queue';
import {
  PermanentJobError,
  type BackgroundJobRecord,
  type JobProcessor,
} from './background-job.types';
import { JobProcessorRegistry } from './job-processor.registry';

/** Tempo após o qual um job `RUNNING` é considerado abandonado. */
const STALLED_AFTER_MS = 5 * 60_000;

@Injectable()
export class BackgroundJobWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackgroundJobWorker.name);
  private readonly identity = `${hostname()}:${process.pid}`;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly queue: BackgroundJobQueue,
    private readonly storage: RequestContextStorage,
    private readonly registry: JobProcessorRegistry,
  ) {}

  onModuleInit(): void {
    if ((process.env.JOBS_WORKER_ENABLED ?? 'true').trim() === 'false') {
      this.logger.log('[jobs] worker desligado por configuração');
      return;
    }
    const interval = Number(process.env.JOBS_POLL_INTERVAL_MS ?? 2000);
    this.timer = setInterval(() => void this.tick(), Math.max(250, interval));
    /** Não segura o processo aberto no encerramento. */
    this.timer.unref?.();
    this.logger.log(`[jobs] worker ativo (${this.identity})`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * Um ciclo.
   *
   * Reentrância é evitada por bandeira: um ciclo lento não deve disparar outro
   * em cima. Exposto para o teste controlar o tempo em vez de esperar.
   */
  async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let processed = 0;
    try {
      for (const processor of this.registry.all()) {
        await this.queue.requeueStalled(processor.queue, STALLED_AFTER_MS);
        const job = await this.queue.claim(processor.queue, this.identity);
        if (!job) continue;
        await this.run(processor, job);
        processed += 1;
      }
    } catch (error) {
      /** Falha do laço não derruba o worker: o próximo ciclo tenta de novo. */
      this.logger.error(
        `[jobs] ciclo falhou: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      );
    } finally {
      this.running = false;
    }
    return processed;
  }

  private async run(
    processor: JobProcessor,
    job: BackgroundJobRecord,
  ): Promise<void> {
    const started = Date.now();

    await this.withTenantContext(job, async () => {
      try {
        await processor.process(job);
        await this.queue.succeed(job.id);
        this.logger.log(
          JSON.stringify({
            queue: job.queue,
            jobId: job.id,
            correlationId: job.correlationId,
            attempt: job.attempts,
            outcome: 'SUCCEEDED',
            durationMs: Date.now() - started,
          }),
        );
      } catch (error) {
        const permanent = error instanceof PermanentJobError;
        const reason =
          error instanceof Error ? error.message : 'erro desconhecido';
        await this.queue.fail(job, reason, permanent);
      }
    });
  }

  /**
   * Reabre o contexto do tenant que enfileirou.
   *
   * `businessUnitIds` recebe a unidade do job para que as políticas que isolam
   * por unidade — a do manifest, por exemplo — encontrem o que precisam.
   */
  private withTenantContext<T>(
    job: BackgroundJobRecord,
    work: () => Promise<T>,
  ): Promise<T> {
    /** `UUID` é um tipo marcado; os valores vêm do banco já validados. */
    const asUuid = (value: string | null): UUID | null =>
      value === null ? null : (value as UUID);

    const context = new RequestContext({
      requestId: job.correlationId,
      userId: asUuid(job.actorUserId),
      organizationId: asUuid(job.organizationId),
      businessUnitId: asUuid(job.businessUnitId),
      businessUnitIds: job.businessUnitId ? [job.businessUnitId as UUID] : [],
      /**
       * O worker não herda papéis nem permissões do ator.
       *
       * Autorização já aconteceu quando o trabalho foi pedido; repeti-la aqui
       * com um papel congelado no tempo seria pior — um papel revogado
       * continuaria valendo. O que o worker precisa é do escopo de dados, e é
       * só isso que ele declara.
       */
      roles: [],
      permissions: [],
      ip: null,
      userAgent: 'orbit-job-worker',
      locale: 'pt-BR',
    });

    return Promise.resolve(this.storage.run(context, work));
  }

  /** Identificador de correlação para quem enfileira. */
  static correlationId(): string {
    return generateUuidV7();
  }
}
