"use client";

import { AlertTriangle, ArrowUpRight, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import { motion } from "motion/react";

import type { AttentionItem, Severity } from "@/data/dashboard";
import { cn } from "@/lib/utils";

const severityStyles: Record<
  Severity,
  { dot: string; chip: string; icon: typeof Info; ring: string }
> = {
  critical: {
    dot: "bg-destructive",
    chip: "bg-destructive/10 text-destructive",
    icon: ShieldAlert,
    ring: "hover:border-destructive/40",
  },
  warning: {
    dot: "bg-warning",
    chip: "bg-warning/15 text-warning",
    icon: AlertTriangle,
    ring: "hover:border-warning/40",
  },
  info: {
    dot: "bg-primary",
    chip: "bg-primary/10 text-primary",
    icon: Info,
    ring: "hover:border-primary/40",
  },
  success: {
    dot: "bg-success",
    chip: "bg-success/15 text-success",
    icon: CheckCircle2,
    ring: "hover:border-success/40",
  },
};

/** Painel horizontal de itens que exigem ação imediata. */
export function AttentionCenter({ items }: { items: AttentionItem[] }) {
  return (
    <section aria-label="Central de atenção" className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="bg-gradient-orbit size-2 rounded-full" aria-hidden />
        <h2 className="font-display text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Central de atenção
        </h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item, index) => {
          const style = severityStyles[item.severity];
          const Icon = style.icon;
          return (
            <motion.button
              key={item.id}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "glass group flex w-full items-start gap-3 rounded-xl border border-border/70 p-4 text-left transition-colors",
                style.ring,
              )}
            >
              <span className={cn("mt-1 size-2 shrink-0 rounded-full", style.dot)} aria-hidden />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-xl font-semibold">
                    {item.unit === "percent" ? `${item.value}%` : item.value}
                  </span>
                  <span className="truncate text-sm font-medium">{item.label}</span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                <span
                  className={cn(
                    "mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                    style.chip,
                  )}
                >
                  <Icon className="size-3" />
                  {item.actionLabel}
                  <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
