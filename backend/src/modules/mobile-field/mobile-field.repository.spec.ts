/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { MobileFieldRepository } from './mobile-field.repository';

describe('MobileFieldRepository projection bounds', () => {
  it('reserves a bounded query for unscheduled work instead of hiding it behind history', async () => {
    const tx = {
      businessUnit: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: '01900000-0000-7000-8000-000000000001',
            legalName: 'Recife',
            tradeName: null,
            timezone: 'America/Recife',
          },
        ]),
      },
      operation: { findMany: jest.fn().mockResolvedValue([]) },
      pmocExecution: { findMany: jest.fn().mockResolvedValue([]) },
      rvtOccurrence: { findMany: jest.fn().mockResolvedValue([]) },
      customer: { findMany: jest.fn().mockResolvedValue([]) },
      asset: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const rls = { run: (work: (client: typeof tx) => unknown) => work(tx) };
    const repository = new MobileFieldRepository(rls as never);

    await repository.project(
      '01900000-0000-7000-8000-000000000002',
      '01900000-0000-7000-8000-000000000003',
      ['01900000-0000-7000-8000-000000000001'],
    );

    expect(tx.operation.findMany).toHaveBeenCalledTimes(4);
    expect(
      tx.operation.findMany.mock.calls.map(([query]) => ({
        take: query.take as number,
        scheduledStart: (query.where as { scheduledStart?: unknown })
          .scheduledStart,
      })),
    ).toEqual([
      { take: 125, scheduledStart: undefined },
      {
        take: 125,
        scheduledStart: expect.objectContaining({ lte: expect.any(Date) }),
      },
      {
        take: 125,
        scheduledStart: expect.objectContaining({ gt: expect.any(Date) }),
      },
      { take: 125, scheduledStart: null },
    ]);
  });

  it('loads one canonical operation directly under the assignment scope', async () => {
    const tx = {
      businessUnit: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: '01900000-0000-7000-8000-000000000001',
            legalName: 'Recife',
            tradeName: null,
            timezone: 'America/Recife',
          },
        ]),
      },
      operation: { findMany: jest.fn().mockResolvedValue([]) },
      customer: { findMany: jest.fn().mockResolvedValue([]) },
      asset: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const rls = { run: (work: (client: typeof tx) => unknown) => work(tx) };
    const repository = new MobileFieldRepository(rls as never);
    const sourceId = '01900000-0000-7000-8000-000000000004';

    await repository.project(
      '01900000-0000-7000-8000-000000000002',
      '01900000-0000-7000-8000-000000000003',
      ['01900000-0000-7000-8000-000000000001'],
      { kind: 'SERVICE_OPERATION', sourceId },
    );

    expect(tx.operation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 1,
        where: expect.objectContaining({
          id: sourceId,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        }),
      }),
    );
  });
});
