import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database';

const identityInclude = {
  credential: true,
  mfaFactors: { where: { verifiedAt: { not: null }, deletedAt: null } },
  platformRoleAssignments: {
    where: { revokedAt: null },
    include: { role: true },
  },
  organizationMemberships: {
    where: { status: 'ACTIVE', deletedAt: null },
    include: { role: true },
  },
  businessUnitMemberships: {
    where: { status: 'ACTIVE', deletedAt: null },
    include: { role: true },
  },
} satisfies Prisma.UserInclude;

export type IdentityUser = Prisma.UserGetPayload<{
  include: typeof identityInclude;
}>;

@Injectable()
export class IdentityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<IdentityUser | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { normalizedEmail },
      select: { id: true },
    });
    return user ? this.findIdentity(user.id) : null;
  }

  findById(id: string): Promise<IdentityUser | null> {
    return this.findIdentity(id);
  }

  hasActivePlatformRole(userId: string, roleKey: string): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      await this.setLocal(transaction, 'app.user_id', userId);
      const assignment = await transaction.platformRoleAssignment.findFirst({
        where: {
          userId,
          revokedAt: null,
          role: {
            key: roleKey,
            organizationId: null,
            deletedAt: null,
          },
        },
        select: { id: true },
      });
      return Boolean(assignment);
    });
  }

  private findIdentity(id: string): Promise<IdentityUser | null> {
    return this.prisma.$transaction(async (transaction) => {
      await this.setLocal(transaction, 'app.user_id', id);
      await this.setLocal(transaction, 'app.is_platform_admin', 'false');
      const organization = await transaction.organizationMembership.findFirst({
        where: { userId: id, status: 'ACTIVE', deletedAt: null },
        select: { organizationId: true },
        orderBy: { joinedAt: 'asc' },
      });
      await this.setLocal(
        transaction,
        'app.organization_id',
        organization?.organizationId ?? '',
      );
      const units = await transaction.businessUnitMembership.findMany({
        where: {
          userId: id,
          organizationId: organization?.organizationId,
          status: 'ACTIVE',
          deletedAt: null,
        },
        select: { businessUnitId: true },
      });
      await this.setLocal(
        transaction,
        'app.business_unit_ids',
        units.map((unit) => unit.businessUnitId).join(','),
      );
      return transaction.user.findUnique({
        where: { id },
        include: identityInclude,
      });
    });
  }

  updateFailedLogin(
    credentialId: string,
    failedAttempts: number,
    lockedUntil: Date | null,
  ): Promise<void> {
    return this.prisma.credential
      .update({
        where: { id: credentialId },
        data: { failedAttempts, lockedUntil },
      })
      .then(() => undefined);
  }

  markAuthenticated(userId: string, credentialId: string): Promise<void> {
    return this.prisma
      .$transaction([
        this.prisma.user.update({
          where: { id: userId },
          data: { lastAuthenticatedAt: new Date() },
        }),
        this.prisma.credential.update({
          where: { id: credentialId },
          data: { failedAttempts: 0, lockedUntil: null },
        }),
      ])
      .then(() => undefined);
  }

  createSession(data: Prisma.SessionUncheckedCreateInput) {
    return this.prisma.session.create({ data });
  }

  findSessionByRefreshHash(refreshTokenHash: string) {
    return this.prisma.session.findUnique({ where: { refreshTokenHash } });
  }

  findSessionById(id: string) {
    return this.prisma.session.findUnique({ where: { id } });
  }

  rotateSession(
    id: string,
    refreshTokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    return this.prisma.session
      .update({
        where: { id },
        data: { refreshTokenHash, expiresAt },
      })
      .then(() => undefined);
  }

  revokeSession(id: string): Promise<void> {
    return this.prisma.session
      .updateMany({
        where: { id, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .then(() => undefined);
  }

  revokeUserSessions(userId: string): Promise<void> {
    return this.prisma.session
      .updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .then(() => undefined);
  }

  listSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        client: true,
        deviceId: true,
        userAgent: true,
        ipAddress: true,
        organizationId: true,
        businessUnitId: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  }

  updateProfile(userId: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      omit: { deletedAt: true },
    });
  }

  createPasswordReset(userId: string, tokenHash: string, expiresAt: Date) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.passwordResetToken.deleteMany({ where: { userId } });
      return transaction.passwordResetToken.create({
        data: { userId, tokenHash, expiresAt },
      });
    });
  }

  findPasswordReset(tokenHash: string) {
    return this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  }

  consumePasswordReset(
    tokenId: string,
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    return this.prisma
      .$transaction(async (transaction) => {
        const consumed = await transaction.passwordResetToken.updateMany({
          where: { id: tokenId, usedAt: null, expiresAt: { gt: new Date() } },
          data: { usedAt: new Date() },
        });
        if (consumed.count !== 1) {
          throw new Error('Password reset token was already consumed');
        }
        await transaction.credential.update({
          where: { userId },
          data: {
            passwordHash,
            passwordUpdatedAt: new Date(),
            mustChangePassword: false,
            failedAttempts: 0,
            lockedUntil: null,
          },
        });
        await transaction.session.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      })
      .then(() => undefined);
  }

  createInvitation(data: Prisma.IdentityInvitationUncheckedCreateInput) {
    return this.prisma.$transaction(async (transaction) => {
      await this.setLocal(
        transaction,
        'app.organization_id',
        data.organizationId,
      );
      await this.setLocal(
        transaction,
        'app.business_unit_ids',
        data.businessUnitId ?? '',
      );
      await this.setLocal(transaction, 'app.user_id', data.invitedById);
      const role = await transaction.role.findFirst({
        where: {
          id: data.roleId,
          OR: [
            { organizationId: data.organizationId },
            { organizationId: null },
          ],
          deletedAt: null,
        },
      });
      const businessUnit = data.businessUnitId
        ? await transaction.businessUnit.findFirst({
            where: {
              id: data.businessUnitId,
              organizationId: data.organizationId,
              deletedAt: null,
            },
          })
        : null;
      if (!role || (data.businessUnitId && !businessUnit)) {
        throw new Error('Invitation scope is invalid');
      }
      await transaction.identityInvitation.updateMany({
        where: {
          organizationId: data.organizationId,
          normalizedEmail: data.normalizedEmail,
          status: 'PENDING',
          expiresAt: { lte: new Date() },
        },
        data: { status: 'EXPIRED' },
      });
      return transaction.identityInvitation.create({ data });
    });
  }

  findInvitation(tokenHash: string) {
    return this.prisma.identityInvitation.findUnique({ where: { tokenHash } });
  }

  acceptInvitation(
    invitationId: string,
    input: {
      email: string;
      normalizedEmail: string;
      firstName: string;
      lastName: string;
      passwordHash: string;
      organizationId: string;
      businessUnitId: string | null;
      roleId: string;
    },
  ): Promise<void> {
    return this.prisma
      .$transaction(async (transaction) => {
        await this.setLocal(
          transaction,
          'app.organization_id',
          input.organizationId,
        );
        await this.setLocal(
          transaction,
          'app.business_unit_ids',
          input.businessUnitId ?? '',
        );
        let user = await transaction.user.findUnique({
          where: { normalizedEmail: input.normalizedEmail },
        });
        user ??= await transaction.user.create({
          data: {
            email: input.email,
            normalizedEmail: input.normalizedEmail,
            firstName: input.firstName,
            lastName: input.lastName,
            displayName: `${input.firstName} ${input.lastName}`.trim(),
            status: 'ACTIVE',
            emailVerifiedAt: new Date(),
            credential: {
              create: { passwordHash: input.passwordHash },
            },
          },
        });
        await transaction.credential.upsert({
          where: { userId: user.id },
          create: { userId: user.id, passwordHash: input.passwordHash },
          update: {},
        });
        await transaction.organizationMembership.upsert({
          where: {
            organizationId_userId: {
              organizationId: input.organizationId,
              userId: user.id,
            },
          },
          create: {
            organizationId: input.organizationId,
            userId: user.id,
            roleId: input.roleId,
          },
          update: { roleId: input.roleId, status: 'ACTIVE', deletedAt: null },
        });
        if (input.businessUnitId) {
          await transaction.businessUnitMembership.upsert({
            where: {
              businessUnitId_userId: {
                businessUnitId: input.businessUnitId,
                userId: user.id,
              },
            },
            create: {
              organizationId: input.organizationId,
              businessUnitId: input.businessUnitId,
              userId: user.id,
              roleId: input.roleId,
            },
            update: { roleId: input.roleId, status: 'ACTIVE', deletedAt: null },
          });
        }
        await transaction.identityInvitation.update({
          where: { id: invitationId },
          data: { status: 'ACCEPTED', acceptedAt: new Date() },
        });
      })
      .then(() => undefined);
  }

  private setLocal(
    transaction: Prisma.TransactionClient,
    key: string,
    value: string,
  ): Promise<unknown> {
    return transaction.$queryRawUnsafe(
      'SELECT set_config($1, $2, true)',
      key,
      value,
    );
  }

  createMfaFactor(userId: string, encryptedSecret: string) {
    return this.prisma.mfaFactor.create({
      data: { userId, secret: encryptedSecret },
      select: { id: true },
    });
  }

  findMfaFactor(id: string, userId: string) {
    return this.prisma.mfaFactor.findFirst({
      where: { id, userId, deletedAt: null },
    });
  }

  enableMfaFactor(id: string, recoveryCodes: readonly string[]): Promise<void> {
    return this.prisma.mfaFactor
      .update({
        where: { id },
        data: { verifiedAt: new Date(), recoveryCodes: [...recoveryCodes] },
      })
      .then(() => undefined);
  }

  touchMfaFactor(id: string): Promise<void> {
    return this.prisma.mfaFactor
      .update({ where: { id }, data: { lastUsedAt: new Date() } })
      .then(() => undefined);
  }

  consumeMfaRecoveryCode(
    id: string,
    recoveryCodes: readonly string[],
  ): Promise<void> {
    return this.prisma.mfaFactor
      .update({
        where: { id },
        data: { recoveryCodes: [...recoveryCodes], lastUsedAt: new Date() },
      })
      .then(() => undefined);
  }

  disableMfa(userId: string): Promise<void> {
    return this.prisma.mfaFactor
      .updateMany({
        where: { userId, deletedAt: null },
        data: { deletedAt: new Date() },
      })
      .then(() => undefined);
  }
}
