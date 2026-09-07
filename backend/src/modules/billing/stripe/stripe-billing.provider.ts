/**
 * O adaptador do Stripe — o **único** arquivo que importa o SDK.
 *
 * Aqui se traduz, e não se decide. Nenhuma regra de ciclo de vida mora neste
 * arquivo: ele converte objetos do provedor para o modelo normalizado e
 * devolve; quem decide o que fazer com isso é a aplicação.
 *
 * ## Chaves de idempotência
 *
 * Toda escrita leva uma chave derivada de identidade estável do comando —
 * organização, assinatura, plano. Nunca do relógio: chave com carimbo de tempo
 * não é idempotência, é um identificador novo a cada tentativa, exatamente
 * quando a repetição é o que importa.
 *
 * ## O período mora no item
 *
 * Nesta versão da API, `current_period_start/end` são do
 * `SubscriptionItem`, e não da `Subscription` — verificado nos tipos do SDK
 * instalado, não presumido.
 */
import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { InfrastructureException } from '../../../exceptions';
import {
  BILLING_INTERVAL_MONTHS,
  BillingInterval,
  PlanCode,
  type BillingInterval as BillingIntervalType,
  type PlanCode as PlanCodeType,
} from '../../subscription-plans/catalog/plan-catalog.types';
import { planDefinition } from '../../subscription-plans/catalog/plan-registry';
import { BillingConfig, STRIPE_API_VERSION } from '../billing.config';
import {
  BillingProviderName,
  type BillingPortalSession,
  type BillingProvider,
  type CheckoutSession,
  type CheckoutSessionRequest,
  type PriceVerification,
  type ProviderEvent,
  type ProviderSubscription,
} from '../billing.types';
import {
  BillingConfigurationInvalidException,
  BillingNotConfiguredException,
  BillingProviderUnavailableException,
  BillingWebhookInvalidException,
} from '../billing.errors';
import { toProviderBillingState } from './stripe-status.mapper';

/** Um provedor lento não pode prender uma requisição do produto. */
const TIMEOUT_MS = 12_000;
const MAX_RETRIES = 2;

@Injectable()
export class StripeBillingProvider implements BillingProvider {
  readonly name = BillingProviderName.STRIPE;

  private readonly logger = new Logger(StripeBillingProvider.name);
  private readonly client: Stripe | null;

  constructor(private readonly config: BillingConfig) {
    this.client = config.enabled
      ? new Stripe(config.secretKey, {
          apiVersion: STRIPE_API_VERSION,
          timeout: TIMEOUT_MS,
          maxNetworkRetries: MAX_RETRIES,
          telemetry: false,
        })
      : null;
  }

  get mode() {
    return this.config.mode;
  }

  isEnabled(): boolean {
    return this.config.enabled && this.client !== null;
  }

  async createCustomer(input: {
    organizationId: string;
    displayName: string;
    idempotencyKey: string;
  }): Promise<{ providerCustomerId: string }> {
    const stripe = this.require();
    const customer = await this.chamar('createCustomer', () =>
      stripe.customers.create(
        {
          name: input.displayName,
          /**
           * Metadados mínimos, e só o que serve para reconciliar.
           *
           * Documento, endereço, credencial e a impressão do antifraude não
           * entram: o painel do provedor é mais uma superfície, e o que não
           * está lá não vaza de lá.
           */
          metadata: { orbitOrganizationId: input.organizationId },
        },
        { idempotencyKey: input.idempotencyKey },
      ),
    );
    return { providerCustomerId: customer.id };
  }

  async createCheckoutSession(
    request: CheckoutSessionRequest,
  ): Promise<CheckoutSession> {
    const stripe = this.require();
    const priceId = this.priceOrFail(request.planCode, request.billingInterval);

    const session = await this.chamar('createCheckoutSession', () =>
      stripe.checkout.sessions.create(
        {
          mode: 'subscription',
          customer: request.providerCustomerId,
          line_items: [{ price: priceId, quantity: 1 }],
          /** URLs do servidor. O cliente não escolhe para onde voltar. */
          success_url: this.config.checkoutSuccessUrl,
          cancel_url: this.config.checkoutCancelUrl,
          locale: 'pt-BR',
          subscription_data: {
            /**
             * A avaliação vem do estado aprovado pelo Orbit.
             *
             * O provedor nunca decide que uma empresa merece trinta dias. Se
             * decidisse, recriar o cliente lá seria um teste grátis novo e o
             * antifraude do Orbit viraria decoração.
             */
            ...(request.trialDays && request.trialDays > 0
              ? { trial_period_days: request.trialDays }
              : {}),
            metadata: {
              orbitOrganizationId: request.organizationId,
              orbitPlanCode: request.planCode,
              orbitBillingInterval: request.billingInterval,
              ...(request.subscriptionId
                ? { orbitSubscriptionId: request.subscriptionId }
                : {}),
            },
          },
          metadata: { orbitOrganizationId: request.organizationId },
        },
        { idempotencyKey: request.idempotencyKey },
      ),
    );

    if (!session.url) {
      throw new BillingProviderUnavailableException(
        'checkout session without url',
      );
    }
    return {
      providerSessionId: session.id,
      url: session.url,
      expiresAt: session.expires_at
        ? new Date(session.expires_at * 1000)
        : null,
    };
  }

