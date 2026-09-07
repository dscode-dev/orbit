/**
 * O que a tela precisa saber sobre cobrança.
 *
 * Sem segredo, sem identificador do provedor, sem evento e sem erro interno.
 * O suficiente para a PR-PL-04 desenhar uma página honesta — inclusive quando
 * a cobrança está desligada, caso em que a resposta é "indisponível", e não um
 * erro técnico na cara de quem estava só olhando o plano.
 */
import { Inject, Injectable } from '@nestjs/common';
import { SubscriptionService } from '../subscription-plans/subscriptions/subscription.service';
import { allowsPlanChange } from '../subscription-plans/subscriptions/subscription.types';
import { BillingRepository } from './billing.repository';
import { BILLING_PROVIDER, type BillingProvider } from './billing.types';

export interface BillingReadinessReadModel {
  /** A integração está configurada neste ambiente? */
  configured: boolean;
  /** `TEST` ou `LIVE`, e só fora de produção interessa a quem opera. */
  mode: string | null;
  canCheckout: boolean;
  canOpenBillingPortal: boolean;
  allowedActions: readonly string[];
}

@Injectable()
export class BillingReadService {
  constructor(
    @Inject(BILLING_PROVIDER) private readonly provider: BillingProvider,
    private readonly repository: BillingRepository,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async readiness(organizationId: string): Promise<BillingReadinessReadModel> {
    const configurada = this.provider.isEnabled();
    if (!configurada) {
      return {
        configured: false,
        mode: null,
        canCheckout: false,
        canOpenBillingPortal: false,
        allowedActions: [],
      };
    }

    const assinatura = await this.subscriptions.currentOrNull(organizationId);
    const cliente = await this.repository.findCustomer(
      organizationId,
      this.provider.name,
      this.provider.mode,
    );

    const podeContratar =
      assinatura === null || allowsPlanChange(assinatura.effectiveStatus);
    /** Sem cliente no provedor não há portal para abrir — ele nasce no checkout. */
    const podeAbrirPortal = cliente !== null;

    return {
      configured: true,
      mode: this.provider.mode,
      canCheckout: podeContratar,
      canOpenBillingPortal: podeAbrirPortal,
      allowedActions: [
        ...(podeContratar ? ['START_CHECKOUT'] : []),
        ...(podeAbrirPortal ? ['OPEN_BILLING_PORTAL'] : []),
      ],
    };
  }
}
