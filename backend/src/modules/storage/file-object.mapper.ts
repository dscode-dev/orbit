import { Injectable } from '@nestjs/common';
import type { SignedUrl } from './storage.types';
import type {
  SignedUrlReadModel,
  StorageFileReadModel,
  StorageFileStatus,
} from './file-object.read-models';

type DateValue = Date | string;

/**
 * Fonte do mapeamento.
 *
 * `bucket` e `objectKey` são declarados de propósito: entram, são vistos e
 * **não saem**. Deixá-los fora da interface esconderia a decisão; declará-los
 * a torna explícita para quem ler o mapper.
 */
export interface StorageFileSource {
  id: string;
  organizationId: string;
  provider: string;
  bucket: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: bigint | number | string;
  sha256: string | null;
  status: string;
  metadata: unknown;
  createdAt: DateValue;
}

@Injectable()
export class StorageFileMapper {
  file(source: StorageFileSource): StorageFileReadModel {
    return {
      id: source.id,
      fileName: source.fileName,
      mimeType: source.mimeType,
      sizeBytes: String(source.sizeBytes),
      sha256: source.sha256,
      status: source.status as StorageFileStatus,
      provider: source.provider,
      metadata: this.metadata(source.metadata),
      createdAt: this.date(source.createdAt),
    };
  }

  files(
    sources: readonly StorageFileSource[],
  ): readonly StorageFileReadModel[] {
    return sources.map((source) => this.file(source));
  }

  signedUrl(signed: SignedUrl): SignedUrlReadModel {
    return {
      url: signed.url,
      method: signed.method,
      expiresAt: signed.expiresAt.toISOString(),
      requiredHeaders: { ...signed.requiredHeaders },
    };
  }

  private metadata(value: unknown): Readonly<Record<string, unknown>> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private date(value: DateValue): string {
    return value instanceof Date ? value.toISOString() : value;
  }
}
