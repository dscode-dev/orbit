/**
 * Contratos do módulo de notificações.
 *
 * O módulo **não publica Read Model**: o controller devolve o registro do
 * Prisma com `deliveries` incluído. A forma abaixo é espelhada — mesma
 * fragilidade que a PR-11 acabou de corrigir no CRM, registrada no manifesto.
 *
 * O que o contrato tem e o que não tem, verificado no `NotificationQueryDto`:
 *
 * | Conceito | Situação |
 * | --- | --- |
 * | filtro por `status`, `type`, `unreadOnly` | ✓ |
 * | paginação | ✓ |
 * | **contador de não lidas** | ✓ — vem em `unread`, na própria listagem |
 * | marcar uma como lida | ✓ `PATCH /:id/read` |
 * | marcar todas como lidas | ✓ `PATCH /read-all` |
 * | **busca textual** | ✗ não existe |
 * | **arquivar, fixar, prioridade** | ✗ não existem no modelo |
 */
import type { NotificationStatus } from "./contracts";

export type { NotificationStatus };

/** Entrega por canal — o backend registra o resultado de cada um. */
export interface NotificationDelivery {
  id: string;
  notificationId: string;
  channel: string;
  status: string;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrbitNotification {
  id: string;
  organizationId: string;
  businessUnitId: string | null;
  recipientUserId: string;
  /** `VarChar(80)` — texto livre. A categoria vem daqui. */
  type: string;
  channels: readonly string[];
  title: string;
  body: string;
  status: string;
  /** JSON livre. É onde vive a Resource Reference. */
  payload: unknown;
  scheduledAt: string | null;
  sentAt: string | null;
  readAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  deliveries?: readonly NotificationDelivery[];
}

/**
 * `GET /notifications`.
 *
 * Além de `data` e `meta`, a resposta traz **`unread`** — a contagem de não
 * lidas do usuário, calculada no banco e **independente do filtro aplicado**.
 * É o número do badge, sem endpoint extra e sem contagem no cliente.
 */
export interface NotificationListResult {
  data: readonly OrbitNotification[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  unread: number;
}

/** `NotificationQueryDto`. Sem busca textual — o contrato não a tem. */
export interface NotificationQuery {
  status?: NotificationStatus;
  type?: string;
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
}
