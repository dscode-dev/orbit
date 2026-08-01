import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConflictException, EntityNotFoundException } from '../../exceptions';
import { ArtifactTemplateReadModelMapper } from './artifact-template.mapper';
import { ArtifactTemplatePolicy } from './artifact-template.policy';
import { ArtifactTemplateRepository } from './artifact-template.repository';
import type {
  ArtifactTemplateListReadModel,
  ArtifactTemplateReadModel,
  ArtifactTemplateVersionReadModel,
} from './artifact-template.read-models';
import { ArtifactTemplateValidator } from './artifact-template.validator';
import type {
  ArtifactTemplateQueryDto,
  CreateArtifactTemplateDto,
  CreateArtifactTemplateVersionDto,
  DuplicateArtifactTemplateDto,
  UpdateArtifactTemplateDto,
} from './dto/artifact-template.dto';

@Injectable()
export class ArtifactTemplateService {
  constructor(
    private readonly repository: ArtifactTemplateRepository,
    private readonly mapper: ArtifactTemplateReadModelMapper,
    private readonly validator: ArtifactTemplateValidator,
    private readonly policy: ArtifactTemplatePolicy,
  ) {}

  async list(
    organizationId: string,
    query: ArtifactTemplateQueryDto,
  ): Promise<ArtifactTemplateListReadModel> {
    return this.mapper.list(await this.repository.list(organizationId, query));
  }

  async get(
    id: string,
    organizationId: string,
  ): Promise<ArtifactTemplateReadModel> {
    return this.mapper.details(await this.source(id, organizationId));
  }

  async create(
    organizationId: string,
    actorId: string,
    input: CreateArtifactTemplateDto,
  ): Promise<ArtifactTemplateReadModel> {
    this.validator.validate(input.sections, input.signatureSlots);
    try {
      const template = await this.repository.create(organizationId, actorId, {
        ...input,
        key: input.key.trim().toUpperCase(),
        artifactType: input.artifactType.trim().toUpperCase(),
        segment: input.segment?.trim().toUpperCase(),
      });
      return this.mapper.details(template);
    } catch (error) {
      this.mapConflict(error);
    }
  }

  async update(
    id: string,
    organizationId: string,
    actorId: string,
    input: UpdateArtifactTemplateDto,
  ): Promise<ArtifactTemplateReadModel> {
    const template = await this.source(id, organizationId);
    this.policy.assertOwnedByOrganization(template, organizationId);
    return this.mapper.details(
      await this.repository.update(id, organizationId, actorId, {
        ...input,
        artifactType: input.artifactType?.trim().toUpperCase(),
        segment: input.segment?.trim().toUpperCase(),
      }),
    );
  }

  async createVersion(
    id: string,
    organizationId: string,
    actorId: string,
    input: CreateArtifactTemplateVersionDto,
  ): Promise<ArtifactTemplateVersionReadModel> {
    const template = await this.source(id, organizationId);
    this.policy.assertOwnedByOrganization(template, organizationId);
    this.validator.validate(input.sections, input.signatureSlots);
    try {
      return this.mapper.version(
        await this.repository.createVersion(id, organizationId, actorId, input),
      );
    } catch (error) {
      this.mapConflict(error);
    }
  }

  async versions(
    id: string,
    organizationId: string,
  ): Promise<readonly ArtifactTemplateVersionReadModel[]> {
    await this.source(id, organizationId);
    return (await this.repository.versions(id)).map((version) =>
      this.mapper.version(version),
    );
  }

  async version(
    id: string,
    versionNumber: number,
    organizationId: string,
  ): Promise<ArtifactTemplateVersionReadModel> {
    await this.source(id, organizationId);
    const version = await this.repository.version(id, versionNumber);
    if (!version) {
      throw new EntityNotFoundException(
        'Artifact template version',
        `${id}@${versionNumber}`,
      );
    }
    return this.mapper.version(version);
  }

  activate(id: string, organizationId: string, actorId: string) {
    return this.changeStatus(id, organizationId, actorId, 'ACTIVE');
  }

  deactivate(id: string, organizationId: string, actorId: string) {
    return this.changeStatus(id, organizationId, actorId, 'INACTIVE');
  }

  async duplicate(
    id: string,
    organizationId: string,
    actorId: string,
    input: DuplicateArtifactTemplateDto,
  ): Promise<ArtifactTemplateReadModel> {
    await this.source(id, organizationId);
    try {
      return this.mapper.details(
        await this.repository.duplicate(
          id,
          organizationId,
          actorId,
          input.key.trim().toUpperCase(),
          input.name,
        ),
      );
    } catch (error) {
      this.mapConflict(error);
    }
  }

  async remove(
    id: string,
    organizationId: string,
    actorId: string,
  ): Promise<void> {
    const template = await this.source(id, organizationId);
    this.policy.assertOwnedByOrganization(template, organizationId);
    this.policy.assertCanDelete(template);
    if ((await this.repository.dependencies(id)) > 0) {
      throw new ConflictException(
        'A template linked to a legacy definition cannot be deleted',
      );
    }
    await this.repository.softDelete(id, organizationId, actorId);
  }

  private async changeStatus(
    id: string,
    organizationId: string,
    actorId: string,
    status: 'ACTIVE' | 'INACTIVE',
  ): Promise<ArtifactTemplateReadModel> {
    const template = await this.source(id, organizationId);
    this.policy.assertOwnedByOrganization(template, organizationId);
    return this.mapper.details(
      await this.repository.setStatus(id, organizationId, actorId, status),
    );
  }

  private async source(id: string, organizationId: string) {
    const template = await this.repository.find(id, organizationId);
    if (!template) throw new EntityNotFoundException('Artifact template', id);
    return template;
  }

  private mapConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Artifact template key already exists');
    }
    throw error;
  }
}
