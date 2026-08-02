/**
 * Serviços do módulo Scheduling.
 *
 * Espelho um-para-um do `SchedulingController`. Nenhuma regra vive aqui:
 * expansão de recorrência, detecção de conflito, verificação de
 * disponibilidade e validação de janela são decisões do servidor.
 *
 * **Datas viajam em ISO 8601 com fuso explícito.** Os DTOs usam
 * `@Type(() => Date)`, que aceita a string ISO; enviar "2026-02-03 09:00" sem
 * fuso deixaria a interpretação a cargo do servidor — e o resultado mudaria
 * conforme onde ele roda.
 */
import { apiClient } from "@/api/client";
import { queryKeys, type QueryKey } from "@/api/query-keys";
import type { QueryParams, RequestOptions } from "@/types/api";
import type {
  AddSchedulingAllocationInput,
  CreateSchedulingAvailabilityInput,
  CreateSchedulingCalendarInput,
  CreateSchedulingEventInput,
  SchedulingAgenda,
  SchedulingAgendaQuery,
  SchedulingAvailability,
  SchedulingAvailabilityQuery,
  SchedulingCalendar,
  SchedulingConflict,
  SchedulingDashboard,
  SchedulingEventDetail,
  SchedulingEventQuery,
  SchedulingIntelligence,
  SchedulingOccurrence,
  SchedulingTimeline,
  UpdateSchedulingEventInput,
} from "@/types/scheduling";

const RESOURCE = "scheduling";

const asParams = (query: object | undefined): QueryParams | undefined =>
  query as QueryParams | undefined;

const event = (id: string): string =>
  `/scheduling/events/${encodeURIComponent(id)}`;

