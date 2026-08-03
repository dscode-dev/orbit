"use client";

/**
 * Indicadores do Execution Center.
 *
 * Cada número é o `meta.total` de uma consulta filtrada por status — contagem
 * do banco, feita pelo servidor. **Nada é somado aqui.**
 *
 * A apresentação (rótulo, ícone, cor, formato, se subir é bom) vem do **Metric
 * Registry**: este componente não escolhe nenhuma dessas coisas.
 *
 * Não há linha de "progresso global": cada execução publica o seu `progress`,
 * e o backend não publica agregado. Uma média calculada aqui seria indicador
 * inventado — a ausência é declarada no rodapé.
 */
import { PanelError } from "@/components/panels";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExecutionCounts } from "@/hooks/artifact-executions/use-execution-center";
import { QUEUE_METRIC_IDS } from "@/hooks/artifact-executions/use-execution-center";
import { formatMetricValue, isMetricVisible, resolveMetric } from "@/metrics";
import { useSession } from "@/providers/session-provider";
import { ApiError } from "@/lib/api-error";
import { cn } from "@/lib/utils";

export function ExecutionKpis({ counts }: { counts: ExecutionCounts }) {
  const session = useSession();

  const cards = [
    { metricId: "executions.total", value: counts.total },
    ...Object.entries(QUEUE_METRIC_IDS).map(([queue, metricId]) => ({
      metricId,
      value: counts.byQueue[queue as keyof ExecutionCounts["byQueue"]],
    })),
  ].filter((card) =>
    isMetricVisible(
      resolveMetric({ id: card.metricId }),
      session.hasCapability,
    ),
  );

  if (counts.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <Skeleton key={card.metricId} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  if (counts.error) {
    return (
      <PanelError
        error={counts.error instanceof ApiError ? counts.error : undefined}
        onRetry={counts.refetch}
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <KpiCard
            key={card.metricId}
            metricId={card.metricId}
            value={card.value}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Contagens do backend, uma consulta por fila. O Analytics não publica
        indicadores de execução de artefato, e não há progresso agregado — o
        progresso é publicado por execução.
      </p>
    </div>
  );
}

function KpiCard({ metricId, value }: { metricId: string; value: number }) {
  const metric = resolveMetric({ id: metricId });
  const Icon = metric.icon;

  return (
    <div className="glass-panel space-y-2 rounded-xl p-4">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={cn("size-4", metric.color)} aria-hidden />
        {metric.label}
      </p>
      <p className="font-display text-2xl font-bold tabular-nums">
        {formatMetricValue(metric, value)}
      </p>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {metric.description}
      </p>
    </div>
  );
}
