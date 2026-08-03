/**
 * Contratos do módulo Operations.
 *
 * Os **literais** (status, tipo, prioridade, ações de histórico) vêm dos
 * contratos sincronizados do backend e não são redeclarados.
 *
 * As formas públicas são sincronizadas dos Read Models do backend. Este
 * arquivo mantém aliases compatíveis para os componentes existentes.
 */
import type {
  OperationKind,
  OperationPriority,
  OperationStatus,
} from "./contracts";
import type {
  OperationAssignmentReadModel,
  OperationAttachmentReadModel,
  OperationBusinessUnitReadModel,
  OperationCustomerReadModel,
  OperationAssetReadModel,
  OperationChecklistReadModel,
  OperationDetailsReadModel,
  OperationHistoryReadModel,
  OperationTimelineAttachmentReadModel,
  OperationTimelineReadModel,
  OperationUserReadModel,
} from "./contracts/modules/operations/operation.read-models";

export type OperationUserRef = OperationUserReadModel;
export type OperationAssignment = OperationAssignmentReadModel;
export type OperationAttachment = OperationAttachmentReadModel;
export type OperationTimelineAttachment = OperationTimelineAttachmentReadModel;
export type OperationHistoryEntry = OperationHistoryReadModel;
export type OperationTimeline = OperationTimelineReadModel;
export type OperationBusinessUnitRef = OperationBusinessUnitReadModel;
export type OperationCustomerRef = OperationCustomerReadModel;
export type OperationAssetRef = OperationAssetReadModel;
export type OperationChecklistSummary = OperationChecklistReadModel;
export type Operation = OperationDetailsReadModel;

/** Query de `GET /operations` (`OperationQueryDto`). */
export interface OperationQuery {
  search?: string;
  businessUnitId?: string;
  customerId?: string;
  assetId?: string;
  assignedUserId?: string;
  kind?: OperationKind;
  status?: OperationStatus;
  priority?: OperationPriority;
  scheduledFrom?: string;
  scheduledTo?: string;
  page?: number;
  limit?: number;
}

/**
 * `POST /operations` (`CreateOperationDto`).
 *
 * `businessUnitId`, `code`, `kind` e `title` são obrigatórios no DTO. Os
 * limites de tamanho são os do `class-validator`, replicados em
 * `OPERATION_LIMITS` para retorno imediato na tela — a recusa continua sendo
 * do servidor.
 */
export interface CreateOperationInput {
  businessUnitId: string;
  customerId?: string;
  assetId?: string;
  code: string;
  kind: OperationKind;
  title: string;
  description?: string;
  priority?: OperationPriority;
  scheduledStart?: string;
  scheduledEnd?: string;
  location?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

/** `PATCH /operations/:id` (`UpdateOperationDto` — `PartialType`). */
export type UpdateOperationInput = Partial<CreateOperationInput>;

/** Limites declarados pelo `class-validator` no `CreateOperationDto`. */
export const OPERATION_LIMITS = {
  codeMinLength: 2,
  codeMaxLength: 60,
  titleMinLength: 2,
  titleMaxLength: 220,
  statusReasonMaxLength: 500,
} as const;

/** `PATCH /operations/:id/status` (`ChangeOperationStatusDto`). */
export interface ChangeOperationStatusInput {
  status: OperationStatus;
  reason?: string;
}

/** `POST /operations/:id/assignments` (`AssignOperationUserDto`). */
export interface AssignOperationUserInput {
  userId: string;
}

/* ------------------------------------------------------------------ */
/* Checklists                                                          */
/* ------------------------------------------------------------------ */

export interface ChecklistTemplateRef {
  id: string;
  key: string;
  name: string;
}

/** Item do snapshot do template (`ChecklistItemDto`). */
export interface ChecklistItem {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: readonly string[];
}

/** Execução completa (`checklist.repository.findExecution`). */
export interface ChecklistExecution {
  id: string;
  organizationId: string;
  businessUnitId: string;
  templateId: string;
  operationId: string | null;
  createdById: string;
  status: string;
  templateVersion: number;
  templateSnapshot: { items?: readonly ChecklistItem[] } | null;
  answers: Readonly<Record<string, unknown>>;
  progress: number;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  template: ChecklistTemplateRef;
  createdBy: { id: string; displayName: string };
  operation?: { id: string; code: string; title: string } | null;
}

export interface ChecklistExecutionQuery {
  operationId?: string;
  businessUnitId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

/* ------------------------------------------------------------------ */
/* Orbit Intelligence da operação                                      */
/* ------------------------------------------------------------------ */

/** Execução de IA (`GET /ai-executions?operationId=`). */
export interface AiExecution {
  id: string;
  agentId: string | null;
  operationId: string | null;
  purpose: string;
  status: string;
  model: string | null;
  /** JSON livre produzido pelo agente; o formato depende do `purpose`. */
  output: unknown;
  error: unknown;
  durationMs: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface AiExecutionQuery {
  operationId?: string;
  /** `AiExecutionQueryDto` também aceita cliente e relatório. */
  customerId?: string;
  reportId?: string;
  agentId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

/* ------------------------------------------------------------------ */
/* Apresentação                                                        */
/* ------------------------------------------------------------------ */

export const OPERATION_STATUS_LABELS: Readonly<Record<string, string>> = {
  OPEN: "Aberta",
  SCHEDULED: "Agendada",
  IN_PROGRESS: "Em execução",
  PAUSED: "Pausada",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

export const OPERATION_STATUS_CLASSES: Readonly<Record<string, string>> = {
  OPEN: "bg-surface-strong text-muted-foreground",
  SCHEDULED: "bg-chart-1/15 text-chart-1",
  IN_PROGRESS: "bg-warning/15 text-warning",
  PAUSED: "bg-surface-strong text-muted-foreground",
  COMPLETED: "bg-success/15 text-success",
  CANCELLED: "bg-destructive/15 text-destructive",
};

export const OPERATION_PRIORITY_LABELS: Readonly<Record<string, string>> = {
  LOW: "Baixa",
  NORMAL: "Normal",
  HIGH: "Alta",
  URGENT: "Urgente",
  CRITICAL: "Crítica",
};

export const OPERATION_KIND_LABELS: Readonly<Record<string, string>> = {
  INSTALLATION: "Instalação",
  MAINTENANCE: "Manutenção",
  INSPECTION: "Inspeção",
  DELIVERY: "Entrega",
  OTHER: "Outra",
};

export const OPERATION_HISTORY_LABELS: Readonly<Record<string, string>> = {
  CREATED: "Operação criada",
  UPDATED: "Operação atualizada",
  STATUS_CHANGED: "Status alterado",
  USER_ASSIGNED: "Técnico atribuído",
  USER_UNASSIGNED: "Técnico removido",
  ATTACHMENT_ADDED: "Anexo adicionado",
  ATTACHMENT_REMOVED: "Anexo removido",
  CHECKLIST_STARTED: "Checklist iniciado",
  CHECKLIST_COMPLETED: "Checklist concluído",
  CHECKLIST_CANCELLED: "Checklist cancelado",
  DELETED: "Operação removida",
};
