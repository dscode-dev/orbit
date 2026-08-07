"use client";

/**
 * Leituras do Execution Center.
 *
 * ## De onde vêm os números
 *
 * **Não do Analytics.** `AnalyticsDomain` cobre operações, PMOC, equipamentos,
 * técnicos, contratos e ambiente — **não há domínio de execução de artefato**,
 * nem indicador algum sobre elas. Consumir "exclusivamente Analytics" para
 * estes KPIs devolveria uma tela vazia.
 *
 * O que existe é a contagem que o próprio backend faz ao paginar: `meta.total`
 * de `GET /artifact-executions?status=…`. É contagem do banco, feita no
 * servidor, uma por fila — o mesmo caminho que o Asset Workspace e o contador
 * de notificações já usam. **Nada é somado no cliente.**
 *
 * `limit: 1` porque só o total interessa: a página em si é carregada pela fila
 * que o usuário abrir.
 *
 * ## O que não é publicado
 *
 * - **Progresso global.** Cada execução publica o seu `progress`; não existe
 *   agregado, e média no cliente seria indicador inventado.
 * - **Execução cancelada.** `ARTIFACT_EXECUTION_STATUSES` não tem `CANCELLED`.
 *   `ARCHIVED` significa arquivada, que é outra coisa.
 *
 * ## Realtime
 *
 * Não há canal para execuções — o gateway Socket.IO existente é de
 * notificações. A cadência é a mesma da listagem (`refetchInterval`), e a
 * arquitetura fica pronta: trocar a fonte destes hooks por um canal não muda
 * nenhum componente. Nada aqui simula tempo real.
 */
import { useMemo } from "react";

import { useApiQuery } from "@/hooks/api/use-api-query";
import { CACHE } from "@/hooks/api/cache-policy";
import { artifactExecutionsService } from "@/services/artifact-executions.service";
import { useActiveScope } from "@/providers/use-active-scope";
import type { ArtifactExecutionStatus } from "@/types/artifact-executions";

/** Status que ganham fila própria, na ordem em que aparecem. */
export const EXECUTION_QUEUES = [
  "IN_PROGRESS",
  "UNDER_REVIEW",
  "PAUSED",
  "DRAFT",
  "COMPLETED",
  "APPROVED",
  "ARCHIVED",
] as const satisfies readonly ArtifactExecutionStatus[];

export type ExecutionQueue = (typeof EXECUTION_QUEUES)[number];

/** Filas que compõem a área de revisão — ver `revisions.section`. */
export const REVIEW_QUEUES: readonly ExecutionQueue[] = [
  "UNDER_REVIEW",
  "PAUSED",
];

/** Métrica do Metric Registry correspondente a cada fila destacada. */
export const QUEUE_METRIC_IDS: Readonly<
  Partial<Record<ExecutionQueue, string>>
> = {
  IN_PROGRESS: "executions.in_progress",
  PAUSED: "executions.paused",
  UNDER_REVIEW: "executions.under_review",
  COMPLETED: "executions.completed",
};

const COUNT_REFRESH = CACHE.live;

/**
 * Contagem de uma fila.
 *
 * Uma consulta por status, com `limit: 1`. O número é o `meta.total` do
 * servidor.
 */
function useQueueCount(status: ExecutionQueue | undefined) {
  const { businessUnitId } = useActiveScope();
  const query = useMemo(
    () => ({
      status,
      limit: 1,
      page: 1,
      businessUnitId: businessUnitId ?? undefined,
    }),
    [status, businessUnitId],
  );

  const result = useApiQuery(
    artifactExecutionsService.keys.list(query),
    ({ signal }) => artifactExecutionsService.list(query, { signal }),
    COUNT_REFRESH,
  );

  return {
    total: result.data?.meta.total ?? 0,
    isPending: result.isPending,
    error: result.error,
    refetch: result.refetch,
  };
}

export interface ExecutionCounts {
  readonly total: number;
  readonly byQueue: Readonly<Record<ExecutionQueue, number>>;
  readonly isPending: boolean;
  readonly error: unknown;
  readonly refetch: () => void;
}

/**
 * Contagens de todas as filas.
 *
 * Os hooks são chamados em ordem fixa — a lista de filas é uma constante do
 * módulo, então a quantidade de hooks nunca varia entre renders.
 */
export function useExecutionCounts(): ExecutionCounts {
  const all = useQueueCount(undefined);
  const inProgress = useQueueCount("IN_PROGRESS");
  const underReview = useQueueCount("UNDER_REVIEW");
  const paused = useQueueCount("PAUSED");
  const draft = useQueueCount("DRAFT");
  const completed = useQueueCount("COMPLETED");
  const approved = useQueueCount("APPROVED");
  const archived = useQueueCount("ARCHIVED");

  const parts = [
    all,
    inProgress,
    underReview,
    paused,
    draft,
    completed,
    approved,
    archived,
  ];

  return {
    total: all.total,
    byQueue: {
      IN_PROGRESS: inProgress.total,
      UNDER_REVIEW: underReview.total,
      PAUSED: paused.total,
      DRAFT: draft.total,
      COMPLETED: completed.total,
      APPROVED: approved.total,
      ARCHIVED: archived.total,
    },
    isPending: parts.some((part) => part.isPending),
    error: parts.find((part) => part.error)?.error ?? null,
    refetch: () => parts.forEach((part) => void part.refetch()),
  };
}
