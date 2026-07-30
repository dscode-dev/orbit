import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ConflictException,
  EntityNotFoundException,
  ValidationException,
} from '../../../../exceptions';
import type {
  AssetQueryDto,
  CreateAssetDto,
  UpdateAssetDto,
} from './asset.dto';
import { AssetRepository } from './asset.repository';

@Injectable()
export class AssetService {
  constructor(private readonly repository: AssetRepository) {}

  list(organizationId: string, query: AssetQueryDto) {
    return this.repository.list(organizationId, query);
  }

  async get(id: string, organizationId: string) {
    const asset = await this.repository.find(id, organizationId);
    if (!asset) throw new EntityNotFoundException('Asset', id);
    return asset;
  }

  async resolve(identifier: string, organizationId: string) {
    const normalized = identifier.trim();
    if (!normalized) throw new ValidationException('Identifier is required');
    const asset = await this.repository.findByIdentifier(
      normalized,
      organizationId,
    );
    if (!asset) throw new EntityNotFoundException('Asset');
    return asset;
  }

  async create(organizationId: string, input: CreateAssetDto) {
    await this.validateReferences(organizationId, input);
    this.validateIdentifier(input.identifierType, input.identifier);
    this.validateDates(input.installationAt, input.warrantyUntil);
    try {
      return await this.repository.create({
        organizationId,
        businessUnitId: input.businessUnitId,
        customerId: input.customerId,
        category: input.category,
        name: input.name,
        manufacturer: input.manufacturer,
        model: input.model,
        serialNumber: input.serialNumber,
        identifierType: input.identifierType,
        identifier: input.identifier,
        installationAt: input.installationAt,
        warrantyUntil: input.warrantyUntil,
        location: input.location,
        specifications: input.specifications as
          Prisma.InputJsonValue | undefined,
      });
    } catch (error) {
      this.mapConflict(error);
    }
  }

  async update(id: string, organizationId: string, input: UpdateAssetDto) {
    const current = await this.get(id, organizationId);
    await this.validateReferences(organizationId, input);
    this.validateIdentifier(
      input.identifierType ?? current.identifierType ?? undefined,
      input.identifier ?? current.identifier ?? undefined,
    );
    this.validateDates(
      input.installationAt ?? current.installationAt ?? undefined,
      input.warrantyUntil ?? current.warrantyUntil ?? undefined,
    );
    try {
      return await this.repository.update(id, {
        businessUnit: input.businessUnitId
          ? { connect: { id: input.businessUnitId } }
          : undefined,
        customer: input.customerId
          ? { connect: { id: input.customerId } }
          : undefined,
        category: input.category,
        name: input.name,
        manufacturer: input.manufacturer,
        model: input.model,
        serialNumber: input.serialNumber,
        identifierType: input.identifierType,
        identifier: input.identifier,
        installationAt: input.installationAt,
        warrantyUntil: input.warrantyUntil,
        location: input.location,
        specifications: input.specifications as
          Prisma.InputJsonValue | undefined,
        status: input.status,
      });
    } catch (error) {
      this.mapConflict(error);
    }
  }

  async remove(id: string, organizationId: string): Promise<void> {
    await this.get(id, organizationId);
    await this.repository.softDelete(id);
  }

  private async validateReferences(
    organizationId: string,
    input: {
      businessUnitId?: string;
      customerId?: string;
    },
  ) {
    if (input.businessUnitId) {
      const unit = await this.repository.findBusinessUnit(
        input.businessUnitId,
        organizationId,
      );
      if (!unit) throw new ValidationException('Invalid business unit');
    }
    if (input.customerId) {
      const customer = await this.repository.findCustomer(
        input.customerId,
        organizationId,
      );
      if (!customer) throw new ValidationException('Invalid customer');
    }
  }

  private validateIdentifier(type?: string, identifier?: string) {
    if (Boolean(type) !== Boolean(identifier)) {
      throw new ValidationException(
        'Identifier type and identifier must be provided together',
      );
    }
  }

  private validateDates(installationAt?: Date, warrantyUntil?: Date) {
    if (
      installationAt &&
      warrantyUntil &&
      warrantyUntil.getTime() < installationAt.getTime()
    ) {
      throw new ValidationException(
        'Warranty date cannot precede installation date',
      );
    }
  }

  private mapConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Asset identifier or serial number is already in use',
      );
    }
    throw error;
  }
}
