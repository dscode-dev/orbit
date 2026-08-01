"use client";

/**
 * Sinalização de procedência dos indicadores.
 *
 * O backend classifica cada KPI em `dataQuality` (`AnalyticsKpi`):
 *
 * | Valor      | Significado                                          | Sinalização |
 * | ---------- | ---------------------------------------------------- | ----------- |
 * | `OBSERVED` | contado direto dos fatos do banco                    | nenhuma     |
 * | `DERIVED`  | calculado a partir de fatos observados               | nenhuma     |
 * | `PROXY`    | aproximação por outra entidade (ex.: clientes ativos como contratos) | discreta |
 * | `MOCK`     | valor não observado                                  | explícita   |
 *
 * `OBSERVED` e `DERIVED` são informações legítimas e não recebem marca visual
 * — poluiriam o painel. `PROXY` ganha uma marca discreta porque muda a
 * interpretação do número. `MOCK` recebe marca explícita: nunca pode parecer
 * observação real.
 *
 * A origem exata (`source`, ex.: `operation_users`) aparece no tooltip de
 * todos, para quem quiser auditar.
 */
import { CircleDashed, FlaskConical } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DataQuality } from "@/types/dashboard";

const DESCRIPTIONS: Readonly<Record<DataQuality, string>> = {
  OBSERVED: "Contagem direta dos registros da organização.",
  DERIVED: "Calculado pelo backend a partir de registros observados.",
  PROXY:
    "Aproximação: o backend usa outra entidade como substituta enquanto a fonte definitiva não existe.",
  MOCK: "Valor não observado — não representa dados reais da sua operação.",
};

const LABELS: Readonly<Record<DataQuality, string>> = {
  OBSERVED: "Observado",
  DERIVED: "Derivado",
  PROXY: "Proxy",
  MOCK: "Não observado",
};

/** `true` quando a procedência precisa aparecer na interface. */
export function needsProvenanceMark(quality: DataQuality): boolean {
  return quality === "PROXY" || quality === "MOCK";
}

export function ProvenanceMark({
  quality,
  source,
  className,
}: {
  quality: DataQuality;
  /** Origem técnica declarada pelo backend (`AnalyticsKpi.source`). */
  source?: string;
  className?: string;
}) {
  if (!needsProvenanceMark(quality)) return null;
  const Icon = quality === "MOCK" ? FlaskConical : CircleDashed;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
            quality === "MOCK"
              ? "bg-warning/15 text-warning"
              : "bg-surface-strong text-muted-foreground",
            className,
          )}
        >
          <Icon className="size-3" aria-hidden />
          {LABELS[quality]}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p>{DESCRIPTIONS[quality]}</p>
        {source ? (
          <p className="mt-1 font-mono text-[11px] opacity-80">
            fonte: {source}
          </p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Aviso de Read Model inteiro não observado.
 *
 * Usado onde o próprio contrato declara a procedência do bloco — o clima
 * (`source: 'MOCK'`) e o impacto ambiental (`source: 'MOCK_DERIVED'`).
 */
export function SimulatedSourceNotice({
  source,
  className,
}: {
  source: "MOCK" | "MOCK_DERIVED";
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 border-warning/40 text-warning", className)}
    >
      <FlaskConical className="size-3" aria-hidden />
      {source === "MOCK"
        ? "Fonte simulada pelo backend"
        : "Derivado de fonte simulada"}
    </Badge>
  );
}
