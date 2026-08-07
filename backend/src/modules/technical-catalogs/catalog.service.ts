import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ConflictException,
  EntityNotFoundException,
  ValidationException,
} from '../../exceptions';
import { SlugHelper } from '../../helpers';
import type {
  CatalogQueryDto,
  CreateProductCategoryDto,
  CreateProductDto,
  UpdateProductCategoryDto,
  UpdateProductDto,
} from './catalog.dto';
import { CatalogRepository } from './catalog.repository';

@Injectable()
export class CatalogService {
  constructor(private readonly repository: CatalogRepository) {}

  listCategories(organizationId: string) {
    return this.repository.listCategories(organizationId);
  }

  async createCategory(
    organizationId: string,
    input: CreateProductCategoryDto,
  ) {
    await this.validateCategoryParent(input.parentId, organizationId);
    const slug = SlugHelper.create(input.name);
    if (!slug) throw new ValidationException('Invalid category name');
    try {
      return await this.repository.createCategory({
        organizationId,
        parentId: input.parentId,
        name: input.name,
        slug,
        description: input.description,
      });
    } catch (error) {
      this.rethrowConflict(error, 'Product category already exists');
    }
  }

  async updateCategory(
    id: string,
    organizationId: string,
    input: UpdateProductCategoryDto,
  ) {
    await this.requireCategory(id, organizationId);
    if (input.parentId === id) {
      throw new ValidationException('A category cannot be its own parent');
    }
    await this.validateCategoryParent(input.parentId, organizationId);
    if (input.parentId) {
      await this.assertNoCategoryCycle(id, input.parentId, organizationId);
    }
    try {
      return await this.repository.updateCategory(id, {
        name: input.name,
        slug: input.name ? SlugHelper.create(input.name) : undefined,
        description: input.description,
        parent: input.parentId
          ? { connect: { id: input.parentId } }
          : undefined,
      });
    } catch (error) {
      this.rethrowConflict(error, 'Product category already exists');
    }
  }

  async removeCategory(id: string, organizationId: string): Promise<void> {
    await this.requireCategory(id, organizationId);
    const dependencies = await this.repository.categoryDependencies(id);
    if (dependencies.children > 0 || dependencies.products > 0) {
      throw new ConflictException(
        'Category with active children or products cannot be deleted',
      );
    }
    await this.repository.softDeleteCategory(id);
  }

  listProducts(organizationId: string, query: CatalogQueryDto) {
    return this.repository.listProducts(organizationId, query);
  }

  getProduct(id: string, organizationId: string) {
    return this.requireProduct(id, organizationId);
  }

  async findAvailableForBusinessUnit(
    id: string,
    organizationId: string,
    businessUnitId: string,
  ) {
    const product = await this.repository.findAvailableProduct(
      id,
      organizationId,
      businessUnitId,
    );
    if (!product) throw new EntityNotFoundException('Product', id);
    return product;
  }

  async createProduct(organizationId: string, input: CreateProductDto) {
    await this.validateProductReferences(input, organizationId);
    try {
      return await this.repository.createProduct({
        organizationId,
        businessUnitId: input.businessUnitId,
        categoryId: input.categoryId,
        kind: input.kind,
        sku: input.sku?.trim() || null,
        name: input.name,
        description: input.description,
        unit: input.unit?.toUpperCase() ?? 'UN',
        salePrice: input.salePrice,
        costPrice: input.costPrice,
        taxData: input.taxData as Prisma.InputJsonValue | undefined,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      });
    } catch (error) {
      this.rethrowConflict(error, 'Product SKU already exists');
    }
  }

  async updateProduct(
    id: string,
    organizationId: string,
    input: UpdateProductDto,
  ) {
    await this.requireProduct(id, organizationId);
    await this.validateProductReferences(input, organizationId);
    try {
      return await this.repository.updateProduct(id, {
        businessUnit: input.businessUnitId
          ? { connect: { id: input.businessUnitId } }
          : input.organizationWide
            ? { disconnect: true }
            : undefined,
        category: input.categoryId
          ? { connect: { id: input.categoryId } }
          : input.uncategorized
            ? { disconnect: true }
            : undefined,
        kind: input.kind,
        sku: input.sku?.trim(),
        name: input.name,
        description: input.description,
        unit: input.unit?.toUpperCase(),
        salePrice: input.salePrice,
        costPrice: input.costPrice,
        taxData: input.taxData as Prisma.InputJsonValue | undefined,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
        status: input.status,
      });
    } catch (error) {
      this.rethrowConflict(error, 'Product SKU already exists');
    }
  }

  async removeProduct(id: string, organizationId: string): Promise<void> {
    await this.requireProduct(id, organizationId);
    await this.repository.softDeleteProduct(id);
  }

  private async validateProductReferences(
    input: Pick<CreateProductDto, 'categoryId' | 'businessUnitId'>,
    organizationId: string,
  ): Promise<void> {
    if (input.categoryId) {
      await this.requireCategory(input.categoryId, organizationId);
    }
    if (
      input.businessUnitId &&
      !(await this.repository.findBusinessUnit(
        input.businessUnitId,
        organizationId,
      ))
    ) {
      throw new ValidationException('Invalid business unit');
    }
  }

  private async validateCategoryParent(
    parentId: string | undefined,
    organizationId: string,
  ): Promise<void> {
    if (parentId) await this.requireCategory(parentId, organizationId);
  }

  private async assertNoCategoryCycle(
    categoryId: string,
    parentId: string,
    organizationId: string,
  ): Promise<void> {
    let current: string | null = parentId;
    for (let depth = 0; current && depth < 100; depth += 1) {
      if (current === categoryId) {
        throw new ValidationException(
          'Category hierarchy cannot contain cycles',
        );
      }
      const category = await this.repository.findCategory(
        current,
        organizationId,
      );
      current = category?.parentId ?? null;
    }
    if (current)
      throw new ValidationException('Category hierarchy is too deep');
  }

  private async requireCategory(id: string, organizationId: string) {
    const category = await this.repository.findCategory(id, organizationId);
    if (!category) throw new EntityNotFoundException('ProductCategory', id);
    return category;
  }

  private async requireProduct(id: string, organizationId: string) {
    const product = await this.repository.findProduct(id, organizationId);
    if (!product) throw new EntityNotFoundException('Product', id);
    return product;
  }

  private rethrowConflict(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }
}
