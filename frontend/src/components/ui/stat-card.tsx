"use client";

import type { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Trend = "up" | "down" | "neutral";

export function StatCard({
  label,
  value,
  hint,
  trend = "neutral",
  delta,
  icon,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: Trend;
  delta?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("glass-panel gap-0 py-5", className)}>
      <CardContent className="space-y-3 px-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        </div>
        <p className="font-display text-3xl font-semibold tracking-tight">{value}</p>
        <div className="flex items-center gap-2 text-xs">
          {delta ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5",
                trend === "up" && "bg-success/15 text-success",
                trend === "down" && "bg-destructive/15 text-destructive",
                trend === "neutral" && "bg-surface-strong text-muted-foreground",
              )}
            >
              {trend === "up" ? <TrendingUp className="size-3" /> : null}
              {trend === "down" ? <TrendingDown className="size-3" /> : null}
              {delta}
            </span>
          ) : null}
          {hint ? <span className="text-muted-foreground">{hint}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}

/** Compact KPI tile — denser variant of StatCard for grids and widgets. */
export function KpiCard({
  label,
  value,
  progress,
  className,
}: {
  label: string;
  value: string;
  progress?: number;
  className?: string;
}) {
  return (
    <div className={cn("glass rounded-xl p-4", className)}>
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="font-display mt-2 text-2xl font-semibold">{value}</p>
      {typeof progress === "number" ? (
        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-strong"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        >
          <div className="bg-gradient-orbit h-full rounded-full" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
    </div>
  );
}
