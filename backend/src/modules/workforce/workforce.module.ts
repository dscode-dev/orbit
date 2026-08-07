import { Module } from '@nestjs/common';
import { WorkforceController } from './workforce.controller';
import { WorkforceMapper } from './workforce.mapper';
import { WorkforceRepository } from './workforce.repository';
import { WorkforceService } from './workforce.service';

@Module({
  controllers: [WorkforceController],
  providers: [WorkforceService, WorkforceRepository, WorkforceMapper],
  exports: [WorkforceService],
})
export class WorkforceModule {}
