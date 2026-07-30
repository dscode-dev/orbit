import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestContextService } from '../../context';
import { PrismaService, RlsTransaction } from '../../database';
import { ConflictException } from '../../exceptions';

export type UsageOperation = 'CONSUME' | 'RESERVE' | 'RELEASE';

@Injectable()
export class UsageRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexts: RequestContextService,
    private readonly rls: RlsTransaction,
  ) {}

  listCurrent(organizationId: string, periodStart: Date, periodEnd: Date) {
    return this.rls.run((transaction) =>
      transaction.planUsage.findMany({
        where: { organizationId, periodStart, periodEnd },
        orderBy: { resource: 'asc' },
      }),
    );
  }

  async record(
    organizationId: string,
    resource: string,
    amount: number,
    operation: UsageOperation,
    periodStart: Date,
    periodEnd: Date,
    limit: number | null,
  ) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const context = this.contexts.get();
            await this.setLocal(
              transaction,
              'app.user_id',
              context.userId ?? '',
            );
            await this.setLocal(
              transaction,
              'app.organization_id',
              organizationId,
            );
            await this.setLocal(
              transaction,
              'app.business_unit_ids',
              context.businessUnitIds.join(','),
            );
            const usage = await transaction.planUsage.upsert({
              where: {
                organizationId_resource_periodStart_periodEnd: {
                  organizationId,
                  resource,
                  periodStart,
                  periodEnd,
                },
              },
              create: {
                organizationId,
                resource,
                periodStart,
                periodEnd,
              },
              update: {},
            });
            const used = usage.used.toNumber();
            const reserved = usage.reserved.toNumber();
            const nextUsed = operation === 'CONSUME' ? used + amount : used;
            const nextReserved =
              operation === 'RESERVE'
                ? reserved + amount
                : operation === 'RELEASE'
                  ? Math.max(0, reserved - amount)
                  : Math.max(0, reserved - amount);
            if (limit !== null && nextUsed + nextReserved > limit) {
              throw new ConflictException(
                `Plan limit exceeded for resource ${resource}`,
              );
            }
            return transaction.planUsage.update({
              where: { id: usage.id },
              data: {
                used: new Prisma.Decimal(nextUsed),
                reserved: new Prisma.Decimal(nextReserved),
              },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < 2
        ) {
          continue;
        }
        throw error;
      }
    }
    throw new ConflictException('Unable to record usage due to contention');
  }

  private setLocal(
    transaction: Prisma.TransactionClient,
    key: string,
    value: string,
  ): Promise<unknown> {
    return transaction.$queryRawUnsafe(
      'SELECT set_config($1, $2, true)',
      key,
      value,
    );
  }
}
