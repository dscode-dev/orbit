import { Injectable } from '@nestjs/common';
import { ForbiddenException, ValidationException } from '../../exceptions';
import type { RecordUsageDto } from './subscription-plan.dto';
import { SubscriptionPlanService } from './subscription-plan.service';
import { UsageRepository } from './usage.repository';

@Injectable()
export class UsageService {
  constructor(
    private readonly repository: UsageRepository,
    private readonly plans: SubscriptionPlanService,
  ) {}

  async listCurrent(organizationId: string) {
    const entitlements = await this.plans.getEntitlements(organizationId);
    const period = this.period(
      entitlements.currentPeriodStart,
      entitlements.currentPeriodEnd,
    );
    return this.repository.listCurrent(
      organizationId,
      period.start,
      period.end,
    );
  }

  async record(organizationId: string, input: RecordUsageDto) {
    await this.plans.assertActive(organizationId);
    const entitlements = await this.plans.getEntitlements(organizationId);
    if (!(input.resource in entitlements.limits)) {
      throw new ForbiddenException(
        `Resource ${input.resource} is not available in the current plan`,
      );
    }
    const period = this.period(
      entitlements.currentPeriodStart,
      entitlements.currentPeriodEnd,
    );
    return this.repository.record(
      organizationId,
      input.resource,
      input.amount,
      input.operation,
      period.start,
      period.end,
      entitlements.limits[input.resource] ?? null,
    );
  }

  private period(
    currentStart: Date | null,
    currentEnd: Date | null,
  ): { start: Date; end: Date } {
    if (currentStart && currentEnd && currentEnd > currentStart) {
      return { start: currentStart, end: currentEnd };
    }
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(1);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    if (end <= start) throw new ValidationException('Invalid usage period');
    return { start, end };
  }
}
