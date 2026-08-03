import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransaction } from '../../database';
import { PaginationHelper } from '../../database/helpers/database.helpers';
import type {
  ArtifactTemplateQueryDto,
  CreateArtifactTemplateDto,
  CreateArtifactTemplateVersionDto,
  UpdateArtifactTemplateDto,
} from './dto/artifact-template.dto';

const versionOrder = { version: 'desc' } as const;

@Injectable()
export class ArtifactTemplateRepository {
  constructor(private readonly rls: RlsTransaction) {}

  list(organizationId: string, query: ArtifactTemplateQueryDto) {
    const pagination = PaginationHelper.normalize(query.page, query.limit);
    const where: Prisma.ArtifactTemplateWhereInput = {
      deletedAt: null,
      OR: [
        { organizationId },
        { organizationId: null, visibility: 'GLOBAL', status: 'ACTIVE' },
      ],
      artifactType: query.artifactType,
      segment: query.segment,
      status: query.status,
      visibility: query.visibility,
      tags: query.tag ? { has: query.tag } : undefined,
      ...(query.search
        ? {
            AND: {
              OR: [
                { key: { contains: query.search, mode: 'insensitive' } },
                { name: { contains: query.search, mode: 'insensitive' } },
                {
                  description: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              ],
            },
          }
        : {}),
    };
    return this.rls.run(async (tx) => {
      const [data, total] = await Promise.all([
        tx.artifactTemplate.findMany({
          where,
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          ...PaginationHelper.toPrisma(pagination),
        }),
        tx.artifactTemplate.count({ where }),
      ]);
      return PaginationHelper.result(data, total, pagination);
    });
  }

  find(id: string, organizationId: string) {
    return this.rls.run((tx) =>
      tx.artifactTemplate.findFirst({
        where: {
          id,
          deletedAt: null,
          OR: [
            { organizationId },
            { organizationId: null, visibility: 'GLOBAL', status: 'ACTIVE' },
          ],
        },
        include: { versions: { orderBy: versionOrder } },
      }),
    );
  }

  create(
    organizationId: string,
    actorId: string,
    input: CreateArtifactTemplateDto,
  ) {
    return this.rls.run(async (tx) => {
      const template = await tx.artifactTemplate.create({
        data: {
          organizationId,
          createdById: actorId,
          key: input.key,
          name: input.name,
          description: input.description,
          artifactType: input.artifactType,
          segment: input.segment,
          visibility: input.visibility,
          tags: input.tags,
          sortOrder: input.sortOrder,
          status: 'DRAFT',
          currentVersion: 1,
          versions: {
            create: {
              organizationId,
              createdById: actorId,
              version: 1,
              metadata: this.json(input.metadata),
              sections: this.json(input.sections),
              signatureSlots: this.json(input.signatureSlots),
              layout: this.json(input.layout),
              changeSummary: 'Initial version',
            },
          },
        },
        include: { versions: { orderBy: versionOrder } },
      });
      await this.audit(
        tx,
        organizationId,
        actorId,
        'ARTIFACT_TEMPLATE_CREATED',
        template.id,
        null,
        {
          key: template.key,
          version: 1,
        },
      );
      return template;
    });
  }

  createVersion(
    templateId: string,
    organizationId: string,
    actorId: string,
    input: CreateArtifactTemplateVersionDto,
  ) {
    return this.rls.run(async (tx) => {
      /**
       * `$executeRaw`, não `$queryRaw`.
       *
       * `pg_advisory_xact_lock` retorna `void`, e o `$queryRaw` tenta
       * desserializar a coluna do resultado: "Failed to deserialize column of
       * type 'void'". A trava funcionava, mas a chamada estourava — publicar
       * versão respondia **500** desde a PR-17. `$executeRaw` executa sem ler
       * resultado, que é o que um lock precisa.
       */
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${organizationId}:${templateId}`}))`;
      const template = await tx.artifactTemplate.findFirstOrThrow({
        where: { id: templateId, organizationId, deletedAt: null },
      });
      const latest = await tx.artifactTemplateVersion.aggregate({
        where: { templateId },
        _max: { version: true },
      });
      const versionNumber = (latest._max.version ?? 0) + 1;
      const version = await tx.artifactTemplateVersion.create({
        data: {
          templateId,
          organizationId,
          createdById: actorId,
          version: versionNumber,
          metadata: this.json(input.metadata),
          sections: this.json(input.sections),
          signatureSlots: this.json(input.signatureSlots),
          layout: this.json(input.layout),
          changeSummary: input.changeSummary,
        },
      });
      await tx.artifactTemplate.update({
        where: { id: templateId },
        data: { currentVersion: versionNumber },
      });
      await this.audit(
        tx,
        organizationId,
        actorId,
        'ARTIFACT_TEMPLATE_VERSION_CREATED',
        templateId,
        { currentVersion: template.currentVersion },
        { currentVersion: versionNumber, versionId: version.id },
      );
      return version;
    });
  }

  update(
    id: string,
    organizationId: string,
    actorId: string,
    input: UpdateArtifactTemplateDto,
  ) {
    return this.rls.run(async (tx) => {
      const before = await tx.artifactTemplate.findFirstOrThrow({
        where: { id, organizationId, deletedAt: null },
      });
      const template = await tx.artifactTemplate.update({
        where: { id },
        data: input,
        include: { versions: { orderBy: versionOrder } },
      });
      await this.audit(
        tx,
        organizationId,
        actorId,
        'ARTIFACT_TEMPLATE_UPDATED',
        id,
        this.metadata(before),
        this.metadata(template),
      );
      return template;
    });
  }

  setStatus(
    id: string,
    organizationId: string,
    actorId: string,
    status: 'ACTIVE' | 'INACTIVE',
  ) {
    return this.rls.run(async (tx) => {
      const before = await tx.artifactTemplate.findFirstOrThrow({
        where: { id, organizationId, deletedAt: null },
      });
      const template = await tx.artifactTemplate.update({
        where: { id },
        data: { status },
        include: { versions: { orderBy: versionOrder } },
      });
      await this.audit(
        tx,
        organizationId,
        actorId,
        `ARTIFACT_TEMPLATE_${status}`,
        id,
        { status: before.status },
        { status },
      );
      return template;
    });
  }

  duplicate(
    sourceId: string,
    organizationId: string,
    actorId: string,
    key: string,
    name?: string,
  ) {
    return this.rls.run(async (tx) => {
      const source = await tx.artifactTemplate.findFirstOrThrow({
        where: { id: sourceId, deletedAt: null },
        include: { versions: { orderBy: versionOrder } },
      });
      const current = source.versions.find(
        (version) => version.version === source.currentVersion,
      );
      if (!current)
        throw new Error('Artifact template current version missing');
      const duplicate = await tx.artifactTemplate.create({
        data: {
          organizationId,
          createdById: actorId,
          key,
          name: name ?? `${source.name} (cópia)`,
          description: source.description,
          artifactType: source.artifactType,
          segment: source.segment,
          visibility: 'ORGANIZATION',
          tags: source.tags,
          sortOrder: source.sortOrder,
          status: 'DRAFT',
          currentVersion: 1,
          versions: {
            create: {
              organizationId,
              createdById: actorId,
              version: 1,
              metadata: this.json(current.metadata),
              sections: this.json(current.sections),
              signatureSlots: this.json(current.signatureSlots),
              layout: this.json(current.layout),
              changeSummary: `Duplicated from ${source.id}@${source.currentVersion}`,
            },
          },
        },
        include: { versions: { orderBy: versionOrder } },
      });
      await this.audit(
        tx,
        organizationId,
        actorId,
        'ARTIFACT_TEMPLATE_DUPLICATED',
        duplicate.id,
        null,
        { sourceId, sourceVersion: source.currentVersion },
      );
      return duplicate;
    });
  }

  versions(templateId: string) {
    return this.rls.run((tx) =>
      tx.artifactTemplateVersion.findMany({
        where: { templateId },
        orderBy: versionOrder,
      }),
    );
  }

  version(templateId: string, version: number) {
    return this.rls.run((tx) =>
      tx.artifactTemplateVersion.findUnique({
        where: { templateId_version: { templateId, version } },
      }),
    );
  }

  dependencies(id: string) {
    return this.rls.run(async (tx) => {
      const [reports, checklists] = await Promise.all([
        tx.reportTemplate.count({ where: { artifactTemplateId: id } }),
        tx.checklistTemplate.count({ where: { artifactTemplateId: id } }),
      ]);
      return reports + checklists;
    });
  }

  softDelete(id: string, organizationId: string, actorId: string) {
    return this.rls.run(async (tx) => {
      await tx.artifactTemplate.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'INACTIVE' },
      });
      await this.audit(
        tx,
        organizationId,
        actorId,
        'ARTIFACT_TEMPLATE_DELETED',
        id,
        null,
        null,
      );
    });
  }

  private metadata(source: {
    name: string;
    description: string | null;
    artifactType: string;
    segment: string | null;
    visibility: string;
    tags: string[];
    sortOrder: number;
  }): Prisma.InputJsonObject {
    return {
      name: source.name,
      description: source.description,
      artifactType: source.artifactType,
      segment: source.segment,
      visibility: source.visibility,
      tags: source.tags,
      sortOrder: source.sortOrder,
    };
  }

  private audit(
    tx: Prisma.TransactionClient,
    organizationId: string,
    actorId: string,
    action: string,
    entityId: string,
    before: Prisma.InputJsonValue | null,
    after: Prisma.InputJsonValue | null,
  ) {
    return tx.auditLog.create({
      data: {
        organizationId,
        userId: actorId,
        action,
        entityType: 'ARTIFACT_TEMPLATE',
        entityId,
        before: before ?? undefined,
        after: after ?? undefined,
      },
    });
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
