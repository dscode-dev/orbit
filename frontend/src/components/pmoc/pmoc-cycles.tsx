"use client";

/**
 * Os ciclos de um plano, e as execuções por equipamento de cada ciclo.
 *
 * ## Ciclo não é ordem de serviço
 *
 * Um ciclo é uma **competência**: a janela com vencimento em que a manutenção
 * daquele período deve acontecer. Não tem status de OS, não tem responsável
 * único, e **não gera documento** — quem gera é cada equipamento executado.
 *
 * ## O progresso vem do que o servidor devolve
 *
 * "3 de 8 concluídos" é contado sobre a lista de execuções que o backend
 * publica para o ciclo — uma consulta, não uma por equipamento. O ciclo não
 * publica um campo de progresso, e inventar um exigiria carregar tudo de
 * qualquer forma; contar o que já está em mãos é honesto e não custa
 * requisição nenhuma.
 */
import { useState } from "react";
import { CalendarClock, Package } from "lucide-react";

import {
  CycleStatusBadge,
  DocumentStatusBadge,
  ExecutionStatusBadge,
} from "@/components/pmoc/pmoc-presentation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  usePmocCycles,
  usePmocEquipmentExecutions,
  usePmocExecutionPreparation,
} from "@/hooks/pmoc/use-pmoc";
import { formatDate, formatDateTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { executionBlockedLabel, knownBlockedReason } from "@/registry";
import type { PmocCycle, PmocCycleEquipmentRow } from "@/types/pmoc";
import { ListState } from "@/workspace";

export function PmocCyclesPanel({ planId }: { planId: string }) {
  const cycles = usePmocCycles(planId);
  const [selected, setSelected] = useState<string | null>(null);

  const current = selected ?? cycles.data?.[0]?.id ?? null;

  return (
    <div className="space-y-4">
      <ListState
        isPending={cycles.isPending}
        error={cycles.error}
        onRetry={() => void cycles.refetch()}
        items={cycles.data ?? []}
        empty={{
          icon: <CalendarClock className="size-5" />,
          title: "Nenhum ciclo disponível",
          description:
            "Ciclos são gerados quando o plano é ativado, seguindo a periodicidade contratada.",
        }}
      >
        {(rows) => (
          <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
            <CycleList
              cycles={rows}
              selectedId={current}
              onSelect={setSelected}
            />
            {current ? (
              <EquipmentExecutions planId={planId} cycleId={current} />
            ) : null}
          </div>
        )}
      </ListState>
    </div>
  );
}

function CycleList({
  cycles,
  selectedId,
  onSelect,
}: {
  cycles: readonly PmocCycle[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="space-y-2" aria-label="Ciclos do plano">
      {cycles.map((cycle) => (
        <li key={cycle.id}>
          <button
            type="button"
            onClick={() => onSelect(cycle.id)}
            aria-current={cycle.id === selectedId ? "true" : undefined}
            className={cn(
              "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
              cycle.id === selectedId
                ? "border-primary/40 bg-primary/5"
                : "border-border hover:bg-surface-strong",
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">
                Ciclo {cycle.sequenceNumber}
              </span>
              <CycleStatusBadge status={cycle.status} />
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {/** `dueOn` é data civil — exibida como o servidor a resolveu. */}
              Vencimento {formatDate(cycle.dueOn)}
            </span>
            {cycle.performedAt ? (
              <span className="block text-xs text-muted-foreground">
                Cumprido em {formatDate(cycle.performedAt)}
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

function EquipmentExecutions({
  planId,
  cycleId,
}: {
  planId: string;
  cycleId: string;
}) {
  const rows = usePmocEquipmentExecutions(planId, cycleId);
  const items = rows.data ?? [];
  const done = items.filter((row) => row.status === "COMPLETED").length;

  return (
    <section className="space-y-3" aria-label="Execuções por equipamento">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Execuções por equipamento</h3>
        {items.length > 0 ? (
          <p className="text-xs tabular-nums text-muted-foreground">
            {done} de {items.length} equipamentos concluídos
          </p>
        ) : null}
      </div>

      <ListState
        isPending={rows.isPending}
        error={rows.error}
        onRetry={() => void rows.refetch()}
        items={items}
        empty={{
          icon: <Package className="size-5" />,
          title: "Nenhum equipamento neste ciclo",
          description:
            "O ciclo abrange os equipamentos cobertos pelo plano no momento em que foi aberto.",
        }}
      >
        {(equipment) => (
          <ul className="space-y-3">
            {equipment.map((row) => (
              <EquipmentRow
                key={row.coverageId}
                planId={planId}
                cycleId={cycleId}
                row={row}
              />
            ))}
          </ul>
        )}
      </ListState>
    </section>
  );
}

/**
 * Um equipamento do ciclo — executado ou não.
 *
 * Quando há execução, mostra quem fez, quando, com quantas evidências e qual
 * documento. Quando não há, consulta a **preparação** e mostra o que o
 * servidor respondeu: pronto para execução, ou o motivo do bloqueio.
 */
function EquipmentRow({
  planId,
  cycleId,
  row,
}: {
  planId: string;
  cycleId: string;
  row: PmocCycleEquipmentRow;
}) {
  const pending = row.execution === null;
  const preparation = usePmocExecutionPreparation(
    planId,
    pending ? cycleId : null,
    pending ? row.equipment.id : null,
  );
  const eligibility = preparation.data?.eligibility;

  return (
    <li className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{row.equipment.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.equipment.identifier ??
              row.equipment.serialNumber ??
              row.equipment.category}
          </p>
        </div>
        {row.status === "NOT_STARTED" ? (
          <span className="text-xs text-muted-foreground">Não iniciada</span>
        ) : (
          <ExecutionStatusBadge status={row.status} />
        )}
      </div>

      {row.execution ? (
        <>
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <p className="min-w-0 truncate">
              <span className="text-muted-foreground">Técnico em Campo: </span>
              {row.execution.responsibleFieldTechnician.displayName}
            </p>
            {row.execution.auxiliaryTechnicians.length > 0 ? (
              <p className="min-w-0 truncate">
                <span className="text-muted-foreground">
                  auxiliares técnico:{" "}
                </span>
                {row.execution.auxiliaryTechnicians
                  .map((person) => person.displayName)
                  .join(", ")}
              </p>
            ) : null}
            {row.execution.performedAt ? (
              <p>
                <span className="text-muted-foreground">Executado em: </span>
                {formatDateTime(row.execution.performedAt)}
              </p>
            ) : null}
          </div>

          <Separator />

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            {/**
             * As evidências vêm dentro da execução deste equipamento — são
             * coleções distintas por linha, então não há como as fotos de uma
             * máquina aparecerem na outra.
             */}
            <span className="text-muted-foreground">
              {row.execution.evidence.length === 0
                ? "Nenhuma evidência registrada"
                : `${row.execution.evidence.length} evidência(s)`}
            </span>

            {/**
             * O documento é **deste** equipamento. Cada máquina executada tem
             * o próprio PMOC; não existe um PDF único do ciclo.
             */}
            {row.execution.artifactExecution ? (
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground">Documento:</span>
                <DocumentStatusBadge
                  status={row.execution.artifactExecution.status}
                />
                <Button asChild variant="ghost" size="sm">
                  <a href={`/execucoes/${row.execution.artifactExecution.id}`}>
                    Abrir
                  </a>
                </Button>
              </span>
            ) : (
              <span className="text-muted-foreground">
                Documento ainda não emitido
              </span>
            )}
          </div>
        </>
      ) : (
        <div className="text-xs">
          {preparation.isPending ? (
            <span className="text-muted-foreground">
              Verificando disponibilidade…
            </span>
          ) : eligibility?.ready ? (
            <span className="text-muted-foreground">
              Pronto para execução em campo.
            </span>
          ) : (
            <ul className="space-y-0.5">
              {(eligibility?.blockedReasons ?? []).map((reason) => (
                <li key={reason} className="text-amber-400">
                  {executionBlockedLabel(reason, knownBlockedReason)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
