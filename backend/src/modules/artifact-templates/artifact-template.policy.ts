import { Injectable } from '@nestjs/common';
import { ConflictException, ForbiddenException } from '../../exceptions';

interface TemplatePolicySource {
  organizationId: string | null;
  status: string;
}

@Injectable()
export class ArtifactTemplatePolicy {
  assertOwnedByOrganization(
    template: TemplatePolicySource,
    organizationId: string,
  ): void {
    if (template.organizationId !== organizationId) {
      throw new ForbiddenException(
        'Global and external templates are read-only',
      );
    }
  }

  assertCanDelete(template: TemplatePolicySource): void {
    if (template.status === 'ACTIVE') {
      throw new ConflictException('Deactivate the template before deleting it');
    }
  }
}
