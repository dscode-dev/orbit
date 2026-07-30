import { createHash } from 'node:crypto';

export class SlugHelper {
  static create(value: string): string {
    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

export class HashHelper {
  static sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}

export class DateHelper {
  static toIso(value: Date): string {
    return value.toISOString();
  }

  static startOfDay(value: Date): Date {
    const result = new Date(value);
    result.setUTCHours(0, 0, 0, 0);
    return result;
  }

  static endOfDay(value: Date): Date {
    const result = new Date(value);
    result.setUTCHours(23, 59, 59, 999);
    return result;
  }
}

export class ValidationHelper {
  static assertNever(value: never): never {
    throw new Error(`Unexpected value: ${String(value)}`);
  }

  static isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }
}
