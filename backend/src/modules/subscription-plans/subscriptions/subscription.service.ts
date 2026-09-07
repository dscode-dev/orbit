/**
 * Os comandos do ciclo comercial.
 *
 * A assinatura é a autoridade sobre o que a organização contratou. O provedor
 * de pagamento — quando existir, na PR-PL-03 — traduzirá os eventos dele para
 * estes comandos; ele não é a autoridade, é uma fonte de fatos financeiros.
 *
 * ## Subir vale agora, descer vale depois
 *
 * Subir de plano entrega o que foi comprado imediatamente. Descer só vale no
 * próximo período: tirar capacidade e teto no meio de uma operação em campo
 * quebraria o trabalho de quem está no telhado com o aplicativo aberto, e por
 * um motivo administrativo.
 *
 * ## Nada aqui apaga nada
 *
 * Suspender, cancelar, expirar e rebaixar mudam **acesso**, nunca dados. Uma
 * organização suspensa que volte encontra os seus clientes, ordens e
 * documentos exatamente onde estavam.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConflictException } from '../../../exceptions';
import type { PrismaTransactionClient } from '../../../database/prisma.types';
import {
  BILLING_INTERVAL_MONTHS,
  BillingInterval,
  CATALOG_VERSION,
  type PlanCode,
} from '../catalog/plan-catalog.types';
import { planDefinition } from '../catalog/plan-registry';
import { anchoredPeriod } from '../entitlements/anchored-period';
import { snapshotOf } from './subscription.snapshot';
import {
  PlanChangeNotAllowedException,
  SubscriptionInvalidTransitionException,
  SubscriptionNotFoundException,
} from './subscription.errors';
import { project } from './subscription.projection';
import {
  SubscriptionRepository,
  type SubscriptionRow,
} from './subscription.repository';
import {
  GRACE_PERIOD_DAYS,
  SubscriptionStatus,
  allowsPlanChange,
  allowsTransition,
  isTerminal,
} from './subscription.types';

const DIA_MS = 24 * 60 * 60_000;

export interface CreateSubscriptionInput {
  organizationId: string;
  planCode: PlanCode;
  billingInterval: BillingInterval;
  /** Quando o acesso começa. O aniversário sai daqui. */
  startsAt?: Date;
  trial?: { startsAt: Date; endsAt: Date };
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(private readonly repository: SubscriptionRepository) {}

  /* ---------------------------------------------------------------- */
  /* Leitura                                                           */
  /* ---------------------------------------------------------------- */

  /**
   * A assinatura corrente, já reconciliada em memória.
   *
   * O estado devolvido é o de **agora**, mesmo que o reconciliador ainda não
   * tenha passado. É esta a garantia que impede um worker atrasado de dar
   * tempo extra a quem venceu.
   */
  async currentOrNull(
    organizationId: string,
    at: Date = new Date(),
  ): Promise<
    (SubscriptionRow & { effectiveStatus: SubscriptionStatus }) | null
  > {
    const linha = await this.repository.findCurrent(organizationId);
    if (!linha) return null;
    const projetado = project(this.estado(linha), at);
    return {
      ...linha,
      currentPeriodStart: projetado.currentPeriodStart,
      currentPeriodEnd: projetado.currentPeriodEnd,
      effectiveStatus: projetado.status,
    };
  }

  async requireCurrent(organizationId: string, at: Date = new Date()) {
    const assinatura = await this.currentOrNull(organizationId, at);
    if (!assinatura) throw new SubscriptionNotFoundException(organizationId);
    return assinatura;
  }

  /* ---------------------------------------------------------------- */
  /* Comandos                                                          */
  /* ---------------------------------------------------------------- */

  /**
   * Cria a assinatura corrente.
   *
   * O retrato dos direitos é tirado agora e guardado: mudar o catálogo amanhã
   * não altera o que esta organização contratou hoje.
   */
  async create(
    input: CreateSubscriptionInput,
    transaction?: PrismaTransactionClient,
  ): Promise<SubscriptionRow> {
    const existente = await this.repository.findCurrent(
      input.organizationId,
      transaction,
    );
    if (existente) {
      throw new ConflictException(
        'Organization already has a current subscription',
        'CONFLICT',
      );
    }
    const plano = planDefinition(input.planCode);
    const inicio = input.startsAt ?? new Date();
    const periodo = anchoredPeriod(
      inicio,
      BILLING_INTERVAL_MONTHS[input.billingInterval] ?? 1,
      inicio,
    );
    return this.repository.create(
      {
        organizationId: input.organizationId,
        planCode: plano.code,
        catalogVersion: CATALOG_VERSION,
        entitlementsSnapshot: snapshotOf(plano) as unknown as Prisma.JsonValue,
        billingInterval: input.billingInterval,
        status: input.trial
          ? SubscriptionStatus.TRIALING
          : SubscriptionStatus.ACTIVE,
        billingAnchorAt: inicio,
        currentPeriodStart: periodo.start,
        currentPeriodEnd: periodo.end,
        trialStartsAt: input.trial?.startsAt ?? null,
        trialEndsAt: input.trial?.endsAt ?? null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        graceStartsAt: null,
        graceEndsAt: null,
        pendingPlanCode: null,
        pendingBillingInterval: null,
        pendingCatalogVersion: null,
        pendingEntitlementsSnapshot: null,
        pendingEffectiveAt: null,
        startedAt: inicio,
        endedAt: null,
      },
      transaction,
    );
  }

  /**
   * Agenda o encerramento para o fim do período já contratado.
   *
   * Vale igual para mensal, semestral e anual: o cliente pagou por um tempo de
   * acesso e recebe esse tempo. Não há devolução nem cálculo proporcional aqui
   * — isso é decisão financeira, e não existe provedor financeiro nesta etapa.
   */
  async cancelAtPeriodEnd(organizationId: string, expectedVersion: number) {
    return this.comando(organizationId, expectedVersion, (atual) => {
      if (isTerminal(atual.effectiveStatus)) {
        throw new SubscriptionInvalidTransitionException(
          atual.effectiveStatus,
          SubscriptionStatus.CANCELED,
        );
      }
      return { cancelAtPeriodEnd: true, canceledAt: new Date() };
    });
  }

  /** Desfaz o encerramento agendado, enquanto o período ainda corre. */
  async keepSubscription(organizationId: string, expectedVersion: number) {
    return this.comando(organizationId, expectedVersion, (atual) => {
      if (!atual.cancelAtPeriodEnd) {
        throw new PlanChangeNotAllowedException('no scheduled cancellation');
      }
      if (isTerminal(atual.effectiveStatus)) {
        throw new SubscriptionInvalidTransitionException(
          atual.effectiveStatus,
          SubscriptionStatus.ACTIVE,
        );
      }
      return { cancelAtPeriodEnd: false, canceledAt: null };
    });
  }

  /**
   * Troca de plano.
   *
   * Subir vale na hora; descer entra na fila do próximo período. Quem decide
   * qual é qual é o preço de tabela mensal do catálogo — é a única ordenação
   * comercial que existe entre os planos, e ela não depende de nome.
   */
  async changePlan(
    organizationId: string,
    expectedVersion: number,
    planCode: PlanCode,
    billingInterval?: BillingInterval,
  ) {
    return this.comando(organizationId, expectedVersion, (atual) => {
      if (!allowsPlanChange(atual.effectiveStatus)) {
        throw new PlanChangeNotAllowedException(
          `status ${atual.effectiveStatus}`,
        );
      }
      const destino = planDefinition(planCode);
      const origem = planDefinition(atual.planCode);
      const intervalo = billingInterval ?? atual.billingInterval;

      const mesmoPlano = destino.code === origem.code;
      const mesmoIntervalo = intervalo === atual.billingInterval;
      if (mesmoPlano && mesmoIntervalo) {
        throw new PlanChangeNotAllowedException('no change requested');
      }

      const subida =
        destino.prices[BillingInterval.MONTHLY]!.amountMinor >
        origem.prices[BillingInterval.MONTHLY]!.amountMinor;

      if (subida) {
        /** Imediato: o cliente comprou mais e recebe agora. */
        const periodo = anchoredPeriod(
          atual.billingAnchorAt,
          BILLING_INTERVAL_MONTHS[intervalo] ?? 1,
          new Date(),
        );
        return {
          planCode: destino.code,
          catalogVersion: CATALOG_VERSION,
          entitlementsSnapshot: snapshotOf(
            destino,
          ) as unknown as Prisma.InputJsonValue,
          billingInterval: intervalo,
          currentPeriodStart: periodo.start,
          currentPeriodEnd: periodo.end,
          pendingPlanCode: null,
          pendingBillingInterval: null,
          pendingCatalogVersion: null,
          pendingEntitlementsSnapshot: Prisma.DbNull,
          pendingEffectiveAt: null,
        };
      }

      /**
       * Programado: nada muda até o período virar.
       *
       * Rebaixar não desliga ninguém nem apaga recurso. Quando a mudança valer,
       * o que existe continua existindo — o que fica bloqueado é criar mais.
       */
      return {
        pendingPlanCode: destino.code,
        pendingBillingInterval: intervalo,
        pendingCatalogVersion: CATALOG_VERSION,
        pendingEntitlementsSnapshot: snapshotOf(
          destino,
        ) as unknown as Prisma.InputJsonValue,
        pendingEffectiveAt: atual.currentPeriodEnd,
      };
    });
  }

  /** Cancela uma troca ainda não efetivada. */
  async cancelScheduledChange(organizationId: string, expectedVersion: number) {
    return this.comando(organizationId, expectedVersion, (atual) => {
      if (!atual.pendingPlanCode) {
        throw new PlanChangeNotAllowedException('no scheduled change');
      }
      return {
        pendingPlanCode: null,
        pendingBillingInterval: null,
        pendingCatalogVersion: null,
        pendingEntitlementsSnapshot: Prisma.DbNull,
        pendingEffectiveAt: null,
      };
    });
  }

  /* ---------------------------------------------------------------- */
  /* Fatos financeiros — a PR-PL-03 os trará do provedor               */
  /* ---------------------------------------------------------------- */

  /** A cobrança falhou. O acesso continua; o relógio da carência começa. */
  async reportPaymentFailed(organizationId: string, expectedVersion: number) {
    return this.comando(organizationId, expectedVersion, (atual) => {
      this.assertTransicao(atual.effectiveStatus, SubscriptionStatus.PAST_DUE);
      const agora = new Date();
      return {
        status: SubscriptionStatus.GRACE_PERIOD,
        graceStartsAt: agora,
        graceEndsAt: new Date(agora.getTime() + GRACE_PERIOD_DAYS * DIA_MS),
      };
    });
  }

  /** A cobrança entrou. Volta a valer, e a carência é esquecida. */
  async reportPaymentSucceeded(
    organizationId: string,
    expectedVersion: number,
  ) {
    return this.comando(organizationId, expectedVersion, (atual) => {
      this.assertTransicao(atual.effectiveStatus, SubscriptionStatus.ACTIVE);
      const periodo = anchoredPeriod(
        atual.billingAnchorAt,
        BILLING_INTERVAL_MONTHS[atual.billingInterval] ?? 1,
        new Date(),
      );
      return {
        status: SubscriptionStatus.ACTIVE,
        graceStartsAt: null,
        graceEndsAt: null,
        currentPeriodStart: periodo.start,
        currentPeriodEnd: periodo.end,
      };
    });
  }

  /* ---------------------------------------------------------------- */
  /* Vínculo com o provedor                                            */
  /* ---------------------------------------------------------------- */

  /**
   * Registra o retrato do provedor — diagnóstico, não decisão.
   *
   * `providerStatus` existe para quem investiga um caso; nenhuma regra o
   * consulta. O que decide acesso continua sendo `status`, que é do Orbit. Sem
   * conferência de versão de propósito: isto não muda direito nenhum, e
   * recusar um retrato por corrida só deixaria o diagnóstico velho.
   */
  async syncProviderSnapshot(
    id: string,
    snapshot: {
      providerStatus: string;
      providerPriceId: string | null;
      providerLastEventId: string | null;
      cancelAtPeriodEnd: boolean;
    },
  ): Promise<void> {
    await this.repository.updateProviderSnapshot(id, {
      providerStatus: snapshot.providerStatus,
      providerPriceId: snapshot.providerPriceId,
      providerLastEventId: snapshot.providerLastEventId,
      providerUpdatedAt: new Date(),
      cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
    });
  }

  /** Liga a assinatura do Orbit à do provedor. Uma vez, e só uma. */
  async linkProvider(
    id: string,
    link: {
      provider: string;
      providerSubscriptionId: string;
      providerCustomerId: string;
      providerPriceId: string | null;
      providerStatus: string;
    },
  ): Promise<void> {
    await this.repository.linkProvider(id, link);
  }

  /* ---------------------------------------------------------------- */
  /* Internos                                                          */
  /* ---------------------------------------------------------------- */

  private assertTransicao(from: string, to: SubscriptionStatus): void {
    if (!allowsTransition(from, to)) {
      throw new SubscriptionInvalidTransitionException(from, to);
    }
  }

  /**
   * Um comando, com versão conferida no mesmo comando que escreve.
   *
   * Cancelar e trocar de plano ao mesmo tempo não pode produzir um estado que
   * nenhum dos dois pediu: quem chega segundo encontra a versão mudada e é
   * recusado com `STALE_VERSION`, o mesmo código que o resto do produto usa.
   */
  private async comando(
    organizationId: string,
    expectedVersion: number,
    decidir: (
      atual: SubscriptionRow & { effectiveStatus: SubscriptionStatus },
    ) => Prisma.OrganizationSubscriptionUpdateInput,
  ): Promise<SubscriptionRow> {
    const atual = await this.requireCurrent(organizationId);
    const atualizada = await this.repository.updateIfVersion(
      atual.id,
      expectedVersion,
      decidir(atual),
    );
    if (!atualizada) {
      throw new ConflictException(
        'Subscription version is stale',
        'STALE_VERSION',
      );
    }
    return atualizada;
  }

  private estado(linha: SubscriptionRow) {
    return {
      status: linha.status,
      billingInterval: linha.billingInterval,
      billingAnchorAt: linha.billingAnchorAt,
      currentPeriodStart: linha.currentPeriodStart,
      currentPeriodEnd: linha.currentPeriodEnd,
      trialEndsAt: linha.trialEndsAt,
      graceEndsAt: linha.graceEndsAt,
      cancelAtPeriodEnd: linha.cancelAtPeriodEnd,
      pendingEffectiveAt: linha.pendingEffectiveAt,
    };
  }
}
