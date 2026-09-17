/**
 * Os comandos de cobrança, do lado do Orbit.
 *
 * ## O que este serviço recusa a fazer
 *
 * Não decide preço, não decide valor e não decide avaliação a partir de nada
 * que o cliente envie. O DTO de contratação aceita **plano e periodicidade**;
 * tudo o mais é resolvido aqui, do catálogo e do estado aprovado.
 *
 * ## E o que ele recusa a acreditar
 *
 * Voltar da tela do provedor não ativa assinatura nenhuma. A URL de sucesso é
 * navegação; quem ativa é o estado verificado do provedor chegando por
 * webhook assinado ou por reconciliação — e nada mais.
 */
import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { generateUuidV7 } from '../../utils';
import { SubscriptionService } from '../subscription-plans/subscriptions/subscription.service';
import {
  TRIAL_DAYS,
  allowsInitialCheckout,
  SubscriptionStatus,
} from '../subscription-plans/subscriptions/subscription.types';
import {
  PlanCode,
  type BillingInterval,
  type PlanCode as PlanCodeType,
} from '../subscription-plans/catalog/plan-catalog.types';
import {
  BillingCheckoutNotAllowedException,
  BillingNotConfiguredException,
} from './billing.errors';
import {
  BillingRepository,
  type BillingCustomerRow,
} from './billing.repository';
import {
  BILLING_PROVIDER,
  ProviderCheckoutState,
  type BillingProvider,
  type CheckoutSession,
} from './billing.types';

@Injectable()
export class BillingService {
  constructor(
    @Inject(BILLING_PROVIDER) private readonly provider: BillingProvider,
    private readonly repository: BillingRepository,
    private readonly subscriptions: SubscriptionService,
  ) {}

  isEnabled(): boolean {
    return this.provider.isEnabled();
  }

  /**
   * O cliente da organização no provedor, criado uma vez só.
   *
   * A corrida é resolvida pelo índice único: duas requisições simultâneas
   * podem chegar a criar dois clientes no provedor, mas só um vira o vínculo
   * canônico — e o outro fica órfão lá, sem cobrança e sem assinatura. É o
   * preço aceitável de não segurar um bloqueio durante uma chamada de rede.
   */
  async ensureCustomer(organizationId: string): Promise<BillingCustomerRow> {
    this.assertEnabled();
    const existente = await this.repository.findCustomer(
      organizationId,
      this.provider.name,
      this.provider.mode,
    );
    if (existente) return existente;

    const criado = await this.provider.createCustomer({
      organizationId,
      displayName: await this.repository.organizationName(organizationId),
      /** Derivada da identidade, nunca do relógio. */
      idempotencyKey: this.chave('customer', organizationId),
    });
    const vinculo = await this.repository.linkCustomer({
      organizationId,
      provider: this.provider.name,
      mode: this.provider.mode,
      providerCustomerId: criado.providerCustomerId,
    });
    return vinculo;
  }

