import { Injectable } from '@nestjs/common';
import type { ITransactionManager } from '../contracts';
import { SoftDeleteHelper } from './helpers/database.helpers';
import type { PrismaTransactionClient } from './prisma.types';
import { RlsTransaction } from './rls/rls-transaction';

class SoftDeleteExtension {
  static where(includeDeleted = false): Record<string, unknown> {
    return SoftDeleteHelper.active(includeDeleted);
  }
}

@Injectable()
export class TransactionManager implements ITransactionManager<PrismaTransactionClient> {
  constructor(private readonly rls: RlsTransaction) {}

  run<T>(
    work: (transaction: PrismaTransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.rls.run(work);
  }
}

export class PrismaExtensions {
  static readonly softDelete = SoftDeleteExtension;
}
