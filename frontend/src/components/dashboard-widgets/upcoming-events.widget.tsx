"use client";

/**
 * Próximos eventos — `GET /scheduling/agenda`.
 *
 * O Read Model `upcoming-events` do `/dashboard` é fixture, mas o módulo de
 * scheduling expõe a agenda real (eventos e ocorrências do banco). O widget
 * consome essa fonte.
 *
 * Exige `scheduling.read` (capability e permissão). Sem acesso, o backend
 * responde 403 e o `WidgetError` mostra o estado de acesso negado — sem
 * quebrar o painel.
 */
import { CalendarClock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Timeline } from "@/components/ui/timeline";
import type { SchedulingOccurrenceReadModel } from "@/types/dashboard";
import { formatDateTime } from "./format";
import type { WidgetProps } from "./widget-registry";
import { WidgetFrame, WidgetState } from "./widget-frame";

/** Quantos eventos futuros exibir. */
const MAX_EVENTS = 8;

const PRIORITY_TONE: Readonly<
  Record<string, "default" | "success" | "warning" | "destructive">
> = {
  LOW: "default",
  NORMAL: "default",
  MEDIUM: "default",
  HIGH: "warning",
  CRITICAL: "destructive",
};

export function UpcomingEventsWidget({ widget, scheduling }: WidgetProps) {
  const total = scheduling.agenda.data?.summary.total;

  return (
    <WidgetFrame
      widgetId={widget.id}
      title={widget.title}
      description={widget.description}
      actions={
        total === undefined ? null : (
          <Badge variant="secondary">
            <CalendarClock className="size-3" aria-hidden />
            {total}
          </Badge>
        )
      }
    >
      <WidgetState
        query={scheduling.agenda}
        loadingRows={4}
        emptyMessage="Nenhum evento agendado para os próximos dias."
        isEmpty={(data) => selectUpcoming(data.days).length === 0}
      >
        {(data) => (
          <Timeline
            items={selectUpcoming(data.days).map((event) => ({
              title: event.title,
              timestamp: formatDateTime(event.startsAt),
              description: event.status,
              tone: PRIORITY_TONE[event.priority] ?? "default",
            }))}
          />
        )}
      </WidgetState>
    </WidgetFrame>
  );
}

/**
 * Achata os dias da agenda e mantém os próximos eventos.
 *
 * Ordenação e recorte — nenhum dado é derivado.
 */
function selectUpcoming(
  days: ReadonlyArray<{
    date: string;
    events: readonly SchedulingOccurrenceReadModel[];
  }>,
): readonly SchedulingOccurrenceReadModel[] {
  const now = Date.now();
  return days
    .flatMap((day) => day.events)
    .filter((event) => new Date(event.endsAt).getTime() >= now)
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
    .slice(0, MAX_EVENTS);
}
