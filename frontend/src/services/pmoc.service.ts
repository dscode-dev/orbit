/**
 * Serviços do PMOC V2 — `/api/v1/pmoc`.
 *
 * As keys seguem a hierarquia do domínio, e é ela que permite invalidar com
 * precisão: concluir a execução de um equipamento derruba o ciclo e a linha do
 * tempo daquele plano, não o cache de PMOC inteiro.
 *
 * ```text
 * pmoc
 * ├── plans (lista)
 * └── plan/:id
 *     ├── coverage (cursor)
 *     ├── cycles
 *     │   └── cycle/:id → equipment-executions
 *     └── timeline (cursor)
 * ```
 */
import { apiClient } from "@/api/client";
import { queryKeys, type QueryKey } from "@/api/query-keys";
import type { PaginatedResult, QueryParams, RequestOptions } from "@/types/api";
import type {
  CreatePmocPlanInput,
  PmocComplianceSummary,
  PmocCoverage,
  PmocCoveragePageQuery,
  PmocCursorPage,
  PmocCycle,
  PmocCycleEquipmentRow,
  PmocExecutionPreparation,
  PmocPlan,
  PmocPlanQuery,
  PmocPlanSummary,
  PmocTimelineItem,
  PmocTimelineQuery,
  PmocUpcoming,
  UpdatePmocPlanInput,
} from "@/types/pmoc";

const PMOC = "pmoc";
const plan = (id: string) => `/pmoc/plans/${encodeURIComponent(id)}`;
const cycle = (planId: string, cycleId: string) =>
  `${plan(planId)}/cycles/${encodeURIComponent(cycleId)}`;

