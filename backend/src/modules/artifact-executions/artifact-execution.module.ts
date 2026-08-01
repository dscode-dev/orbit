import { Module } from '@nestjs/common';
import { ArtifactExecutionController } from './artifact-execution.controller';
import { ArtifactExecutionReadModelMapper } from './artifact-execution.mapper';
import { ArtifactExecutionPolicy } from './artifact-execution.policy';
import { ArtifactExecutionProgressCalculator } from './artifact-execution.progress';
import { ArtifactExecutionRepository } from './artifact-execution.repository';
import { ArtifactExecutionService } from './artifact-execution.service';
import { ArtifactExecutionStateMachine } from './artifact-execution.state-machine';
import { ArtifactExecutionValidator } from './artifact-execution.validator';

@Module({
  controllers: [ArtifactExecutionController],
  providers: [
    ArtifactExecutionService,
    ArtifactExecutionRepository,
    ArtifactExecutionReadModelMapper,
    ArtifactExecutionProgressCalculator,
    ArtifactExecutionStateMachine,
    ArtifactExecutionValidator,
    ArtifactExecutionPolicy,
  ],
  exports: [ArtifactExecutionService],
})
export class ArtifactExecutionModule {}
