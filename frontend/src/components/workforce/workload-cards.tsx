"use client";

/**
 * Carga de trabalho de uma pessoa.
 *
 * Cada número é o `meta.total` de uma consulta filtrada por `assignedUserId`
 * ou `responsibleUserId` — contagem do banco, feita pelo servidor.
 *
 * **Nada é produtividade.** O Analytics publica `technicians.active` e
 * `technicians.assignment_coverage`, ambos da organização; não há indicador
 * por pessoa em contrato nenhum. Uma média calculada aqui seria número
 * inventado sobre desempenho de alguém — a pior classe de número inventado.
 */
import { useMemberExecutionsCount, useMemberOperationsCount } from "@/hooks/workforce/use-workforce";
import { MetricCard } from "@/workspace";

/** Ids registrados no Metric Registry para a carga individual. */
export const WORKLOAD_METRIC_IDS = {
  operations: "member.operations.assigned",
  operationsInProgress: "member.operations.in_progress",
  executions: "member.executions.total",
  executionsInProgress: "member.executions.in_progress",
} as const;

export function WorkloadCards({ userId }: { userId: string }) {
  const operations = useMemberOperationsCount(userId);
  const operationsRunning = useMemberOperationsCount(userId, "IN_PROGRESS");
  const executions = useMemberExecutionsCount(userId);
  const executionsRunning = useMemberExecutionsCount(userId, "IN_PROGRESS");

  const cards = [
    { metricId: WORKLOAD_METRIC_IDS.operations, count: operations },
    {
      metricId: WORKLOAD_METRIC_IDS.operationsInProgress,
      count: operationsRunning,
    },
    { metricId: WORKLOAD_METRIC_IDS.executions, count: executions },
    {
      metricId: WORKLOAD_METRIC_IDS.executionsInProgress,
      count: executionsRunning,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <MetricCard
          key={card.metricId}
          size="sm"
          metricId={card.metricId}
          value={card.count.total}
          isPending={card.count.isPending}
          failed={Boolean(card.count.error)}
        />
      ))}
    </div>
  );
}
