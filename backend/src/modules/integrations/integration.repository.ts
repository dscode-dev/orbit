import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { RlsTransaction } from '../../database';

const publicSelection = {
  id: true,
  organizationId: true,
  provider: true,
  category: true,
  displayName: true,
  status: true,
  configuration: true,
  secretKeyVersion: true,
  lastValidatedAt: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.IntegrationSelect;

@Injectable()
export class IntegrationRepository {
  constructor(private readonly rls: RlsTransaction) {}

  list(organizationId: string) {
    return this.rls.run((transaction) =>
      transaction.integration.findMany({
        where: { organizationId, deletedAt: null },
        select: publicSelection,
        orderBy: [{ category: 'asc' }, { displayName: 'asc' }],
      }),
    );
  }

  findPublic(id: string, organizationId: string) {
    return this.rls.run((transaction) =>
      transaction.integration.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: publicSelection,
      }),
    );
  }

  findInternal(id: string, organizationId: string) {
    return this.rls.run((transaction) =>
      transaction.integration.findFirst({
        where: { id, organizationId, deletedAt: null },
      }),
    );
  }

  create(data: Prisma.IntegrationUncheckedCreateInput) {
    return this.rls.run((transaction) =>
      transaction.integration.create({ data, select: publicSelection }),
    );
  }

  update(id: string, data: Prisma.IntegrationUpdateInput) {
    return this.rls.run((transaction) =>
      transaction.integration.update({
        where: { id },
        data,
        select: publicSelection,
      }),
    );
  }

  softDelete(id: string): Promise<void> {
    return this.rls
      .run((transaction) =>
        transaction.integration.update({
          where: { id },
          data: { deletedAt: new Date(), status: 'INACTIVE' },
        }),
      )
      .then(() => undefined);
  }
}
