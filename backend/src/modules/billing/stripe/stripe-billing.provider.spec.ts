import {
  BillingInterval,
  PlanCode,
} from '../../subscription-plans/catalog/plan-catalog.types';
import { BillingMode } from '../billing.types';
import { StripeBillingProvider } from './stripe-billing.provider';

describe('StripeBillingProvider subscription commands', () => {
  const current = (overrides: Record<string, unknown> = {}) => ({
    id: 'sub_test_1',
    customer: 'cus_test_1',
    status: 'active',
    cancel_at_period_end: false,
    trial_end: null,
    schedule: null,
    metadata: {},
    items: {
      data: [
        {
          id: 'si_test_1',
          price: { id: 'price_old' },
          quantity: 1,
          current_period_start: 1_791_158_400,
          current_period_end: 1_793_836_800,
        },
      ],
    },
    ...overrides,
  });

  const setup = () => {
    const config = {
      enabled: true,
      secretKey: 'sk_test_unit_only',
      mode: BillingMode.TEST,
      priceId: jest.fn().mockReturnValue('price_target'),
    };
    const subscriptions = {
      retrieve: jest.fn().mockResolvedValue(current()),
      update: jest.fn().mockResolvedValue(
        current({
          metadata: {
            orbitOrganizationId: 'org_1',
            orbitSubscriptionId: 'local_sub_1',
          },
          items: {
            data: [
              {
                id: 'si_test_1',
                price: { id: 'price_target' },
                quantity: 1,
                current_period_start: 1_791_158_400,
                current_period_end: 1_793_836_800,
              },
            ],
          },
        }),
      ),
    };
    const subscriptionSchedules = {
      create: jest.fn().mockResolvedValue({
        id: 'sub_sched_1',
        metadata: {},
        current_phase: { start: 1_791_158_400, end: 1_793_836_800 },
      }),
      retrieve: jest.fn(),
      update: jest.fn().mockResolvedValue({ id: 'sub_sched_1' }),
      release: jest.fn().mockResolvedValue({ id: 'sub_sched_1' }),
    };
    const provider = new StripeBillingProvider(config as never);
    Object.defineProperty(provider, 'client', {
      value: { subscriptions, subscriptionSchedules },
    });
    return { provider, subscriptions, subscriptionSchedules };
  };

  const input = {
    providerSubscriptionId: 'sub_test_1',
    organizationId: 'org_1',
    subscriptionId: 'local_sub_1',
    planCode: PlanCode.PROFESSIONAL_INTELLIGENCE,
    billingInterval: BillingInterval.MONTHLY,
    idempotencyKey: 'orbit:change-plan:stable',
  } as const;

  it('cobra upgrade imediatamente e recusa estado incomplete', async () => {
    const { provider, subscriptions } = setup();

    await expect(
      provider.changePlan({ ...input, timing: 'IMMEDIATE' }),
    ).resolves.toMatchObject({ scheduled: false });

    expect(subscriptions.update).toHaveBeenCalledWith(
      'sub_test_1',
      expect.objectContaining({
        proration_behavior: 'always_invoice',
        payment_behavior: 'error_if_incomplete',
        items: [{ id: 'si_test_1', price: 'price_target' }],
      }),
      { idempotencyKey: 'orbit:change-plan:stable' },
    );
  });

  it('preserva o preço atual e agenda downgrade para o fim do período', async () => {
    const { provider, subscriptionSchedules } = setup();

    const result = await provider.changePlan({
      ...input,
      planCode: PlanCode.ESSENTIAL,
      billingInterval: BillingInterval.ANNUAL,
      timing: 'PERIOD_END',
    });

    expect(result).toMatchObject({
      scheduled: true,
      providerScheduleId: 'sub_sched_1',
      subscription: { providerPriceId: 'price_old' },
    });
    expect(subscriptionSchedules.create).toHaveBeenCalledWith(
      { from_subscription: 'sub_test_1' },
      { idempotencyKey: 'orbit:change-plan:stable:create' },
    );
    expect(subscriptionSchedules.update).toHaveBeenCalledWith(
      'sub_sched_1',
      expect.objectContaining({
        end_behavior: 'release',
        proration_behavior: 'none',
        phases: [
          expect.objectContaining({
            end_date: 1_793_836_800,
            items: [{ price: 'price_old', quantity: 1 }],
          }),
          expect.objectContaining({
            start_date: 1_793_836_800,
            duration: { interval: 'month', interval_count: 12 },
            items: [{ price: 'price_target', quantity: 1 }],
          }),
        ],
      }),
      { idempotencyKey: 'orbit:change-plan:stable:update' },
    );
  });

  it('só desfaz schedule criado para a mesma organização e assinatura', async () => {
    const { provider, subscriptions, subscriptionSchedules } = setup();
    subscriptions.retrieve.mockResolvedValue(
      current({ schedule: 'sub_sched_1' }),
    );
    subscriptionSchedules.retrieve.mockResolvedValue({
      id: 'sub_sched_1',
      metadata: {
        orbitOrganizationId: 'org_1',
        orbitSubscriptionId: 'local_sub_1',
      },
    });

    await provider.cancelScheduledPlanChange({
      providerSubscriptionId: 'sub_test_1',
      organizationId: 'org_1',
      subscriptionId: 'local_sub_1',
      idempotencyKey: 'orbit:cancel-plan-change:stable',
    });

    expect(subscriptionSchedules.release).toHaveBeenCalledWith(
      'sub_sched_1',
      { preserve_cancel_date: true },
      { idempotencyKey: 'orbit:cancel-plan-change:stable' },
    );
  });
});