  async createBillingPortalSession(input: {
    providerCustomerId: string;
  }): Promise<BillingPortalSession> {
    const stripe = this.require();
    const session = await this.chamar('createBillingPortalSession', () =>
      stripe.billingPortal.sessions.create({
        customer: input.providerCustomerId,
        return_url: this.config.portalReturnUrl,
        locale: 'pt-BR',
      }),
    );
    return { url: session.url };
  }

  async retrieveSubscription(
    providerSubscriptionId: string,
  ): Promise<ProviderSubscription> {
    const stripe = this.require();
    return this.normalizar(
      await this.chamar('retrieveSubscription', () =>
        stripe.subscriptions.retrieve(providerSubscriptionId),
      ),
    );
  }

  async changePlan(input: {
    providerSubscriptionId: string;
    planCode: PlanCodeType;
    billingInterval: BillingIntervalType;
    timing: 'IMMEDIATE' | 'PERIOD_END';
    idempotencyKey: string;
  }): Promise<ProviderSubscription> {
    const stripe = this.require();
    const priceId = this.priceOrFail(input.planCode, input.billingInterval);
    const atual = await this.chamar('retrieveSubscription', () =>
      stripe.subscriptions.retrieve(input.providerSubscriptionId),
    );
    const item = atual.items.data[0];
    if (!item) {
      throw new BillingProviderUnavailableException(
        'subscription without line item',
      );
    }

    return this.normalizar(
      await this.chamar('changePlan', () =>
        stripe.subscriptions.update(
          input.providerSubscriptionId,
          {
            items: [{ id: item.id, price: priceId }],
            /**
             * Quem calcula centavos é o provedor.
             *
             * Subir cobra a diferença agora; descer espera o fim do período. O
             * Orbit não recalcula proporcional — proporcional tem
             * arredondamento, imposto e histórico, e a fatura do provedor é a
             * autoridade financeira disso.
             */
            proration_behavior:
              input.timing === 'IMMEDIATE' ? 'create_prorations' : 'none',
          },
          { idempotencyKey: input.idempotencyKey },
        ),
      ),
    );
  }

  async setCancelAtPeriodEnd(input: {
    providerSubscriptionId: string;
    cancelAtPeriodEnd: boolean;
    idempotencyKey: string;
  }): Promise<ProviderSubscription> {
    const stripe = this.require();
    return this.normalizar(
      await this.chamar('setCancelAtPeriodEnd', () =>
        stripe.subscriptions.update(
          input.providerSubscriptionId,
          { cancel_at_period_end: input.cancelAtPeriodEnd },
          { idempotencyKey: input.idempotencyKey },
        ),
      ),
    );
  }

  /**
   * Verifica a assinatura sobre o corpo **cru**.
   *
   * O SDK recalcula o HMAC sobre exatamente os bytes recebidos. Reserializar o
   * JSON antes mudaria espaços, ordem de chaves e escapes; a assinatura
   * deixaria de bater para eventos legítimos, e a tentação seguinte seria
   * "consertar" ignorando a verificação.
   */
  verifyWebhook(rawBody: Buffer, signature: string): ProviderEvent {
    const stripe = this.require();
    let evento: Stripe.Event;
    try {
      evento = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.config.webhookSecret,
      );
    } catch (error) {
      /** O motivo fica no log; a resposta é sempre a mesma recusa. */
      this.logger.warn(
        JSON.stringify({
          stage: 'billing-webhook-invalid',
          reason: error instanceof Error ? error.name : 'UNKNOWN',
        }),
      );
      throw new BillingWebhookInvalidException('signature verification failed');
    }

