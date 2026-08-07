/**
 * Serviços do Workforce Management.
 *
 * Duas origens, um módulo: membros e papéis vêm de `organizations/current`,
 * convites vêm de `identity/invitations`. É a divisão do backend, e o service
 * a preserva — não há um recurso "equipe" no servidor, e inventar um caminho
 * único aqui esconderia de onde cada coisa vem.
 *
 * As **keys** de membro e papel são as de `organizations`: o Organization
 * Workspace já lê membros, e as duas telas compartilham a mesma consulta em
 * vez de manterem caches paralelos.
 */
import { apiClient } from "@/api/client";
import { queryKeys, type QueryKey } from "@/api/query-keys";
import { organizationService } from "@/services/organization.service";
import type { QueryParams, RequestOptions } from "@/types/api";
import type {
  CreateInvitationInput,
  InvitationQuery,
  TeamInvitation,
  TeamRole,
} from "@/types/workforce";

const INVITATIONS = "identity-invitations";
const INVITATIONS_PATH = "/identity/invitations";

const invitation = (id: string): string =>
  `${INVITATIONS_PATH}/${encodeURIComponent(id)}`;

export const workforceService = {
  /** Papéis da organização, com o que cada um concede. */
  roles: (options?: RequestOptions): Promise<TeamRole[]> =>
    apiClient.get<TeamRole[]>("/organizations/current/roles", options),

  invitations: (
    query?: InvitationQuery,
    options?: RequestOptions,
  ): Promise<TeamInvitation[]> =>
    apiClient.get<TeamInvitation[]>(INVITATIONS_PATH, {
      ...options,
      query: query as QueryParams | undefined,
    }),

  invite: (
    input: CreateInvitationInput,
  ): Promise<{ id: string; expiresAt: string }> =>
    apiClient.post<{ id: string; expiresAt: string }>(INVITATIONS_PATH, input),

  /** Reenvia: gera token novo, e o anterior deixa de valer. */
  resendInvitation: (
    id: string,
  ): Promise<{ id: string; expiresAt: string }> =>
    apiClient.post<{ id: string; expiresAt: string }>(
      `${invitation(id)}/resend`,
      {},
    ),

  /** Cancela: o registro permanece como `REVOKED`, para auditoria. */
  revokeInvitation: (id: string): Promise<void> =>
    apiClient.delete<void>(invitation(id)),

  keys: {
    /** Membros e papéis pertencem ao módulo `organizations`. */
    members: (): QueryKey => organizationService.keys.members(),
    roles: (): QueryKey => queryKeys.query("organizations", "roles"),

    invitationsModule: (): QueryKey => queryKeys.module(INVITATIONS),
    invitations: (query?: InvitationQuery): QueryKey =>
      queryKeys.list(INVITATIONS, query as QueryParams | undefined),
  },
} as const;
