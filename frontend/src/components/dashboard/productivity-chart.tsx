"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartWrapper } from "@/components/charts/chart-wrapper";
import type { ProductivityRow } from "@/data/dashboard";

const axisProps = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

export function ProductivityChart({ data }: { data: ProductivityRow[] }) {
  return (
    <ChartWrapper
      title="Produtividade por usuário"
      description="Operações concluídas e em execução por responsável"
      height={300}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
          <XAxis type="number" {...axisProps} />
          <YAxis type="category" dataKey="initials" width={40} {...axisProps} />
          <Tooltip
            cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
            contentStyle={{
              background: "var(--color-popover)",
              border: "1px solid var(--color-border)",
              borderRadius: "0.75rem",
              color: "var(--color-popover-foreground)",
              fontSize: "12px",
            }}
            labelFormatter={(value) => data.find((row) => row.initials === value)?.name ?? value}
          />
          <Bar
            dataKey="completed"
            name="Concluídas"
            stackId="ops"
            fill="var(--color-chart-1)"
            radius={[0, 0, 0, 0]}
            barSize={16}
          />
          <Bar
            dataKey="inProgress"
            name="Em execução"
            stackId="ops"
            fill="var(--color-chart-2)"
            radius={[0, 6, 6, 0]}
            barSize={16}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
