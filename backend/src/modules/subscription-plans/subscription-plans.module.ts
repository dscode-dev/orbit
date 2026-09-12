import { Global, Module } from '@nestjs/common';
import { EntitlementMapper } from './entitlements/entitlement.mapper';
import { EntitlementMetrics } from './entitlements/entitlement.metrics';
import { EntitlementRepository } from './entitlements/entitlement.repository';
import { EntitlementService } from './entitlements/entitlement.service';
import { SubscriptionMapper } from './subscriptions/subscription.mapper';
import { SubscriptionProvisioningService } from './subscriptions/subscription-provisioning.service';
import { SubscriptionReconciliationService } from './subscriptions/subscription-reconciliation.service';
import { SubscriptionRepository } from './subscriptions/subscription.repository';
import { SubscriptionService } from './subscriptions/subscription.service';
import { TrialEligibilityService } from './subscriptions/trial-eligibility.service';
import { TrialFingerprintService } from './subscriptions/trial-fingerprint';
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
    SubscriptionRepository,
    SubscriptionService,
    SubscriptionMapper,
    SubscriptionReconciliationService,
    SubscriptionProvisioningService,
    TrialFingerprintService,
    TrialEligibilityService,
  ],
  exports: [
    SubscriptionPlanService,
    UsageService,
    EntitlementService,
    SubscriptionService,
    SubscriptionMapper,
    SubscriptionReconciliationService,
    SubscriptionProvisioningService,
    TrialEligibilityService,
  ],
})
export class SubscriptionPlansModule {}
