"use client";

import { CalendarClock, MapPin, Wrench, Users, Flag, ListChecks } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollablePanel } from "@/components/layout/page-primitives";
import type { AgendaEvent } from "@/data/dashboard";

const typeMeta = {
  task: { icon: ListChecks, label: "Tarefa" },
  meeting: { icon: Users, label: "Reunião" },
  deadline: { icon: Flag, label: "Prazo" },
  maintenance: { icon: Wrench, label: "Manutenção" },
} as const;

export function UpcomingEventsPanel({ events }: { events: AgendaEvent[] }) {
  return (
    <Card className="glass-panel h-full">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-4 text-primary" />
            Próximos eventos
          </CardTitle>
          <CardDescription>Agenda das próximas 72 horas</CardDescription>
        </div>
        <Badge variant="secondary">{events.length}</Badge>
      </CardHeader>
      <CardContent>
        <ScrollablePanel maxHeight="20rem" className="pr-1">
          <ul className="space-y-2">
            {events.map((event) => {
              const meta = typeMeta[event.type];
              const Icon = meta.icon;
              return (
                <li
                  key={event.id}
                  className="flex items-start gap-3 rounded-xl border border-border/60 bg-surface/60 p-3 transition-colors hover:border-primary/40"
                >
                  <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-surface-strong px-2 py-1.5">
                    <span className="font-mono text-sm font-semibold">{event.timeLabel}</span>
                    <span className="text-[10px] text-muted-foreground">{event.dayLabel}</span>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-sm font-medium">{event.title}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Icon className="size-3" />
                        {meta.label}
                      </span>
                      <span>{event.owner.name}</span>
                      {event.location ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" />
                          {event.location}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollablePanel>
      </CardContent>
    </Card>
  );
}