  /**
   * Abre a contratação.
   *
   * A avaliação, quando existe, vem do estado que o Orbit já aprovou: se a
   * assinatura está em avaliação, os dias que faltam são espelhados no
   * provedor. Recriar cliente ou sessão não gera avaliação nova, porque
   * ninguém aqui consulta o cliente do provedor para decidir isso.
   */
  async createCheckoutSession(input: {
    organizationId: string;
    planCode: PlanCodeType;
    billingInterval: BillingInterval;
  }): Promise<CheckoutSession> {
    this.assertEnabled();
    const assinatura = await this.subscriptions.requireCurrent(
      input.organizationId,
    );
    if (!allowsInitialCheckout(assinatura.effectiveStatus)) {
      throw new BillingCheckoutNotAllowedException(
        `subscription status ${assinatura.effectiveStatus}`,
      );
    }
    if (assinatura.providerSubscriptionId) {
      throw new BillingCheckoutNotAllowedException(
        'subscription is already linked to the billing provider',
      );
    }
    if (
      assinatura.planCode !== input.planCode ||
      assinatura.billingInterval !== input.billingInterval
    ) {
      throw new BillingCheckoutNotAllowedException(
        'checkout must match the current subscription',
      );
    }

    const customer = await this.ensureCustomer(input.organizationId);

    for (let passagem = 0; passagem < 2; passagem += 1) {
      const attemptId = generateUuidV7();
      const { attempt } = await this.repository.beginCheckoutAttempt({
        id: attemptId,
        organizationId: input.organizationId,
        subscriptionId: assinatura.id,
        billingCustomerId: customer.id,
        provider: this.provider.name,
        mode: this.provider.mode,
        planCode: input.planCode,
        billingInterval: input.billingInterval,
        idempotencyKey: this.chave('checkout-attempt', attemptId),
      });

      if (
        attempt.subscriptionId !== assinatura.id ||
        attempt.planCode !== input.planCode ||
        attempt.billingInterval !== input.billingInterval ||
        attempt.billingCustomerId !== customer.id
      ) {
        throw new BillingCheckoutNotAllowedException(
          'another checkout is already in progress',
        );
      }

      if (attempt.providerSessionId) {
        const currentSession = await this.provider.retrieveCheckoutSession(
          attempt.providerSessionId,
        );
        if (currentSession.state === ProviderCheckoutState.EXPIRED) {
          await this.repository.expireCheckoutAttempt(attempt.id);
          continue;
        }
        if (currentSession.state === ProviderCheckoutState.COMPLETE) {
          throw new BillingCheckoutNotAllowedException(
            'checkout is already complete and awaiting reconciliation',
          );
        }
      }

      /**
       * A tentativa já estava persistida. Se a aplicação caiu após o Stripe
       * responder, a mesma chave recupera a mesma sessão sem criar cobrança
       * paralela.
       */
      const session = await this.provider.createCheckoutSession({
        checkoutAttemptId: attempt.id,
        organizationId: input.organizationId,
        providerCustomerId: customer.providerCustomerId,
        planCode: input.planCode,
        billingInterval: input.billingInterval,
        trialDays: this.diasDeAvaliacao(assinatura, input.planCode),
        subscriptionId: assinatura.id,
        idempotencyKey: attempt.idempotencyKey,
      });
      await this.repository.openCheckoutAttempt({
        id: attempt.id,
        providerSessionId: session.providerSessionId,
        expiresAt: session.expiresAt,
      });
      return session;
    }

    throw new BillingCheckoutNotAllowedException(
      'expired checkout could not be replaced',
    );
  }

  async createBillingPortalSession(
    organizationId: string,
  ): Promise<{ url: string }> {
    this.assertEnabled();
    const customer = await this.ensureCustomer(organizationId);
    return this.provider.createBillingPortalSession({
      providerCustomerId: customer.providerCustomerId,
    });
  }

  /* ---------------------------------------------------------------- */
  /* Internos                                                          */
  /* ---------------------------------------------------------------- */

  /**
   * Quantos dias de avaliação espelhar no provedor.
   *
   * Sai do estado que o Orbit **já** aprovou, e nunca de uma nova avaliação de
   * elegibilidade no momento do checkout: se decidisse aqui, abrir dez sessões
   * seria dez chances de conseguir trinta dias.
   */
  private diasDeAvaliacao(
    assinatura: {
      effectiveStatus: SubscriptionStatus;
      trialEndsAt: Date | null;
    },
    planCode: PlanCodeType,
  ): number | null {
    if (planCode !== PlanCode.ESSENTIAL) return null;
    if (assinatura.effectiveStatus !== SubscriptionStatus.TRIALING) {
      return null;
    }
    if (!assinatura.trialEndsAt) return null;
    const restantes = Math.ceil(
      (assinatura.trialEndsAt.getTime() - Date.now()) / 86_400_000,
    );
    if (restantes <= 0) return null;
    return Math.min(restantes, TRIAL_DAYS);
  }

  /** Chave estável: mesmo comando, mesma chave, qualquer que seja a hora. */
  private chave(escopo: string, identidade: string): string {
    return `orbit:${escopo}:${createHash('sha256')
      .update(identidade)
      .digest('hex')
      .slice(0, 40)}`;
  }

  private assertEnabled(): void {
    if (!this.provider.isEnabled()) throw new BillingNotConfiguredException();
  }
}
