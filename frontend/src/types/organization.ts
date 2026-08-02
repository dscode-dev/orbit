/**
 * Contratos do Organization Workspace.
 *
 * Reúne o que já é sincronizado (`OrganizationContextReadModel`,
 * `BusinessUnitReadModel`, `OrganizationPlanReadModel`) e declara os DTOs de
 * entrada e as duas formas **espelhadas** que faltam Read Model: consumo do
 * plano e integrações.
 *
 * O que o contrato **não** tem, e por isso a tela não inventa:
 *
 * - **branding** — não há campo de logotipo, cor ou identidade em
 *   `UpdateOrganizationDto`; só `settings`, que é JSON livre;
 * - **timezone da organização** — existe por unidade, não na organização
 *   (verificado: `PATCH /organizations/current` recusa `timezone` com
 *   "property timezone should not exist");
 * - **status de unidade editável** — `status` é publicado no Read Model, mas
 *   `UpdateBusinessUnitDto` não o aceita;
 * - **listagem de usuários e de papéis** — nenhum endpoint.
 */
import type {
  BusinessUnitReadModel,
  OrganizationContextReadModel,
  OrganizationPlanReadModel,
} from "./contracts/modules/organizations/organization.read-models";
import type { BusinessUnitType } from "./contracts";

export type Organization = OrganizationContextReadModel;
export type BusinessUnit = BusinessUnitReadModel;
export type OrganizationPlan = OrganizationPlanReadModel;

/**
 * Direitos do plano (`GET /organizations/current/subscription`).
 *
 * Mesmo formato que a sessão já consome; declarado aqui para o Workspace não
 * depender do tipo de sessão.
 */
export interface OrganizationEntitlements {
  planKey: string;
  subscriptionStatus: string;
  capabilities: readonly string[];
  limits: Readonly<Record<string, number | null>>;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
}

/**
 * Consumo do período (`GET /organizations/current/usage`).
 *
 * **Espelhado** do registro `PlanUsage`: o módulo não publica Read Model. O
 * serviço recorta pelo período corrente da assinatura, então o número já vem
 * do intervalo certo — não há janela a escolher aqui.
 */
export interface PlanUsageRecord {
  id: string;
  organizationId: string;
  resource: string;
  used: number;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Integração (`GET /integrations`).
 *
 * Também espelhada. Nota de contrato: o campo é `lastValidatedAt`, não
 * "última sincronização" — o backend valida credenciais
 * (`POST /:id/validate`), não sincroniza dados. A tela usa o nome certo.
 */
export interface Integration {
  id: string;
  organizationId: string;
  provider: string;
  category: string;
  displayName: string;
  status: string;
  configuration: Record<string, unknown>;
  lastValidatedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `PATCH /organizations/current` (`UpdateOrganizationDto`). */
export interface UpdateOrganizationInput {
  displayName?: string;
  primarySegment?: string;
  /** JSON livre. É onde branding vive hoje, por convenção do tenant. */
  settings?: Record<string, unknown>;
}

/** `POST /organizations/current/business-units` (`CreateBusinessUnitDto`). */
export interface CreateBusinessUnitInput {
  legalName: string;
  tradeName?: string;
  type: BusinessUnitType;
  documentType: "CPF" | "CNPJ";
  documentNumber: string;
  city: string;
  street: string;
  number?: string;
  stateCode?: string;
  postalCode?: string;
  email?: string;
  phone?: string;
  code?: string;
  parentId?: string;
  isPrimary?: boolean;
}

/**
 * `PATCH /organizations/current/business-units/:id`.
 *
 * `PartialType(CreateBusinessUnitDto)` — logo **sem** `status`, `timezone`,
 * `locale` e `currency`, que são publicados na leitura mas não são editáveis.
 */
export type UpdateBusinessUnitInput = Partial<CreateBusinessUnitInput>;

/** Limites declarados pelo `class-validator`. */
export const ORGANIZATION_LIMITS = {
  displayNameMinLength: 2,
  displayNameMaxLength: 180,
  segmentMaxLength: 60,
  legalNameMaxLength: 255,
  cityMaxLength: 160,
  streetMaxLength: 255,
} as const;

/**
 * Chave de recurso → limite publicado em `entitlements.limits`.
 *
 * A correspondência entre o nome do recurso em `usage` e a chave do limite é
 * do backend (`UsageService.record` valida `input.resource in limits`). A tela
 * cruza os dois pela mesma chave, sem inventar apelidos.
 */
export const USAGE_RESOURCE_LABELS: Readonly<Record<string, string>> = {
  users: "Usuários",
  businessUnits: "Unidades de negócio",
  integrations: "Integrações",
};
