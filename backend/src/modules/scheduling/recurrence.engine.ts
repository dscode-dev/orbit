import { Injectable } from '@nestjs/common';
import { ValidationException } from '../../exceptions';
import { addCivilDays, civilParts, instantFromCivil } from './scheduling-time';

export type RecurrenceRule = {
  frequency: string;
  interval: number;
  byWeekday: number[];
  byMonthDay: number | null;
  count: number | null;
  until: Date | null;
  customRule: unknown;
  exceptions: Date[];
  timezone: string;
};

export type RecurrenceOccurrence = {
  startsAt: Date;
  endsAt: Date;
};

@Injectable()
export class RecurrenceEngine {
  expand(
    startsAt: Date,
    endsAt: Date,
    recurrence: RecurrenceRule | null,
    from: Date,
    to: Date,
  ): RecurrenceOccurrence[] {
    if (endsAt <= startsAt)
      throw new ValidationException('Event end must follow start');
    if (to <= from) throw new ValidationException('Schedule range is invalid');
    if (!recurrence)
      return startsAt < to && endsAt > from ? [{ startsAt, endsAt }] : [];

    const duration = endsAt.getTime() - startsAt.getTime();
    const exceptions = new Set(
      recurrence.exceptions.map((date) => date.toISOString()),
    );
    const candidates = this.candidates(startsAt, recurrence, to);
    return candidates
      .filter((date, index) => !recurrence.count || index < recurrence.count)
      .filter((date) => !recurrence.until || date <= recurrence.until)
      .filter((date) => !exceptions.has(date.toISOString()))
      .map((date) => ({
        startsAt: date,
        endsAt: new Date(date.getTime() + duration),
      }))
      .filter(
        (occurrence) => occurrence.startsAt < to && occurrence.endsAt > from,
      )
      .slice(0, 2000);
  }

  private candidates(seed: Date, rule: RecurrenceRule, horizon: Date): Date[] {
    if (rule.frequency === 'CUSTOM') return this.custom(seed, rule);
    const dates: Date[] = [];
    if (rule.frequency === 'DAILY') {
      for (let index = 0; index < 2000; index += 1) {
        const date = addCivilDays(seed, index * rule.interval, rule.timezone);
        if (date >= horizon) break;
        dates.push(date);
      }
      return dates;
    }
    if (rule.frequency === 'WEEKLY') {
      const weekdays = new Set(
        rule.byWeekday.length
          ? rule.byWeekday
          : [civilParts(seed, rule.timezone).weekday],
      );
      for (let day = 0; day < 3660 && dates.length < 2000; day += 1) {
        const date = addCivilDays(seed, day, rule.timezone);
        if (date >= horizon) break;
        const week = Math.floor(day / 7);
        if (
          week % rule.interval === 0 &&
          weekdays.has(civilParts(date, rule.timezone).weekday)
        )
          dates.push(date);
      }
      return dates;
    }
    if (rule.frequency === 'MONTHLY') {
      const seedPart = civilParts(seed, rule.timezone);
      const day = rule.byMonthDay ?? seedPart.day;
      for (let index = 0; index < 1200 && dates.length < 2000; index += 1) {
        const monthIndex = seedPart.month - 1 + index * rule.interval;
        const year = seedPart.year + Math.floor(monthIndex / 12);
        const month = (((monthIndex % 12) + 12) % 12) + 1;
        const candidate = instantFromCivil(
          {
            year,
            month,
            day,
            hour: seedPart.hour,
            minute: seedPart.minute,
            second: seedPart.second,
          },
          rule.timezone,
        );
        const candidatePart = civilParts(candidate, rule.timezone);
        if (candidatePart.month !== month || candidatePart.day !== day)
          continue;
        if (candidate < seed) continue;
        if (candidate >= horizon) break;
        dates.push(candidate);
      }
      return dates;
    }
    throw new ValidationException(`Unsupported recurrence: ${rule.frequency}`);
  }

  private custom(seed: Date, rule: RecurrenceRule): Date[] {
    const custom = rule.customRule as { dates?: unknown } | null;
    const values = Array.isArray(custom?.dates) ? custom.dates : [];
    const dates = values
      .filter((value): value is string => typeof value === 'string')
      .map((value) => new Date(value))
      .filter((value) => !Number.isNaN(value.getTime()));
    return [seed, ...dates]
      .sort((left, right) => left.getTime() - right.getTime())
      .filter(
        (date, index, all) =>
          index === 0 || date.getTime() !== all[index - 1]?.getTime(),
      );
  }
}
