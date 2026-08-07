"use client";

/**
 * Cartão de indicador — dirigido pelo Metric Registry.
 *
 * Três Workspaces escreveram o mesmo componente com nomes diferentes: o
 * `KpiCard` do Execution Center e os `Counter` do Asset e do Customer. Os três
 * resolviam a métrica no registry, tiravam ícone, cor, rótulo e formato de lá,
 * e desenhavam a mesma caixa. Divergiam só em tamanho e em como tratavam a
 * ausência de valor — e essa segunda divergência era um defeito, não uma
 * escolha: um deles mostrava esqueleto para sempre quando a consulta falhava.
 *
 * ## O que ele não faz
 *
 * Não calcula, não agrega e não formata por conta própria. O valor vem do
 * backend e o formato vem do registry. Um cartão que soma números seria
 * indicador inventado.
 */
import { Skeleton } from "@/components/ui/skeleton";
import { formatMetricValue, resolveMetric } from "@/metrics";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  /** Id registrado no Metric Registry. */
  readonly metricId: string;
  /** Valor publicado pelo backend. `undefined` enquanto não chegou. */
  readonly value: number | undefined;
  readonly isPending?: boolean;
  /**
   * A consulta falhou.
   *
   * Distinto de "ainda não chegou": esqueleto eterno é pior que dizer
   * "indisponível", porque promete um número que não vem.
   */
  readonly failed?: boolean;
  /** Mostra a descrição da métrica sob o número. */
  readonly showDescription?: boolean;
  readonly size?: "sm" | "md";
  readonly className?: string;
}

export function MetricCard({
  metricId,
  value,
  isPending = false,
  failed = false,
  showDescription = false,
  size = "md",
  className,
}: MetricCardProps) {
  const metric = resolveMetric({ id: metricId });
  const Icon = metric.icon;

  return (
    <div
      className={cn(
        "space-y-1 rounded-lg border border-border px-3 py-3",
        size === "md" && "glass-panel space-y-2 rounded-xl border-0 p-4",
        className,
      )}
    >
      <p
        className={cn(
          "flex items-center gap-1.5 text-xs text-muted-foreground",
          size === "md" && "gap-2",
        )}
      >
        <Icon
          className={cn(size === "sm" ? "size-3.5" : "size-4", metric.color)}
          aria-hidden
        />
        {metric.label}
      </p>

      {isPending ? (
        <Skeleton className="h-7 w-16" />
      ) : failed || value === undefined ? (
        <p className="text-sm text-muted-foreground">indisponível</p>
      ) : (
        <p className="font-display text-2xl font-bold tabular-nums">
          {formatMetricValue(metric, value)}
        </p>
      )}

      {showDescription ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {metric.description}
        </p>
      ) : null}
    </div>
  );
}
