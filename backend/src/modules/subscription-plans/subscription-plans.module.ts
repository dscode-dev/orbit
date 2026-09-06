import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EntitlementMapper } from './entitlements/entitlement.mapper';
import { EntitlementMetrics } from './entitlements/entitlement.metrics';
import { EntitlementRepository } from './entitlements/entitlement.repository';
import { EntitlementService } from './entitlements/entitlement.service';
import {
  ActivePlanGuard,
  CapabilityGuard,
  RequiredPlanGuard,
} from './plan-access';
import { SubscriptionPlanController } from './subscription-plan.controller';
import { SubscriptionPlanRepository } from './subscription-plan.repository';
import { SubscriptionPlanService } from './subscription-plan.service';
import { UsageRepository } from './usage.repository';
import { UsageService } from './usage.service';

@Global()
@Module({
  controllers: [SubscriptionPlanController],
  providers: [
    SubscriptionPlanRepository,
    SubscriptionPlanService,
    UsageRepository,
    UsageService,
    EntitlementRepository,
    EntitlementMetrics,
    EntitlementMapper,
    EntitlementService,
    { provide: APP_GUARD, useClass: ActivePlanGuard },
    { provide: APP_GUARD, useClass: RequiredPlanGuard },
    { provide: APP_GUARD, useClass: CapabilityGuard },
  ],
  exports: [SubscriptionPlanService, UsageService, EntitlementService],
})
export class SubscriptionPlansModule {}
