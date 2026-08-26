import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { ForbiddenException } from '../../exceptions';
import { CapabilityGuard, REQUIRED_CAPABILITIES_KEY } from './plan-access';
import type { SubscriptionPlanService } from './subscription-plan.service';

describe('CapabilityGuard error semantics', () => {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) =>
      key === REQUIRED_CAPABILITIES_KEY ? ['inventory.read'] : false,
    ),
  };
  const plans = {
    getEntitlements: jest.fn(),
    assertCapabilitiesOn: jest.fn(),
  };
  const request = () => ({
    id: 'request-id',
    method: 'GET',
    path: '/inventory',
    identity: {
      id: 'user-id',
      organizationId: 'organization-id',
      businessUnitIds: ['unit-id'],
    },
  });
  const context = (value: ReturnType<typeof request>) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => value }),
    }) as unknown as ExecutionContext;
  const guard = new CapabilityGuard(
    reflector as unknown as Reflector,
    plans as unknown as SubscriptionPlanService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    plans.assertCapabilitiesOn.mockReset();
  });

  it('keeps a policy denial as 403', async () => {
    plans.getEntitlements.mockResolvedValue({ capabilities: [] });
    plans.assertCapabilitiesOn.mockImplementation(() => {
      throw new ForbiddenException('missing capability');
    });
    await expect(guard.canActivate(context(request()))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rethrows capability lookup infrastructure failures', async () => {
    const failure = Object.assign(new Error('socket hang up'), {
      code: 'ECONNRESET',
    });
    plans.getEntitlements.mockRejectedValue(failure);
    await expect(guard.canActivate(context(request()))).rejects.toBe(failure);
  });

  it('memoizes only inside one request object', async () => {
    plans.assertCapabilitiesOn.mockImplementation(() => undefined);
    plans.getEntitlements.mockResolvedValue({ capabilities: ['*'] });
    await guard.canActivate(context(request()));
    await guard.canActivate(context(request()));
    expect(plans.getEntitlements).toHaveBeenCalledTimes(2);
  });
});
