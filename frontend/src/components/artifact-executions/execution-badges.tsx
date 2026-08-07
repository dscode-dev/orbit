"use client";

/**
 * Leitura visual dos literais de execução.
 *
 * Um só lugar para status, renderização e severidade de insight. Valores
 * desconhecidos aparecem crus em vez de virarem um rótulo genérico — se o
 * backend publicar um estado novo, ele precisa ser visto.
 */
import { Progress } from "@/components/ui/progress";
import { resolveRenderStatus } from "@/documents";
import { cn } from "@/lib/utils";

/** Exportado para o Entity Registry referenciar — nunca copiar. */
export const ARTIFACT_EXECUTION_STATUS_LABELS: Readonly<
  Record<string, string>
> = {
  DRAFT: "Rascunho",
  IN_PROGRESS: "Em execução",
  PAUSED: "Pausada",
  UNDER_REVIEW: "Em revisão",
  APPROVED: "Aprovada",
  COMPLETED: "Concluída",
  ARCHIVED: "Arquivada",
};

const STATUS_CLASSES: Readonly<Record<string, string>> = {
  DRAFT: "bg-surface-strong text-muted-foreground",
  IN_PROGRESS: "bg-primary/15 text-primary",
  PAUSED: "bg-amber-500/15 text-amber-400",
  UNDER_REVIEW: "bg-violet-500/15 text-violet-400",
  APPROVED: "bg-sky-500/15 text-sky-400",
  COMPLETED: "bg-emerald-500/15 text-emerald-400",
  ARCHIVED: "bg-surface-strong text-muted-foreground",
};

export function executionStatusLabel(status: string): string {
  return ARTIFACT_EXECUTION_STATUS_LABELS[status] ?? status;
}

export function ExecutionStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium",
        STATUS_CLASSES[status] ?? "bg-surface-strong text-muted-foreground",
        className,
      )}
    >
      {executionStatusLabel(status)}
    </span>
  );
}

/**
 * Estado de renderização — delegado ao Document Registry.
 *
 * O mapa de rótulos e cores vivia aqui desde a PR-06, quando não havia motor
 * de renderização nem central documental. Agora o **Document Registry** é a
 * fonte única: manter uma segunda cópia faria a mesma informação divergir
 * entre a execução e a central.
 *
 * Os dois nomes continuam exportados para os componentes existentes não
 * mudarem de import.
 */
export function renderStatusLabel(status: string): string {
  return resolveRenderStatus(status).label;
}

export { RenderStatusBadge } from "@/documents";

/**
 * Progresso — sempre o número que o backend calculou.
 *
 * `ArtifactExecutionProgressCalculator` conta campos visíveis, obrigatórios e
 * assinaturas exigidas. Recalcular no cliente daria outro número na primeira
 * regra que mudasse no servidor.
 */
export function ExecutionProgress({
  percentage,
  className,
  showLabel = true,
}: {
  percentage: number;
  className?: string;
  showLabel?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Progress value={percentage} className="h-1.5 min-w-16 flex-1" />
      {showLabel ? (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {percentage}%
        </span>
      ) : null}
    </div>
  );
}

const SEVERITY_CLASSES: Readonly<Record<string, string>> = {
  CRITICAL: "bg-destructive/15 text-destructive",
  HIGH: "bg-destructive/15 text-destructive",
  ERROR: "bg-destructive/15 text-destructive",
  WARNING: "bg-amber-500/15 text-amber-400",
  MEDIUM: "bg-amber-500/15 text-amber-400",
  LOW: "bg-sky-500/15 text-sky-400",
  INFO: "bg-surface-strong text-muted-foreground",
};

/**
 * Severidade do insight.
 *
 * `severity` é `varchar` livre no banco, sem `CHECK` — a lista acima cobre as
 * convenções vistas e qualquer outro valor aparece cru, sem virar "info".
 */
export function InsightSeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[10px] font-medium uppercase",
        SEVERITY_CLASSES[severity] ?? "bg-surface-strong text-muted-foreground",
      )}
    >
      {severity}
    </span>
  );
}
