import { Module } from '@nestjs/common';
import { OperationController } from './operation.controller';
import { OperationRepository } from './operation.repository';
import { OperationService } from './operation.service';
import { OperationStorageService } from './operation-storage.service';

@Module({
  controllers: [OperationController],
  providers: [OperationRepository, OperationService, OperationStorageService],
  exports: [OperationService],
})
export class OperationsModule {}
