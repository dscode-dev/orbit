import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { RlsTransaction } from '../../../../database';
import { PaginationHelper } from '../../../../database/helpers/database.helpers';
import type { CustomerQueryDto } from './customer.dto';

const customerInclude = {
  contacts: {
    where: { deletedAt: null },
    orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
  },
  _count: {
    select: {
      assets: { where: { deletedAt: null } },
      operations: { where: { deletedAt: null } },
    },
  },
} satisfies Prisma.CustomerInclude;

@Injectable()
export class CustomerRepository {
  constructor(private readonly rls: RlsTransaction) {}

  list(organizationId: string, query: CustomerQueryDto) {
    const pagination = PaginationHelper.normalize(query.page, query.limit);
    const where: Prisma.CustomerWhereInput = {
      organizationId,
      deletedAt: null,
      type: query.type,
      status: query.status,
      ...(query.search
        ? {
            OR: [
              { legalName: { contains: query.search, mode: 'insensitive' } },
              { tradeName: { contains: query.search, mode: 'insensitive' } },
              {
                documentNumber: {
                  contains: query.search.replace(/\D/g, ''),
                },
              },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
            ],
          }
        : {}),
    };
    return this.rls.run(async (transaction) => {
      const data = await transaction.customer.findMany({
        where,
        include: customerInclude,
        orderBy: [{ legalName: 'asc' }, { id: 'asc' }],
        ...PaginationHelper.toPrisma(pagination),
      });
      const total = await transaction.customer.count({ where });
      return PaginationHelper.result(data, total, pagination);
    });
  }

  find(id: string, organizationId: string) {
    return this.rls.run((transaction) =>
      transaction.customer.findFirst({
        where: { id, organizationId, deletedAt: null },
        include: customerInclude,
      }),
    );
  }

  create(data: Prisma.CustomerUncheckedCreateInput) {
    return this.rls.run((transaction) =>
      transaction.customer.create({ data, include: customerInclude }),
    );
  }

  update(id: string, data: Prisma.CustomerUpdateInput) {
    return this.rls.run((transaction) =>
      transaction.customer.update({
        where: { id },
        data,
        include: customerInclude,
      }),
    );
  }

  softDelete(id: string): Promise<void> {
    return this.rls
      .run(async (transaction) => {
        const now = new Date();
        await transaction.contact.updateMany({
          where: { customerId: id, deletedAt: null },
          data: { deletedAt: now },
        });
        await transaction.customer.update({
          where: { id },
          data: { status: 'INACTIVE', deletedAt: now },
        });
      })
      .then(() => undefined);
  }

  listContacts(customerId: string) {
    return this.rls.run((transaction) =>
      transaction.contact.findMany({
        where: { customerId, deletedAt: null },
        include: {
          businessUnit: {
            select: { id: true, legalName: true, tradeName: true },
          },
        },
        orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
      }),
    );
  }

  findContact(id: string, customerId: string, organizationId: string) {
    return this.rls.run((transaction) =>
      transaction.contact.findFirst({
        where: { id, customerId, organizationId, deletedAt: null },
      }),
    );
  }

  createContact(data: Prisma.ContactUncheckedCreateInput) {
    return this.rls.run(async (transaction) => {
      if (data.isPrimary) {
        await transaction.contact.updateMany({
          where: {
            customerId: data.customerId,
            organizationId: data.organizationId,
            deletedAt: null,
            isPrimary: true,
          },
          data: { isPrimary: false },
        });
      }
      return transaction.contact.create({ data });
    });
  }

  updateContact(
    id: string,
    customerId: string,
    organizationId: string,
    data: Prisma.ContactUpdateInput,
  ) {
    return this.rls.run(async (transaction) => {
      if (data.isPrimary === true) {
        await transaction.contact.updateMany({
          where: {
            id: { not: id },
            customerId,
            organizationId,
            deletedAt: null,
            isPrimary: true,
          },
          data: { isPrimary: false },
        });
      }
      return transaction.contact.update({ where: { id }, data });
    });
  }

  softDeleteContact(id: string): Promise<void> {
    return this.rls
      .run((transaction) =>
        transaction.contact.update({
          where: { id },
          data: { deletedAt: new Date(), isPrimary: false },
        }),
      )
      .then(() => undefined);
  }

  findBusinessUnit(id: string, organizationId: string) {
    return this.rls.run((transaction) =>
      transaction.businessUnit.findFirst({
        where: { id, organizationId, deletedAt: null, status: 'ACTIVE' },
        select: { id: true },
      }),
    );
  }
}
