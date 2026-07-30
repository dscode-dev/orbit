import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ConflictException,
  EntityNotFoundException,
  ValidationException,
} from '../../exceptions';
import { SlugHelper } from '../../helpers';
import type {
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';
import { OrganizationRepository } from './organization.repository';

@Injectable()
export class OrganizationService {
  constructor(private readonly repository: OrganizationRepository) {}

  async create(ownerUserId: string, input: CreateOrganizationDto) {
    const slug = SlugHelper.create(input.displayName);
    const businessUnitSlug = SlugHelper.create(
      input.primaryBusinessUnit.tradeName ??
        input.primaryBusinessUnit.legalName,
    );
    if (!slug || !businessUnitSlug) {
      throw new ValidationException('Unable to generate a valid slug');
    }
    try {
      const organization = await this.repository.create(
        ownerUserId,
        input,
        slug,
        businessUnitSlug,
      );
      if (!organization) throw new ValidationException('Invalid plan');
      return organization;
    } catch (error) {
      if (error instanceof ValidationException) throw error;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Organization or primary business unit already exists',
        );
      }
      throw error;
    }
  }

  async getCurrent(organizationId: string) {
    const organization = await this.repository.findCurrent(organizationId);
    if (!organization) throw new EntityNotFoundException('Organization');
    return organization;
  }

  async update(organizationId: string, input: UpdateOrganizationDto) {
    await this.getCurrent(organizationId);
    return this.repository.updateCurrent(organizationId, {
      displayName: input.displayName,
      primarySegment: input.primarySegment,
      settings: input.settings as Prisma.InputJsonValue | undefined,
    });
  }
}
