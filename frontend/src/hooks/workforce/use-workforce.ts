"use client";

/**
 * Query Layer do Workforce Management.
 *
 * ## Cadência
 *
 * Equipe é cadastro: muda quando alguém convida, aceita ou sai. Nada aqui se
 * recarrega sozinho. Papéis mudam ainda menos — `CACHE.catalog`.
 *
 * ## Uma consulta de membros para a aplicação inteira
 *
 * A key é a de `organizations`, a mesma que o `UserReference` e o Organization
 * Workspace já usam. Três telas pedindo a equipe fazem **uma** requisição.
 *
 * ## Visão técnica: nada é recortado no cliente
 *
 * `assignedUserId`, `responsibleUserId` e `userId` são filtros reais de
 * `OperationQueryDto`, `ArtifactExecutionQueryDto` e `EventQueryDto`. O que a
 * tela mostra por pessoa é o que o servidor contou.
 */
import { useQueryClient } from "@tanstack/react-query";

import { useApiMutation } from "@/hooks/api/use-api-mutation";
import { useApiQuery } from "@/hooks/api/use-api-query";
import { CACHE, MINUTE, every } from "@/hooks/api/cache-policy";
import { artifactExecutionsService } from "@/services/artifact-executions.service";
import { operationsService } from "@/services/operations.service";
import { schedulingService } from "@/services/scheduling.service";
import { workforceService } from "@/services/workforce.service";
import type { ArtifactExecutionQuery } from "@/types/artifact-executions";
import type { OperationQuery } from "@/types/operations";
import type { CreateInvitationInput, InvitationQuery } from "@/types/workforce";

export const WORKFORCE_REFRESH = {
  roles: CACHE.catalog,
  /** Convite expira sozinho; a lista revalida para o prazo não ficar velho. */
  invitations: every(CACHE.stable, 5 * MINUTE),
  related: CACHE.fresh,
} as const;

/** Horizonte da agenda da pessoa, em dias. */
const SCHEDULE_HORIZON_DAYS = 30;

/* ------------------------------------------------------------------ */
/* Leituras                                                            */
/* ------------------------------------------------------------------ */

/**
 * Membros da organização.
 *
 * Reexporta `useOrganizationMembers` em vez de reimplementá-lo: a consulta já
 * existia, com a mesma key e a mesma política. Um segundo hook sobre o mesmo
 * endpoint criaria duas cadências para o mesmo dado.
 */
export { useOrganizationMembers as useTeamMembers } from "@/hooks/organization/use-organization";

export function useTeamRoles() {
  return useApiQuery(
    workforceService.keys.roles(),
    ({ signal }) => workforceService.roles({ signal }),
    WORKFORCE_REFRESH.roles,
  );
}

export function useTeamInvitations(query?: InvitationQuery) {
  return useApiQuery(
    workforceService.keys.invitations(query),
    ({ signal }) => workforceService.invitations(query, { signal }),
    WORKFORCE_REFRESH.invitations,
  );
}

/* ------------------------------------------------------------------ */
/* Visão técnica — o que uma pessoa tem para fazer                      */
/* ------------------------------------------------------------------ */

/** Operações atribuídas — `assignedUserId` é filtro real. */
export function useMemberOperations(userId: string, limit = 5) {
  const query = { assignedUserId: userId, page: 1, limit } as const;
  return useApiQuery(
    operationsService.keys.list(query),
    ({ signal }) => operationsService.list(query, { signal }),
    WORKFORCE_REFRESH.related,
  );
}

/** Execuções sob responsabilidade — `responsibleUserId` é filtro real. */
export function useMemberExecutions(userId: string, limit = 5) {
  const query = { responsibleUserId: userId, page: 1, limit } as const;
  return useApiQuery(
    artifactExecutionsService.keys.list(query),
    ({ signal }) => artifactExecutionsService.list(query, { signal }),
    WORKFORCE_REFRESH.related,
  );
}

/**
 * Agenda da pessoa.
 *
 * Janela de 30 dias — recorte de apresentação. As ocorrências vêm expandidas
 * pelo motor de recorrência do backend; nada de conflito ou disponibilidade é
 * calculado aqui.
 */
export function useMemberSchedule(userId: string) {
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + SCHEDULE_HORIZON_DAYS);

  const query = {
    userId,
    from: from.toISOString(),
    to: to.toISOString(),
  };

  return useApiQuery(
    schedulingService.keys.occurrences(query),
    ({ signal }) => schedulingService.occurrences(query, { signal }),
    WORKFORCE_REFRESH.related,
  );
}

/**
 * Contagem de um recorte, para os KPIs por pessoa.
 *
 * `limit: 1` e o número vem do `meta.total` do servidor — a mesma técnica do
 * Execution Center e do Catálogo, pelo mesmo motivo: **o Analytics não publica
 * indicadores por pessoa**, só `technicians.active` e
 * `technicians.assignment_coverage`, que são da organização.
 */
export function useMemberOperationsCount(
  userId: string,
  status?: OperationQuery["status"],
) {
  const query: OperationQuery = {
    assignedUserId: userId,
    status,
    page: 1,
    limit: 1,
  };
  const result = useApiQuery(
    operationsService.keys.list(query),
    ({ signal }) => operationsService.list(query, { signal }),
    WORKFORCE_REFRESH.related,
  );
  return {
    total: result.data?.meta.total,
    isPending: result.isPending,
    error: result.error,
  };
}

export function useMemberExecutionsCount(
  userId: string,
  status?: ArtifactExecutionQuery["status"],
) {
  const query: ArtifactExecutionQuery = {
    responsibleUserId: userId,
    status,
    page: 1,
    limit: 1,
  };
  const result = useApiQuery(
    artifactExecutionsService.keys.list(query),
    ({ signal }) => artifactExecutionsService.list(query, { signal }),
    WORKFORCE_REFRESH.related,
  );
  return {
    total: result.data?.meta.total,
    isPending: result.isPending,
    error: result.error,
  };
}

/* ------------------------------------------------------------------ */
/* Escritas                                                            */
/* ------------------------------------------------------------------ */

/**
 * Escritas de convite invalidam a lista de convites.
 *
 * **Não invalidam membros**: convidar não cria membro — quem cria é o
 * `accept`, feito pela pessoa convidada, noutra sessão. Derrubar o cache de
 * membros aqui seria recarregar por nada.
 */
function useInvitationInvalidation() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({
      queryKey: workforceService.keys.invitationsModule(),
    });
  };
}

export function useInviteMember() {
  const invalidate = useInvitationInvalidation();
  return useApiMutation(
    (input: CreateInvitationInput) => workforceService.invite(input),
    { onSuccess: invalidate },
  );
}

export function useResendInvitation() {
  const invalidate = useInvitationInvalidation();
  return useApiMutation(
    (id: string) => workforceService.resendInvitation(id),
    { onSuccess: invalidate },
  );
}

export function useRevokeInvitation() {
  const invalidate = useInvitationInvalidation();
  return useApiMutation(
    (id: string) => workforceService.revokeInvitation(id),
    { onSuccess: invalidate },
  );
}
