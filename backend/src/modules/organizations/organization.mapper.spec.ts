import { OrganizationReadModelMapper } from './organization.mapper';

describe('OrganizationReadModelMapper', () => {
  it('maps organization context and removes persistence-only fields', () => {
    const mapper = new OrganizationReadModelMapper();
    const unit = {
      id: 'unit-1',
      organizationId: 'org-1',
      parentId: null,
      slug: 'main',
      code: null,
      type: 'HEADQUARTERS' as const,
      isPrimary: true,
      legalName: 'Orbit Ltda',
      tradeName: 'Orbit',
      documentType: 'CNPJ',
      documentNumber: '11222333000181',
      city: 'Recife',
      street: 'Rua A',
      number: null,
      stateCode: 'PE',
      postalCode: null,
      email: null,
      phone: null,
      timezone: 'America/Recife',
      locale: 'pt-BR',
      currency: 'BRL',
      status: 'ACTIVE',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      deletedAt: null,
    };
    const result = mapper.context({
      id: 'org-1',
      ownerUserId: 'user-1',
      planId: 'plan-1',
      slug: 'orbit',
      displayName: 'Orbit',
      primarySegment: 'SERVICES',
      status: 'ACTIVE',
      subscriptionStatus: 'TRIALING',
      subscriptionStartedAt: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      settings: {},
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      plan: {
        id: 'plan-1',
        key: 'STARTER',
        name: 'Starter',
        description: null,
        monthlyPrice: { toString: () => '99.90' },
        annualPrice: null,
        currency: 'BRL',
        capabilities: ['operations.read'],
        limits: { users: 5 },
        isActive: true,
      },
      businessUnits: [unit],
    });

    expect(result.plan.monthlyPrice).toBe('99.90');
    expect(result.businessUnits[0]).not.toHaveProperty('deletedAt');
  });
});