    const objeto = evento.data.object as unknown as { id?: unknown };
    return {
      providerEventId: evento.id,
      type: evento.type,
      apiVersion: evento.api_version ?? null,
      createdAt: new Date(evento.created * 1000),
      objectId: typeof objeto.id === 'string' ? objeto.id : null,
      subscriptionId: this.assinaturaDoEvento(evento),
    };
  }

  /**
   * Confere os doze preços contra o catálogo do Orbit.
   *
   * Não corrige o painel do provedor: se lá diz 699,90 e aqui diz 599,00, quem
   * está errado é uma configuração, e adivinhar qual seria pior do que recusar.
   */
  async verifyPriceCatalog(): Promise<readonly PriceVerification[]> {
    const stripe = this.require();
    const resultados: PriceVerification[] = [];

    for (const planCode of Object.values(PlanCode)) {
      const plano = planDefinition(planCode);
      for (const interval of Object.values(BillingInterval)) {
        const priceId = this.config.priceId(planCode, interval);
        if (!priceId) {
          resultados.push({
            planCode,
            billingInterval: interval,
            configured: false,
            valid: false,
            problem: 'price is not configured',
          });
          continue;
        }
        try {
          const price = await this.chamar('retrievePrice', () =>
            stripe.prices.retrieve(priceId),
          );
          const problema = this.problemaDePreco(
            price,
            plano.prices[interval]!.amountMinor,
            BILLING_INTERVAL_MONTHS[interval] ?? 1,
          );
          resultados.push({
            planCode,
            billingInterval: interval,
            configured: true,
            valid: problema === null,
            problem: problema,
          });
        } catch (error) {
          resultados.push({
            planCode,
            billingInterval: interval,
            configured: true,
            valid: false,
            problem:
              error instanceof Error ? error.name : 'price retrieval failed',
          });
        }
      }
    }
    return resultados;
  }

  /* ---------------------------------------------------------------- */
  /* Internos                                                          */
  /* ---------------------------------------------------------------- */

  private problemaDePreco(
    price: Stripe.Price,
    esperadoMinor: number,
    mesesEsperados: number,
  ): string | null {
    if (!price.active) return 'price is inactive';
    if (price.currency !== 'brl') return `currency is ${price.currency}`;
    if (price.unit_amount !== esperadoMinor) {
      return `amount mismatch: provider ${String(price.unit_amount)} vs catalog ${esperadoMinor}`;
    }
    const recorrencia = price.recurring;
    if (!recorrencia) return 'price is not recurring';
    const meses =
      recorrencia.interval === 'year'
        ? 12 * (recorrencia.interval_count || 1)
        : recorrencia.interval === 'month'
          ? recorrencia.interval_count || 1
          : 0;
    if (meses !== mesesEsperados) {
      return `interval mismatch: provider ${meses} months vs catalog ${mesesEsperados}`;
    }
    return null;
  }

  private normalizar(assinatura: Stripe.Subscription): ProviderSubscription {
    const item = assinatura.items.data[0];
    return {
      providerSubscriptionId: assinatura.id,
      providerCustomerId:
        typeof assinatura.customer === 'string'
          ? assinatura.customer
          : assinatura.customer.id,
      providerPriceId: item?.price?.id ?? null,
      state: toProviderBillingState(assinatura.status),
      rawStatus: assinatura.status,
      currentPeriodStart: item?.current_period_start
        ? new Date(item.current_period_start * 1000)
        : null,
      currentPeriodEnd: item?.current_period_end
        ? new Date(item.current_period_end * 1000)
        : null,
      cancelAtPeriodEnd: assinatura.cancel_at_period_end,
      trialEndsAt: assinatura.trial_end
        ? new Date(assinatura.trial_end * 1000)
        : null,
      providerUpdatedAt: new Date(),
    };
  }

  private assinaturaDoEvento(evento: Stripe.Event): string | null {
    const objeto = evento.data.object as unknown as Record<string, unknown>;
    if (evento.type.startsWith('customer.subscription.')) {
      return typeof objeto['id'] === 'string' ? objeto['id'] : null;
    }
    const assinatura = objeto['subscription'];
    if (typeof assinatura === 'string') return assinatura;
    if (
      assinatura !== null &&
      typeof assinatura === 'object' &&
      typeof (assinatura as { id?: unknown }).id === 'string'
    ) {
      return (assinatura as { id: string }).id;
    }
    return null;
  }

  private priceOrFail(
    planCode: PlanCodeType,
    interval: BillingIntervalType,
  ): string {
    const priceId = this.config.priceId(planCode, interval);
    if (!priceId) {
      throw new BillingConfigurationInvalidException(
        `no configured price for ${planCode}/${interval}`,
      );
    }
    return priceId;
  }

  private require(): Stripe {
    if (!this.client) throw new BillingNotConfiguredException();
    return this.client;
  }

  /**
   * Uma chamada ao provedor, com a falha traduzida.
   *
   * O erro cru nunca sai daqui: `No such price: price_1ABC` conta ao cliente um
   * identificador da nossa configuração, e a mensagem pública não precisa dele.
   * E indisponibilidade **não** é pagamento recusado — confundir os dois
   * suspenderia clientes em dia num dia ruim do fornecedor.
   */
  private async chamar<T>(
    operacao: string,
    work: () => Promise<T>,
  ): Promise<T> {
    try {
      return await work();
    } catch (error) {
      const tipo =
        error instanceof Stripe.errors.StripeError ? error.type : 'unknown';
      this.logger.warn(
        JSON.stringify({
          stage: 'billing-provider',
          operacao,
          result: 'ERROR',
          providerErrorType: tipo,
          providerRequestId:
            error instanceof Stripe.errors.StripeError
              ? (error.requestId ?? null)
              : null,
        }),
      );
      if (
        error instanceof Stripe.errors.StripeConnectionError ||
        error instanceof Stripe.errors.StripeAPIError ||
        error instanceof Stripe.errors.StripeRateLimitError
      ) {
        throw new BillingProviderUnavailableException(tipo);
      }
      if (error instanceof Stripe.errors.StripeError) {
        throw new BillingConfigurationInvalidException(tipo);
      }
      throw new InfrastructureException('Billing provider call failed', {
        cause: error,
      });
    }
  }
}
