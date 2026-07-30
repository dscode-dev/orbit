"use client";

import { History } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Timeline, type TimelineEntry } from "@/components/ui/timeline";
import { ScrollablePanel } from "@/components/layout/page-primitives";
import type { ActivityItem } from "@/data/dashboard";

export function RecentActivityPanel({ activities }: { activities: ActivityItem[] }) {
  const items: TimelineEntry[] = activities.map((activity) => ({
    title: `${activity.actor.name} ${activity.action} ${activity.target}`,
    timestamp: activity.timeLabel,
    tone: activity.tone,
  }));

  return (
    <Card className="glass-panel h-full">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="size-4 text-primary" />
          Atividades recentes
        </CardTitle>
        <CardDescription>Últimos registros do fluxo operacional</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollablePanel maxHeight="20rem" className="pr-1">
          <Timeline items={items} className="pl-6" />
        </ScrollablePanel>
      </CardContent>
    </Card>
  );
}
