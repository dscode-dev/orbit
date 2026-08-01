"use client";

/**
 * Health Score — `GET /analytics/health`.
 *
 * O score e as dimensões (com peso e drivers) vêm calculados do
 * `HealthEngine`. O frontend não recalcula nem repondera nada.
 */
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { HealthDimension } from "@/types/dashboard";
import { STATUS_CLASSES, STATUS_LABELS } from "@/metrics";
import type { WidgetProps } from "./widget-registry";
import { PanelFrame, PanelState } from "@/components/panels";

export function HealthScoreWidget({ widget, analytics }: WidgetProps) {
  const status = analytics.health.data?.status;

  return (
    <PanelFrame
      panelId={widget.id}
      title={widget.title}
      description={widget.description}
      actions={
        status ? (
          <span
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium",
              STATUS_CLASSES[status],
            )}
          >
            {STATUS_LABELS[status]}
          </span>
        ) : null
      }
    >
      <PanelState query={analytics.health} loadingRows={4}>
        {(data) => (
          <div className="space-y-5">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-4xl font-semibold tracking-tight">
                {Math.round(data.score)}
              </span>
              <span className="text-sm text-muted-foreground">/ 100</span>
            </div>
            <div className="space-y-3">
              {data.dimensions.map((dimension) => (
                <DimensionRow key={dimension.id} dimension={dimension} />
              ))}
            </div>
          </div>
        )}
      </PanelState>
    </PanelFrame>
  );
}

function DimensionRow({ dimension }: { dimension: HealthDimension }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="truncate">{dimension.label}</span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">
            peso {Math.round(dimension.weight * 100)}%
          </span>
          <span className="font-mono text-xs">
            {Math.round(dimension.score)}
          </span>
        </span>
      </div>
      <Progress value={dimension.score} aria-label={dimension.label} />
      {dimension.drivers.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {dimension.drivers.join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
