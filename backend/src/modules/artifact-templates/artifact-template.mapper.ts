import { Injectable } from '@nestjs/common';
import type {
  ArtifactLayoutReadModel,
  ArtifactSectionReadModel,
  ArtifactSignatureSlotReadModel,
  ArtifactTemplateListItemReadModel,
  ArtifactTemplateListReadModel,
  ArtifactTemplateReadModel,
  ArtifactTemplateVersionReadModel,
} from './artifact-template.read-models';

type DateValue = Date | string;

interface VersionSource {
  id: string;
  templateId: string;
  organizationId: string | null;
  createdById: string | null;
  version: number;
  metadata: unknown;
  sections: unknown;
  signatureSlots: unknown;
  layout: unknown;
  changeSummary: string | null;
  createdAt: DateValue;
}

interface TemplateSource {
  id: string;
  organizationId: string | null;
  key: string;
  name: string;
  description: string | null;
  artifactType: string;
  segment: string | null;
  status: string;
  visibility: string;
  tags: readonly string[];
  sortOrder: number;
  currentVersion: number;
  source: string;
  createdAt: DateValue;
  updatedAt: DateValue;
  versions?: readonly VersionSource[];
}

@Injectable()
export class ArtifactTemplateReadModelMapper {
  list(source: {
    data: readonly TemplateSource[];
    meta: ArtifactTemplateListReadModel['meta'];
  }): ArtifactTemplateListReadModel {
    return {
      data: source.data.map((template) => this.listItem(template)),
      meta: { ...source.meta },
    };
  }

  listItem(source: TemplateSource): ArtifactTemplateListItemReadModel {
    return {
      id: source.id,
      organizationId: source.organizationId,
      key: source.key,
      name: source.name,
      description: source.description,
      artifactType: source.artifactType,
      segment: source.segment,
      status: source.status,
      visibility: source.visibility,
      tags: [...source.tags],
      sortOrder: source.sortOrder,
      currentVersion: source.currentVersion,
      source: source.source,
      createdAt: this.date(source.createdAt),
      updatedAt: this.date(source.updatedAt),
    };
  }

  details(source: TemplateSource): ArtifactTemplateReadModel {
    const current = source.versions?.find(
      (version) => version.version === source.currentVersion,
    );
    if (!current)
      throw new Error('Artifact template current version is missing');
    return { ...this.listItem(source), current: this.version(current) };
  }

  version(source: VersionSource): ArtifactTemplateVersionReadModel {
    return {
      id: source.id,
      templateId: source.templateId,
      organizationId: source.organizationId,
      version: source.version,
      metadata: this.object(source.metadata),
      sections: this.array(
        source.sections,
      ) as unknown as ArtifactSectionReadModel[],
      signatureSlots: this.array(
        source.signatureSlots,
      ) as unknown as ArtifactSignatureSlotReadModel[],
      layout: this.layout(source.layout),
      changeSummary: source.changeSummary,
      createdById: source.createdById,
      createdAt: this.date(source.createdAt),
    };
  }

  private layout(value: unknown): ArtifactLayoutReadModel {
    const layout = this.object(value);
    return {
      ...(layout.header ? { header: this.object(layout.header) } : {}),
      ...(layout.footer ? { footer: this.object(layout.footer) } : {}),
      ...(layout.logo ? { logo: this.object(layout.logo) } : {}),
      ...(layout.pagination
        ? { pagination: this.object(layout.pagination) }
        : {}),
      ...(layout.numbering ? { numbering: this.object(layout.numbering) } : {}),
      ...(layout.visualIdentity
        ? { visualIdentity: this.object(layout.visualIdentity) }
        : {}),
      reusableBlocks: this.array(layout.reusableBlocks) as Record<
        string,
        unknown
      >[],
    };
  }

  private object(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private date(value: DateValue): string {
    return value instanceof Date ? value.toISOString() : value;
  }
}
