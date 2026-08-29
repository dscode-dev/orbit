/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  MobileFieldService,
  type MobileFieldActor,
} from './mobile-field.service';

const actor: MobileFieldActor = {
  id: '01900000-0000-7000-8000-000000000001',
  organizationId: '01900000-0000-7000-8000-000000000002',
  businessUnitIds: ['01900000-0000-7000-8000-000000000003'],
  permissions: ['operations.read'],
};

describe('MobileFieldService', () => {
  it('returns a valid empty dashboard', async () => {
    const repository = { project: jest.fn().mockResolvedValue(emptySource()) };
    const service = new MobileFieldService(repository as never);
    await expect(service.dashboard(actor)).resolves.toMatchObject({
      next: null,
      counters: { today: 0, overdue: 0, inProgress: 0, upcoming: 0 },
      today: [],
      overdue: [],
      inProgress: [],
    });
  });

  it('does not turn assignment into execution authorization', async () => {
    const source = emptySource();
    source.businessUnits.push({
      id: actor.businessUnitIds[0],
      legalName: 'Recife',
      tradeName: null,
      timezone: 'America/Recife',
    });
    source.operations.push({
      id: '01900000-0000-7000-8000-000000000004',
      businessUnitId: actor.businessUnitIds[0],
      customerId: null,
      assetId: null,
      code: 'OS-1',
      title: 'Atendimento',
      description: null,
      status: 'OPEN',
      priority: 'NORMAL',
      scheduledStart: new Date('2099-01-01T12:00:00Z'),
      scheduledEnd: null,
      startedAt: null,
      completedAt: null,
      location: null,
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      responsibleFieldTechnician: { id: actor.id, displayName: 'João' },
      auxiliaryTechnicians: [],
      asset: null,
      artifactExecutions: [],
      checklistExecutions: [],
    });
    const service = new MobileFieldService({
      project: jest.fn().mockResolvedValue(source),
    } as never);
    const queue = await service.workQueue(actor, {});
    expect(queue.data).toHaveLength(1);
    expect(queue.data[0]?.allowedActions).toEqual(['VIEW']);
    expect(queue.data[0]?.allowedActions).not.toContain('START');
  });

  it('uses an opaque stable cursor without duplicates', async () => {
    const source = emptySource();
    source.businessUnits.push({
      id: actor.businessUnitIds[0],
      legalName: 'Recife',
      tradeName: null,
      timezone: 'America/Recife',
    });
    for (let index = 0; index < 55; index += 1) {
      source.operations.push({
        id: `01900000-0000-7000-8000-${String(index).padStart(12, '0')}`,
        businessUnitId: actor.businessUnitIds[0],
        customerId: null,
        assetId: null,
        code: `OS-${index}`,
        title: `Atendimento ${index}`,
        description: null,
        status: 'OPEN',
        priority: 'NORMAL',
        scheduledStart: new Date(
          `2099-01-${String((index % 28) + 1).padStart(2, '0')}T12:00:00Z`,
        ),
        scheduledEnd: null,
        startedAt: null,
        completedAt: null,
        location: null,
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        responsibleFieldTechnician: { id: actor.id, displayName: 'João' },
        auxiliaryTechnicians: [],
        asset: null,
        artifactExecutions: [],
        checklistExecutions: [],
      });
    }
    const service = new MobileFieldService({
      project: jest.fn().mockResolvedValue(source),
    } as never);
    const first = await service.workQueue(actor, { limit: 50 });
    const second = await service.workQueue(actor, {
      limit: 50,
      cursor: first.meta.nextCursor!,
    });
    expect(first.data).toHaveLength(50);
    expect(second.data).toHaveLength(5);
    expect(Buffer.byteLength(JSON.stringify(first), 'utf8')).toBeLessThan(
      128 * 1024,
    );
    expect(
      new Set([...first.data, ...second.data].map((item) => item.id)).size,
    ).toBe(55);
  });
});

function emptySource() {
  return {
    businessUnits: [] as any[],
    operations: [] as any[],
    pmocCycles: [] as any[],
    rvtOccurrences: [] as any[],
    customers: [] as any[],
    rvtAssets: [] as any[],
  };
}
