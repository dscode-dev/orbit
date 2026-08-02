/**
 * Serviços do módulo Artifact Executions.
 *
 * Espelho um-para-um do `ArtifactExecutionController`. Nenhuma regra vive
 * aqui: transições, editabilidade, progresso e completude são decisões do
 * servidor.
 *
 * Uma característica do contrato molda o cache do Workspace: **quase toda
 * escrita devolve a execução inteira**. Salvar uma resposta, registrar um
 * anexo ou coletar uma assinatura respondem com `ArtifactExecutionReadModel`
 * completo, com `progressDetails` já recalculado. Isso permite semear o cache
 * do detalhe com a resposta da própria mutação, em vez de invalidar e pedir
 * tudo de novo — ver `use-artifact-executions.ts`.
 */
import { apiClient } from "@/api/client";
import { queryKeys, type QueryKey } from "@/api/query-keys";
import type { PaginatedResult, QueryParams, RequestOptions } from "@/types/api";
import type {
  ArtifactExecution,
  ArtifactExecutionListItem,
  ArtifactExecutionProgress,
  ArtifactExecutionQuery,
  ChangeArtifactExecutionStatusInput,
  RegisterArtifactAttachmentInput,
  SaveArtifactResponseInput,
  UpdateArtifactExecutionInput,
} from "@/types/artifact-executions";

const RESOURCE = "artifact-executions";
const BASE_PATH = "/artifact-executions";

const asParams = (query: object | undefined): QueryParams | undefined =>
  query as QueryParams | undefined;

const item = (id: string): string => `${BASE_PATH}/${encodeURIComponent(id)}`;

export const artifactExecutionsService = {
  basePath: BASE_PATH,

  list: (
    query?: ArtifactExecutionQuery,
    options?: RequestOptions,
  ): Promise<PaginatedResult<ArtifactExecutionListItem>> =>
    apiClient.get<PaginatedResult<ArtifactExecutionListItem>>(BASE_PATH, {
      ...options,
      query: asParams(query),
    }),

  /** Detalhe com snapshot, respostas, anexos, assinaturas, insights e progresso. */
  get: (id: string, options?: RequestOptions): Promise<ArtifactExecution> =>
    apiClient.get<ArtifactExecution>(item(id), options),

  /** Metadados da execução — não toca em respostas nem em status. */
  update: (
    id: string,
    input: UpdateArtifactExecutionInput,
  ): Promise<ArtifactExecution> =>
    apiClient.patch<ArtifactExecution>(item(id), input),

  /** Envia a intenção de transição. Quem valida é a máquina de estados do backend. */
  changeStatus: (
    id: string,
    input: ChangeArtifactExecutionStatusInput,
  ): Promise<ArtifactExecution> =>
    apiClient.patch<ArtifactExecution>(`${item(id)}/status`, input),

  /**
   * Grava uma resposta.
   *
   * `PUT` porque a operação é idempotente por `(sectionId, fieldId)`: reenviar
   * o mesmo par substitui o valor em vez de acrescentar outra resposta.
   */
  saveResponse: (
    id: string,
    input: SaveArtifactResponseInput,
  ): Promise<ArtifactExecution> =>
    apiClient.put<ArtifactExecution>(`${item(id)}/responses`, input),

  /**
   * Registra um anexo **já existente no armazenamento**.
   *
   * O contrato recebe `storageKey`, não o arquivo: este endpoint cadastra
   * metadados. O backend não expõe rota que receba o binário de uma execução
   * — ver `docs/artifact-execution-workspace.md`.
   */
  registerAttachment: (
    id: string,
    input: RegisterArtifactAttachmentInput,
  ): Promise<ArtifactExecution> =>
    apiClient.post<ArtifactExecution>(`${item(id)}/attachments`, input),

  /** Progresso calculado pelo backend. Nunca recalculado no cliente. */
  progress: (
    id: string,
    options?: RequestOptions,
  ): Promise<ArtifactExecutionProgress> =>
    apiClient.get<ArtifactExecutionProgress>(`${item(id)}/progress`, options),

  keys: {
    module: (): QueryKey => queryKeys.module(RESOURCE),
    list: (query?: ArtifactExecutionQuery): QueryKey =>
      queryKeys.list(RESOURCE, asParams(query)),
    detail: (id: string): QueryKey => queryKeys.detail(RESOURCE, id),
    progress: (id: string): QueryKey =>
      queryKeys.nested(RESOURCE, id, "progress"),
  },
} as const;
