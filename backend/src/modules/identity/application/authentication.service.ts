import { Inject, Injectable } from '@nestjs/common';
import type { IHashProvider, IUuidProvider, UUID } from '../../../contracts';
import { HASH_PROVIDER, UUID_PROVIDER } from '../../../providers';
import { UnauthorizedException } from '../../../exceptions';
import type {
  AuthenticatedIdentity,
  SessionMetadata,
  TokenPair,
} from '../domain/identity.types';
import {
  IdentityRepository,
  type IdentityUser,
} from '../infrastructure/identity.repository';
import { IdentityTokenService } from './token.service';
import { MfaService } from './mfa.service';

@Injectable()
export class AuthenticationService {
  private static readonly MAX_FAILED_ATTEMPTS = 5;
  private static readonly LOCK_MINUTES = 15;

  constructor(
    private readonly repository: IdentityRepository,
    private readonly tokens: IdentityTokenService,
    private readonly mfa: MfaService,
    @Inject(HASH_PROVIDER) private readonly hashes: IHashProvider,
    @Inject(UUID_PROVIDER) private readonly uuids: IUuidProvider,
  ) {}

  async login(
    email: string,
    password: string,
    mfaCode: string | undefined,
    metadata: SessionMetadata,
  ): Promise<TokenPair> {
    const user = await this.repository.findByEmail(email);
    if (!user?.credential || user.deletedAt || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (
      user.credential.lockedUntil &&
      user.credential.lockedUntil.getTime() > Date.now()
    ) {
      throw new UnauthorizedException('Account temporarily locked');
    }
    const passwordValid = await this.hashes.verify(
      user.credential.passwordHash,
      password,
    );
    if (!passwordValid) {
      await this.recordFailedAttempt(user);
      throw new UnauthorizedException('Invalid credentials');
    }
    const factor = user.mfaFactors[0];
    if (factor) await this.mfa.verifyFactor(factor, mfaCode);

    const sessionId = this.uuids.generate();
    const identity = this.toIdentity(user, sessionId);
    const pair = await this.tokens.issue(identity);
    await this.repository.createSession({
      id: sessionId,
      userId: user.id,
      organizationId: identity.organizationId,
      businessUnitId: identity.businessUnitId,
      refreshTokenHash: pair.refreshTokenHash,
      expiresAt: pair.expiresAt,
      ...metadata,
    });
    await this.repository.markAuthenticated(user.id, user.credential.id);
    return this.publicPair(pair);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const hash = this.tokens.hashOpaqueToken(refreshToken);
    const session = await this.repository.findSessionByRefreshHash(hash);
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.repository.findById(session.userId);
    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      await this.repository.revokeSession(session.id);
      throw new UnauthorizedException('Invalid refresh token');
    }
    const pair = await this.tokens.issue(
      this.toIdentity(user, session.id as UUID),
    );
    await this.repository.rotateSession(
      session.id,
      pair.refreshTokenHash,
      pair.expiresAt,
    );
    return this.publicPair(pair);
  }

  async logout(sessionId: string | undefined, refreshToken?: string) {
    if (sessionId) {
      await this.repository.revokeSession(sessionId);
    } else if (refreshToken) {
      const session = await this.repository.findSessionByRefreshHash(
        this.tokens.hashOpaqueToken(refreshToken),
      );
      if (session) await this.repository.revokeSession(session.id);
    }
  }

  listSessions(userId: string) {
    return this.repository.listSessions(userId);
  }

  revokeSession(userId: string, sessionId: string): Promise<void> {
    return this.repository.findSessionById(sessionId).then(async (session) => {
      if (!session || session.userId !== userId) {
        throw new UnauthorizedException();
      }
      await this.repository.revokeSession(sessionId);
    });
  }

  private async recordFailedAttempt(user: IdentityUser): Promise<void> {
    const attempts = user.credential!.failedAttempts + 1;
    const lockedUntil =
      attempts >= AuthenticationService.MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + AuthenticationService.LOCK_MINUTES * 60_000)
        : null;
    await this.repository.updateFailedLogin(
      user.credential!.id,
      attempts,
      lockedUntil,
    );
  }

  private toIdentity(
    user: IdentityUser,
    sessionId: UUID,
  ): AuthenticatedIdentity {
    const organization = user.organizationMemberships[0] ?? null;
    const units = user.businessUnitMemberships.filter(
      (membership) =>
        !organization ||
        membership.organizationId === organization.organizationId,
    );
    const roles = new Set<string>();
    const permissions = new Set<string>();
    user.platformRoleAssignments.forEach((assignment) => {
      roles.add(assignment.role.key);
      assignment.role.permissions.forEach((item) => permissions.add(item));
    });
    if (organization) {
      roles.add(organization.role.key);
      organization.role.permissions.forEach((item) => permissions.add(item));
    }
    units.forEach((membership) => {
      roles.add(membership.role.key);
      membership.role.permissions.forEach((item) => permissions.add(item));
    });
    return {
      id: user.id as UUID,
      sessionId,
      organizationId: (organization?.organizationId as UUID) ?? null,
      businessUnitId: (units[0]?.businessUnitId as UUID) ?? null,
      businessUnitIds: units.map((unit) => unit.businessUnitId as UUID),
      roles: [...roles],
      permissions: [...permissions],
    };
  }

  private publicPair(
    pair: TokenPair & { refreshTokenHash: string; expiresAt: Date },
  ): TokenPair {
    return {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      tokenType: pair.tokenType,
      expiresIn: pair.expiresIn,
    };
  }
}
