"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartWrapper } from "@/components/charts/chart-wrapper";
import type { OperationsEvolutionPoint } from "@/data/dashboard";

const axisProps = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: "0.75rem",
  color: "var(--color-popover-foreground)",
  fontSize: "12px",
} as const;

export function OperationsEvolutionChart({ data }: { data: OperationsEvolutionPoint[] }) {
  return (
    <ChartWrapper
      title="Evolução das operações"
      description="Criadas, concluídas e backlog acumulado no período"
      height={300}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="orbitCreated" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="orbitCompleted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-chart-3)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-chart-3)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis {...axisProps} width={44} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "var(--color-border)" }} />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 12, color: "var(--color-muted-foreground)" }}
          />
          <Area
            type="monotone"
            dataKey="created"
            name="Criadas"
            stroke="var(--color-chart-1)"
            fill="url(#orbitCreated)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="completed"
            name="Concluídas"
            stroke="var(--color-chart-3)"
            fill="url(#orbitCompleted)"
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="backlog"
            name="Backlog"
            stroke="var(--color-chart-4)"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
