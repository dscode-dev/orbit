/**
 * O acesso ao banco da cobrança.
 *
 * Duas fronteiras diferentes convivem aqui. `billing_customers` é dado de
 * inquilino e passa pela RLS normal. A caixa de entrada de eventos é
 * infraestrutura da plataforma — o evento chega antes de sabermos de quem ele
 * é — e por isso é lida e escrita declarando contexto de plataforma, na
 * transação daquela operação.
 */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, RlsTransaction } from '../../database';
import type { PrismaTransactionClient } from '../../database/prisma.types';
import { generateUuidV7 } from '../../utils';
import type { BillingMode, BillingProviderName } from './billing.types';

export interface BillingCustomerRow {
  id: string;
  organizationId: string;
  provider: string;
  mode: string;
  providerCustomerId: string;
}

@Injectable()
export class BillingRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rls: RlsTransaction,
  ) {}

  /** O nome comercial da organização, para o cliente do provedor. */
  async organizationName(organizationId: string): Promise<string> {
    const organizacao = await this.rls.run((tx) =>
      tx.organization.findUnique({
        where: { id: organizationId },
        select: { displayName: true },
      }),
    );
    return organizacao?.displayName ?? organizationId;
  }

  findCustomer(
    organizationId: string,
    provider: BillingProviderName,
    mode: BillingMode,
  ): Promise<BillingCustomerRow | null> {
    return this.rls.run((tx) =>
      tx.billingCustomer.findFirst({
        where: { organizationId, provider, mode },
      }),
    );
  }

  /**
   * Grava o vínculo, ou devolve o que já existia.
   *
   * O índice único é quem decide: duas requisições concorrentes criando o
   * cliente resultam num vínculo canônico só, e a segunda encontra o primeiro
   * em vez de gravar um paralelo.
   */
  async linkCustomer(input: {
    organizationId: string;
    provider: BillingProviderName;
    mode: BillingMode;
    providerCustomerId: string;
  }): Promise<BillingCustomerRow> {
    return this.rls.run(async (tx) => {
      try {
        return await tx.billingCustomer.create({
          data: { id: generateUuidV7(), ...input },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          return tx.billingCustomer.findFirstOrThrow({
            where: {
              organizationId: input.organizationId,
              provider: input.provider,
              mode: input.mode,
            },
          });
        }
        throw error;
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /* Caixa de entrada — contexto de plataforma                         */
  /* ---------------------------------------------------------------- */

  /**
   * Uma transação que se declara da plataforma.
   *
   * A caixa de entrada não pertence a inquilino nenhum: um evento chega
   * identificado pelo provedor, e só depois de reconciliado sabemos de quem
   * era. Uma política por inquilino esconderia todo evento do próprio
   * processador. O contexto vale enquanto esta transação existir, e o alcance
   * real é o do código abaixo — que só conhece uma tabela.
   */
  private comoPlataforma<T>(
    work: (tx: PrismaTransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        `SELECT set_config('app.is_platform_admin', 'true', true)`,
      );
      return work(tx);
    });
  }

  /**
   * Registra o evento recebido.
   *
   * Devolve `false` quando ele já estava lá. É o índice único respondendo, e
   * não uma consulta anterior: dez entregas simultâneas do mesmo evento
   * produzem uma linha e um efeito.
   */
  async recordEvent(input: {
    provider: BillingProviderName;
    providerEventId: string;
    eventType: string;
    providerObjectId: string | null;
    providerSubscriptionId: string | null;
    apiVersion: string | null;
    providerCreatedAt: Date;
  }): Promise<boolean> {
    return this.comoPlataforma(async (tx) => {
      const inseridas = await tx.$executeRaw`
        INSERT INTO "billing_webhook_events"
          ("id", "provider", "provider_event_id", "event_type",
           "provider_object_id", "provider_subscription_id", "api_version",
           "provider_created_at", "received_at", "processing_status",
           "attempts", "created_at", "updated_at")
        VALUES
          (${generateUuidV7()}::uuid, ${input.provider}, ${input.providerEventId},
           ${input.eventType}, ${input.providerObjectId},
           ${input.providerSubscriptionId}, ${input.apiVersion},
           ${input.providerCreatedAt}::timestamptz, now(), 'PENDING', 0,
           now(), now())
        ON CONFLICT ("provider", "provider_event_id") DO NOTHING
      `;
      return inseridas > 0;
    });
  }

  /** Eventos ainda não processados, os mais antigos primeiro. */
  pendingEvents(take: number) {
    return this.comoPlataforma((tx) =>
      tx.billingWebhookEvent.findMany({
        where: { processingStatus: 'PENDING' },
        orderBy: { receivedAt: 'asc' },
        take,
      }),
    );
  }

  finishEvent(
    id: string,
    status: 'PROCESSED' | 'IGNORED' | 'FAILED',
    lastErrorCode?: string,
  ) {
    return this.comoPlataforma((tx) =>
      tx.billingWebhookEvent.update({
        where: { id },
        data: {
          processingStatus: status,
          processedAt: new Date(),
          attempts: { increment: 1 },
          lastErrorCode: lastErrorCode ?? null,
        },
      }),
    );
  }

  /**
   * A assinatura ligada a um identificador do provedor.
   *
   * Consulta de plataforma: o worker está reconciliando um evento e ainda não
   * declarou inquilino nenhum — é justamente esta consulta que descobre qual é.
   */
  findSubscriptionByProviderId(providerSubscriptionId: string) {
    return this.comoPlataforma((tx) =>
      tx.organizationSubscription.findFirst({
        where: { providerSubscriptionId, endedAt: null },
      }),
    );
  }

  /** Assinaturas vinculadas ao provedor, para a varredura periódica. */
  linkedSubscriptions(take: number, after?: string) {
    return this.comoPlataforma((tx) =>
      tx.organizationSubscription.findMany({
        where: {
          endedAt: null,
          providerSubscriptionId: { not: null },
          ...(after ? { id: { gt: after } } : {}),
        },
        orderBy: { id: 'asc' },
        take,
      }),
    );
  }
}
