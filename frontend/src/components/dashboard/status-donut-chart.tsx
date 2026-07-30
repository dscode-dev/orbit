"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { ChartWrapper } from "@/components/charts/chart-wrapper";
import type { StatusSlice } from "@/data/dashboard";

const numberFormat = new Intl.NumberFormat("pt-BR");

export function StatusDonutChart({ data }: { data: StatusSlice[] }) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <ChartWrapper
      title="Distribuição por status"
      description="Participação de cada status no total de operações"
      height={300}
    >
      <div className="flex h-full flex-col gap-3">
        <div className="relative min-h-0 w-full flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "0.75rem",
                  color: "var(--color-popover-foreground)",
                  fontSize: "12px",
                }}
              />
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius="62%"
                outerRadius="92%"
                paddingAngle={2}
                stroke="var(--color-background)"
                strokeWidth={2}
              >
                {data.map((slice) => (
                  <Cell key={slice.status} fill={slice.colorToken} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-2xl font-semibold">
              {numberFormat.format(total)}
            </span>
            <span className="text-xs text-muted-foreground">operações</span>
          </div>
        </div>
        <ul className="w-full space-y-1.5">
          {data.map((slice) => (
            <li key={slice.status} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ background: slice.colorToken }}
              />
              <span className="flex-1 truncate text-muted-foreground">{slice.label}</span>
              <span className="font-mono text-xs">{numberFormat.format(slice.value)}</span>
              <span className="w-10 text-right font-mono text-xs text-muted-foreground">
                {Math.round((slice.value / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ChartWrapper>
  );
}
