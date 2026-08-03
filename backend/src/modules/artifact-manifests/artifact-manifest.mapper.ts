import { Injectable } from '@nestjs/common';
import {
  StorageFileMapper,
  type StorageFileSource,
} from '../storage/file-object.mapper';
import type {
  ArtifactManifestActorReadModel,
  ArtifactManifestFormat,
  ArtifactManifestListItemReadModel,
  ArtifactManifestListReadModel,
  ArtifactManifestReadModel,
  ArtifactManifestStatus,
} from './artifact-manifest.read-models';

type DateValue = Date | string;

interface ActorSource {
  id: string;
  displayName: string;
}

/**
 * Fonte do mapeamento.
 *
 * `fileId` é declarado e **não publicado**: o cliente recebe o arquivo
 * mapeado, não a chave estrangeira. `deletedAt` também entra e fica de fora,
 * pela mesma razão de sempre — marca de exclusão lógica não é contrato.
 */
export interface ArtifactManifestSource {
  id: string;
  organizationId: string;
  businessUnitId: string;
  executionId: string;
  snapshotId: string;
  templateId: string;
  templateVersion: number;
  revision: number;
  status: string;
  renderer: string;
  rendererVersion: string | null;
  format: string;
  contentHash: string | null;
  sourceHash: string;
  fileId: string | null;
  isActive: boolean;
  issuedAt: DateValue | null;
  supersededAt: DateValue | null;
  revokedAt: DateValue | null;
  revokedReason: string | null;
  metadata: unknown;
  createdAt: DateValue;
  updatedAt: DateValue;
  deletedAt?: DateValue | null;
  issuedBy?: ActorSource | null;
  createdBy?: ActorSource | null;
  file?: StorageFileSource | null;
}

@Injectable()
export class ArtifactManifestMapper {
  constructor(private readonly files: StorageFileMapper) {}

  list(
    sources: readonly ArtifactManifestSource[],
  ): ArtifactManifestListReadModel {
    const data = sources.map((source) => this.listItem(source));
    return {
      data,
      meta: {
        total: data.length,
        activeRevision:
          data.find((manifest) => manifest.isActive)?.revision ?? null,
      },
    };
  }

  listItem(source: ArtifactManifestSource): ArtifactManifestListItemReadModel {
    return {
      id: source.id,
      executionId: source.executionId,
      snapshotId: source.snapshotId,
      templateId: source.templateId,
      templateVersion: source.templateVersion,
      revision: source.revision,
      status: source.status as ArtifactManifestStatus,
      renderer: source.renderer,
      rendererVersion: source.rendererVersion,
      format: source.format as ArtifactManifestFormat,
      contentHash: source.contentHash,
      sourceHash: source.sourceHash,
      isActive: source.isActive,
      issuedAt: this.nullableDate(source.issuedAt),
      issuedBy: this.actor(source.issuedBy),
      supersededAt: this.nullableDate(source.supersededAt),
      revokedAt: this.nullableDate(source.revokedAt),
      revokedReason: source.revokedReason,
      createdAt: this.date(source.createdAt),
      updatedAt: this.date(source.updatedAt),
    };
  }

  details(source: ArtifactManifestSource): ArtifactManifestReadModel {
    return {
      ...this.listItem(source),
      businessUnitId: source.businessUnitId,
      metadata: this.metadata(source.metadata),
      createdBy: this.actor(source.createdBy),
      file: source.file ? this.files.file(source.file) : null,
    };
  }

  private actor(
    source: ActorSource | null | undefined,
  ): ArtifactManifestActorReadModel | null {
    return source ? { id: source.id, displayName: source.displayName } : null;
  }

  private metadata(value: unknown): Readonly<Record<string, unknown>> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private date(value: DateValue): string {
    return value instanceof Date ? value.toISOString() : value;
  }

  private nullableDate(value: DateValue | null | undefined): string | null {
    return value === null || value === undefined ? null : this.date(value);
  }
}
