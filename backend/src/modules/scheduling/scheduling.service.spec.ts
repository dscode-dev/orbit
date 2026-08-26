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

describe('SchedulingService agenda timezone', () => {
  it('queries UTC boundaries and groups occurrences by the authoritative local day', async () => {
    const repository = {
      agendaTimezone: jest.fn().mockResolvedValue('America/Recife'),
      candidateEvents: jest.fn().mockResolvedValue([
        {
          id: 'event',
          calendarId: 'calendar',
          title: 'Visita noturna',
          description: null,
          type: 'OPERATION',
          status: 'CONFIRMED',
          priority: 'NORMAL',
          startsAt: new Date('2026-08-15T01:30:00.000Z'),
          endsAt: new Date('2026-08-15T02:30:00.000Z'),
          allDay: false,
          timezone: 'America/Recife',
          businessUnitId: 'unit',
          customerId: null,
          assetId: null,
          segment: null,
          sourceModule: 'operations',
          sourceEntityType: 'OPERATION',
          sourceEntityId: null,
          location: null,
          recurrence: null,
          allocations: [],
        },
      ]),
    };
    const recurrence = {
      expand: jest.fn((startsAt: Date, endsAt: Date) => [{ startsAt, endsAt }]),
    };
    const service = new SchedulingService(
      repository as never,
      recurrence as never,
    );

    const agenda = await service.agenda('organization', {
      view: 'DAY',
      date: new Date('2026-08-14T00:00:00.000Z'),
      businessUnitId: 'unit',
    });

    expect(repository.candidateEvents).toHaveBeenCalledWith(
      'organization',
      expect.objectContaining({
        from: new Date('2026-08-14T03:00:00.000Z'),
        to: new Date('2026-08-15T03:00:00.000Z'),
      }),
    );
    expect(agenda.range.timezone).toBe('America/Recife');
    expect(agenda.days).toEqual([
      expect.objectContaining({ date: '2026-08-14' }),
    ]);
    for (const day of agenda.days)
      for (const event of day.events)
        expect(event.startsAt).toBe('2026-08-15T01:30:00.000Z');
  });
});
