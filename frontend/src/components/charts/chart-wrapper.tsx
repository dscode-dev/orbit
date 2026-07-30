"use client";

import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Wrapper that gives every chart the same frame, spacing and header.
 * Charts themselves (Recharts) are composed as children and must read
 * colors from the --color-chart-* tokens.
 */
export function ChartWrapper({
  title,
  description,
  actions,
  children,
  height = 260,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  height?: number;
  className?: string;
}) {
  return (
    <Card className={cn("glass-panel", className)}>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {actions}
      </CardHeader>
      <CardContent>
        <div style={{ height }} className="w-full">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
