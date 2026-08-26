/**
 * ARQUIVO GERADO — NÃO EDITE MANUALMENTE.
 * Fonte: backend/src
 * Regenerar: npm run contracts:sync
 */

import type {
  OperationKind,
  OperationPriority,
  OperationStatus,
} from '../..';

export interface OperationUserReadModel {
  id: string;
  displayName: string;
  email?: string;
  avatarUrl: string | null;
}

export interface OperationAssignmentReadModel {
  operationId: string;
  userId: string;
  assignedById: string | null;
  assignedAt: string;
  user: OperationUserReadModel;
}

export interface OperationAttachmentReadModel {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  checksum: string;
  uploadedById: string;
  createdAt: string;
}

export interface OperationTimelineAttachmentReadModel extends OperationAttachmentReadModel {
  operationId: string;
  uploadedBy: OperationUserReadModel | null;
}

export interface OperationHistoryReadModel {
  id: string;
  operationId: string;
  userId: string | null;
  action: string;
  fromStatus: OperationStatus | null;
  toStatus: OperationStatus | null;
  details: unknown;
  createdAt: string;
  user: OperationUserReadModel | null;
}

export interface OperationTimelineReadModel {
  events: readonly OperationHistoryReadModel[];
  attachments: readonly OperationTimelineAttachmentReadModel[];
}

export interface OperationBusinessUnitReadModel {
  id: string;
  legalName: string;
  tradeName: string | null;
}

export interface OperationCustomerReadModel {
  id: string;
  legalName: string;
  tradeName: string | null;
}

export interface OperationAssetReadModel {
  id: string;
  name: string;
  identifier: string | null;
  status: string;
}

export interface OperationChecklistReadModel {
  id: string;
  templateId: string;
  templateVersion: number;
  status: string;
  progress: number;
  completedAt: string | null;
  updatedAt: string;
}

export interface OperationListItemReadModel {
  id: string;
  organizationId: string;
  businessUnitId: string;
  customerId: string | null;
  assetId: string | null;
  code: string;
  kind: OperationKind;
  title: string;
  description: string | null;
  status: OperationStatus;
  priority: OperationPriority;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  startedAt: string | null;
  completedAt: string | null;
  location: unknown;
  data: unknown;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  businessUnit: OperationBusinessUnitReadModel;
  customer: OperationCustomerReadModel | null;
  asset: OperationAssetReadModel | null;
  users: readonly OperationAssignmentReadModel[];
  attachments: readonly OperationAttachmentReadModel[];
  checklistExecutions: readonly OperationChecklistReadModel[];
}

/** A lista permanece compacta; somente o detalhe publica ações autoritativas. */
export type OperationDetailsReadModel = OperationListItemReadModel & {
  transitions: readonly OperationStatus[];
};

export interface OperationListReadModel {
  data: readonly OperationListItemReadModel[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
