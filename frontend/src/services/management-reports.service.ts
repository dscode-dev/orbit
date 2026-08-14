/**
 * Serviços do Management Reports Engine — `/management-reports/**`.
 *
 * **Não confundir com `documentsService`**, que fala com `/artifact-manifests`
 * e serve o Document Center. São dois domínios com saídas parecidas (ambos
 * produzem PDF) e naturezas diferentes: um documento emitido pertence a uma
 * execução de campo e tem revisão; um relatório gerencial é um retrato de
 * período e não tem revisão — corrige-se gerando outro.
 *
 * `generate` devolve **202** com a solicitação; o relatório fica pronto depois.
 * Não existe método que gere de forma síncrona, porque não existe rota.
 */
import { apiClient } from "@/api/client";
import { queryKeys, type QueryKey } from "@/api/query-keys";
import type { PaginatedResult, QueryParams, RequestOptions } from "@/types/api";
import type { SignedUrlReadModel } from "@/types/contracts/modules/storage/file-object.read-models";
import type {
  GenerateReportInput,
  ManagementReport,
  ManagementReportQuery,
  ManagementReportStatus,
  ManagementReportSummary,
  ReportCatalog,
  ReportSnapshot,
} from "@/types/management-reports";

const REPORTS = "management-reports";
const PATH = "/management-reports";

const report = (id: string): string => `${PATH}/${encodeURIComponent(id)}`;

const asParams = (query?: object): QueryParams | undefined =>
  query as QueryParams | undefined;

export type ReportSignedUrlOperation = "preview" | "download";

export const managementReportsService = {
  keys: {
    catalog: (): QueryKey => queryKeys.list(`${REPORTS}-catalog`),
    list: (query?: ManagementReportQuery): QueryKey =>
      queryKeys.list(REPORTS, asParams(query)),
    lists: (): QueryKey => queryKeys.lists(REPORTS),
    detail: (id: string): QueryKey => queryKeys.detail(REPORTS, id),
    status: (id: string): QueryKey => [
      ...queryKeys.detail(REPORTS, id),
      "status",
    ],
    all: (): QueryKey => queryKeys.module(REPORTS),
  },

  /* ---------------------------------------------------------------- */
  /* Leitura                                                           */
  /* ---------------------------------------------------------------- */

  /** A autoridade sobre tipos, parâmetros e o que esta sessão pode gerar. */
  catalog: (options?: RequestOptions): Promise<ReportCatalog> =>
    apiClient.get<ReportCatalog>(`${PATH}/catalog`, options),

  list: (
    query?: ManagementReportQuery,
    options?: RequestOptions,
  ): Promise<PaginatedResult<ManagementReportSummary>> =>
    apiClient.get<PaginatedResult<ManagementReportSummary>>(PATH, {
      ...options,
      query: asParams(query),
    }),

  get: (id: string, options?: RequestOptions): Promise<ManagementReport> =>
    apiClient.get<ManagementReport>(report(id), options),

  /** Só a situação — é o que o acompanhamento consulta em intervalo curto. */
  status: (
    id: string,
    options?: RequestOptions,
  ): Promise<ManagementReportStatus> =>
    apiClient.get<ManagementReportStatus>(`${report(id)}/status`, options),

  /** O snapshot sozinho, como foi gravado. Nunca recomposto na leitura. */
  snapshot: (id: string, options?: RequestOptions): Promise<ReportSnapshot> =>
    apiClient.get<ReportSnapshot>(`${report(id)}/snapshot`, options),

  signedUrl: (
    id: string,
    operation: ReportSignedUrlOperation,
    options?: RequestOptions,
  ): Promise<SignedUrlReadModel> =>
    apiClient.get<SignedUrlReadModel>(`${report(id)}/download`, {
      ...options,
      query: { operation },
    }),

  /* ---------------------------------------------------------------- */
  /* Escrita                                                           */
  /* ---------------------------------------------------------------- */

  /** 202: o que volta é a solicitação, não o relatório pronto. */
  generate: (input: GenerateReportInput): Promise<ManagementReport> =>
    apiClient.post<ManagementReport>(PATH, input),
};
