import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import {
  CustomerPortalAuthController,
  CustomerPortalController,
} from './customer-portal.controller';
import { NoopCustomerPortalTokenDelivery } from './customer-portal.delivery';
import { CustomerPortalGuard } from './customer-portal.guard';
import { CustomerPortalManagementController } from './customer-portal-management.controller';
import { CustomerPortalMapper } from './customer-portal.mapper';
import { CustomerPortalMetrics } from './customer-portal.metrics';
import { CustomerPortalAuthorizationPolicy } from './customer-portal.policy';
import { CustomerPortalRepository } from './customer-portal.repository';
import { CustomerPortalService } from './customer-portal.service';
import { CustomerPortalTokenService } from './customer-portal-token.service';
import { CUSTOMER_PORTAL_TOKEN_DELIVERY } from './customer-portal.types';

@Module({
  imports: [JwtModule.register({})],
  controllers: [
    CustomerPortalAuthController,
    CustomerPortalController,
    CustomerPortalManagementController,
  ],
  providers: [
    CustomerPortalRepository,
    CustomerPortalService,
    CustomerPortalTokenService,
    CustomerPortalGuard,
    CustomerPortalMapper,
    CustomerPortalMetrics,
    CustomerPortalAuthorizationPolicy,
    NoopCustomerPortalTokenDelivery,
    {
      provide: CUSTOMER_PORTAL_TOKEN_DELIVERY,
      useExisting: NoopCustomerPortalTokenDelivery,
    },
  ],
  exports: [
    CustomerPortalGuard,
    CustomerPortalService,
    CustomerPortalAuthorizationPolicy,
  ],
})
export class CustomerPortalModule {}
