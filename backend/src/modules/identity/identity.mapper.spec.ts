import { IdentityReadModelMapper } from './identity.mapper';

describe('IdentityReadModelMapper', () => {
  const mapper = new IdentityReadModelMapper();

  it('publishes a stable profile without credential or internal fields', () => {
    const source = {
      id: 'user-1',
      email: 'owner@orbit.test',
      normalizedEmail: 'owner@orbit.test',
      firstName: 'Orbit',
      lastName: 'Owner',
      displayName: 'Orbit Owner',
      phone: null,
      avatarUrl: null,
      locale: 'pt-BR',
      timezone: 'America/Recife',
      status: 'ACTIVE' as const,
      emailVerifiedAt: null,
      mfaFactors: [{}],
      credential: { passwordHash: 'never-public' },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    const result = mapper.profile(source);

    expect(result.mfaEnabled).toBe(true);
    expect(result.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result).not.toHaveProperty('credential');
    expect(result).not.toHaveProperty('normalizedEmail');
  });
});
