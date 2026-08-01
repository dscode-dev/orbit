"use client";

/**
 * KPIs executivos — `GET /analytics/dashboard` (`metrics`).
 *
 * Cada indicador chega pronto do backend: valor, unidade, alvo, status,
 * direção, variação, origem e procedência. O widget só apresenta.
 */
import { Activity, Gauge, TrendingUp, Users, Wrench } from "lucide-react";
import type { ComponentType } from "react";

import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";
import type { AnalyticsDomain, AnalyticsKpi } from "@/types/dashboard";
import {
  formatChange,
  formatMetric,
  STATUS_CLASSES,
  STATUS_LABELS,
  toTrend,
} from "./format";
import { ProvenanceMark } from "./provenance";
import type { WidgetProps } from "./widget-registry";
import { WidgetFrame, WidgetState } from "./widget-frame";

/** Ícone por domínio — o backend não define ícones. */
const DOMAIN_ICONS: Readonly<
  Record<AnalyticsDomain, ComponentType<{ className?: string }>>
> = {
  OPERATIONS: Activity,
  PMOC: Gauge,
  EQUIPMENT: Wrench,
  TECHNICIANS: Users,
  CONTRACTS: TrendingUp,
  ENVIRONMENT: Gauge,
};

export function ExecutiveKpisWidget({ widget, analytics }: WidgetProps) {
  return (
    <WidgetFrame
      widgetId={widget.id}
      title={widget.title}
      description={widget.description}
    >
      <WidgetState
        query={analytics.dashboard}
        loadingRows={4}
        isEmpty={(data) => data.metrics.length === 0}
      >
        {(data) => (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data.metrics.map((metric) => (
              <KpiTile key={metric.id} metric={metric} />
            ))}
          </div>
        )}
      </WidgetState>
    </WidgetFrame>
  );
}

function KpiTile({ metric }: { metric: AnalyticsKpi }) {
  const Icon = DOMAIN_ICONS[metric.domain];
  const target =
    metric.target === undefined
      ? undefined
      : `meta ${formatMetric(metric.target, metric.unit)}`;

  return (
    <div className="space-y-1.5">
      <StatCard
        label={metric.label}
        value={formatMetric(metric.value, metric.unit)}
        delta={formatChange(metric.changePercent)}
        trend={toTrend(metric.direction)}
        hint={target}
        icon={<Icon className="size-4" />}
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
        <ProvenanceMark quality={metric.dataQuality} source={metric.source} />
      </div>
    </div>
  );
}
