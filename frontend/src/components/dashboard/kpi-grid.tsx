"use client";

import { Activity, CheckCircle2, CircleDot, Clock } from "lucide-react";
import { motion } from "motion/react";

import { StatCard } from "@/components/ui/stat-card";
import type { KpiMetric } from "@/data/dashboard";

const icons = {
  operations_open: CircleDot,
  operations_in_progress: Activity,
  operations_done_today: CheckCircle2,
  operations_pending: Clock,
} as const;

const numberFormat = new Intl.NumberFormat("pt-BR");

export function KpiGrid({ metrics }: { metrics: KpiMetric[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric, index) => {
        const Icon = icons[metric.id];
        const sign = metric.deltaPercent > 0 ? "+" : "";
        return (
          <motion.div
            key={metric.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
          >
            <StatCard
              label={metric.label}
              value={numberFormat.format(metric.value)}
              trend={metric.trend}
              delta={
                metric.deltaPercent === 0
                  ? "0%"
                  : `${sign}${metric.deltaPercent.toFixed(1).replace(".", ",")}%`
              }
              hint={metric.hint}
              icon={<Icon className="size-4" />}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
