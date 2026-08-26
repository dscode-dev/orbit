import { InfrastructureException } from '../../exceptions';
import type { PrismaService, RlsTransaction } from '../../database';
import { SubscriptionPlanRepository } from './subscription-plan.repository';

describe('SubscriptionPlanRepository entitlement diagnosis', () => {
  const transaction = {
    $queryRawUnsafe: jest.fn(),
    $queryRaw: jest.fn(),
    organization: { findUnique: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((work: (tx: typeof transaction) => unknown) =>
      work(transaction),
    ),
  };
  const repository = new SubscriptionPlanRepository(
    prisma as unknown as PrismaService,
    {} as RlsTransaction,
  );
  const access = { userId: 'user-id', businessUnitIds: ['unit-id'] };

  beforeEach(() => {
    jest.clearAllMocks();
    transaction.organization.findUnique.mockResolvedValue(null);
  });

  it('returns null only when the context was established successfully', async () => {
    transaction.$queryRaw.mockResolvedValue([
      { role: 'orbit_app', organization: 'organization-id', units: 'unit-id' },
    ]);
    await expect(
      repository.getOrganizationEntitlements('organization-id', access),
    ).resolves.toBeNull();
    expect(transaction.$queryRawUnsafe).toHaveBeenCalledTimes(1);
  });

  it.each([null, 'other-organization'])(
    'turns missing or mismatched RLS context %s into 5xx semantics',
    async (declared) => {
      transaction.$queryRaw.mockResolvedValue([
        { role: 'orbit_app', organization: declared, units: 'unit-id' },
      ]);
      await expect(
        repository.getOrganizationEntitlements('organization-id', access),
      ).rejects.toBeInstanceOf(InfrastructureException);
    },
  );

  it('does not turn a failed diagnostic query into null/404', async () => {
    transaction.$queryRaw.mockRejectedValue(
      Object.assign(new Error('transaction expired'), { code: 'P2028' }),
    );
    await expect(
      repository.getOrganizationEntitlements('organization-id', access),
    ).rejects.toBeInstanceOf(InfrastructureException);
  });
});
