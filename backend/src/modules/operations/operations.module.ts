import { Module } from '@nestjs/common';
import { OperationController } from './operation.controller';
import { OperationRepository } from './operation.repository';
import { OperationService } from './operation.service';
import { OperationStorageService } from './operation-storage.service';
import { ChecklistController } from './checklist.controller';
import { ChecklistRepository } from './checklist.repository';
import { ChecklistService } from './checklist.service';
import { OperationReadModelMapper } from './operation.mapper';
import { WorkforceModule } from '../workforce/workforce.module';

@Module({
  imports: [WorkforceModule],
  controllers: [OperationController, ChecklistController],
  providers: [
    OperationRepository,
    OperationService,
    OperationStorageService,
    ChecklistRepository,
    ChecklistService,
    OperationReadModelMapper,
  ],
  exports: [OperationService, ChecklistService],
})
export class OperationsModule {}
