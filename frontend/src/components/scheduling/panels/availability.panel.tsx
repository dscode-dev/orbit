"use client";

/**
 * Disponibilidade dos operadores.
 *
 * As regras vêm de `GET /scheduling/availability` e são de dois tipos:
 * `AVAILABLE` (janela em que o recurso atende) e `BLOCKED` (janela em que não
 * atende). O backend usa exatamente estas regras para produzir os conflitos
 * `OUTSIDE_AVAILABILITY` e `BLOCKED_AVAILABILITY` — o painel mostra a fonte, e
 * não uma segunda leitura dela.
 *
 * Os minutos são **locais ao fuso da regra** (`startMinute` conta a partir da
 * meia-noite em `rule.timezone`), então são apresentados como hora de parede
 * daquele fuso, não convertidos para o fuso da visão: converter faria uma
 * regra semanal "das 8h às 17h" virar "das 7h às 16h" e deixaria de descrever
 * o que foi configurado.
 */
import { CalendarCheck2, CalendarX2, Trash2 } from "lucide-react";

import { PanelFrame, PanelState, toPanelQuery } from "@/components/panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRemoveSchedulingAvailability } from "@/hooks/scheduling/use-scheduling";
import type { useSchedulingAvailability } from "@/hooks/scheduling/use-scheduling";
import { formatZonedDate } from "@/lib/scheduling";
import { cn } from "@/lib/utils";
import type { SchedulingAvailability } from "@/types/scheduling";

const WEEKDAYS = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];

export function AvailabilityPanel({
  query,
  canManage,
}: {
  query: ReturnType<typeof useSchedulingAvailability>;
  canManage: boolean;
}) {
  const remove = useRemoveSchedulingAvailability();

  return (
    <PanelFrame
      panelId="scheduling-availability"
      title="Disponibilidade"
      description="Janelas de atendimento e bloqueios"
    >
      <PanelState
        query={toPanelQuery(query)}
        loadingRows={3}
        isEmpty={(data) => data.length === 0}
        emptyMessage="Nenhuma regra de disponibilidade cadastrada."
      >
        {(rules) => (
          <ul className="space-y-2">
            {rules.map((rule) => (
              <li
                key={rule.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2"
              >
                {rule.kind === "BLOCKED" ? (
                  <CalendarX2
                    className="size-4 shrink-0 text-destructive"
                    aria-hidden
                  />
                ) : (
                  <CalendarCheck2
                    className="size-4 shrink-0 text-emerald-400"
                    aria-hidden
                  />
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-sm">{describeRule(rule)}</p>
                  <p className="text-xs text-muted-foreground">
                    {minuteLabel(rule.startMinute)} –{" "}
                    {minuteLabel(rule.endMinute)} ({rule.timezone})
                    {rule.reason ? ` · ${rule.reason}` : ""}
                  </p>
                </div>

                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    rule.kind === "BLOCKED" && "text-destructive",
                  )}
                >
                  {rule.kind === "BLOCKED" ? "Bloqueio" : "Disponível"}
                </Badge>

                {canManage ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(rule.id)}
                    aria-label="Remover regra"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </PanelState>
    </PanelFrame>
  );
}

function describeRule(rule: SchedulingAvailability): string {
  const scope =
    rule.resourceType === "USER"
      ? `Operador ${rule.userId?.slice(0, 8) ?? "—"}`
      : rule.resourceType === "ASSET"
        ? "Ativo"
        : (rule.resourceKey ?? "Recurso");

  if (rule.date) {
    return `${scope} · ${formatZonedDate(rule.date, rule.timezone)}`;
  }
  if (rule.dayOfWeek !== null) {
    return `${scope} · toda ${WEEKDAYS[rule.dayOfWeek] ?? rule.dayOfWeek}`;
  }
  return scope;
}

/** Minuto do dia → hora de parede, no fuso da própria regra. */
function minuteLabel(minute: number): string {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
