"use client";

import { AlertTriangle, BellRing, CheckCircle2, Info, ShieldAlert } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollablePanel } from "@/components/layout/page-primitives";
import type { AlertItem, Severity } from "@/data/dashboard";
import { cn } from "@/lib/utils";

const severityMeta: Record<Severity, { icon: typeof Info; className: string; label: string }> = {
  critical: { icon: ShieldAlert, className: "bg-destructive/10 text-destructive", label: "Crítico" },
  warning: { icon: AlertTriangle, className: "bg-warning/15 text-warning", label: "Atenção" },
  info: { icon: Info, className: "bg-primary/10 text-primary", label: "Informativo" },
  success: { icon: CheckCircle2, className: "bg-success/15 text-success", label: "Resolvido" },
};

export function AlertsPanel({ alerts }: { alerts: AlertItem[] }) {
  const open = alerts.filter((alert) => !alert.acknowledged).length;

  return (
    <Card className="glass-panel h-full">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="size-4 text-primary" />
            Alertas
          </CardTitle>
          <CardDescription>Eventos que podem impactar a operação</CardDescription>
        </div>
        <Badge variant={open > 0 ? "destructive" : "secondary"}>{open} abertos</Badge>
      </CardHeader>
      <CardContent>
        <ScrollablePanel maxHeight="20rem" className="pr-1">
          <ul className="space-y-2">
            {alerts.map((alert) => {
              const meta = severityMeta[alert.severity];
              const Icon = meta.icon;
              return (
                <li
                  key={alert.id}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border border-border/60 bg-surface/60 p-3",
                    alert.acknowledged && "opacity-70",
                  )}
                >
                  <span className={cn("mt-0.5 rounded-lg p-1.5", meta.className)}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{alert.title}</p>
                      <time className="shrink-0 font-mono text-[11px] text-muted-foreground">
                        {alert.timeAgo}
                      </time>
                    </div>
                    <p className="text-xs text-muted-foreground">{alert.description}</p>
                    <span className="text-[11px] tracking-wide text-muted-foreground/80 uppercase">
                      {alert.source} · {meta.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollablePanel>
      </CardContent>
    </Card>
  );
}
