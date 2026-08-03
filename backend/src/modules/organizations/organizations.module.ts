import { Module } from '@nestjs/common';
import { SubscriptionPlansModule } from '../subscription-plans/subscription-plans.module';
import { BusinessUnitController } from './business-units/business-unit.controller';
import { BusinessUnitRepository } from './business-units/business-unit.repository';
import { BusinessUnitService } from './business-units/business-unit.service';
import { CustomerController } from './business-units/customers/customer.controller';
import { CustomerRepository } from './business-units/customers/customer.repository';
import { CustomerReadModelMapper } from './business-units/customers/customer.mapper';
import { CustomerService } from './business-units/customers/customer.service';
import { AssetController } from './business-units/equipaments/asset.controller';
import { AssetRepository } from './business-units/equipaments/asset.repository';
import { AssetService } from './business-units/equipaments/asset.service';
import { OrganizationController } from './organization.controller';
import { OrganizationRepository } from './organization.repository';
import { OrganizationService } from './organization.service';
import { OrganizationReadModelMapper } from './organization.mapper';

@Module({
  imports: [SubscriptionPlansModule],
  controllers: [
    OrganizationController,
    BusinessUnitController,
    AssetController,
    CustomerController,
  ],
  providers: [
    OrganizationRepository,
    OrganizationService,
    OrganizationReadModelMapper,
    BusinessUnitRepository,
    BusinessUnitService,
    AssetRepository,
    AssetService,
    CustomerRepository,
    CustomerService,
    CustomerReadModelMapper,
  ],
  exports: [
    OrganizationService,
    BusinessUnitService,
    AssetService,
    CustomerService,
  ],
})
export class OrganizationsModule {}
