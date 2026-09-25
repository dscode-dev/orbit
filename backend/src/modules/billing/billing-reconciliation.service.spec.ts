import { RequestContextStorage } from '../../context';
import { BillingProviderUnavailableException } from './billing.errors';
import { BillingReconciliationService } from './billing-reconciliation.service';
import {
  BillingMode,
  BillingProviderName,
  ProviderBillingState,
  type BillingProvider,
} from './billing.types';
import {
  BillingInterval,
  PlanCode,
} from '../subscription-plans/catalog/plan-catalog.types';
import { SubscriptionStatus } from '../subscription-plans/subscriptions/subscription.types';

describe('BillingReconciliationService durable inbox', () => {
  const event = (overrides: Record<string, unknown> = {}) => ({
    id: '01900000-0000-7000-8000-000000000001',
    provider: BillingProviderName.STRIPE,
    providerEventId: 'evt_test_1',
    eventType: 'customer.subscription.updated',
    providerObjectId: 'sub_test_1',
    providerSubscriptionId: 'sub_test_1',
    apiVersion: '2026-08-26.dahlia',
    providerCreatedAt: new Date(),
    receivedAt: new Date(),
    processingStatus: 'PROCESSING',
    attempts: 1,
    processingToken: '01900000-0000-7000-8000-000000000002',
    ...overrides,
  });

  const setup = (
    claimed = event(),
    catalogEntry: {
      planCode: PlanCode;
      billingInterval: BillingInterval;
    } | null = null,
  ) => {
    const provider = {
      name: BillingProviderName.STRIPE,
      mode: BillingMode.TEST,
      isEnabled: jest.fn().mockReturnValue(true),
      retrieveSubscription: jest.fn(),
    } as unknown as BillingProvider;
    const repository = {
      claimNextEvent: jest
        .fn()
        .mockResolvedValueOnce(claimed)
        .mockResolvedValue(null),
      finishClaimedEvent: jest.fn().mockResolvedValue(undefined),
      retryClaimedEvent: jest.fn().mockResolvedValue(undefined),
      findSubscriptionByProviderId: jest.fn(),
    };
    const checkout = { fulfill: jest.fn() };
    const subscriptions = {
      currentOrNull: jest.fn(),
      applyProviderPlan: jest.fn().mockResolvedValue(undefined),
      syncProviderSnapshot: jest.fn().mockResolvedValue(undefined),
    };
    const config = {
      enabled: catalogEntry !== null,
      catalogEntryForPrice: jest.fn().mockReturnValue(catalogEntry),
    };
    const service = new BillingReconciliationService(
      provider,
      repository as never,
      checkout as never,
      subscriptions as never,
      config as never,
      new RequestContextStorage(),
    );
    return { service, provider, repository, checkout, subscriptions, config };
  };

  it('arquiva evento suportado por assinatura, mas sem consumidor', async () => {
    const claimed = event({ eventType: 'customer.discount.created' });
    const { service, repository } = setup(claimed);

    await expect(service.drainInbox()).resolves.toMatchObject({
      examined: 1,
      ignored: 1,
    });
    expect(repository.finishClaimedEvent).toHaveBeenCalledWith({
      id: claimed.id,
      processingToken: claimed.processingToken,
      status: 'IGNORED',
    });
    expect(repository.retryClaimedEvent).not.toHaveBeenCalled();
  });

  it('devolve ao backoff quando o Stripe está indisponível', async () => {
    const claimed = event();
    const { service, provider, repository } = setup(claimed);
    (provider.retrieveSubscription as jest.Mock).mockRejectedValue(
      new BillingProviderUnavailableException('timeout'),
    );

    await expect(service.drainInbox()).resolves.toMatchObject({
      examined: 1,
      deferred: 1,
      failed: 0,
    });
    expect(repository.retryClaimedEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: claimed.id,
        processingToken: claimed.processingToken,
        errorCode: 'PROVIDER_UNAVAILABLE',
        deadLetter: false,
      }),
    );
    expect(repository.finishClaimedEvent).not.toHaveBeenCalled();
  });

  it('manda correlação de checkout inválida para dead-letter', async () => {
    const claimed = event({
      eventType: 'checkout.session.completed',
      providerObjectId: 'cs_test_1',
      providerSubscriptionId: null,
    });
    const { service, repository, checkout } = setup(claimed);
    checkout.fulfill.mockRejectedValue(new Error('CHECKOUT_PRICE_MISMATCH'));

    await expect(service.drainInbox()).resolves.toMatchObject({
      examined: 1,
      failed: 1,
      deferred: 0,
    });
    expect(repository.retryClaimedEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'CHECKOUT_PRICE_MISMATCH',
        deadLetter: true,
      }),
    );
  });

  it('encerra em dead-letter quando o orçamento de tentativas acaba', async () => {
    const claimed = event({ attempts: 8 });
    const { service, provider, repository } = setup(claimed);
    (provider.retrieveSubscription as jest.Mock).mockRejectedValue(
      new Error('temporary internal failure'),
    );

    await service.drainInbox();

    expect(repository.retryClaimedEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'RETRY_EXHAUSTED',
        deadLetter: true,
      }),
    );
  });

  it('traduz o price id canônico para plano sem confiar no evento', async () => {
    const target = {
      planCode: PlanCode.PROFESSIONAL_INTELLIGENCE,
      billingInterval: BillingInterval.ANNUAL,
    } as const;
    const { service, provider, repository, subscriptions } = setup(
      event(),
      target,
    );
    const start = new Date('2026-10-01T00:00:00.000Z');
    const end = new Date('2027-10-01T00:00:00.000Z');
    (provider.retrieveSubscription as jest.Mock).mockResolvedValue({
      providerSubscriptionId: 'sub_test_1',
      providerCustomerId: 'cus_test_1',
      providerPriceId: 'price_target',
      state: ProviderBillingState.ACTIVE,
      rawStatus: 'active',
      currentPeriodStart: start,
      currentPeriodEnd: end,
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
      providerUpdatedAt: new Date(),
    });
    repository.findSubscriptionByProviderId.mockResolvedValue({
      organizationId: '01900000-0000-7000-8000-000000000099',
      providerCustomerId: 'cus_test_1',
    });
    subscriptions.currentOrNull.mockResolvedValue({
      id: '01900000-0000-7000-8000-000000000098',
      organizationId: '01900000-0000-7000-8000-000000000099',
      version: 4,
      effectiveStatus: SubscriptionStatus.ACTIVE,
      planCode: PlanCode.PROFESSIONAL,
      billingInterval: BillingInterval.MONTHLY,
      currentPeriodStart: start,
      currentPeriodEnd: new Date('2026-11-01T00:00:00.000Z'),
      cancelAtPeriodEnd: false,
    });

    await service.reconcileProviderSubscription('sub_test_1', 'evt_test_1');

    expect(subscriptions.applyProviderPlan).toHaveBeenCalledWith(
      '01900000-0000-7000-8000-000000000099',
      4,
      {
        planCode: target.planCode,
        billingInterval: target.billingInterval,
        period: { start, end },
        activate: true,
        cancelAtPeriodEnd: false,
      },
    );
  });
});
