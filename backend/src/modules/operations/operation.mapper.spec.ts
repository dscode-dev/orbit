import { OperationReadModelMapper } from './operation.mapper';

describe('OperationReadModelMapper', () => {
  it('publishes operation details without attachment storage keys', () => {
    const mapper = new OperationReadModelMapper();
    const attachment = {
      id: 'file-1',
      operationId: 'op-1',
      fileName: 'a.pdf',
      mimeType: 'application/pdf',
      size: 10,
      checksum: 'hash',
      uploadedById: 'user-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      storageKey: '/private/file',
    };
    const result = mapper.details({
      id: 'op-1',
      organizationId: 'org-1',
      businessUnitId: 'unit-1',
      customerId: null,
      assetId: null,
      code: 'ORB-1',
      kind: 'MAINTENANCE',
      title: 'Preventiva',
      description: null,
      status: 'OPEN',
      priority: 'NORMAL',
      scheduledStart: null,
      scheduledEnd: null,
      startedAt: null,
      completedAt: null,
      location: {},
      data: {},
      createdById: 'user-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      businessUnit: { id: 'unit-1', legalName: 'Orbit', tradeName: null },
      customer: null,
      asset: null,
      users: [],
      checklistExecutions: [],
      attachments: [attachment],
    });

    expect(result.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result.transitions).toEqual([
      'SCHEDULED',
      'IN_PROGRESS',
      'CANCELLED',
    ]);
    expect(result.attachments[0]).not.toHaveProperty('storageKey');
  });
});
