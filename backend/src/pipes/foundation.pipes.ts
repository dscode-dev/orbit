import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import type { IFilter, IPagination, ISort, UUID } from '../contracts';
import { SortDirection } from '../contracts';
import { PaginationHelper } from '../database';
import { ValidationException } from '../exceptions';
import { isUuidV7 } from '../utils';

@Injectable()
export class ParseUUIDv7Pipe implements PipeTransform<string, UUID> {
  transform(value: string): UUID {
    if (!isUuidV7(value)) {
      throw new BadRequestException('A valid UUID v7 is required');
    }
    return value;
  }
}

@Injectable()
export class TrimPipe implements PipeTransform {
  transform(value: unknown): unknown {
    if (typeof value === 'string') return value.trim();
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        typeof item === 'string' ? item.trim() : item,
      ]),
    );
  }
}

@Injectable()
export class PaginationPipe implements PipeTransform<
  Record<string, unknown>,
  IPagination
> {
  transform(value: Record<string, unknown>): IPagination {
    return PaginationHelper.normalize(
      Number(value.page ?? 1),
      Number(value.limit ?? 20),
    );
  }
}

@Injectable()
export class SortPipe implements PipeTransform<string | undefined, ISort[]> {
  transform(value?: string): ISort[] {
    if (!value) return [];
    return value.split(',').map((entry) => {
      const [field, rawDirection = SortDirection.ASC] = entry.split(':');
      if (
        !field ||
        !Object.values(SortDirection).includes(rawDirection as SortDirection)
      ) {
        throw new ValidationException(`Invalid sort expression: ${entry}`);
      }
      return { field, direction: rawDirection as SortDirection };
    });
  }
}

@Injectable()
export class FilterPipe implements PipeTransform<
  string | undefined,
  IFilter[]
> {
  transform(value: string | undefined): IFilter[] {
    if (!value) return [];
    return value.split(',').map((entry) => {
      const [field, operator, ...parts] = entry.split(':');
      if (!field || !operator || parts.length === 0) {
        throw new ValidationException(`Invalid filter expression: ${entry}`);
      }
      return { field, operator, value: parts.join(':') };
    });
  }
}
