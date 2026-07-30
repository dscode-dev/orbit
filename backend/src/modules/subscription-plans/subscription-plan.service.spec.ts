import { ForbiddenException, ValidationException } from '../../exceptions';
import type { SubscriptionPlanRepository } from './subscription-plan.repository';
import { SubscriptionPlanService } from './subscription-plan.service';

describe('SubscriptionPlanService', () => {
  const repository = {
    getOrganizationEntitlements: jest.fn(),
    listActive: jest.fn(),
    createPlan: jest.fn(),
    updatePlan: jest.fn(),
  };
  const service = new SubscriptionPlanService(
    repository as unknown as SubscriptionPlanRepository,
  );

  beforeEach(() => jest.clearAllMocks());

  it('parses finite limits and preserves unlimited resources', async () => {
    repository.getOrganizationEntitlements.mockResolvedValue({
      id: 'organization-id',
      status: 'ACTIVE',
      subscriptionStatus: 'ACTIVE',
      currentPeriodStart: new Date('2026-07-01'),
      currentPeriodEnd: new Date('2026-08-01'),
      externalCustomerId: null,
      externalSubscriptionId: null,
      plan: {
        key: 'PRO',
        capabilities: ['business_units.manage'],
        limits: { users: 10, storage: null, invalid: -1 },
      },
    });

    const result = await service.getEntitlements('organization-id');
    expect(result.limits).toEqual({ users: 10, storage: null });
    await expect(
      service.assertCapabilities('organization-id', ['business_units.manage']),
    ).resolves.toBeUndefined();
  });

  it('rejects unavailable capabilities', async () => {
    repository.getOrganizationEntitlements.mockResolvedValue({
      subscriptionStatus: 'ACTIVE',
      currentPeriodStart: new Date('2026-07-01'),
      currentPeriodEnd: new Date('2099-08-01'),
      plan: { key: 'FREE', capabilities: [], limits: {} },
    });

    await expect(
      service.assertCapabilities('organization-id', ['reports.create']),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects invalid plan limits before persistence', () => {
    expect(() =>
      service.createPlan({
        key: 'BAD',
        name: 'Invalid',
        limits: { users: -1 },
      }),
    ).toThrow(ValidationException);
    expect(repository.createPlan).not.toHaveBeenCalled();
  });
});
