import { ValidationException } from '../../exceptions';
import type { IFilter, ISort } from '../../contracts';
import type { OrderByInput, WhereInput } from '../prisma.types';

const OPERATORS: Readonly<Record<string, string>> = {
  eq: 'equals',
  ne: 'not',
  gt: 'gt',
  gte: 'gte',
  lt: 'lt',
  lte: 'lte',
  in: 'in',
  contains: 'contains',
  startsWith: 'startsWith',
  endsWith: 'endsWith',
};

export class FilterBuilder {
  static build(
    filters: readonly IFilter[] = [],
    allowedFields?: ReadonlySet<string>,
  ): WhereInput {
    return filters.reduce<WhereInput>((where, filter) => {
      if (allowedFields && !allowedFields.has(filter.field)) {
        throw new ValidationException(
          `Filtering by ${filter.field} is not allowed`,
        );
      }
      const operator = OPERATORS[filter.operator];
      if (!operator) {
        throw new ValidationException(
          `Unsupported filter operator ${filter.operator}`,
        );
      }
      return {
        ...where,
        [filter.field]: { [operator]: filter.value },
      };
    }, {});
  }
}

export class SearchBuilder {
  static build(
    search: string | undefined,
    fields: readonly string[],
  ): WhereInput {
    const term = search?.trim();
    return term
      ? {
          OR: fields.map((field) => ({
            [field]: { contains: term, mode: 'insensitive' },
          })),
        }
      : {};
  }
}

export class OrderBuilder {
  static build(
    sorts: readonly ISort[] = [],
    allowedFields?: ReadonlySet<string>,
  ): readonly OrderByInput[] {
    return sorts.map(({ field, direction }) => {
      if (allowedFields && !allowedFields.has(field)) {
        throw new ValidationException(`Sorting by ${field} is not allowed`);
      }
      return { [field]: direction };
    });
  }
}
