import {
  addCivilDays,
  availabilityRuleApplies,
  civilDateKey,
  civilParts,
  instantFromCivil,
  localViewRange,
} from './scheduling-time';

describe('Scheduling calendar time semantics', () => {
  it('keeps late Recife instants in their local civil day', () => {
    const at2230 = new Date('2026-08-15T01:30:00.000Z');
    const beforeMidnight = new Date('2026-08-15T02:59:59.000Z');
    const afterMidnight = new Date('2026-08-15T03:00:01.000Z');

    expect(civilDateKey(at2230, 'America/Recife')).toBe('2026-08-14');
    expect(civilDateKey(beforeMidnight, 'America/Recife')).toBe('2026-08-14');
    expect(civilDateKey(afterMidnight, 'America/Recife')).toBe('2026-08-15');
  });

  it('turns Recife day and month into semi-open UTC ranges', () => {
    const day = localViewRange(
      'DAY',
      new Date('2026-08-14T00:00:00.000Z'),
      'America/Recife',
    );
    expect(day.from.toISOString()).toBe('2026-08-14T03:00:00.000Z');
    expect(day.to.toISOString()).toBe('2026-08-15T03:00:00.000Z');

    const month = localViewRange(
      'MONTH',
      new Date('2026-08-14T00:00:00.000Z'),
      'America/Recife',
    );
    expect(month.from.toISOString()).toBe('2026-08-01T03:00:00.000Z');
    expect(month.to.toISOString()).toBe('2026-09-01T03:00:00.000Z');
  });

  it('uses the local weekday rather than UTC', () => {
    const sundayAt22 = new Date('2026-08-10T01:00:00.000Z');
    expect(sundayAt22.getUTCDay()).toBe(1);
    expect(civilParts(sundayAt22, 'America/Recife').weekday).toBe(0);
    expect(
      availabilityRuleApplies(
        {
          dayOfWeek: 0,
          date: null,
          effectiveFrom: null,
          effectiveUntil: null,
          timezone: 'America/Recife',
        },
        sundayAt22,
      ),
    ).toBe(true);
  });

  it('compares availability exceptions as civil DATE values', () => {
    const rule = {
      dayOfWeek: null,
      date: new Date('2026-08-14T00:00:00.000Z'),
      effectiveFrom: null,
      effectiveUntil: null,
      timezone: 'America/Recife',
    };
    expect(
      availabilityRuleApplies(rule, new Date('2026-08-15T01:30:00.000Z')),
    ).toBe(true);
    expect(
      availabilityRuleApplies(rule, new Date('2026-08-15T03:30:00.000Z')),
    ).toBe(false);
  });

  it('models the New York DST transition as a 23-hour local day', () => {
    const range = localViewRange(
      'DAY',
      new Date('2026-03-08T00:00:00.000Z'),
      'America/New_York',
    );
    expect(range.from.toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-03-09T04:00:00.000Z');
    expect(range.to.getTime() - range.from.getTime()).toBe(23 * 3_600_000);
    expect(
      civilDateKey(new Date('2026-03-09T03:30:00Z'), 'America/New_York'),
    ).toBe('2026-03-08');
  });

  it('preserves civil time when adding days across DST', () => {
    const before = instantFromCivil(
      { year: 2026, month: 3, day: 7, hour: 9 },
      'America/New_York',
    );
    const after = addCivilDays(before, 1, 'America/New_York');
    expect(civilParts(after, 'America/New_York')).toMatchObject({
      year: 2026,
      month: 3,
      day: 8,
      hour: 9,
    });
    expect(after.getTime() - before.getTime()).toBe(23 * 3_600_000);
  });

  it('does not depend on the process timezone', () => {
    const previous = process.env.TZ;
    try {
      process.env.TZ = 'Pacific/Honolulu';
      const honoluluHost = localViewRange(
        'DAY',
        new Date('2026-08-14T00:00:00.000Z'),
        'America/Recife',
      );
      process.env.TZ = 'Europe/Berlin';
      const berlinHost = localViewRange(
        'DAY',
        new Date('2026-08-14T00:00:00.000Z'),
        'America/Recife',
      );
      expect(berlinHost).toEqual(honoluluHost);
    } finally {
      process.env.TZ = previous;
    }
  });
});
