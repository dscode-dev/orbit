/**
 * Contratos do módulo Artifact Templates.
 *
 * As formas de leitura vêm dos Read Models sincronizados do backend
 * (`npm run contracts:sync`) — nunca redeclaradas aqui. Este arquivo só
 * acrescenta o que o backend expressa em DTOs de entrada (classes com
 * `class-validator`, que não são sincronizáveis) e apelidos legíveis.
 *
 * Sobre os literais: `artifactType`, `type` de seção, `type` de campo e
 * `signerRole` **não são enums no backend**. São strings validadas por formato
 * (`/^[A-Z][A-Z0-9_.-]*$/`) e, nas palavras do próprio DTO, "metadata-driven
 * field type. The engine does not interpret it". Fixar uma lista fechada no
 * frontend inventaria uma regra que o servidor não tem — o Studio oferece
 * sugestões e aceita qualquer identificador válido.
 */
import type {
  ArtifactFieldReadModel,
  ArtifactLayoutReadModel,
  ArtifactSectionReadModel,
  ArtifactSignatureSlotReadModel,
  ArtifactTemplateListItemReadModel,
  ArtifactTemplateReadModel,
  ArtifactTemplateVersionReadModel,
} from "./contracts/modules/artifact-templates/artifact-template.read-models";

export type ArtifactField = ArtifactFieldReadModel;
export type ArtifactSection = ArtifactSectionReadModel;
export type ArtifactSignatureSlot = ArtifactSignatureSlotReadModel;
export type ArtifactLayout = ArtifactLayoutReadModel;
export type ArtifactTemplateVersion = ArtifactTemplateVersionReadModel;
export type ArtifactTemplateListItem = ArtifactTemplateListItemReadModel;
export type ArtifactTemplate = ArtifactTemplateReadModel;

/** Status do template (`artifact_templates_status_check` no banco). */
export const ARTIFACT_TEMPLATE_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "INACTIVE",
] as const;
export type ArtifactTemplateStatus =
  (typeof ARTIFACT_TEMPLATE_STATUSES)[number];

/**
 * Visibilidade.
 *
 * `GLOBAL` só existe em templates da plataforma (`organizationId` nulo) e não
 * pode ser escolhida pelo tenant: o `CreateArtifactTemplateDto` aceita apenas
 * `PRIVATE` e `ORGANIZATION`. Ela aparece na consulta porque a listagem
 * devolve os globais ativos junto com os da organização.
 */
export const ARTIFACT_TEMPLATE_VISIBILITIES = [
  "PRIVATE",
  "ORGANIZATION",
] as const;
export type ArtifactTemplateVisibility =
  (typeof ARTIFACT_TEMPLATE_VISIBILITIES)[number];

/** Estrutura versionada — corpo de criação e de nova versão. */
export interface ArtifactStructureInput {
  metadata?: Record<string, unknown>;
  sections: readonly ArtifactSectionInput[];
  signatureSlots?: readonly ArtifactSignatureSlotInput[];
  layout?: ArtifactLayoutInput;
}

export interface ArtifactSectionInput {
  id: string;
  title: string;
  description?: string;
  order: number;
  type: string;
  required?: boolean;
  visibility?: string;
  permissions?: readonly string[];
  collapsible?: boolean;
  configuration?: Record<string, unknown>;
  fields?: readonly ArtifactFieldInput[];
}

export interface ArtifactFieldInput {
  id: string;
  label: string;
  description?: string;
  type: string;
  order: number;
  required?: boolean;
  readOnly?: boolean;
  hidden?: boolean;
  defaultValue?: unknown;
  validations?: readonly Record<string, unknown>[];
  dependencies?: readonly Record<string, unknown>[];
  conditionalExpression?: unknown;
  placeholder?: string;
  mask?: string;
  unit?: string;
  configuration?: Record<string, unknown>;
}

export interface ArtifactSignatureSlotInput {
  id: string;
  label: string;
  signerRole: string;
  order: number;
  required?: boolean;
  visibility?: string;
  permissions?: readonly string[];
  configuration?: Record<string, unknown>;
}

