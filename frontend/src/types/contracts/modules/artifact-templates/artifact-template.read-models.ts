/**
 * ARQUIVO GERADO — NÃO EDITE MANUALMENTE.
 * Fonte: backend/src
 * Regenerar: npm run contracts:sync
 */

export interface ArtifactFieldReadModel {
  id: string;
  label: string;
  description?: string;
  type: string;
  order: number;
  required: boolean;
  readOnly: boolean;
  hidden: boolean;
  defaultValue?: unknown;
  validations: readonly Record<string, unknown>[];
  dependencies: readonly Record<string, unknown>[];
  conditionalExpression?: unknown;
  placeholder?: string;
  mask?: string;
  unit?: string;
  configuration: Readonly<Record<string, unknown>>;
}

export interface ArtifactSectionReadModel {
  id: string;
  title: string;
  description?: string;
  order: number;
  type: string;
  required: boolean;
  visibility: string;
  permissions: readonly string[];
  collapsible: boolean;
  configuration: Readonly<Record<string, unknown>>;
  fields: readonly ArtifactFieldReadModel[];
}

export interface ArtifactSignatureSlotReadModel {
  id: string;
  label: string;
  signerRole: string;
  order: number;
  required: boolean;
  visibility: string;
  permissions: readonly string[];
  configuration: Readonly<Record<string, unknown>>;
}

export interface ArtifactLayoutReadModel {
  header?: Readonly<Record<string, unknown>>;
  footer?: Readonly<Record<string, unknown>>;
  logo?: Readonly<Record<string, unknown>>;
  pagination?: Readonly<Record<string, unknown>>;
  numbering?: Readonly<Record<string, unknown>>;
  visualIdentity?: Readonly<Record<string, unknown>>;
  reusableBlocks: readonly Record<string, unknown>[];
}

export interface ArtifactTemplateVersionReadModel {
  id: string;
  templateId: string;
  organizationId: string | null;
  version: number;
  metadata: Readonly<Record<string, unknown>>;
  sections: readonly ArtifactSectionReadModel[];
  signatureSlots: readonly ArtifactSignatureSlotReadModel[];
  layout: ArtifactLayoutReadModel;
  changeSummary: string | null;
  createdById: string | null;
  createdAt: string;
}

export interface ArtifactTemplateListItemReadModel {
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
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactTemplateReadModel extends ArtifactTemplateListItemReadModel {
  current: ArtifactTemplateVersionReadModel;
}

export interface ArtifactTemplateListReadModel {
  data: readonly ArtifactTemplateListItemReadModel[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
