import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database';
import { generateUuidV7 } from '../../../utils';
import type { RegisterOrganizationDto } from '../presentation/dto/identity.dto';

@Injectable()
export class RegistrationRepository {
  constructor(private readonly prisma: PrismaService) {}

  register(input: RegisterOrganizationDto, passwordHash: string, slug: string) {
    const userId = generateUuidV7();
    const organizationId = generateUuidV7();
    const businessUnitId = generateUuidV7();
    const now = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setUTCDate(trialEndsAt.getUTCDate() + 14);

    return this.prisma.$transaction(async (transaction) => {
      const plan = await transaction.plan.findFirst({
        where: { key: input.planKey, isActive: true },
      });
      if (!plan) return null;

      await this.setLocal(transaction, 'app.user_id', userId);
      await this.setLocal(transaction, 'app.organization_id', organizationId);
      await this.setLocal(transaction, 'app.business_unit_id', businessUnitId);
      await this.setLocal(transaction, 'app.business_unit_ids', businessUnitId);

      await transaction.user.create({
        data: {
          id: userId,
          email: input.email,
          normalizedEmail: input.email,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          displayName: `${input.firstName} ${input.lastName}`.trim(),
          status: 'ACTIVE',
          emailVerifiedAt: now,
          credential: { create: { passwordHash } },
        },
      });
      await transaction.organization.create({
        data: {
          id: organizationId,
          ownerUserId: userId,
          planId: plan.id,
          slug,
          displayName: input.organizationName.trim(),
          primarySegment: input.primarySegment,
          status: 'ACTIVE',
          subscriptionStatus: 'TRIALING',
          subscriptionStartedAt: now,
          currentPeriodStart: now,
          currentPeriodEnd: trialEndsAt,
        },
      });
      const ownerRole = await transaction.role.create({
        data: {
          organizationId,
          key: 'OWNER',
          name: 'Owner',
          description: 'Organization owner',
          permissions: ['*'],
        },
      });
      await transaction.businessUnit.create({
        data: {
          id: businessUnitId,
          organizationId,
          slug: `${slug}-matriz`,
          isPrimary: true,
          legalName: input.legalName.trim(),
          tradeName: input.organizationName.trim(),
          type: input.businessUnitType,
          documentType: input.documentType,
          documentNumber: input.documentNumber,
          city: input.city.trim(),
          street: input.street.trim(),
          stateCode: input.stateCode.toUpperCase(),
        },
      });
      await transaction.organizationMembership.create({
        data: { organizationId, userId, roleId: ownerRole.id },
      });
      await transaction.businessUnitMembership.create({
        data: {
          organizationId,
          businessUnitId,
          userId,
          roleId: ownerRole.id,
        },
      });
      return { userId, organizationId, businessUnitId };
    });
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
}
