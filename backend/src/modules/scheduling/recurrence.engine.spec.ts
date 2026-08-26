import { RecurrenceEngine } from './recurrence.engine';

describe('RecurrenceEngine', () => {
  const engine = new RecurrenceEngine();
  const startsAt = new Date('2026-08-03T09:00:00.000Z');
  const endsAt = new Date('2026-08-03T10:00:00.000Z');
  const rangeEnd = new Date('2026-09-15T00:00:00.000Z');

  it('expands daily recurrence with count', () => {
    const result = engine.expand(
      startsAt,
      endsAt,
      {
        frequency: 'DAILY',
        interval: 2,
        byWeekday: [],
        byMonthDay: null,
        count: 3,
        until: null,
        customRule: null,
        exceptions: [],
        timezone: 'America/Recife',
      },
      startsAt,
      rangeEnd,
    );
    expect(result.map((item) => item.startsAt.toISOString())).toEqual([
      '2026-08-03T09:00:00.000Z',
      '2026-08-05T09:00:00.000Z',
      '2026-08-07T09:00:00.000Z',
    ]);
  });

  it('supports selected weekdays', () => {
    const result = engine.expand(
      startsAt,
      endsAt,
      {
        frequency: 'WEEKLY',
        interval: 1,
        byWeekday: [1, 3],
        byMonthDay: null,
        count: 4,
        until: null,
        customRule: null,
        exceptions: [],
        timezone: 'America/Recife',
      },
      startsAt,
      rangeEnd,
    );
    expect(result.map((item) => item.startsAt.getUTCDay())).toEqual([
      1, 3, 1, 3,
    ]);
  });

  it('skips months that do not contain the requested day', () => {
    const result = engine.expand(
      new Date('2026-01-31T09:00:00.000Z'),
      new Date('2026-01-31T10:00:00.000Z'),
      {
        frequency: 'MONTHLY',
        interval: 1,
        byWeekday: [],
        byMonthDay: 31,
        count: 3,
        until: null,
        customRule: null,
        exceptions: [],
        timezone: 'UTC',
      },
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-06-01T00:00:00.000Z'),
    );
    expect(
      result.map((item) => item.startsAt.toISOString().slice(0, 10)),
    ).toEqual(['2026-01-31', '2026-03-31', '2026-05-31']);
  });

  it('applies custom dates and exceptions', () => {
    const result = engine.expand(
      startsAt,
      endsAt,
      {
        frequency: 'CUSTOM',
        interval: 1,
        byWeekday: [],
        byMonthDay: null,
        count: null,
        until: null,
        customRule: {
          dates: ['2026-08-10T09:00:00.000Z', '2026-08-17T09:00:00.000Z'],
        },
        exceptions: [new Date('2026-08-10T09:00:00.000Z')],
        timezone: 'UTC',
      },
      startsAt,
      rangeEnd,
    );
    expect(result.map((item) => item.startsAt.toISOString())).toEqual([
      '2026-08-03T09:00:00.000Z',
      '2026-08-17T09:00:00.000Z',
    ]);
  });

  it('preserves 09:00 civil time across a DST offset change', () => {
    const result = engine.expand(
      new Date('2026-03-07T14:00:00.000Z'),
      new Date('2026-03-07T15:00:00.000Z'),
      {
        frequency: 'DAILY',
        interval: 1,
        byWeekday: [],
        byMonthDay: null,
        count: 3,
        until: null,
        customRule: null,
        exceptions: [],
        timezone: 'America/New_York',
      },
      new Date('2026-03-07T00:00:00.000Z'),
      new Date('2026-03-11T00:00:00.000Z'),
    );
    expect(result.map((item) => item.startsAt.toISOString())).toEqual([
      '2026-03-07T14:00:00.000Z',
      '2026-03-08T13:00:00.000Z',
      '2026-03-09T13:00:00.000Z',
    ]);
  });
});
