import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
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
    { provide: APP_GUARD, useClass: ActivePlanGuard },
    { provide: APP_GUARD, useClass: RequiredPlanGuard },
    { provide: APP_GUARD, useClass: CapabilityGuard },
  ],
  exports: [SubscriptionPlanService, UsageService],
})
export class SubscriptionPlansModule {}
