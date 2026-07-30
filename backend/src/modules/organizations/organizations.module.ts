import { Module } from '@nestjs/common';
import { SubscriptionPlansModule } from '../subscription-plans/subscription-plans.module';
import { BusinessUnitController } from './business-units/business-unit.controller';
import { BusinessUnitRepository } from './business-units/business-unit.repository';
import { BusinessUnitService } from './business-units/business-unit.service';
import { OrganizationController } from './organization.controller';
import { OrganizationRepository } from './organization.repository';
import { OrganizationService } from './organization.service';

@Module({
  imports: [SubscriptionPlansModule],
  controllers: [OrganizationController, BusinessUnitController],
  providers: [
    OrganizationRepository,
    OrganizationService,
    BusinessUnitRepository,
    BusinessUnitService,
  ],
  exports: [OrganizationService, BusinessUnitService],
})
export class OrganizationsModule {}
