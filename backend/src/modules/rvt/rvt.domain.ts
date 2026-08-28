import { ValidationException } from '../../exceptions';
import {
  addCivilDays,
  assertIanaTimezone,
  civilDateKey,
  instantFromCivilDate,
} from '../scheduling/scheduling-time';

export type RvtVisitType = 'WEEKLY' | 'SEMIANNUAL';
export type RvtScheduleMode = 'RECURRING' | 'ONE_TIME';
export type RvtDueState = 'UPCOMING' | 'DUE_TODAY' | 'OVERDUE';

export interface OccurrenceCandidate {
  sequenceNumber: number;
  localDate: string;
  scheduledFor: Date;
}

export function generateRvtOccurrences(input: {
  scheduleMode: RvtScheduleMode;
  visitType: RvtVisitType;
  coverageStart: string;
  coverageEnd?: string;
  timezone: string;
}): OccurrenceCandidate[] {
  assertIanaTimezone(input.timezone);
  const start = instantFromCivilDate(input.coverageStart, input.timezone, 9);
  if (input.scheduleMode === 'ONE_TIME') {
    return [
      {
        sequenceNumber: 1,
        localDate: input.coverageStart,
        scheduledFor: start,
      },
    ];
  }
  if (!input.coverageEnd)
    throw new ValidationException('Recurring RVT requires coverageEnd');
  const end = instantFromCivilDate(input.coverageEnd, input.timezone, 23);
  if (end < start)
    throw new ValidationException('coverageEnd must not precede coverageStart');
  const result: OccurrenceCandidate[] = [];
  let current = start;
  while (current <= end) {
    result.push({
      sequenceNumber: result.length + 1,
      localDate: civilDateKey(current, input.timezone),
      scheduledFor: current,
    });
    if (result.length > 1000)
      throw new ValidationException(
        'RVT coverage produces too many occurrences',
      );
    current =
      input.visitType === 'WEEKLY'
        ? addCivilDays(current, 7, input.timezone)
        : addCalendarMonthsClamped(start, result.length * 6, input.timezone);
  }
  return result;
}

function addCalendarMonthsClamped(
  instant: Date,
  months: number,
  timezone: string,
): Date {
  const key = civilDateKey(instant, timezone);
  const parts = key.split('-').map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const targetMonthIndex = month - 1 + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  const date = `${String(targetYear).padStart(4, '0')}-${String(targetMonth + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
  return instantFromCivilDate(date, timezone, 9);
}

export function deriveRvtDueState(
  scheduledFor: Date | null,
  timezone: string,
  now = new Date(),
): RvtDueState {
  if (!scheduledFor) return 'UPCOMING';
  const scheduled = civilDateKey(scheduledFor, timezone);
  const today = civilDateKey(now, timezone);
  return scheduled === today
    ? 'DUE_TODAY'
    : scheduled < today
      ? 'OVERDUE'
      : 'UPCOMING';
}

export function formatOccurrenceSequence(value: number): string {
  return String(value).padStart(3, '0');
}
