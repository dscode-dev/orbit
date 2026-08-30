import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database';
import { MobileFieldController } from './mobile-field.controller';
import { MobileFieldRepository } from './mobile-field.repository';
import { MobileFieldService } from './mobile-field.service';
import { InventoryModule } from '../inventory/inventory.module';
import { MobileFieldOperationController } from './mobile-field-operation.controller';
import { MobileFieldOperationRepository } from './mobile-field-operation.repository';
import { MobileFieldOperationService } from './mobile-field-operation.service';
import { MobileSignatureController } from './mobile-signature.controller';
import { MobileSignatureRepository } from './mobile-signature.repository';
import { MobileSignatureService } from './mobile-signature.service';
import { MobileOfflineSyncController } from './mobile-offline-sync.controller';
import { MobileOfflineSyncRepository } from './mobile-offline-sync.repository';
import { MobileOfflineSyncService } from './mobile-offline-sync.service';
import { MobileSyncCleanupProcessor } from './mobile-sync-cleanup.processor';

@Module({
  imports: [PrismaModule, InventoryModule],
  controllers: [
    MobileFieldController,
    MobileFieldOperationController,
    MobileSignatureController,
    MobileOfflineSyncController,
  ],
  providers: [
    MobileFieldRepository,
    MobileFieldService,
    MobileFieldOperationRepository,
    MobileFieldOperationService,
    MobileSignatureRepository,
    MobileSignatureService,
    MobileOfflineSyncRepository,
    MobileOfflineSyncService,
    MobileSyncCleanupProcessor,
  ],
  exports: [MobileFieldService, MobileFieldOperationService],
})
export class MobileFieldModule {}
