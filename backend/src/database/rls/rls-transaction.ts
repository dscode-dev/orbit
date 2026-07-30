import { Injectable } from '@nestjs/common';
import type { ITransactionManager } from '../../contracts';
import { PrismaService } from '../prisma.service';
import type { PrismaTransactionClient } from '../prisma.types';
import { RlsContextProvider } from './rls-context.provider';

@Injectable()
export class RlsTransaction implements ITransactionManager<PrismaTransactionClient> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contextProvider: RlsContextProvider,
  ) {}

  run<T>(
    work: (transaction: PrismaTransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (transaction) => {
      await this.applyContext(transaction);
      return work(transaction);
    });
  }

  private async applyContext(
    transaction: PrismaTransactionClient,
  ): Promise<void> {
    const context = this.contextProvider.get();
    const settings: Readonly<Record<string, string>> = {
      'app.user_id': context.userId,
      'app.organization_id': context.organizationId,
      'app.business_unit_id': context.businessUnitId,
      'app.business_unit_ids': context.businessUnitIds,
      'app.roles': context.roles,
      'app.permissions': context.permissions,
      'app.is_platform_admin': context.isPlatformAdmin,
    };
    for (const [key, value] of Object.entries(settings)) {
      await transaction.$queryRawUnsafe(
        'SELECT set_config($1, $2, true)',
        key,
        value,
      );
    }
  }
}

export class RlsPrismaExtension {
  constructor(private readonly transaction: RlsTransaction) {}

  execute<T>(
    work: (transaction: PrismaTransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.transaction.run(work);
  }
}
