/**
 * O contrato do arquivo não pode vazar o provider.
 *
 * Se `bucket` ou `objectKey` aparecerem em um Read Model, o cliente ganha um
 * endereço interno: ele muda ao trocar de provider, não é autorizável e
 * convida a tentar acesso direto ao object store. Este teste é a trava.
 */
import {
  StorageFileMapper,
  type StorageFileSource,
} from './file-object.mapper';
import {
  ArtifactManifestMapper,
  type ArtifactManifestSource,
} from '../artifact-manifests/artifact-manifest.mapper';

const file: StorageFileSource = {
  id: '019f-file',
  organizationId: '019f-org',
  provider: 'MINIO',
  bucket: 'orbit-artifacts',
  objectKey: '019f-org/manifests/2026/08/019f-obj.pdf',
  fileName: 'PMOC — agosto.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 184_320n,
  sha256: 'a'.repeat(64),
  status: 'AVAILABLE',
  metadata: { manifestId: '019f-manifest' },
  createdAt: new Date('2026-08-03T12:00:00Z'),
};

describe('StorageFileMapper', () => {
  const mapper = new StorageFileMapper();

  it('não publica bucket nem objectKey', () => {
    const result = mapper.file(file);

    expect(result).not.toHaveProperty('bucket');
    expect(result).not.toHaveProperty('objectKey');
    expect(JSON.stringify(result)).not.toContain('orbit-artifacts');
    expect(JSON.stringify(result)).not.toContain('019f-obj.pdf');
  });

  it('publica o que o cliente precisa para exibir e conferir', () => {
    const result = mapper.file(file);

    expect(result.fileName).toBe('PMOC — agosto.pdf');
    expect(result.mimeType).toBe('application/pdf');
    expect(result.sha256).toBe('a'.repeat(64));
    expect(result.status).toBe('AVAILABLE');
  });

  it('serializa o tamanho como texto — BigInt não cabe em JSON', () => {
    expect(mapper.file(file).sizeBytes).toBe('184320');
    expect(() => JSON.stringify(mapper.file(file))).not.toThrow();
  });

  it('tolera metadados fora de forma', () => {
    expect(mapper.file({ ...file, metadata: null }).metadata).toEqual({});
    expect(mapper.file({ ...file, metadata: [1, 2] }).metadata).toEqual({});
  });

  it('mapeia a URL assinada com a expiração em ISO', () => {
    const expiresAt = new Date('2026-08-03T12:05:00Z');
    const result = mapper.signedUrl({
      url: 'https://storage/orbit/obj?X-Amz-Signature=abc',
      expiresAt,
      method: 'GET',
      requiredHeaders: {},
    });

    expect(result.expiresAt).toBe('2026-08-03T12:05:00.000Z');
    expect(result.method).toBe('GET');
  });
});

const manifest: ArtifactManifestSource = {
  id: '019f-manifest',
  organizationId: '019f-org',
  businessUnitId: '019f-unit',
  executionId: '019f-execution',
  snapshotId: '019f-snapshot',
  templateId: '019f-template',
  templateVersion: 3,
  revision: 2,
  status: 'ISSUED',
  renderer: 'pdf.default',
  rendererVersion: '1.0.0',
  format: 'PDF',
  contentHash: 'b'.repeat(64),
  sourceHash: 'c'.repeat(64),
  fileId: '019f-file',
  isActive: true,
  issuedAt: new Date('2026-08-03T12:00:00Z'),
  supersededAt: null,
  revokedAt: null,
  revokedReason: null,
  metadata: { origin: 'qa' },
  createdAt: new Date('2026-08-03T11:00:00Z'),
  updatedAt: new Date('2026-08-03T12:00:00Z'),
  deletedAt: null,
  issuedBy: { id: '019f-user', displayName: 'Ana' },
  createdBy: { id: '019f-user', displayName: 'Ana' },
  file,
};

describe('ArtifactManifestMapper', () => {
  const mapper = new ArtifactManifestMapper(new StorageFileMapper());

  it('não publica deletedAt, fileId nem endereço do objeto', () => {
    const result = mapper.details(manifest);

    expect(result).not.toHaveProperty('deletedAt');
    expect(result).not.toHaveProperty('fileId');
    expect(JSON.stringify(result)).not.toContain('orbit-artifacts');
    expect(JSON.stringify(result)).not.toContain('019f-obj.pdf');
  });

  it('publica os dois hashes — o do conteúdo e o da fonte', () => {
    const result = mapper.details(manifest);

    expect(result.contentHash).toBe('b'.repeat(64));
    expect(result.sourceHash).toBe('c'.repeat(64));
  });

  it('publica o arquivo mapeado, não a chave estrangeira', () => {
    expect(mapper.details(manifest).file?.id).toBe('019f-file');
    expect(mapper.details({ ...manifest, file: null }).file).toBeNull();
  });

  it('a listagem aponta qual revisão está ativa', () => {
    const result = mapper.list([
      manifest,
      {
        ...manifest,
        id: 'outro',
        revision: 1,
        isActive: false,
        status: 'SUPERSEDED',
      },
    ]);

    expect(result.meta.total).toBe(2);
    expect(result.meta.activeRevision).toBe(2);
  });

  it('sem revisão ativa, a listagem diz isso em vez de escolher uma', () => {
    const result = mapper.list([
      { ...manifest, isActive: false, status: 'REVOKED' },
    ]);

    expect(result.meta.activeRevision).toBeNull();
  });

  it('rascunho não publica conteúdo nem emissão', () => {
    const result = mapper.details({
      ...manifest,
      status: 'DRAFT',
      contentHash: null,
      fileId: null,
      file: null,
      isActive: false,
      issuedAt: null,
      issuedBy: null,
    });

    expect(result.contentHash).toBeNull();
    expect(result.issuedAt).toBeNull();
    expect(result.file).toBeNull();
  });
});
