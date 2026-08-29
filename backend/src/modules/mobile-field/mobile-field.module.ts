import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database';
import { MobileFieldController } from './mobile-field.controller';
import { MobileFieldRepository } from './mobile-field.repository';
import { MobileFieldService } from './mobile-field.service';
import { InventoryModule } from '../inventory/inventory.module';
import { MobileFieldOperationController } from './mobile-field-operation.controller';
import { MobileFieldOperationRepository } from './mobile-field-operation.repository';
import { MobileFieldOperationService } from './mobile-field-operation.service';

@Module({
  imports: [PrismaModule, InventoryModule],
  controllers: [MobileFieldController, MobileFieldOperationController],
  providers: [
    MobileFieldRepository,
    MobileFieldService,
    MobileFieldOperationRepository,
    MobileFieldOperationService,
  ],
  exports: [MobileFieldService, MobileFieldOperationService],
})
export class MobileFieldModule {}
