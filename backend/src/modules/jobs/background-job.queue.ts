/**
 * Fila sobre Postgres.
 *
 * ## Reivindicação sem corrida
 *
 * ```sql
 * UPDATE background_jobs SET status = 'RUNNING' …
 * WHERE id = (
 *   SELECT id FROM background_jobs
 *   WHERE queue = $1 AND status = 'PENDING' AND available_at <= now()
 *   ORDER BY available_at
 *   FOR UPDATE SKIP LOCKED
 *   LIMIT 1
 * )
 * ```
 *
 * `SKIP LOCKED` faz cada réplica pegar um job diferente sem bloquear as outras.
 * É o mecanismo que uma fila dedicada implementaria por dentro.
 *
 * ## Fora da RLS, de propósito
 *
 * A reivindicação usa o cliente Prisma direto: o worker ainda não sabe de que
 * organização é o job — descobrir é o objetivo da consulta. A partir daí, **todo
 * o trabalho roda dentro do contexto do tenant dono do job**, com a mesma RLS
 * de uma requisição. Ver `background-job.worker.ts`.
 *
 * A tabela tem política de RLS assim mesmo: qualquer leitura feita por um
 * caminho de requisição continua isolada por organização.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database';
import type { PrismaTransactionClient } from '../../database/prisma.types';
import { generateUuidV7 } from '../../utils';
import type {
  BackgroundJobRecord,
  EnqueueJobInput,
  JobQueue,
} from './background-job.types';

/** Backoff exponencial com teto — 5s, 10s, 20s, 40s… até 5 minutos. */
export const BACKOFF_BASE_MS = 5_000;
export const BACKOFF_CEILING_MS = 300_000;

export function backoffFor(attempts: number): number {
  return Math.min(
    BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1),
    BACKOFF_CEILING_MS,
  );
}

interface JobRow {
  id: string;
  queue: string;
  job_key: string;
  organization_id: string;
  business_unit_id: string | null;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  max_attempts: number;
  correlation_id: string;
  actor_user_id: string | null;
  last_error: string | null;
  available_at: Date;
  created_at: Date;
}

