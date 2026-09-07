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
import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { SubscriptionService } from '../subscription-plans/subscriptions/subscription.service';
import { TrialEligibilityService } from '../subscription-plans/subscriptions/trial-eligibility.service';
import {
  TRIAL_DAYS,
  allowsPlanChange,
  SubscriptionStatus,
} from '../subscription-plans/subscriptions/subscription.types';
import {
  PlanCode,
  type BillingInterval,
  type PlanCode as PlanCodeType,
} from '../subscription-plans/catalog/plan-catalog.types';
import { BillingConfig } from './billing.config';
import {
  BillingCheckoutNotAllowedException,
  BillingNotConfiguredException,
} from './billing.errors';
import { BillingRepository } from './billing.repository';
import {
  BILLING_PROVIDER,
  type BillingProvider,
  type CheckoutSession,
} from './billing.types';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @Inject(BILLING_PROVIDER) private readonly provider: BillingProvider,
    private readonly repository: BillingRepository,
    private readonly config: BillingConfig,
    private readonly subscriptions: SubscriptionService,
    private readonly trials: TrialEligibilityService,
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
  async ensureCustomer(organizationId: string): Promise<string> {
    this.assertEnabled();
    const existente = await this.repository.findCustomer(
      organizationId,
      this.provider.name,
      this.provider.mode,
    );
    if (existente) return existente.providerCustomerId;

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
    return vinculo.providerCustomerId;
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
    const assinatura = await this.subscriptions.currentOrNull(
      input.organizationId,
    );
    if (assinatura && !allowsPlanChange(assinatura.effectiveStatus)) {
      throw new BillingCheckoutNotAllowedException(
        `subscription status ${assinatura.effectiveStatus}`,
      );
    }

    const customerId = await this.ensureCustomer(input.organizationId);

    return this.provider.createCheckoutSession({
      organizationId: input.organizationId,
      providerCustomerId: customerId,
      planCode: input.planCode,
      billingInterval: input.billingInterval,
      trialDays: this.diasDeAvaliacao(assinatura, input.planCode),
      subscriptionId: assinatura?.id ?? null,
      /**
       * A mesma intenção produz a mesma chave.
       *
       * Clicar duas vezes em "assinar" devolve a mesma sessão do provedor em
       * vez de abrir duas contratações concorrentes para a mesma empresa.
       */
      idempotencyKey: this.chave(
        'checkout',
        `${input.organizationId}:${input.planCode}:${input.billingInterval}:${assinatura?.version ?? 0}`,
      ),
    });
  }

  async createBillingPortalSession(
    organizationId: string,
  ): Promise<{ url: string }> {
    this.assertEnabled();
    const customerId = await this.ensureCustomer(organizationId);
    return this.provider.createBillingPortalSession({
      providerCustomerId: customerId,
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
    } | null,
    planCode: PlanCodeType,
  ): number | null {
    if (planCode !== PlanCode.ESSENTIAL) return null;
    if (
      !assinatura ||
      assinatura.effectiveStatus !== SubscriptionStatus.TRIALING
    ) {
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
