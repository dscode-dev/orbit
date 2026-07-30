"use client";

import { useMemo, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { ContentContainer } from "@/components/layout/page-primitives";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { AttentionCenter } from "@/components/dashboard/attention-center";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { OperationsEvolutionChart } from "@/components/dashboard/operations-evolution-chart";
import { ProductivityChart } from "@/components/dashboard/productivity-chart";
import { StatusDonutChart } from "@/components/dashboard/status-donut-chart";
import { UpcomingEventsPanel } from "@/components/dashboard/upcoming-events-panel";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { RecentActivityPanel } from "@/components/dashboard/recent-activity-panel";
import { getDashboardData, type DashboardRange } from "@/data/dashboard";



export default function DashboardPage() {
  const [range, setRange] = useState<DashboardRange>("7d");
  const data = useMemo(() => getDashboardData(range), [range]);

  return (
    <AppShell activeLabel="Visão geral" breadcrumb={<span>Dashboard</span>}>
      <ContentContainer size="wide" className="space-y-8">
        <DashboardHeader summary={data.summary} range={range} onRangeChange={setRange} />

        <AttentionCenter items={data.attention} />

        <KpiGrid metrics={data.kpis} />

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <OperationsEvolutionChart data={data.operationsEvolution} />
          </div>
          <StatusDonutChart data={data.statusDistribution} />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <ProductivityChart data={data.productivity} />
          </div>
          <UpcomingEventsPanel events={data.events} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <AlertsPanel alerts={data.alerts} />
          <RecentActivityPanel activities={data.activities} />
        </div>
      </ContentContainer>
    </AppShell>
  );
}
