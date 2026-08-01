import { ConflictException, ForbiddenException } from '../../exceptions';
import { ArtifactTemplatePolicy } from './artifact-template.policy';

describe('ArtifactTemplatePolicy', () => {
  const policy = new ArtifactTemplatePolicy();

  it('keeps global templates read-only for tenants', () => {
    expect(() =>
      policy.assertOwnedByOrganization(
        { organizationId: null, status: 'ACTIVE' },
        'tenant-id',
      ),
    ).toThrow(ForbiddenException);
  });

  it('requires deactivation before deletion', () => {
    expect(() =>
      policy.assertCanDelete({ organizationId: 'tenant-id', status: 'ACTIVE' }),
    ).toThrow(ConflictException);
  });
});
