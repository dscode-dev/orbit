import {
  deriveRvtDueState,
  formatOccurrenceSequence,
  generateRvtOccurrences,
} from './rvt.domain';

describe('RVT V2 domain', () => {
  it('generates real weekly occurrences without a fake recurrence', () => {
    const values = generateRvtOccurrences({
      scheduleMode: 'RECURRING',
      visitType: 'WEEKLY',
      coverageStart: '2027-09-01',
      coverageEnd: '2027-09-30',
      timezone: 'America/Recife',
    });
    expect(values.map((x) => x.localDate)).toEqual([
      '2027-09-01',
      '2027-09-08',
      '2027-09-15',
      '2027-09-22',
      '2027-09-29',
    ]);
    expect(values.map((x) => x.sequenceNumber)).toEqual([1, 2, 3, 4, 5]);
  });

  it('normalizes one-time as exactly occurrence 001', () => {
    const values = generateRvtOccurrences({
      scheduleMode: 'ONE_TIME',
      visitType: 'WEEKLY',
      coverageStart: '2027-03-10',
      timezone: 'America/New_York',
    });
    expect(values).toHaveLength(1);
    expect(formatOccurrenceSequence(values[0].sequenceNumber)).toBe('001');
  });

  it('clamps semiannual calendar dates and preserves local time through DST', () => {
    const values = generateRvtOccurrences({
      scheduleMode: 'RECURRING',
      visitType: 'SEMIANNUAL',
      coverageStart: '2026-08-31',
      coverageEnd: '2027-08-31',
      timezone: 'America/New_York',
    });
    expect(values.map((x) => x.localDate)).toEqual([
      '2026-08-31',
      '2027-02-28',
      '2027-08-31',
    ]);
    expect(
      values.map((x) =>
        new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          hour: 'numeric',
          hourCycle: 'h23',
        }).format(x.scheduledFor),
      ),
    ).toEqual(['09', '09', '09']);
  });

  it('derives due state in the authoritative timezone', () => {
    const now = new Date('2027-09-15T12:00:00Z');
    expect(
      deriveRvtDueState(
        new Date('2027-09-15T12:00:00Z'),
        'America/Recife',
        now,
      ),
    ).toBe('DUE_TODAY');
    expect(
      deriveRvtDueState(
        new Date('2027-09-14T12:00:00Z'),
        'America/Recife',
        now,
      ),
    ).toBe('OVERDUE');
  });
});
