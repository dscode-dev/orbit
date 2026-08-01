"use client";

/**
 * KPIs executivos — `GET /analytics/dashboard` (`metrics`).
 *
 * Cada indicador chega pronto do backend: valor, unidade, alvo, status,
 * direção, variação, origem e procedência. Toda a apresentação (rótulo,
 * ícone, cor, formato, favorabilidade e marca de procedência) vem do Metric
 * Registry — o componente não decide nada disso.
 */
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";
import {
  MetricProvenanceMark,
  presentMetric,
  sortByPriority,
  STATUS_CLASSES,
  STATUS_LABELS,
  type PresentedMetric,
} from "@/metrics";
import { PanelFrame, PanelState } from "@/components/panels";
import type { WidgetProps } from "./widget-registry";

export function ExecutiveKpisWidget({ widget, analytics }: WidgetProps) {
  return (
    <PanelFrame
      panelId={widget.id}
      title={widget.title}
      description={widget.description}
    >
      <PanelState
        query={analytics.dashboard}
        loadingRows={4}
        isEmpty={(data) => data.metrics.length === 0}
      >
        {(data) => (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {sortByPriority(data.metrics).map((metric) => (
              <KpiTile key={metric.id} metric={presentMetric(metric)} />
            ))}
          </div>
        )}
      </PanelState>
    </PanelFrame>
  );
}

function KpiTile({ metric }: { metric: PresentedMetric }) {
  const Icon = metric.icon;
  return (
    <div className="space-y-1.5">
      <StatCard
        label={metric.label}
        value={metric.value}
        delta={metric.change}
        trend={
          metric.trendTone === "positive"
            ? "up"
            : metric.trendTone === "negative"
              ? "down"
              : "neutral"
        }
        hint={metric.target ? `meta ${metric.target}` : undefined}
        icon={<Icon className={cn("size-4", metric.iconColor)} />}
      />
      <div className="flex flex-wrap items-center gap-1.5 px-1">
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
            STATUS_CLASSES[metric.status],
          )}
        >
          {STATUS_LABELS[metric.status]}
        </span>
        <MetricProvenanceMark
          quality={metric.provenance.quality}
          mark={metric.provenance.mark}
          source={metric.provenance.source}
        />
      </div>
    </div>
  );
}