export interface ArtifactLayoutInput {
  header?: Record<string, unknown>;
  footer?: Record<string, unknown>;
  logo?: Record<string, unknown>;
  pagination?: Record<string, unknown>;
  numbering?: Record<string, unknown>;
  visualIdentity?: Record<string, unknown>;
  reusableBlocks?: readonly Record<string, unknown>[];
}

/** `POST /artifact-templates` (`CreateArtifactTemplateDto`). */
export interface CreateArtifactTemplateInput extends ArtifactStructureInput {
  key: string;
  name: string;
  description?: string;
  artifactType: string;
  segment?: string;
  visibility?: ArtifactTemplateVisibility;
  tags?: readonly string[];
  sortOrder?: number;
}

/**
 * `PATCH /artifact-templates/:id` (`UpdateArtifactTemplateDto`).
 *
 * Só metadados. A estrutura não é editável em lugar: muda por versão nova.
 */
export interface UpdateArtifactTemplateInput {
  name?: string;
  description?: string;
  artifactType?: string;
  segment?: string;
  visibility?: ArtifactTemplateVisibility;
  tags?: readonly string[];
  sortOrder?: number;
}

/** `POST /artifact-templates/:id/versions` (`CreateArtifactTemplateVersionDto`). */
export interface CreateArtifactTemplateVersionInput extends ArtifactStructureInput {
  changeSummary?: string;
}

/** `POST /artifact-templates/:id/duplicate` (`DuplicateArtifactTemplateDto`). */
export interface DuplicateArtifactTemplateInput {
  key: string;
  name?: string;
}

/** `GET /artifact-templates` (`ArtifactTemplateQueryDto`). */
export interface ArtifactTemplateQuery {
  search?: string;
  artifactType?: string;
  segment?: string;
  status?: ArtifactTemplateStatus;
  visibility?: string;
  tag?: string;
  page?: number;
  limit?: number;
}

/**
 * Limites declarados pelo `class-validator` no backend.
 *
 * Reproduzidos aqui só para dar retorno imediato ao usuário — quem valida
 * continua sendo o servidor, e um 400 dele é apresentado como veio.
 */
export const ARTIFACT_LIMITS = {
  keyPattern: /^[A-Z][A-Z0-9_-]*$/,
  /** `id` de seção, campo e assinatura. */
  identifierPattern: /^[a-zA-Z][a-zA-Z0-9_.-]*$/,
  /** `type`, `artifactType`, `signerRole`, `visibility` de seção. */
  typePattern: /^[A-Z][A-Z0-9_.-]*$/,
  keyMaxLength: 100,
  nameMaxLength: 180,
  descriptionMaxLength: 4000,
  sectionDescriptionMaxLength: 2000,
  fieldDescriptionMaxLength: 1000,
  labelMaxLength: 180,
  identifierMaxLength: 120,
  typeMaxLength: 80,
  segmentMaxLength: 60,
  placeholderMaxLength: 500,
  maskMaxLength: 160,
  unitMaxLength: 40,
  changeSummaryMaxLength: 500,
  maxSections: 100,
  minSections: 1,
  maxFieldsPerSection: 300,
  maxSignatureSlots: 30,
  maxTags: 50,
} as const;

/**
 * Tipos de campo citados como exemplo no `ArtifactFieldDto`.
 *
 * São **sugestões**, não um enum: o backend aceita qualquer identificador que
 * case com `typePattern`. O Studio oferece estas e deixa o campo aberto.
 */
export const SUGGESTED_FIELD_TYPES = [
  "TEXT",
  "LONG_TEXT",
  "NUMBER",
  "DECIMAL",
  "DATE",
  "TIME",
  "DATETIME",
  "CHECKBOX",
  "SWITCH",
  "RADIO",
  "SELECT",
  "MULTISELECT",
  "SIGNATURE",
  "PHOTO",
  "VIDEO",
  "FILE",
  "QR_CODE",
  "BARCODE",
  "LOCATION",
  "OBSERVATION",
] as const;
