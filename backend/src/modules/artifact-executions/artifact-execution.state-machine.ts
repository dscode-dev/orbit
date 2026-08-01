import { Injectable } from '@nestjs/common';
import { BusinessException } from '../../exceptions';
import type { ArtifactExecutionStatus } from './dto/artifact-execution.dto';

const transitions: Readonly<
  Record<ArtifactExecutionStatus, readonly ArtifactExecutionStatus[]>
> = {
  DRAFT: ['IN_PROGRESS', 'ARCHIVED'],
  IN_PROGRESS: ['PAUSED', 'UNDER_REVIEW'],
  PAUSED: ['IN_PROGRESS', 'ARCHIVED'],
  UNDER_REVIEW: ['IN_PROGRESS', 'APPROVED'],
  APPROVED: ['COMPLETED', 'IN_PROGRESS'],
  COMPLETED: ['ARCHIVED'],
  ARCHIVED: [],
};

@Injectable()
export class ArtifactExecutionStateMachine {
  assertTransition(from: string, to: ArtifactExecutionStatus): void {
    if (!transitions[from as ArtifactExecutionStatus]?.includes(to)) {
      throw new BusinessException(
        `Status transition from ${from} to ${to} is not allowed`,
        'INVALID_ARTIFACT_EXECUTION_TRANSITION',
      );
    }
  }
}
