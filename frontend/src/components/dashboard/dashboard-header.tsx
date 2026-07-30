"use client";

import { Building2, CalendarRange, Download, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { rangeOptions, type DashboardRange, type DashboardSummary } from "@/data/dashboard";
import { cn } from "@/lib/utils";

function greeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function DashboardHeader({
  summary,
  range,
  onRangeChange,
}: {
  summary: DashboardSummary;
  range: DashboardRange;
  onRangeChange: (range: DashboardRange) => void;
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="size-3.5" />
            {summary.organization.name}
          </span>
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="size-3" />
            Plano {summary.organization.plan}
          </Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {greeting(new Date())}, {summary.user.firstName}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Visão consolidada das operações da organização no período selecionado.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Período"
          className="glass inline-flex items-center gap-1 rounded-xl border border-border/70 p-1"
        >
          <CalendarRange className="mx-1.5 size-4 text-muted-foreground" aria-hidden />
          {rangeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={range === option.value}
              onClick={() => onRangeChange(option.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                range === option.value
                  ? "bg-gradient-orbit text-primary-foreground shadow-soft"
                  : "text-muted-foreground hover:bg-surface-strong hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="size-4" />
          Exportar
        </Button>
      </div>
    </header>
  );
}
