/**
 * Contrato público do documento emitido.
 *
 * O Manifest é a **única representação oficial** de um documento produzido
 * pela plataforma. Quem quiser saber o que foi emitido, com que estrutura, por
 * quem e com que conteúdo, pergunta a ele.
 *
 * Nada do provider de armazenamento aparece: nem bucket, nem chave, nem
 * caminho. O arquivo é publicado como `StorageFileReadModel`, e o acesso é por
 * URL assinada.
 */
import type { StorageFileReadModel } from '../storage/file-object.read-models';

/**
 * Ciclo de vida de uma revisão.
 *
 * - `DRAFT` — revisão aberta; o renderer ainda não entregou conteúdo.
 * - `ISSUED` — documento emitido, com arquivo e hash.
 * - `SUPERSEDED` — havia sido emitido e uma revisão posterior tomou o lugar.
 * - `REVOKED` — invalidado deliberadamente; permanece para auditoria.
 */
export const ARTIFACT_MANIFEST_STATUSES = [
  'DRAFT',
  'ISSUED',
  'SUPERSEDED',
  'REVOKED',
] as const;
export type ArtifactManifestStatus =
  (typeof ARTIFACT_MANIFEST_STATUSES)[number];

/** Formatos previstos. O conteúdo é responsabilidade do Rendering Engine. */
export const ARTIFACT_MANIFEST_FORMATS = ['PDF', 'HTML', 'JSON'] as const;
export type ArtifactManifestFormat = (typeof ARTIFACT_MANIFEST_FORMATS)[number];

export interface ArtifactManifestActorReadModel {
  id: string;
  displayName: string;
}

export interface ArtifactManifestListItemReadModel {
  id: string;
  executionId: string;
  snapshotId: string;
  templateId: string;
  templateVersion: number;
  /** Número da revisão, começando em 1. */
  revision: number;
  status: ArtifactManifestStatus;
  /** Identificador do renderer que produziu o conteúdo. */
  renderer: string;
  rendererVersion: string | null;
  format: ArtifactManifestFormat;
  /** SHA-256 do arquivo emitido; nulo enquanto a revisão é rascunho. */
  contentHash: string | null;
  /**
   * SHA-256 da fonte no momento da abertura da revisão.
   *
   * Permite responder "o documento emitido ainda corresponde à execução?" sem
   * comparar conteúdo — se a fonte mudou, o hash muda.
   */
  sourceHash: string;
  /** Apenas uma revisão da execução pode ser a ativa. */
  isActive: boolean;
  issuedAt: string | null;
  issuedBy: ArtifactManifestActorReadModel | null;
  supersededAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactManifestReadModel extends ArtifactManifestListItemReadModel {
  businessUnitId: string;
  metadata: Readonly<Record<string, unknown>>;
  createdBy: ArtifactManifestActorReadModel | null;
  /** Arquivo emitido; nulo enquanto a revisão é rascunho. */
  file: StorageFileReadModel | null;
}

export interface ArtifactManifestListReadModel {
  data: readonly ArtifactManifestListItemReadModel[];
  meta: {
    total: number;
    /** Revisão ativa, quando existe. */
    activeRevision: number | null;
  };
}
