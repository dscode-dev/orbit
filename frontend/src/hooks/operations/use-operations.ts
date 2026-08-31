"use client";

/**
 * Hooks do módulo Operations.
 *
 * Cada seção do Workspace tem a sua consulta e a sua cadência — é o que
 * permite recarregar uma área sem tocar nas outras.
 *
 * O escopo ativo entra nas queries: `businessUnitId` é filtro real de
 * `OperationQueryDto`, então trocar de unidade muda a query key e refaz a
 * leitura. Trocar de organização já descarta as queries do escopo anterior
 * (`RequestContextProvider`, PR-02).
 */
import { useMemo } from "react";

import { queryKeys } from "@/api/query-keys";
import { useApiMutation } from "@/hooks/api/use-api-mutation";
import { useApiQuery } from "@/hooks/api/use-api-query";
import { CACHE } from "@/hooks/api/cache-policy";
import { useActiveScope } from "@/providers/use-active-scope";
import {
  operationChecklistsService,
  operationIntelligenceService,
  operationsService,
} from "@/services/operations.service";
import type {
  AssignOperationUserInput,
  ChangeOperationStatusInput,
  CreateOperationInput,
  OperationQuery,
  UpdateOperationInput,
} from "@/types/operations";

/**
 * Cadência por seção, escolhida pela volatilidade.
 *
 * Timeline e status mudam durante a execução; detalhes e checklists mudam por
 * ação do usuário; anexos só mudam quando alguém envia algo.
 */
export const OPERATIONS_REFRESH = {
  list: CACHE.live,
  detail: CACHE.fresh,
  timeline: CACHE.live,
  history: CACHE.stable,
  checklists: CACHE.fresh,
  intelligence: CACHE.catalog,
} as const;

/** Lista paginada. A unidade ativa entra como filtro quando não há escolha explícita. */
export function useOperationsList(query: OperationQuery) {
  const { businessUnitId } = useActiveScope();
  const scopedQuery = useMemo<OperationQuery>(
    () => ({
      ...query,
      businessUnitId: query.businessUnitId ?? businessUnitId ?? undefined,
    }),
    [businessUnitId, query],
  );

  return useApiQuery(
    operationsService.keys.list(scopedQuery),
    ({ signal }) => operationsService.list(scopedQuery, { signal }),
    {
      ...OPERATIONS_REFRESH.list,
      /** Mantém a página anterior visível durante a troca de página. */
      placeholderData: (previous) => previous,
    },
  );
}

export function useOperation(id: string) {
  return useApiQuery(
    operationsService.keys.detail(id),
    ({ signal }) => operationsService.get(id, { signal }),
    OPERATIONS_REFRESH.detail,
  );
}

export function useOperationTimeline(id: string) {
  return useApiQuery(
    operationsService.keys.timeline(id),
    ({ signal }) => operationsService.timeline(id, { signal }),
    { ...OPERATIONS_REFRESH.timeline, refetchOnWindowFocus: true },
  );
}

export function useOperationHistory(id: string) {
  return useApiQuery(
    operationsService.keys.history(id),
    ({ signal }) => operationsService.history(id, { signal }),
    OPERATIONS_REFRESH.history,
  );
}

export function useOperationChecklists(operationId: string) {
  return useApiQuery(
    operationChecklistsService.keys.byOperation(operationId),
    ({ signal }) =>
      operationChecklistsService.list({ operationId }, { signal }),
    OPERATIONS_REFRESH.checklists,
  );
}

export function useOperationIntelligence(operationId: string) {
  return useApiQuery(
    operationIntelligenceService.keys.byOperation(operationId),
    ({ signal }) =>
      operationIntelligenceService.list({ operationId }, { signal }),
    OPERATIONS_REFRESH.intelligence,
  );
}

/**
 * Keys invalidadas após qualquer escrita na operação.
 *
 * O backend registra histórico em toda mutação, então detalhe, timeline e
 * histórico saem juntos — e a lista, porque status e atribuições aparecem lá.
 */
function affectedKeys(id: string) {
  return [
    operationsService.keys.detail(id),
    operationsService.keys.timeline(id),
    operationsService.keys.history(id),
    queryKeys.module("operations"),
  ];
}

/**
 * O que uma mudança de equipe afeta.
 *
 * O detalhe e a listagem, porque ambos mostram quem responde; e a Agenda,
 * porque o backend espelha o responsável nas alocações do evento vinculado.
 * Nada além disso — invalidar tudo derrubaria caches que a troca não tocou.
 */
function assignmentKeys(id: string) {
  return [...affectedKeys(id), queryKeys.module("scheduling")];
}

export function useCreateOperation() {
  return useApiMutation(
    (input: CreateOperationInput) => operationsService.create(input),
    { invalidate: [queryKeys.module("operations")] },
  );
}

export function useUpdateOperation(id: string) {
  return useApiMutation(
    (input: UpdateOperationInput) => operationsService.update(id, input),
    {
      /** Edições da mesma operação não disputam a última palavra. */
      scope: { id: `operations:${id}` },
      invalidate: affectedKeys(id),
    },
  );
}

export function useRemoveOperation() {
  return useApiMutation((id: string) => operationsService.remove(id), {
    invalidate: [queryKeys.module("operations")],
  });
}

export function useChangeOperationStatus(id: string) {
  return useApiMutation(
    (input: ChangeOperationStatusInput) =>
      operationsService.changeStatus(id, input),
    { invalidate: affectedKeys(id) },
  );
}

export function useAssignOperationUser(id: string) {
  return useApiMutation(
    (input: AssignOperationUserInput) => operationsService.assign(id, input),
    { invalidate: affectedKeys(id) },
  );
}

export function useUnassignOperationUser(id: string) {
  return useApiMutation(
    (userId: string) => operationsService.unassign(id, userId),
    { invalidate: affectedKeys(id) },
  );
}

/* ------------------------------------------------------------------ */
/* Equipe do atendimento (PR-28)                                       */
/* ------------------------------------------------------------------ */

/**
 * Define ou troca o responsável — e promove um auxiliar, quando é o caso.
 *
 * Uma chamada só. O invariante "responsável não é auxiliar" é do servidor, e
 * é lá que ele é mantido; a tela apenas relê o estado autoritativo depois.
 *
 * A Agenda entra na invalidação porque o vínculo do atendimento espelha nas
 * alocações do evento: trocar o responsável muda quem aparece no calendário.
 */
export function useReplaceOperationResponsible(id: string) {
  return useApiMutation(
    (userId: string) => operationsService.replaceResponsible(id, userId),
    { invalidate: assignmentKeys(id) },
  );
}

export function useAddOperationAuxiliary(id: string) {
  return useApiMutation(
    (userId: string) => operationsService.addAuxiliary(id, userId),
    { invalidate: assignmentKeys(id) },
  );
}

export function useRemoveOperationAuxiliary(id: string) {
  return useApiMutation(
    (userId: string) => operationsService.removeAuxiliary(id, userId),
    { invalidate: assignmentKeys(id) },
  );
}

export function useRemoveOperationAttachment(id: string) {
  return useApiMutation(
    (attachmentId: string) =>
      operationsService.removeAttachment(id, attachmentId),
    { invalidate: affectedKeys(id) },
  );
}
