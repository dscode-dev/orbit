import { Injectable } from '@nestjs/common';
import { BusinessException } from '../../exceptions';

@Injectable()
export class ArtifactExecutionPolicy {
  assertEditable(status: string): void {
    if (!['DRAFT', 'IN_PROGRESS', 'PAUSED'].includes(status)) {
      throw new BusinessException(
        `Execution cannot be edited while ${status}`,
        'ARTIFACT_EXECUTION_NOT_EDITABLE',
      );
    }
  }
}
