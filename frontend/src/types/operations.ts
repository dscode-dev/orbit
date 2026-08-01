/**
 * Contratos do módulo Operations.
 *
 * Os **literais** (status, tipo, prioridade, ações de histórico) vêm dos
 * contratos sincronizados do backend e não são redeclarados.
 *
 * As **formas de resposta** precisam ser declaradas aqui: o backend devolve
 * payloads do Prisma montados por `operationInclude`, sem exportar um tipo
 * correspondente. Cada interface abaixo espelha exatamente o `select`/`include`
 * de `operation.repository.ts` e `checklist.repository.ts`.
 */
import type {
  OperationHistoryAction,
  OperationKind,
  OperationPriority,
  OperationStatus,
} from "./contracts";

/** Referência de usuário devolvida em atribuições e histórico. */
export interface OperationUserRef {
  id: string;
  displayName: string;
  email?: string;
  avatarUrl: string | null;
}

/** Atribuição de técnico (`OperationUser` + `user`). */
export interface OperationAssignment {
  operationId: string;
  userId: string;
  assignedById: string | null;
  assignedAt: string;
  user: OperationUserRef;
}

/** Anexo, como devolvido no detalhe da operação (sem `storageKey`). */
export interface OperationAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  checksum: string;
  uploadedById: string;
  createdAt: string;
}

/** Anexo na timeline, que inclui quem enviou. */
export interface OperationTimelineAttachment extends OperationAttachment {
  operationId: string;
  uploadedBy: OperationUserRef | null;
}

/** Evento de histórico (`OperationHistory` + `user`). */
export interface OperationHistoryEntry {
  id: string;
  operationId: string;
  userId: string | null;
  action: OperationHistoryAction | string;
  fromStatus: OperationStatus | null;
  toStatus: OperationStatus | null;
  details: unknown;
  createdAt: string;
  user: OperationUserRef | null;
}

/** `GET /operations/:id/timeline`. */
export interface OperationTimeline {
  events: readonly OperationHistoryEntry[];
  attachments: readonly OperationTimelineAttachment[];
}

export interface OperationBusinessUnitRef {
  id: string;
  legalName: string;
  tradeName: string | null;
}

export interface OperationCustomerRef {
  id: string;
  legalName: string;
  tradeName: string | null;
}

export interface OperationAssetRef {
  id: string;
  name: string;
  identifier: string | null;
  status: string;
}

/** Execução de checklist resumida, aninhada no detalhe da operação. */
export interface OperationChecklistSummary {
  id: string;
  templateId: string;
  templateVersion: number;
  status: string;
  progress: number;
  completedAt: string | null;
  updatedAt: string;
}

/** Operação completa (`operationInclude`). */
export interface Operation {
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
  businessUnit: OperationBusinessUnitRef;
  customer: OperationCustomerRef | null;
  asset: OperationAssetRef | null;
  users: readonly OperationAssignment[];
  attachments: readonly OperationAttachment[];
  checklistExecutions: readonly OperationChecklistSummary[];
}

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
