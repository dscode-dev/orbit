import { Module } from '@nestjs/common';
import { OperationController } from './operation.controller';
import { OperationRepository } from './operation.repository';
import { OperationService } from './operation.service';
import { OperationStorageService } from './operation-storage.service';
import { ChecklistController } from './checklist.controller';
import { ChecklistRepository } from './checklist.repository';
import { ChecklistService } from './checklist.service';

@Module({
  controllers: [OperationController, ChecklistController],
  providers: [
    OperationRepository,
    OperationService,
    OperationStorageService,
    ChecklistRepository,
    ChecklistService,
  ],
  exports: [OperationService, ChecklistService],
})
export class OperationsModule {}
