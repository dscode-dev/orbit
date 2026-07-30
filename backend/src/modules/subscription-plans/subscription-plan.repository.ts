import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService, RlsTransaction } from '../../database';

export interface PlanTenantAccess {
  userId: string;
  businessUnitIds: readonly string[];
}

@Injectable()
export class SubscriptionPlanRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rls: RlsTransaction,
  ) {}

  listActive() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: [{ monthlyPrice: 'asc' }, { name: 'asc' }],
    });
  }

  findActiveByKey(key: string) {
    return this.prisma.plan.findFirst({ where: { key, isActive: true } });
  }

  createPlan(data: Prisma.PlanCreateInput) {
    return this.prisma.plan.create({ data });
  }

  updatePlan(id: string, data: Prisma.PlanUpdateInput) {
    return this.prisma.plan.update({ where: { id }, data });
  }

  getOrganizationEntitlements(
    organizationId: string,
    access?: PlanTenantAccess,
  ) {
    if (access) {
      return this.prisma.$transaction(async (transaction) => {
        await transaction.$queryRawUnsafe(
          'SELECT set_config($1, $2, true)',
          'app.user_id',
          access.userId,
        );
        await transaction.$queryRawUnsafe(
          'SELECT set_config($1, $2, true)',
          'app.organization_id',
          organizationId,
        );
        await transaction.$queryRawUnsafe(
          'SELECT set_config($1, $2, true)',
          'app.business_unit_ids',
          access.businessUnitIds.join(','),
        );
        return transaction.organization.findUnique({
          where: { id: organizationId, deletedAt: null },
          select: {
            id: true,
            status: true,
            subscriptionStatus: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            externalCustomerId: true,
            externalSubscriptionId: true,
            plan: true,
          },
        });
      });
    }
    return this.rls.run((transaction) =>
      transaction.organization.findUnique({
        where: { id: organizationId, deletedAt: null },
        select: {
          id: true,
          status: true,
          subscriptionStatus: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          externalCustomerId: true,
          externalSubscriptionId: true,
          plan: true,
        },
      }),
    );
  }

  changeSubscription(
    organizationId: string,
    planId: string,
    data: {
      status: string;
      periodStart: Date;
      periodEnd: Date;
      externalCustomerId?: string;
      externalSubscriptionId?: string;
    },
  ) {
    return this.rls.run((transaction) =>
      transaction.organization.update({
        where: { id: organizationId },
        data: {
          planId,
          subscriptionStatus: data.status,
          subscriptionStartedAt: data.periodStart,
          currentPeriodStart: data.periodStart,
          currentPeriodEnd: data.periodEnd,
          externalCustomerId: data.externalCustomerId,
          externalSubscriptionId: data.externalSubscriptionId,
        },
        include: { plan: true },
      }),
    );
  }

  updateSubscriptionState(
    organizationId: string,
    data: Prisma.OrganizationUpdateInput,
  ) {
    return this.rls.run((transaction) =>
      transaction.organization.update({
        where: { id: organizationId },
        data,
        include: { plan: true },
      }),
    );
  }
}
