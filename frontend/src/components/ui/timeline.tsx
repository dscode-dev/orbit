"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TimelineEntry = {
  title: string;
  description?: string;
  timestamp: string;
  icon?: ReactNode;
  tone?: "default" | "success" | "warning" | "destructive";
};

export function Timeline({ items, className }: { items: TimelineEntry[]; className?: string }) {
  return (
    <ol className={cn("relative space-y-6 border-l border-border pl-6", className)}>
      {items.map((item) => (
        <li key={`${item.title}-${item.timestamp}`} className="relative">
          <span
            aria-hidden
            className={cn(
              "absolute top-1 -left-[1.9rem] flex size-4 items-center justify-center rounded-full ring-4 ring-background",
              item.tone === "success" && "bg-success",
              item.tone === "warning" && "bg-warning",
              item.tone === "destructive" && "bg-destructive",
              (!item.tone || item.tone === "default") && "bg-gradient-orbit",
            )}
          />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{item.title}</p>
              <time className="font-mono text-xs text-muted-foreground">{item.timestamp}</time>
            </div>
            {item.description ? (
              <p className="text-sm text-muted-foreground">{item.description}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
