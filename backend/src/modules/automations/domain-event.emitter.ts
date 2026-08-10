/**
 * Onde um fato de domínio vira evento.
 *
 * ## Outbox, sempre
 *
 * O evento e o job que o levará adiante são gravados **dentro da transação do
 * fato que os originou**. Um processo que morra entre o commit e o
 * enfileiramento não perde a automação — é o mesmo padrão do recibo e do
 * orçamento, pela mesma razão: perda silenciosa é a que ninguém descobre
 * porque nada falhou.
 *
 * ## O emissor não conhece automação
 *
 * Quem chama `emit` é o domínio — operações, orçamentos, estoque —, e ele
 * apenas declara que algo aconteceu. Não sabe se existe regra, quantas são, nem
 * o que farão. É o que permite acrescentar um gatilho sem tocar em nenhum
 * módulo de negócio.
 *
 * ## Payload mínimo
 *
 * Só os campos que o catálogo declara como avaliáveis para aquele gatilho.
 * Serializar a entidade Prisma inteira criaria um retrato que envelhece — e
 * que vaza colunas que ninguém pediu para um consumidor futuro.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaTransactionClient } from '../../database/prisma.types';
import { generateUuidV7 } from '../../utils';
import { BackgroundJobQueue } from '../jobs/background-job.queue';
import { JOB_QUEUES } from '../jobs/background-job.types';
import { findTrigger } from './automation.catalog';

/** Versão do formato do payload. Sobe quando um campo muda de significado. */
export const PAYLOAD_VERSION = 1;

export interface DomainEventInput {
  type: string;
  organizationId: string;
  businessUnitId?: string | null;
  actorId?: string | null;
  entityType: string;
  entityId: string;
  /** Só os campos avaliáveis do gatilho. Ver `automation.catalog`. */
  payload: Record<string, unknown>;
  correlationId?: string;
}

@Injectable()
export class DomainEventEmitter {
  private readonly logger = new Logger(DomainEventEmitter.name);

  constructor(private readonly jobs: BackgroundJobQueue) {}

  /**
   * Grava o evento e enfileira o despacho, na transação recebida.
   *
   * Devolve o id do evento — é ele que atravessa o fluxo como identidade, e
   * que compõe a chave de idempotência de cada ação.
   *
   * **Nunca lança por causa de automação.** Um gatilho desconhecido é
   * registrado no log e descartado: um fato de negócio não pode falhar porque
   * o motor de automação não reconheceu o nome do evento. O fato é o que
   * importa; a reação é consequência.
   */
  async emit(
    tx: PrismaTransactionClient,
    input: DomainEventInput,
  ): Promise<string | null> {
    if (!findTrigger(input.type)) {
      this.logger.warn(
        `[automations] evento fora do catálogo, descartado: ${input.type}`,
      );
      return null;
    }

    const id = generateUuidV7();
    const correlationId = input.correlationId ?? generateUuidV7();

    await tx.domainEvent.create({
      data: {
        id,
        organizationId: input.organizationId,
        businessUnitId: input.businessUnitId ?? null,
        type: input.type,
        actorId: input.actorId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        payloadVersion: PAYLOAD_VERSION,
        payload: this.clean(input.payload) as Prisma.InputJsonValue,
        correlationId,
      },
    });

    await this.jobs.enqueue(
      {
        queue: JOB_QUEUES.automationDispatch,
        /** Um despacho por ocorrência — reentrega não gera dois fan-outs. */
        jobKey: id,
        organizationId: input.organizationId,
        businessUnitId: input.businessUnitId ?? null,
        payload: { eventId: id },
        correlationId,
        actorUserId: input.actorId ?? null,
      },
      tx,
    );

    this.logger.log(
      JSON.stringify({
        stage: 'emitted',
        eventId: id,
        correlationId,
        type: input.type,
        entityId: input.entityId,
      }),
    );

    return id;
  }

  /**
   * Remove nulos e valores não escalares do payload.
   *
   * As condições comparam texto. Guardar objeto aninhado convidaria a um
   * acesso por caminho — `operation.customer.name` — e caminho é o começo de
   * uma linguagem de consulta que esta PR existe para não ter.
   */
  private clean(payload: Record<string, unknown>): Record<string, unknown> {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (value === null || value === undefined) continue;
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }
}
