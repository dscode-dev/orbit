import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { RlsTransaction } from '../../database';
import { PaginationHelper } from '../../database/helpers/database.helpers';
import type {
  PlatformListQueryDto,
  UpdatePlatformOrganizationDto,
} from './dto/platform-administration.dto';

const organizationView = {
  owner: {
    select: { id: true, email: true, displayName: true, status: true },
  },
  plan: {
    select: { id: true, key: true, name: true, isActive: true },
  },
  businessUnits: {
    where: { deletedAt: null },
    select: {
      id: true,
      legalName: true,
      tradeName: true,
      isPrimary: true,
      status: true,
    },
  },
  _count: {
    select: {
      memberships: true,
      operations: true,
      customers: true,
      assets: true,
    },
  },
} satisfies Prisma.OrganizationInclude;

@Injectable()
export class PlatformAdministrationRepository {
  constructor(private readonly rls: RlsTransaction) {}

  overview() {
    return this.rls.run(async (tx) => {
      const [
        organizations,
        users,
        activeSubscriptions,
        suspendedOrganizations,
        plans,
        modules,
      ] = await Promise.all([
        tx.organization.count({ where: { deletedAt: null } }),
        tx.user.count({ where: { deletedAt: null } }),
        tx.organization.count({
          where: { deletedAt: null, subscriptionStatus: 'ACTIVE' },
        }),
        tx.organization.count({
          where: { deletedAt: null, status: 'SUSPENDED' },
        }),
        tx.plan.count({ where: { isActive: true } }),
        tx.module.count({ where: { isActive: true } }),
      ]);
      return {
        organizations,
        users,
        activeSubscriptions,
        suspendedOrganizations,
        activePlans: plans,
        activeModules: modules,
      };
    });
  }

  listOrganizations(query: PlatformListQueryDto) {
    const pagination = PaginationHelper.normalize(query.page, query.limit);
    const where: Prisma.OrganizationWhereInput = {
      deletedAt: null,
      status: query.status,
      ...(query.search
        ? {
            OR: [
              { displayName: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
              {
                owner: {
                  email: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    return this.rls.run(async (tx) => {
      const [data, total] = await Promise.all([
        tx.organization.findMany({
          where,
          include: organizationView,
          orderBy: { createdAt: 'desc' },
          ...PaginationHelper.toPrisma(pagination),
        }),
        tx.organization.count({ where }),
      ]);
      return PaginationHelper.result(data, total, pagination);
    });
  }

  findOrganization(id: string) {
    return this.rls.run((tx) =>
      tx.organization.findFirst({
        where: { id, deletedAt: null },
        include: organizationView,
      }),
    );
  }

  listUsers(query: PlatformListQueryDto) {
    const pagination = PaginationHelper.normalize(query.page, query.limit);
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      status: query.status,
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { displayName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return this.rls.run(async (tx) => {
      const [data, total] = await Promise.all([
        tx.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            displayName: true,
            status: true,
            emailVerifiedAt: true,
            lastAuthenticatedAt: true,
            createdAt: true,
            organizationMemberships: {
              where: { deletedAt: null },
              select: {
                organizationId: true,
                status: true,
                role: { select: { key: true } },
              },
            },
            platformRoleAssignments: {
              where: { revokedAt: null },
              select: { role: { select: { key: true } } },
            },
          },
          orderBy: { createdAt: 'desc' },
          ...PaginationHelper.toPrisma(pagination),
        }),
        tx.user.count({ where }),
      ]);
      return PaginationHelper.result(data, total, pagination);
    });
  }

  plansAndModules() {
    return this.rls.run(async (tx) => {
      const [plans, modules] = await Promise.all([
        tx.plan.findMany({ orderBy: { monthlyPrice: 'asc' } }),
        tx.module.findMany({
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        }),
      ]);
      return { plans, modules };
    });
  }

  updateOrganization(
    id: string,
    actorId: string,
    input: UpdatePlatformOrganizationDto,
    planId?: string,
  ) {
    return this.rls.run(async (tx) => {
      const before = await tx.organization.findFirst({
        where: { id, deletedAt: null },
      });
      if (!before) return null;
      const organization = await tx.organization.update({
        where: { id },
        data: {
          status: input.status,
          subscriptionStatus: input.subscriptionStatus,
          currentPeriodEnd: input.currentPeriodEnd,
          planId,
        },
        include: organizationView,
      });
      await tx.auditLog.create({
        data: {
          organizationId: id,
          userId: actorId,
          action: 'PLATFORM_ORGANIZATION_UPDATED',
          entityType: 'ORGANIZATION',
          entityId: id,
          before: {
            status: before.status,
            subscriptionStatus: before.subscriptionStatus,
            planId: before.planId,
          },
          after: {
            status: organization.status,
            subscriptionStatus: organization.subscriptionStatus,
            planId: organization.planId,
          },
        },
      });
      return organization;
    });
  }

  findPlan(key: string) {
    return this.rls.run((tx) =>
      tx.plan.findFirst({ where: { key, isActive: true } }),
    );
  }
}
