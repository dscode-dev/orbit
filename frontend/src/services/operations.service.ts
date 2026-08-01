/**
 * Serviços do módulo Operations.
 *
 * Todas as rotas passam pelo BFF (`/api/orbit/...`) via `apiClient` da PR-01.
 * Nenhuma regra de negócio vive aqui: transições de status, validação de
 * agenda e permissões são do backend.
 */
import { apiClient } from "@/api/client";
import { queryKeys, type QueryKey } from "@/api/query-keys";
import { download, upload, type DownloadResult } from "@/api/transfer";
import type { QueryParams, PaginatedResult, RequestOptions } from "@/types/api";
import type {
  AiExecution,
  AiExecutionQuery,
  AssignOperationUserInput,
  ChangeOperationStatusInput,
  ChecklistExecution,
  ChecklistExecutionQuery,
  Operation,
  OperationAttachment,
  OperationHistoryEntry,
  OperationQuery,
  OperationTimeline,
} from "@/types/operations";

const RESOURCE = "operations";
const CHECKLISTS_RESOURCE = "checklist-executions";
const AI_RESOURCE = "ai-executions";

const asParams = (query: object | undefined): QueryParams | undefined =>
  query as QueryParams | undefined;

const item = (id: string): string => `/operations/${encodeURIComponent(id)}`;

export const operationsService = {
  basePath: "/operations",

  list: (
    query?: OperationQuery,
    options?: RequestOptions,
  ): Promise<PaginatedResult<Operation>> =>
    apiClient.get<PaginatedResult<Operation>>("/operations", {
      ...options,
      query: asParams(query),
    }),

  get: (id: string, options?: RequestOptions): Promise<Operation> =>
    apiClient.get<Operation>(item(id), options),

  history: (
    id: string,
    options?: RequestOptions,
  ): Promise<readonly OperationHistoryEntry[]> =>
    apiClient.get<readonly OperationHistoryEntry[]>(
      `${item(id)}/history`,
      options,
    ),

  timeline: (
    id: string,
    options?: RequestOptions,
  ): Promise<OperationTimeline> =>
    apiClient.get<OperationTimeline>(`${item(id)}/timeline`, options),

  /** O backend valida a transição; o frontend só envia a intenção. */
  changeStatus: (
    id: string,
    input: ChangeOperationStatusInput,
  ): Promise<Operation> =>
    apiClient.patch<Operation>(`${item(id)}/status`, input),

  assign: (id: string, input: AssignOperationUserInput): Promise<Operation> =>
    apiClient.post<Operation>(`${item(id)}/assignments`, input),

  unassign: (id: string, userId: string): Promise<void> =>
    apiClient.delete<void>(
      `${item(id)}/assignments/${encodeURIComponent(userId)}`,
    ),

  /** `multipart/form-data` no campo `file`, limite de 20 MB. */
  uploadAttachment: (id: string, file: File): Promise<OperationAttachment> =>
    upload<OperationAttachment>(`${item(id)}/attachments`, file),

  downloadAttachment: (
    id: string,
    attachmentId: string,
  ): Promise<DownloadResult> =>
    download(`${item(id)}/attachments/${encodeURIComponent(attachmentId)}`),

  removeAttachment: (id: string, attachmentId: string): Promise<void> =>
    apiClient.delete<void>(
      `${item(id)}/attachments/${encodeURIComponent(attachmentId)}`,
    ),

  keys: {
    module: (): QueryKey => queryKeys.module(RESOURCE),
    list: (query?: OperationQuery): QueryKey =>
      queryKeys.list(RESOURCE, asParams(query)),
    detail: (id: string): QueryKey => queryKeys.detail(RESOURCE, id),
    history: (id: string): QueryKey =>
      queryKeys.nested(RESOURCE, id, "history"),
    timeline: (id: string): QueryKey =>
      queryKeys.nested(RESOURCE, id, "timeline"),
  },
} as const;

export const operationChecklistsService = {
  list: (
    query: ChecklistExecutionQuery,
    options?: RequestOptions,
  ): Promise<PaginatedResult<ChecklistExecution>> =>
    apiClient.get<PaginatedResult<ChecklistExecution>>(
      "/checklist-executions",
      { ...options, query: asParams(query) },
    ),

  get: (id: string, options?: RequestOptions): Promise<ChecklistExecution> =>
    apiClient.get<ChecklistExecution>(
      `/checklist-executions/${encodeURIComponent(id)}`,
      options,
    ),

  keys: {
    module: (): QueryKey => queryKeys.module(CHECKLISTS_RESOURCE),
    byOperation: (operationId: string): QueryKey =>
      queryKeys.list(CHECKLISTS_RESOURCE, { operationId }),
    detail: (id: string): QueryKey => queryKeys.detail(CHECKLISTS_RESOURCE, id),
  },
} as const;

export const operationIntelligenceService = {
  /**
   * Execuções de IA vinculadas à operação.
   *
   * É o único caminho real de "Orbit Intelligence" por operação: o backend
   * permite filtrar `AiExecution` por `operationId`. O conteúdo de `output` é
   * JSON livre, definido pelo agente que executou.
   */
  list: (
    query: AiExecutionQuery,
    options?: RequestOptions,
  ): Promise<PaginatedResult<AiExecution>> =>
    apiClient.get<PaginatedResult<AiExecution>>("/ai-executions", {
      ...options,
      query: asParams(query),
    }),

  keys: {
    module: (): QueryKey => queryKeys.module(AI_RESOURCE),
    byOperation: (operationId: string): QueryKey =>
      queryKeys.list(AI_RESOURCE, { operationId }),
  },
} as const;
