/**
 * Serviços do módulo de notificações.
 *
 * Espelho das rotas de leitura e de marcação. As rotas de **emissão**
 * (`POST /notifications`, `POST /:id/dispatch`) exigem
 * `notifications.manage` e pertencem a quem produz notificação, não à central
 * que as lê — não são consumidas aqui.
 *
 * Preferências (`/preferences`) e push (`/push-subscriptions`) são
 * configuração de canal, não a central que lê — e por isso vivem no Workspace
 * de Configurações. Ficam neste service porque o recurso é o mesmo; o que
 * muda é quem as consome.
 */
import { apiClient } from "@/api/client";
import { queryKeys, type QueryKey } from "@/api/query-keys";
import type { QueryParams, RequestOptions } from "@/types/api";
import type {
  NotificationPreference,
  UpdateNotificationPreferenceInput,
} from "@/types/settings";
import type {
  NotificationListResult,
  NotificationQuery,
  OrbitNotification,
} from "@/types/notifications";

const RESOURCE = "notifications";
const BASE_PATH = "/notifications";

const asParams = (query: object | undefined): QueryParams | undefined =>
  query as QueryParams | undefined;

const item = (id: string): string => `${BASE_PATH}/${encodeURIComponent(id)}`;

export const notificationsService = {
  basePath: BASE_PATH,

  /** A resposta traz `unread` junto — é o contador do badge. */
  list: (
    query?: NotificationQuery,
    options?: RequestOptions,
  ): Promise<NotificationListResult> =>
    apiClient.get<NotificationListResult>(BASE_PATH, {
      ...options,
      query: asParams(query),
    }),

  get: (id: string, options?: RequestOptions): Promise<OrbitNotification> =>
    apiClient.get<OrbitNotification>(item(id), options),

  markRead: (id: string): Promise<OrbitNotification> =>
    apiClient.patch<OrbitNotification>(`${item(id)}/read`),

  /** Marcação em lote — o endpoint existe, então a central a oferece. */
  markAllRead: (): Promise<unknown> =>
    apiClient.patch<unknown>(`${BASE_PATH}/read-all`),

  /**
   * Preferências de notificação.
   *
   * `@@unique([organizationId, userId, type])`: são pessoais **dentro de uma
   * organização**. O `PATCH` faz upsert de um tipo por vez — não substitui o
   * conjunto.
   */
  preferences: (options?: RequestOptions): Promise<NotificationPreference[]> =>
    apiClient.get<NotificationPreference[]>(
      `${BASE_PATH}/preferences`,
      options,
    ),

  setPreference: (
    input: UpdateNotificationPreferenceInput,
  ): Promise<NotificationPreference> =>
    apiClient.patch<NotificationPreference>(
      `${BASE_PATH}/preferences`,
      input,
    ),

  keys: {
    module: (): QueryKey => queryKeys.module(RESOURCE),
    lists: (): QueryKey => queryKeys.lists(RESOURCE),
    list: (query?: NotificationQuery): QueryKey =>
      queryKeys.list(RESOURCE, asParams(query)),
    detail: (id: string): QueryKey => queryKeys.detail(RESOURCE, id),
    /** Consulta dedicada do contador, com `limit: 1`. */
    unread: (): QueryKey => queryKeys.query(RESOURCE, "unread"),
    preferences: (): QueryKey => queryKeys.query(RESOURCE, "preferences"),
  },
} as const;
