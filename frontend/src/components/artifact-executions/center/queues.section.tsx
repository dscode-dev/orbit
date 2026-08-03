"use client";

/**
 * Filas do Execution Center.
 *
 * Cada cartão é um status publicado por `ARTIFACT_EXECUTION_STATUSES` com a
 * contagem que o backend devolveu para ele. Clicar abre a fila na aba de
 * listagem, que consulta o servidor com aquele `status`.
 *
 * ## Cancelada não existe
 *
 * O contrato tem `DRAFT`, `IN_PROGRESS`, `PAUSED`, `UNDER_REVIEW`, `APPROVED`,
 * `COMPLETED` e `ARCHIVED`. **Não há `CANCELLED`** — e `ARCHIVED` significa
 * arquivada, que é outra coisa. Uma fila de canceladas aqui seria uma
 * categoria que nenhum outro cliente reconhece; a ausência está declarada.
 */
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  EXECUTION_QUEUES,
  type ExecutionCounts,
  type ExecutionQueue,
} from "@/hooks/artifact-executions/use-execution-center";
import { cn } from "@/lib/utils";
import { executionStatusLabel } from "../execution-badges";

/** Leitura visual da fila — cor sobre tokens existentes do Design System. */
const QUEUE_TONE: Readonly<Record<ExecutionQueue, string>> = {
  IN_PROGRESS: "border-primary/40 bg-primary/5",
  UNDER_REVIEW: "border-amber-500/40 bg-amber-500/5",
  PAUSED: "border-amber-500/30 bg-surface-strong/40",
  DRAFT: "border-border",
  COMPLETED: "border-emerald-500/40 bg-emerald-500/5",
  APPROVED: "border-emerald-500/30",
  ARCHIVED: "border-border",
};

export function ExecutionQueues({
  counts,
  onOpenQueues,
}: {
  counts: ExecutionCounts;
  onOpenQueues: () => void;
}) {
  return (
    <div className="glass-panel space-y-4 rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">Filas por situação</h2>
          <p className="text-xs text-muted-foreground">
            Cada fila é uma consulta filtrada no servidor.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onOpenQueues}>
          Abrir listagem
          <ArrowRight className="size-4" />
        </Button>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {EXECUTION_QUEUES.map((queue) => (
          <li key={queue}>
            <button
              type="button"
              onClick={onOpenQueues}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-surface-strong",
                QUEUE_TONE[queue],
              )}
            >
              <span className="text-sm">{executionStatusLabel(queue)}</span>
              <span className="font-display text-lg font-bold tabular-nums">
                {counts.byQueue[queue]}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">
        Não há fila de canceladas: o contrato de execução não publica esse
        status. Arquivada é outra coisa e tem fila própria.
      </p>
    </div>
  );
}