@Injectable()
export class BackgroundJobQueue {
  private readonly logger = new Logger(BackgroundJobQueue.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enfileira, ou devolve o job já pendente com a mesma chave.
   *
   * A idempotência é do **banco**: um índice único parcial sobre
   * `(queue, job_key)` enquanto o status é `PENDING` ou `RUNNING`. Duas
   * requisições simultâneas não criam dois jobs — a segunda colide e lê a
   * primeira.
   *
   * ## Enfileirar dentro da transação de quem pediu
   *
   * `client` recebe a transação do chamador quando o job **só faz sentido se o
   * fato de negócio existir** — e vice-versa. Sem isso o enfileiramento
   * acontece depois do commit, e um processo que morre entre os dois deixa o
   * fato gravado e o trabalho nunca pedido: perda silenciosa, do tipo que
   * ninguém descobre porque nada falhou. Com a transação, é padrão outbox — ou
   * os dois existem, ou nenhum.
   */
  async enqueue(
    input: EnqueueJobInput,
    client?: PrismaTransactionClient,
  ): Promise<BackgroundJobRecord> {
    if (client) return this.enqueueWithin(client, input);
    try {
      const created = await this.prisma.backgroundJob.create({
        data: {
          id: generateUuidV7(),
          organizationId: input.organizationId,
          businessUnitId: input.businessUnitId ?? null,
          queue: input.queue,
          jobKey: input.jobKey,
          payload: input.payload as Prisma.InputJsonValue,
          correlationId: input.correlationId,
          actorUserId: input.actorUserId ?? null,
          maxAttempts: input.maxAttempts ?? 3,
          ...(input.availableAt ? { availableAt: input.availableAt } : {}),
        },
      });
      return this.toRecord(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.backgroundJob.findFirst({
          where: {
            queue: input.queue,
            jobKey: input.jobKey,
            status: { in: ['PENDING', 'RUNNING'] },
          },
        });
        if (existing) return this.toRecord(existing);
      }
      throw error;
    }
  }

  /**
   * Insere dentro de uma transação em curso.
   *
   * Aqui **não** se captura `P2002`: no Postgres uma violação de unicidade
   * aborta a transação inteira, e a leitura de recuperação falharia com
   * "current transaction is aborted". `ON CONFLICT DO NOTHING` evita o erro em
   * vez de tratá-lo — sem alvo declarado, cobre o índice parcial que define a
   * idempotência da fila. Nada retornado significa que a chave já está na
   * fila, e aí o job existente é lido normalmente.
   */
  private async enqueueWithin(
    client: PrismaTransactionClient,
    input: EnqueueJobInput,
  ): Promise<BackgroundJobRecord> {
    const inserted = await client.$queryRaw<JobRow[]>`
      INSERT INTO background_jobs (
        id, organization_id, business_unit_id, queue, job_key, payload,
        correlation_id, actor_user_id, max_attempts, available_at, updated_at
      ) VALUES (
        ${generateUuidV7()}::uuid,
        ${input.organizationId}::uuid,
        ${input.businessUnitId ?? null}::uuid,
        ${input.queue},
        ${input.jobKey},
        ${JSON.stringify(input.payload)}::jsonb,
        ${input.correlationId},
        ${input.actorUserId ?? null}::uuid,
        ${input.maxAttempts ?? 3},
        COALESCE(${input.availableAt ?? null}::timestamptz, now()),
        now()
      )
      ON CONFLICT DO NOTHING
      RETURNING id, queue, job_key, organization_id, business_unit_id,
                payload, status, attempts, max_attempts, correlation_id,
                actor_user_id, last_error, available_at, created_at
    `;

    const row = inserted[0];
    if (row) return this.fromRow(row);

    const existing = await client.backgroundJob.findFirst({
      where: {
        queue: input.queue,
        jobKey: input.jobKey,
        status: { in: ['PENDING', 'RUNNING'] },
      },
    });
    if (!existing) {
      throw new Error(
        `[jobs] enfileiramento recusado sem job correspondente: ${input.queue}/${input.jobKey}`,
      );
    }
    return this.toRecord(existing);
  }

  /** Reivindica um job elegível, ou `null` quando não há trabalho. */
  async claim(
    queue: JobQueue,
    worker: string,
  ): Promise<BackgroundJobRecord | null> {
    const rows = await this.prisma.$queryRaw<JobRow[]>`
      UPDATE background_jobs
         SET status = 'RUNNING',
             attempts = attempts + 1,
             locked_at = now(),
             locked_by = ${worker},
             started_at = COALESCE(started_at, now()),
             updated_at = now()
       WHERE id = (
         SELECT id FROM background_jobs
          WHERE queue = ${queue}
            AND status = 'PENDING'
            AND available_at <= now()
          ORDER BY available_at ASC, created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
       )
       RETURNING id, queue, job_key, organization_id, business_unit_id,
                 payload, status, attempts, max_attempts, correlation_id,
                 actor_user_id, last_error, available_at, created_at
    `;

    const row = rows[0];
    return row ? this.fromRow(row) : null;
  }

  async succeed(id: string): Promise<void> {
    await this.prisma.backgroundJob.update({
      where: { id },
      data: {
        status: 'SUCCEEDED',
        finishedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        lastError: null,
      },
    });
  }

  /**
   * Registra a falha e decide entre repetir e enterrar.
   *
   * `permanent` pula o retry: payload inválido não melhora na terceira
   * tentativa. Esgotadas as tentativas, o job vai para `DEAD` — que é o
   * dead-letter desta fila: permanece na tabela, com o último erro, para ser
   * investigado.
   */
  async fail(
    job: BackgroundJobRecord,
    reason: string,
    permanent = false,
  ): Promise<'RETRY' | 'DEAD'> {
    const exhausted = permanent || job.attempts >= job.maxAttempts;
    const delay = backoffFor(job.attempts);

    await this.prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: exhausted ? 'DEAD' : 'PENDING',
        availableAt: exhausted ? undefined : new Date(Date.now() + delay),
        lockedAt: null,
        lockedBy: null,
        finishedAt: exhausted ? new Date() : null,
        lastError: reason.slice(0, 1000),
      },
    });

    this.logger.warn(
      JSON.stringify({
        queue: job.queue,
        jobId: job.id,
        correlationId: job.correlationId,
        attempt: job.attempts,
        maxAttempts: job.maxAttempts,
        outcome: exhausted ? 'DEAD' : 'RETRY',
        retryInMs: exhausted ? null : delay,
        reason,
      }),
    );

    return exhausted ? 'DEAD' : 'RETRY';
  }

  /**
   * Devolve jobs presos.
   *
   * Um processo derrubado no meio do trabalho deixa o job `RUNNING` para
   * sempre. Depois do tempo limite, ele volta para a fila — e é por isso que
   * todo processador precisa ser idempotente.
   */
  async requeueStalled(queue: JobQueue, olderThanMs: number): Promise<number> {
    const threshold = new Date(Date.now() - olderThanMs);
    const result = await this.prisma.backgroundJob.updateMany({
      where: { queue, status: 'RUNNING', lockedAt: { lt: threshold } },
      data: { status: 'PENDING', lockedAt: null, lockedBy: null },
    });
    if (result.count > 0) {
      this.logger.warn(
        `[jobs] ${result.count} job(s) presos em ${queue} devolvidos à fila`,
      );
    }
    return result.count;
  }

  find(id: string) {
    return this.prisma.backgroundJob.findUnique({ where: { id } });
  }

  private toRecord(job: {
    id: string;
    queue: string;
    jobKey: string;
    organizationId: string;
    businessUnitId: string | null;
    payload: Prisma.JsonValue;
    status: string;
    attempts: number;
    maxAttempts: number;
    correlationId: string;
    actorUserId: string | null;
    lastError: string | null;
    availableAt: Date;
    createdAt: Date;
  }): BackgroundJobRecord {
    return {
      id: job.id,
      queue: job.queue,
      jobKey: job.jobKey,
      organizationId: job.organizationId,
      businessUnitId: job.businessUnitId,
      payload: (job.payload ?? {}) as Record<string, unknown>,
      status: job.status as BackgroundJobRecord['status'],
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      correlationId: job.correlationId,
      actorUserId: job.actorUserId,
      lastError: job.lastError,
      availableAt: job.availableAt,
      createdAt: job.createdAt,
    };
  }

  private fromRow(row: JobRow): BackgroundJobRecord {
    return {
      id: row.id,
      queue: row.queue,
      jobKey: row.job_key,
      organizationId: row.organization_id,
      businessUnitId: row.business_unit_id,
      payload: row.payload ?? {},
      status: row.status as BackgroundJobRecord['status'],
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      correlationId: row.correlation_id,
      actorUserId: row.actor_user_id,
      lastError: row.last_error,
      availableAt: row.available_at,
      createdAt: row.created_at,
    };
  }
}
