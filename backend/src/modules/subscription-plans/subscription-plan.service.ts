import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  EntityNotFoundException,
  ForbiddenException,
  ValidationException,
} from '../../exceptions';
import type {
  ChangeSubscriptionDto,
  CreatePlanDto,
  UpdatePlanDto,
} from './subscription-plan.dto';
import {
  type PlanTenantAccess,
  SubscriptionPlanRepository,
} from './subscription-plan.repository';

export interface OrganizationEntitlements {
  planKey: string;
  subscriptionStatus: string;
  capabilities: readonly string[];
  limits: Readonly<Record<string, number | null>>;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
}

@Injectable()
export class SubscriptionPlanService {
  private static readonly ALLOWED_STATUSES = new Set([
    'TRIALING',
    'ACTIVE',
    'PAST_DUE',
  ]);

  constructor(private readonly repository: SubscriptionPlanRepository) {}

  listPlans() {
    return this.repository.listActive();
  }

  createPlan(input: CreatePlanDto) {
    this.validateLimits(input.limits);
    return this.repository.createPlan({
      key: input.key.toUpperCase(),
      name: input.name,
      description: input.description,
      monthlyPrice: input.monthlyPrice,
      annualPrice: input.annualPrice,
      currency: input.currency?.toUpperCase() ?? 'BRL',
      capabilities: input.capabilities ?? [],
      limits: input.limits ?? {},
      isActive: input.isActive ?? true,
    });
  }

  updatePlan(id: string, input: UpdatePlanDto) {
    this.validateLimits(input.limits);
    return this.repository.updatePlan(id, {
      key: input.key?.toUpperCase(),
      name: input.name,
      description: input.description,
      monthlyPrice: input.monthlyPrice,
      annualPrice: input.annualPrice,
      currency: input.currency?.toUpperCase(),
      capabilities: input.capabilities,
      limits: input.limits,
      isActive: input.isActive,
    });
  }

  async getEntitlements(
    organizationId: string,
    access?: PlanTenantAccess,
  ): Promise<OrganizationEntitlements> {
    const organization = await this.repository.getOrganizationEntitlements(
      organizationId,
      access,
    );
    if (!organization) throw new EntityNotFoundException('Organization');
    return {
      planKey: organization.plan.key,
      subscriptionStatus: organization.subscriptionStatus,
      capabilities: organization.plan.capabilities,
      limits: this.parseLimits(organization.plan.limits),
      currentPeriodStart: organization.currentPeriodStart,
      currentPeriodEnd: organization.currentPeriodEnd,
    };
  }

  async assertActive(
    organizationId: string,
    access?: PlanTenantAccess,
  ): Promise<void> {
    const entitlements = await this.getEntitlements(organizationId, access);
    if (
      !SubscriptionPlanService.ALLOWED_STATUSES.has(
        entitlements.subscriptionStatus,
      ) ||
      (entitlements.currentPeriodEnd &&
        entitlements.currentPeriodEnd.getTime() <= Date.now())
    ) {
      throw new ForbiddenException('An active subscription is required');
    }
  }

  async assertPlan(
    organizationId: string,
    acceptedPlans: readonly string[],
    access?: PlanTenantAccess,
  ): Promise<void> {
    const entitlements = await this.getEntitlements(organizationId, access);
    if (!acceptedPlans.includes(entitlements.planKey)) {
      throw new ForbiddenException(
        'The current plan does not allow this action',
      );
    }
  }

  async assertCapabilities(
    organizationId: string,
    required: readonly string[],
    access?: PlanTenantAccess,
  ): Promise<void> {
    const entitlements = await this.getEntitlements(organizationId, access);
    const granted = new Set(entitlements.capabilities);
    if (
      !granted.has('*') &&
      !required.every((capability) => granted.has(capability))
    ) {
      throw new ForbiddenException(
        'The current plan does not include the required capability',
      );
    }
  }

  async changeSubscription(
    organizationId: string,
    input: ChangeSubscriptionDto,
  ) {
    const plan = await this.repository.findActiveByKey(input.planKey);
    if (!plan) throw new ValidationException('Invalid plan');
    const periodStart = new Date();
    const periodEnd = new Date(periodStart);
    if (input.billingCycle === 'ANNUAL') {
      periodEnd.setUTCFullYear(periodEnd.getUTCFullYear() + 1);
    } else {
      periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
    }
    return this.repository.changeSubscription(organizationId, plan.id, {
      status: 'ACTIVE',
      periodStart,
      periodEnd,
      externalCustomerId: input.externalCustomerId,
      externalSubscriptionId: input.externalSubscriptionId,
    });
  }

  private parseLimits(
    value: Prisma.JsonValue,
  ): Readonly<Record<string, number | null>> {
    if (!value || Array.isArray(value) || typeof value !== 'object') return {};
    return Object.entries(value).reduce<Record<string, number | null>>(
      (limits, [resource, limit]) => {
        if (limit === null) limits[resource] = null;
        if (typeof limit === 'number' && Number.isFinite(limit) && limit >= 0) {
          limits[resource] = limit;
        }
        return limits;
      },
      {},
    );
  }

  private validateLimits(
    limits: Record<string, number | null> | undefined,
  ): void {
    if (!limits) return;
    for (const [resource, limit] of Object.entries(limits)) {
      if (
        resource.trim().length === 0 ||
        (limit !== null &&
          (typeof limit !== 'number' || !Number.isFinite(limit) || limit < 0))
      ) {
        throw new ValidationException('Plan limits are invalid');
      }
    }
  }
}
