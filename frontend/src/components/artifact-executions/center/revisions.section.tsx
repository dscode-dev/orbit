"use client";

/**
 * Área de revisão.
 *
 * Reúne o que está parado esperando alguém: **aguardando revisão** e
 * **pausadas**. Cada coluna é uma consulta filtrada por status no servidor —
 * a mesma listagem da aba de filas, embutida com o filtro fixo.
 *
 * ## Preparada para o Workflow Engine, sem implementá-lo
 *
 * Não existe motor de workflow: não há etapas, aprovadores, prazos de revisão
 * nem transições configuráveis no contrato. O que existe é
 * `PATCH /artifact-executions/:id/status`, que o backend valida.
 *
 * O que esta PR deixa pronto é a **fronteira**: a área é composta por filas
 * declaradas em `REVIEW_QUEUES`. Quando o motor existir e publicar etapas, a
 * lista de filas passa a vir dele — e nenhum componente desta pasta muda.
 * Nada de aprovação, delegação ou SLA é simulado aqui.
 */
import { ClipboardCheck, PauseCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ExecutionCounts } from "@/hooks/artifact-executions/use-execution-center";
import { REVIEW_QUEUES } from "@/hooks/artifact-executions/use-execution-center";
import { ExecutionsList } from "../executions-list";
import { executionStatusLabel } from "../execution-badges";

const QUEUE_ICONS = {
  UNDER_REVIEW: ClipboardCheck,
  PAUSED: PauseCircle,
} as const;

const QUEUE_HINTS: Readonly<Record<string, string>> = {
  UNDER_REVIEW:
    "Submetidas por quem executou e ainda não aprovadas. A aprovação acontece no Workspace da execução.",
  PAUSED:
    "Interrompidas antes da conclusão. Retomar depende da situação atual de cada uma.",
};

export function ExecutionRevisions({ counts }: { counts: ExecutionCounts }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Execuções que dependem de uma decisão. Nenhuma alteração acontece nesta
        tela — cada uma abre no Workspace, onde a mudança é registrada.
      </p>

      {REVIEW_QUEUES.map((queue) => {
        const Icon = QUEUE_ICONS[queue as keyof typeof QUEUE_ICONS];
        return (
          <section key={queue} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Icon className="size-4 text-amber-400" aria-hidden />
              <h2 className="text-sm font-medium">
                {executionStatusLabel(queue)}
              </h2>
              <Badge variant="secondary">{counts.byQueue[queue]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {QUEUE_HINTS[queue]}
            </p>
            <ExecutionsList initialQuery={{ status: queue }} />
          </section>
        );
      })}

      <p className="rounded-lg border border-border bg-surface-strong/40 px-3 py-2 text-xs text-muted-foreground">
        Não há Workflow Engine no backend: etapas, aprovadores, prazos e
        transições configuráveis não existem no contrato. Esta área acompanha o
        que o status já publica — quando o motor existir, as filas passam a vir
        dele.
      </p>
    </div>
  );
}
