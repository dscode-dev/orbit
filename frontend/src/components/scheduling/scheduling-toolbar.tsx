"use client";

/**
 * Barra de período e visão.
 *
 * A navegação anda em unidades do calendário local — mês a mês, semana a
 * semana — e o fuso em uso fica declarado ao lado do período. Em um produto de
 * campo, "que fuso é este horário?" é pergunta legítima, e a resposta não pode
 * depender de onde está a máquina que abriu a tela.
 */
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { zoneAbbreviation, type SchedulingView } from "@/lib/scheduling";

const VIEW_LABELS: Readonly<Record<SchedulingView, string>> = {
  DAY: "Dia",
  WEEK: "Semana",
  MONTH: "Mês",
  LIST: "Lista",
};

const VIEWS: readonly SchedulingView[] = ["DAY", "WEEK", "MONTH", "LIST"];

export function SchedulingToolbar({
  view,
  periodLabel,
  timeZone,
  timeZoneOrigin,
  canManage,
  onViewChange,
  onShift,
  onToday,
  onCreate,
}: {
  view: SchedulingView;
  periodLabel: string;
  timeZone: string;
  /** De onde saiu o fuso — unidade, organização ou navegador. */
  timeZoneOrigin: string;
  canManage: boolean;
  onViewChange: (view: SchedulingView) => void;
  onShift: (direction: 1 | -1) => void;
  onToday: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onShift(-1)}
          aria-label="Período anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={onToday}>
          Hoje
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onShift(1)}
          aria-label="Próximo período"
        >
          <ChevronRight className="size-4" />
        </Button>

        <div className="ml-2 min-w-0">
          <p className="truncate text-sm font-medium">{periodLabel}</p>
          <p
            className="text-xs text-muted-foreground"
            title={`Fuso ${timeZone} (${timeZoneOrigin})`}
          >
            {timeZone} · {zoneAbbreviation(timeZone)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex overflow-hidden rounded-md border border-border"
          role="group"
          aria-label="Visão da agenda"
        >
          {VIEWS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onViewChange(option)}
              aria-pressed={view === option}
              className={cn(
                "px-3 py-1.5 text-sm transition-colors",
                view === option
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-surface-strong",
              )}
            >
              {VIEW_LABELS[option]}
            </button>
          ))}
        </div>

        {canManage ? (
          <Button size="sm" onClick={onCreate}>
            <Plus className="size-4" />
            Novo evento
          </Button>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" aria-hidden />
            Somente leitura
          </span>
        )}
      </div>
    </div>
  );
}