export const schedulingService = {
  basePath: "/scheduling",

  calendars: (
    businessUnitId?: string,
    options?: RequestOptions,
  ): Promise<readonly SchedulingCalendar[]> =>
    apiClient.get<readonly SchedulingCalendar[]>("/scheduling/calendars", {
      ...options,
      query: businessUnitId ? { businessUnitId } : undefined,
    }),

  createCalendar: (
    input: CreateSchedulingCalendarInput,
  ): Promise<SchedulingCalendar> =>
    apiClient.post<SchedulingCalendar>("/scheduling/calendars", input),

  /**
   * Ocorrências já expandidas pelo motor de recorrência, dentro da janela.
   *
   * É a fonte de todas as visões. `GET /scheduling/agenda` existe e agrupa por
   * dia, mas **em UTC** — ver `lib/scheduling/view-window.ts`.
   */
  occurrences: (
    query: SchedulingEventQuery,
    options?: RequestOptions,
  ): Promise<readonly SchedulingOccurrence[]> =>
    apiClient.get<readonly SchedulingOccurrence[]>("/scheduling/events", {
      ...options,
      query: asParams(query),
    }),

  agenda: (
    query: SchedulingAgendaQuery,
    options?: RequestOptions,
  ): Promise<SchedulingAgenda> =>
    apiClient.get<SchedulingAgenda>("/scheduling/agenda", {
      ...options,
      query: asParams(query),
    }),

  event: (
    id: string,
    options?: RequestOptions,
  ): Promise<SchedulingEventDetail> =>
    apiClient.get<SchedulingEventDetail>(event(id), options),

  createEvent: (
    input: CreateSchedulingEventInput,
  ): Promise<SchedulingEventDetail> =>
    apiClient.post<SchedulingEventDetail>("/scheduling/events", input),

  updateEvent: (
    id: string,
    input: UpdateSchedulingEventInput,
  ): Promise<SchedulingEventDetail> =>
    apiClient.patch<SchedulingEventDetail>(event(id), input),

  /**
   * Remoção do evento.
   *
   * O backend faz exclusão lógica (`deletedAt`) e registra no histórico. Não
   * existe rota de "cancelar" — cancelar é `PATCH` com
   * `status: "CANCELLED"`, que preserva o evento na agenda.
   */
  removeEvent: (id: string): Promise<void> => apiClient.delete<void>(event(id)),

  timeline: (
    id: string,
    options?: RequestOptions,
  ): Promise<SchedulingTimeline> =>
    apiClient.get<SchedulingTimeline>(`${event(id)}/timeline`, options),

  addAllocation: (
    id: string,
    input: AddSchedulingAllocationInput,
  ): Promise<SchedulingEventDetail> =>
    apiClient.post<SchedulingEventDetail>(`${event(id)}/allocations`, input),

  removeAllocation: (id: string, allocationId: string): Promise<void> =>
    apiClient.delete<void>(
      `${event(id)}/allocations/${encodeURIComponent(allocationId)}`,
    ),

  /** Conflitos detectados pelo backend na janela — nunca calculados aqui. */
  conflicts: (
    query: SchedulingEventQuery,
    options?: RequestOptions,
  ): Promise<readonly SchedulingConflict[]> =>
    apiClient.get<readonly SchedulingConflict[]>("/scheduling/conflicts", {
      ...options,
      query: asParams(query),
    }),

  availability: (
    query: SchedulingAvailabilityQuery,
    options?: RequestOptions,
  ): Promise<readonly SchedulingAvailability[]> =>
    apiClient.get<readonly SchedulingAvailability[]>(
      "/scheduling/availability",
      { ...options, query: asParams(query) },
    ),

  createAvailability: (
    input: CreateSchedulingAvailabilityInput,
  ): Promise<SchedulingAvailability> =>
    apiClient.post<SchedulingAvailability>("/scheduling/availability", input),

  removeAvailability: (id: string): Promise<void> =>
    apiClient.delete<void>(
      `/scheduling/availability/${encodeURIComponent(id)}`,
    ),

  /**
   * Scheduling Intelligence.
   *
   * O contrato declara `source: 'MOCK'` e o controller diz "Return mocked
   * Scheduling Intelligence contracts". Dentro do payload, **`conflicts` é
   * real** — vem do mesmo cálculo de `/scheduling/conflicts`; o restante é
   * fixture. A interface marca cada bloco pelo que ele é.
   */
  intelligence: (
    query: SchedulingEventQuery,
    options?: RequestOptions,
  ): Promise<SchedulingIntelligence> =>
    apiClient.get<SchedulingIntelligence>("/scheduling/intelligence", {
      ...options,
      query: asParams(query),
    }),

  dashboard: (options?: RequestOptions): Promise<SchedulingDashboard> =>
    apiClient.get<SchedulingDashboard>("/scheduling/dashboard", options),

  keys: {
    module: (): QueryKey => queryKeys.module(RESOURCE),
    calendars: (businessUnitId?: string): QueryKey =>
      queryKeys.query(RESOURCE, "calendars", { businessUnitId }),
    occurrences: (query: SchedulingEventQuery): QueryKey =>
      queryKeys.query(RESOURCE, "events", asParams(query)),
    agenda: (query: SchedulingAgendaQuery): QueryKey =>
      queryKeys.query(RESOURCE, "agenda", asParams(query)),
    event: (id: string): QueryKey => queryKeys.detail(RESOURCE, id),
    timeline: (id: string): QueryKey =>
      queryKeys.nested(RESOURCE, id, "timeline"),
    conflicts: (query: SchedulingEventQuery): QueryKey =>
      queryKeys.query(RESOURCE, "conflicts", asParams(query)),
    availability: (query: SchedulingAvailabilityQuery): QueryKey =>
      queryKeys.query(RESOURCE, "availability", asParams(query)),
    intelligence: (query: SchedulingEventQuery): QueryKey =>
      queryKeys.query(RESOURCE, "intelligence", asParams(query)),
    dashboard: (): QueryKey => queryKeys.query(RESOURCE, "dashboard"),
  },
} as const;
