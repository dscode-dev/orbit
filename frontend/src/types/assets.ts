/**
 * Contratos do módulo Assets.
 *
 * Os **literais** (`AssetStatus`, `AssetCategory`, `AssetIdentifierType`) vêm
 * dos contratos sincronizados e não são redeclarados.
 *
 * A forma do ativo é **espelhada**: o módulo não publica Read Model — o
 * controller devolve o registro do Prisma com os `include` de unidade e
 * cliente. Mudança silenciosa naquele `include` não quebra a compilação;
 * quebra em runtime, com campo nulo. Daí cada acesso a relação ser tolerante.
 */
import type {
  AssetCategory,
  AssetIdentifierType,
  AssetStatus,
} from "./contracts";

export type { AssetCategory, AssetIdentifierType, AssetStatus };

/** Recorte de unidade devolvido junto do ativo. */
export interface AssetBusinessUnitRef {
  id: string;
  legalName: string;
  tradeName: string | null;
}

/** Recorte de cliente devolvido junto do ativo. */
export interface AssetCustomerRef {
  id: string;
  legalName: string;
  tradeName: string | null;
  status: string;
}

export interface Asset {
  id: string;
  organizationId: string;
  businessUnitId: string;
  customerId: string | null;
  category: AssetCategory;
  name: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  identifierType: AssetIdentifierType | null;
  identifier: string | null;
  /** `@db.Date` — dia, sem hora. */
  installationAt: string | null;
  warrantyUntil: string | null;
  location: string | null;
  /** JSON livre definido pelo tenant; o backend não o interpreta. */
  specifications: Record<string, unknown> | null;
  status: AssetStatus;
  createdAt: string;
  updatedAt: string;
  businessUnit: AssetBusinessUnitRef | null;
  customer: AssetCustomerRef | null;
}

/** `GET /assets` (`AssetQueryDto`). */
export interface AssetQuery {
  search?: string;
  businessUnitId?: string;
  customerId?: string;
  category?: AssetCategory;
  status?: AssetStatus;
  page?: number;
  limit?: number;
}

/** `POST /assets` (`CreateAssetDto`). */
export interface CreateAssetInput {
  businessUnitId: string;
  customerId?: string;
  category: AssetCategory;
  name: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  identifierType?: AssetIdentifierType;
  identifier?: string;
  installationAt?: string;
  warrantyUntil?: string;
  location?: string;
  specifications?: Record<string, unknown>;
}

/** `PATCH /assets/:id` (`UpdateAssetDto`) — acrescenta `status`. */
export interface UpdateAssetInput extends Partial<CreateAssetInput> {
  status?: AssetStatus;
}

/** Limites declarados pelo `class-validator`, para retorno imediato na tela. */
export const ASSET_LIMITS = {
  nameMinLength: 2,
  nameMaxLength: 180,
  manufacturerMaxLength: 120,
  modelMaxLength: 120,
  serialNumberMaxLength: 120,
  identifierMaxLength: 180,
  locationMaxLength: 255,
  searchMaxLength: 180,
} as const;

/**
 * O que o contrato de ativo **não** tem, e que a tela por isso não inventa:
 *
 * - **criticidade** — não existe campo nem filtro; ver `docs/asset-workspace.md`;
 * - **índice de saúde** — `GET /analytics/health` é da organização/unidade,
 *   não do ativo;
 * - **histórico** — não há tabela nem endpoint de eventos do ativo.
 *
 * Um tenant pode gravar qualquer um deles em `specifications`, que é JSON
 * livre — mas isso é convenção da organização, não contrato, e a tela o
 * apresenta como especificação, não como campo de primeira classe.
 */
export const ASSET_CONTRACT_GAPS = [
  "criticality",
  "healthScore",
  "history",
] as const;
