import type { IPaginatedResult, IPagination } from '../../contracts';
import type { WhereInput } from '../prisma.types';

export class PaginationHelper {
  static normalize(page = 1, limit = 20, maximumLimit = 100): IPagination {
    return {
      page: Math.max(1, Math.trunc(page)),
      limit: Math.min(maximumLimit, Math.max(1, Math.trunc(limit))),
    };
  }

  static toPrisma(pagination: IPagination): { skip: number; take: number } {
    return {
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    };
  }

  static result<T>(
    data: readonly T[],
    total: number,
    pagination: IPagination,
  ): IPaginatedResult<T> {
    const totalPages = Math.ceil(total / pagination.limit);
    return {
      data,
      meta: {
        ...pagination,
        total,
        totalPages,
        hasNextPage: pagination.page < totalPages,
        hasPreviousPage: pagination.page > 1,
      },
    };
  }
}

export class SoftDeleteHelper {
  static active(includeDeleted = false): WhereInput {
    return includeDeleted ? {} : { deletedAt: null };
  }

  static delete(at = new Date()): WhereInput {
    return { deletedAt: at };
  }

  static restore(): WhereInput {
    return { deletedAt: null };
  }
}
