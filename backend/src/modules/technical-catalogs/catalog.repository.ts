import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { RlsTransaction } from '../../database';
import { PaginationHelper } from '../../database/helpers/database.helpers';
import type { CatalogQueryDto } from './catalog.dto';

const productInclude = {
  category: {
    select: { id: true, name: true, slug: true },
  },
  businessUnit: {
    select: { id: true, legalName: true, tradeName: true },
  },
} satisfies Prisma.ProductInclude;

@Injectable()
export class CatalogRepository {
  constructor(private readonly rls: RlsTransaction) {}

  listCategories(organizationId: string) {
    return this.rls.run((transaction) =>
      transaction.productCategory.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: { name: 'asc' },
      }),
    );
  }

  findCategory(id: string, organizationId: string) {
    return this.rls.run((transaction) =>
      transaction.productCategory.findFirst({
        where: { id, organizationId, deletedAt: null },
      }),
    );
  }

  createCategory(data: Prisma.ProductCategoryUncheckedCreateInput) {
    return this.rls.run((transaction) =>
      transaction.productCategory.create({ data }),
    );
  }

  updateCategory(id: string, data: Prisma.ProductCategoryUpdateInput) {
    return this.rls.run((transaction) =>
      transaction.productCategory.update({ where: { id }, data }),
    );
  }

  categoryDependencies(id: string) {
    return this.rls.run(async (transaction) => {
      const [children, products] = await Promise.all([
        transaction.productCategory.count({
          where: { parentId: id, deletedAt: null },
        }),
        transaction.product.count({
          where: { categoryId: id, deletedAt: null },
        }),
      ]);
      return { children, products };
    });
  }

  softDeleteCategory(id: string): Promise<void> {
    return this.rls
      .run((transaction) =>
        transaction.productCategory.update({
          where: { id },
          data: { deletedAt: new Date() },
        }),
      )
      .then(() => undefined);
  }

  listProducts(organizationId: string, query: CatalogQueryDto) {
    const pagination = PaginationHelper.normalize(query.page, query.limit);
    const where: Prisma.ProductWhereInput = {
      organizationId,
      deletedAt: null,
      kind: query.kind,
      categoryId: query.categoryId,
      businessUnitId: query.businessUnitId,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return this.rls.run(async (transaction) => {
      const [data, total] = await Promise.all([
        transaction.product.findMany({
          where,
          include: productInclude,
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          ...PaginationHelper.toPrisma(pagination),
        }),
        transaction.product.count({ where }),
      ]);
      return PaginationHelper.result(data, total, pagination);
    });
  }

  findProduct(id: string, organizationId: string) {
    return this.rls.run((transaction) =>
      transaction.product.findFirst({
        where: { id, organizationId, deletedAt: null },
        include: productInclude,
      }),
    );
  }

  findAvailableProduct(
    id: string,
    organizationId: string,
    businessUnitId: string,
  ) {
    return this.rls.run((transaction) =>
      transaction.product.findFirst({
        where: {
          id,
          organizationId,
          deletedAt: null,
          status: 'ACTIVE',
          OR: [{ businessUnitId: null }, { businessUnitId }],
        },
        include: productInclude,
      }),
    );
  }

  createProduct(data: Prisma.ProductUncheckedCreateInput) {
    return this.rls.run((transaction) =>
      transaction.product.create({ data, include: productInclude }),
    );
  }

  updateProduct(id: string, data: Prisma.ProductUpdateInput) {
    return this.rls.run((transaction) =>
      transaction.product.update({
        where: { id },
        data,
        include: productInclude,
      }),
    );
  }

  softDeleteProduct(id: string): Promise<void> {
    return this.rls
      .run((transaction) =>
        transaction.product.update({
          where: { id },
          data: { deletedAt: new Date(), status: 'INACTIVE' },
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
