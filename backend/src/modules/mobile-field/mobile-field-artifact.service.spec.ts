/* eslint-disable @typescript-eslint/no-explicit-any */
import { MobileFieldArtifactService } from './mobile-field-artifact.service';
import type { MobileFieldActor } from './mobile-field.service';

const actor: MobileFieldActor = {
  id: '01900000-0000-7000-8000-000000000001',
  organizationId: '01900000-0000-7000-8000-000000000002',
  businessUnitIds: ['01900000-0000-7000-8000-000000000003'],
  permissions: ['artifact_rendering.render'],
};

describe('MobileFieldArtifactService', () => {
  it('projects PMOC readiness without replacing its existing preparation flow', async () => {
    const repository = {
      source: jest.fn().mockResolvedValue({
        kind: 'PMOC_EQUIPMENT_EXECUTION',
        source: {
          id: '01900000-0000-7000-8000-000000000004',
          status: 'COMPLETED',
          artifactExecutionId: '01900000-0000-7000-8000-000000000005',
        },
        permissions: ['artifact_rendering.render'],
      }),
      existing: jest.fn().mockResolvedValue(null),
    };
    const service = new MobileFieldArtifactService(
      repository as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.preparation(
        actor,
        'PMOC_EQUIPMENT_EXECUTION',
        '01900000-0000-7000-8000-000000000004',
      ),
    ).resolves.toMatchObject({
      documentType: 'PMOC',
      eligibility: { eligible: true, blockedReasons: [] },
    });
  });

  it('does not enqueue another render when the frozen artifact is pending', async () => {
    const rendering = { request: jest.fn() };
    const repository = {
      get: jest.fn().mockResolvedValue(artifact('PENDING')),
    };
    const service = new MobileFieldArtifactService(
      repository as never,
      rendering as never,
      {} as never,
    );

    await expect(
      service.render(actor, '01900000-0000-7000-8000-000000000010', {}),
    ).resolves.toMatchObject({ status: 'PENDING', allowedActions: [] });
    expect(rendering.request).not.toHaveBeenCalled();
  });
});

function artifact(renderStatus: string): any {
  return {
    id: '01900000-0000-7000-8000-000000000010',
    artifactExecutionId: '01900000-0000-7000-8000-000000000011',
    sourceType: 'OPERATION',
    sourceId: '01900000-0000-7000-8000-000000000012',
    documentType: 'SERVICE_ORDER',
    snapshotVersion: 1,
    snapshotHash: 'a'.repeat(64),
    artifactExecution: {
      renderStatus,
      snapshot: { templateVersion: 1 },
      manifests: [],
    },
  };
}
