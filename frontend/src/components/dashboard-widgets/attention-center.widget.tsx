"use client";

/**
 * Attention Center — `GET /analytics/intelligence`.
 *
 * O Read Model `attention-center` do `/dashboard` é fixture. O que existe de
 * real com o mesmo propósito é o contexto de inteligência: `priorities` são
 * exatamente os indicadores que o backend classificou fora do saudável, e
 * `risks` reúne impactos ambientais e dimensões de saúde degradadas.
 *
 * A seleção do que "merece atenção" continua sendo do backend — o widget
 * apenas ordena por severidade e apresenta.
 */
import { AlertTriangle, CircleAlert, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AnalyticsStatus } from "@/types/dashboard";
import { STATUS_CLASSES, STATUS_LABELS } from "@/metrics";
import type { WidgetProps } from "./widget-registry";
import { PanelFrame, PanelState } from "@/components/panels";

/** Críticos primeiro. */
const SEVERITY_ORDER: Readonly<Record<AnalyticsStatus, number>> = {
  CRITICAL: 0,
  ATTENTION: 1,
  HEALTHY: 2,
};

export function AttentionCenterWidget({ widget, analytics }: WidgetProps) {
  const criticals =
    analytics.intelligence.data?.priorities.filter(
      (priority) => priority.status === "CRITICAL",
    ).length ?? 0;

  return (
    <PanelFrame
      panelId={widget.id}
      title={widget.title}
      description={widget.description}
      actions={
        analytics.intelligence.data ? (
          <Badge variant={criticals > 0 ? "destructive" : "secondary"}>
            {criticals > 0 ? `${criticals} críticos` : "Sem críticos"}
          </Badge>
        ) : null
      }
    >
      <PanelState query={analytics.intelligence} loadingRows={3}>
        {(data) => {
          const priorities = [...data.priorities].sort(
            (left, right) =>
              SEVERITY_ORDER[left.status] - SEVERITY_ORDER[right.status],
          );
          if (priorities.length === 0 && data.risks.length === 0) {
            return (
              <div className="flex min-h-24 flex-col items-center justify-center gap-2 text-center">
                <ShieldCheck className="size-5 text-success" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  Nenhum indicador fora do saudável no período.
                </p>
              </div>
            );
          }
          return (
            <div className="space-y-5">
              {priorities.length > 0 ? (
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {priorities.map((priority) => (
                    <li
                      key={priority.indicator}
                      className="glass space-y-2 rounded-xl p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                          {priority.indicator}
                        </span>
                        <CircleAlert
                          className={cn(
                            "size-4 shrink-0",
                            priority.status === "CRITICAL"
                              ? "text-destructive"
                              : "text-warning",
                          )}
                          aria-hidden
                        />
                      </div>
                      <p className="font-display text-2xl font-semibold">
                        {priority.value}
                      </p>
                      <span
                        className={cn(
                          "inline-block rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                          STATUS_CLASSES[priority.status],
                        )}
                      >
                        {STATUS_LABELS[priority.status]}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {data.risks.length > 0 ? (
                <ul className="space-y-2 border-t border-border pt-4">
                  {data.risks.map((risk) => (
                    <li key={risk} className="flex items-start gap-2 text-sm">
                      <AlertTriangle
                        className="mt-0.5 size-3.5 shrink-0 text-warning"
                        aria-hidden
                      />
                      <span className="text-muted-foreground">{risk}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        }}
      </PanelState>
    </PanelFrame>
  );
}
