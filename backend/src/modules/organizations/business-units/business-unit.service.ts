import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ConflictException,
  EntityNotFoundException,
  ForbiddenException,
  ValidationException,
} from '../../../exceptions';
import { SlugHelper } from '../../../helpers';
import type {
  CreateBusinessUnitDto,
  UpdateBusinessUnitDto,
} from '../dto/organization.dto';
import { BusinessUnitRepository } from './business-unit.repository';

@Injectable()
export class BusinessUnitService {
  constructor(private readonly repository: BusinessUnitRepository) {}

  list(organizationId: string) {
    return this.repository.list(organizationId);
  }

  async create(
    organizationId: string,
    actorUserId: string,
    accessibleUnitIds: readonly string[],
    input: CreateBusinessUnitDto,
  ) {
    if (input.parentId) {
      await this.require(input.parentId, organizationId);
    }
    const role = await this.repository.findActorRole(
      organizationId,
      actorUserId,
    );
    if (!role) throw new ForbiddenException();
    const slug = SlugHelper.create(input.tradeName ?? input.legalName);
    if (!slug) throw new ValidationException('Unable to generate a valid slug');
    try {
      return await this.repository.create(
        organizationId,
        actorUserId,
        accessibleUnitIds,
        role.roleId,
        input,
        slug,
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Business unit already exists');
      }
      throw error;
    }
  }

  async update(
    id: string,
    organizationId: string,
    input: UpdateBusinessUnitDto,
  ) {
    const current = await this.require(id, organizationId);
    if (input.parentId === id) {
      throw new ValidationException('A business unit cannot be its own parent');
    }
    if (input.parentId) {
      await this.require(input.parentId, organizationId);
    }
    if (current.isPrimary && input.isPrimary === false) {
      throw new ConflictException(
        'Promote another business unit instead of unsetting the primary unit',
      );
    }
    const name = input.tradeName ?? input.legalName;
    const slug = name ? SlugHelper.create(name) : undefined;
    try {
      return await this.repository.update(id, organizationId, input, slug);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Business unit conflicts with an existing record',
        );
      }
      throw error;
    }
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const unit = await this.require(id, organizationId);
    if (unit.isPrimary) {
      throw new ConflictException(
        'The primary business unit cannot be deleted',
      );
    }
    await this.repository.softDelete(id);
  }

  private async require(id: string, organizationId: string) {
    const unit = await this.repository.find(id, organizationId);
    if (!unit) throw new EntityNotFoundException('BusinessUnit', id);
    return unit;
  }
}
