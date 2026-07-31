import { ValidationException } from '../../exceptions';
import { SchedulingService } from './scheduling.service';

describe('SchedulingService validation', () => {
  const service = new SchedulingService({} as never, {} as never);

  it('rejects events whose end does not follow the start', async () => {
    await expect(
      service.createEvent('organization', 'actor', {
        calendarId: 'calendar',
        title: 'Invalid',
        type: 'AUDIT',
        startsAt: new Date('2026-08-10T10:00:00.000Z'),
        endsAt: new Date('2026-08-10T09:00:00.000Z'),
        timezone: 'UTC',
        sourceModule: 'audits',
        sourceEntityType: 'AUDIT',
      }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('rejects inconsistent resource allocation identifiers', async () => {
    await expect(
      service.createEvent('organization', 'actor', {
        calendarId: 'calendar',
        title: 'Invalid allocation',
        type: 'OPERATION',
        startsAt: new Date('2026-08-10T09:00:00.000Z'),
        endsAt: new Date('2026-08-10T10:00:00.000Z'),
        timezone: 'UTC',
        sourceModule: 'operations',
        sourceEntityType: 'OPERATION',
        allocations: [
          {
            resourceType: 'USER',
            userId: 'user',
            assetId: 'asset',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('rejects invalid availability windows', async () => {
    await expect(
      service.createAvailability('organization', {
        resourceType: 'CUSTOM',
        resourceKey: 'room-1',
        kind: 'AVAILABLE',
        dayOfWeek: 1,
        startMinute: 600,
        endMinute: 500,
        timezone: 'UTC',
      }),
    ).rejects.toBeInstanceOf(ValidationException);
  });
});