export const pmocService = {
  basePath: "/pmoc",

  /* ---------------------------------------------------------------- */
  /* Configuração                                                      */
  /* ---------------------------------------------------------------- */

  list: (
    query?: PmocPlanQuery,
    options?: RequestOptions,
  ): Promise<PaginatedResult<PmocPlanSummary>> =>
    apiClient.get<PaginatedResult<PmocPlanSummary>>("/pmoc/plans", {
      ...options,
      query: query as QueryParams | undefined,
    }),

  get: (id: string, options?: RequestOptions): Promise<PmocPlan> =>
    apiClient.get<PmocPlan>(plan(id), options),

  create: (input: CreatePmocPlanInput): Promise<PmocPlanSummary> =>
    apiClient.post<PmocPlanSummary>("/pmoc/plans", input),

  update: (id: string, input: UpdatePmocPlanInput): Promise<PmocPlanSummary> =>
    apiClient.patch<PmocPlanSummary>(plan(id), input),

  activate: (id: string): Promise<PmocPlanSummary> =>
    apiClient.post<PmocPlanSummary>(`${plan(id)}/activate`, {}),

  suspend: (id: string): Promise<PmocPlanSummary> =>
    apiClient.post<PmocPlanSummary>(`${plan(id)}/suspend`, {}),

  cancel: (id: string): Promise<PmocPlanSummary> =>
    apiClient.post<PmocPlanSummary>(`${plan(id)}/cancel`, {}),

  /* ---------------------------------------------------------------- */
  /* Cobertura — cursor, não offset                                    */
  /* ---------------------------------------------------------------- */

  /**
   * Uma página de equipamentos cobertos.
   *
   * O backend pagina por cursor porque a cobertura de um contrato grande passa
   * de centenas de máquinas. Converter para offset no cliente reintroduziria
   * o salto de registros que o cursor existe para evitar.
   */
  coveragePage: (
    id: string,
    query?: PmocCoveragePageQuery,
    options?: RequestOptions,
  ): Promise<PmocCursorPage<PmocCoverage>> =>
    apiClient.get<PmocCursorPage<PmocCoverage>>(`${plan(id)}/equipment-page`, {
      ...options,
      query: query as QueryParams | undefined,
    }),

  addCoverage: (id: string, assetId: string, notes?: string) =>
    apiClient.post<PmocCoverage>(`${plan(id)}/equipment`, { assetId, notes }),

  removeCoverage: (id: string, coverageId: string): Promise<void> =>
    apiClient.delete<void>(
      `${plan(id)}/equipment/${encodeURIComponent(coverageId)}`,
    ),

  /* ---------------------------------------------------------------- */
  /* Ciclos e execuções por equipamento                                */
  /* ---------------------------------------------------------------- */

  cycles: (id: string, options?: RequestOptions): Promise<PmocCycle[]> =>
    apiClient.get<PmocCycle[]>(`${plan(id)}/executions`, options),

  /**
   * A cobertura do ciclo, com a execução de cada equipamento quando existe.
   *
   * Uma consulta responde tudo: quais equipamentos o ciclo abrange, quais já
   * foram executados e por quem. Cruzar cobertura com execuções no navegador
   * daria o mesmo resultado com duas consultas e uma regra a mais para errar.
   */
  equipmentExecutions: (
    planId: string,
    cycleId: string,
    options?: RequestOptions,
  ): Promise<PmocCycleEquipmentRow[]> =>
    apiClient.get<PmocCycleEquipmentRow[]>(
      `${cycle(planId, cycleId)}/equipment-executions`,
      options,
    ),

  /** A resposta que decide se a manutenção deste equipamento pode começar. */
  executionPreparation: (
    planId: string,
    cycleId: string,
    assetId: string,
    options?: RequestOptions,
  ): Promise<PmocExecutionPreparation> =>
    apiClient.get<PmocExecutionPreparation>(
      `${cycle(planId, cycleId)}/equipment/${encodeURIComponent(assetId)}/execution-preparation`,
      options,
    ),

  /* ---------------------------------------------------------------- */
  /* Linha do tempo                                                    */
  /* ---------------------------------------------------------------- */

  timeline: (
    id: string,
    query?: PmocTimelineQuery,
    options?: RequestOptions,
  ): Promise<PmocCursorPage<PmocTimelineItem>> =>
    apiClient.get<PmocCursorPage<PmocTimelineItem>>(`${plan(id)}/timeline`, {
      ...options,
      query: query as QueryParams | undefined,
    }),

  /* ---------------------------------------------------------------- */
  /* Painel                                                            */
  /* ---------------------------------------------------------------- */

  compliance: (options?: RequestOptions): Promise<PmocComplianceSummary> =>
    apiClient.get<PmocComplianceSummary>("/pmoc/compliance", options),

  upcoming: (options?: RequestOptions): Promise<PmocUpcoming[]> =>
    apiClient.get<PmocUpcoming[]>("/pmoc/upcoming", options),

  keys: {
    module: (): QueryKey => queryKeys.module(PMOC),
    plans: (query?: PmocPlanQuery): QueryKey =>
      queryKeys.list(PMOC, query as QueryParams | undefined),
    plan: (id: string): QueryKey => queryKeys.detail(PMOC, id),
    coverage: (id: string, query?: PmocCoveragePageQuery): QueryKey =>
      queryKeys.query(PMOC, "coverage", {
        id,
        ...(query as QueryParams | undefined),
      }),
    cycles: (id: string): QueryKey => queryKeys.query(PMOC, "cycles", { id }),
    equipmentExecutions: (planId: string, cycleId: string): QueryKey =>
      queryKeys.query(PMOC, "equipment-executions", { planId, cycleId }),
    preparation: (planId: string, cycleId: string, assetId: string): QueryKey =>
      queryKeys.query(PMOC, "execution-preparation", {
        planId,
        cycleId,
        assetId,
      }),
    timeline: (id: string, query?: PmocTimelineQuery): QueryKey =>
      queryKeys.query(PMOC, "timeline", {
        id,
        ...(query as QueryParams | undefined),
      }),
    compliance: (): QueryKey => queryKeys.query(PMOC, "compliance"),
    upcoming: (): QueryKey => queryKeys.query(PMOC, "upcoming"),
  },
} as const;
