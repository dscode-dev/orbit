"use client";

/**
 * Listagem de execuções de artefato.
 *
 * **Agrupamento.** `ArtifactExecutionQueryDto` não aceita `groupBy` nem
 * ordenação — o backend ordena por `createdAt desc`. O único agrupamento que o
 * contrato suporta é por `status`, e ele é feito **no servidor**: cada aba é
 * uma consulta filtrada, não um recorte da página atual. Agrupar no cliente
 * daria grupos que só refletem os 20 registros carregados.
 *
 * **Vínculos.** A listagem devolve `operationId`, `customerId` e `assetId` —
 * identificadores, não nomes. Resolver cada um viraria N+1 por página, então a
 * coluna mostra quais vínculos existem e leva ao registro; os nomes aparecem
 * no Workspace, onde é uma leitura por vínculo.
 */
import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Boxes, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useArtifactExecutionsList } from "@/hooks/artifact-executions/use-artifact-executions";
import { formatDateTime } from "@/lib/formatters";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useActiveScope } from "@/providers/use-active-scope";
import { useSession } from "@/providers/session-provider";
import {
  ListState,
  Pagination,
  ResultSummary,
  SearchField,
  useListController,
} from "@/workspace";
import {
  ARTIFACT_EXECUTION_STATUSES,
  type ArtifactExecutionListItem,
  type ArtifactExecutionQuery,
} from "@/types/artifact-executions";
import {
  ExecutionProgress,
  ExecutionStatusBadge,
  executionStatusLabel,
  RenderStatusBadge,
} from "./execution-badges";

export function ExecutionsList({
  initialQuery,
}: {
  /** Permite embutir a lista já filtrada (por operação, cliente ou ativo). */
  initialQuery?: ArtifactExecutionQuery;
}) {
  const session = useSession();
  const { businessUnitId } = useActiveScope();
  const list = useListController<ArtifactExecutionQuery>({
    limit: 20,
    initial: initialQuery,
  });

  /** A unidade ativa é filtro real da consulta quando não há escolha explícita. */
  const scopedQuery = useMemo<ArtifactExecutionQuery>(
    () => ({
      ...list.query,
      businessUnitId: list.query.businessUnitId ?? businessUnitId ?? undefined,
    }),
    [list.query, businessUnitId],
  );

  const query = useArtifactExecutionsList(scopedQuery);
  const executions = query.data?.data ?? [];
  const meta = query.data?.meta;

  const mine = list.query.responsibleUserId === session.user?.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <SearchField
          id="executions-search"
          value={list.searchTerm}
          onChange={list.setSearchTerm}
          placeholder="Código ou título"
          className="min-w-64 flex-1"
        />

        {session.user ? (
          <Button
            variant={mine ? "default" : "outline"}
            onClick={() =>
              list.setFilter(
                "responsibleUserId",
                mine ? undefined : session.user?.id,
              )
            }
          >
            <UserRound className="size-4" />
            Sob minha responsabilidade
          </Button>
        ) : null}
      </div>

      <StatusTabs
        value={list.query.status}
        onChange={(status) => list.setFilter("status", status)}
      />

      <ResultSummary
        meta={meta}
        noun="execução"
        gender="f"
        note="Ordenado por criação, da mais recente (ordem definida pelo backend)"
      />

      <ListState
        isPending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        items={executions}
        empty={{
          icon: <Boxes className="size-5" />,
          title: "Nenhuma execução encontrada",
          description:
            "Ajuste a busca ou o filtro de status para ver mais resultados.",
        }}
      >
        {(rows) => (
          <div className="glass-panel overflow-x-auto rounded-xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Execução</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="min-w-40">Progresso</TableHead>
                  <TableHead>Artefato</TableHead>
                  <TableHead>Vínculos</TableHead>
                  <TableHead>Agendamento</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((execution) => (
                  <ExecutionRow key={execution.id} execution={execution} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </ListState>

      <Pagination
        meta={meta}
        onPrevious={list.previousPage}
        onNext={list.nextPage}
        isFetching={query.isFetching}
      />
    </div>
  );
}

/**
 * Agrupamento por status.
 *
 * Cada aba refaz a consulta com `status` — é o agrupamento que o backend
 * suporta. Não há contagem por aba porque o contrato não a devolve, e sete
 * consultas paralelas só para preencher números seria caro e frágil.
 */
function StatusTabs({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (status: ArtifactExecutionQuery["status"]) => void;
}) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="Filtrar por status"
    >
      <StatusTab active={!value} onClick={() => onChange(undefined)}>
        Todas
      </StatusTab>
      {ARTIFACT_EXECUTION_STATUSES.map((status) => (
        <StatusTab
          key={status}
          active={value === status}
          onClick={() => onChange(status)}
        >
          {executionStatusLabel(status)}
        </StatusTab>
      ))}
    </div>
  );
}

function StatusTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md border px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-primary/60 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-surface-strong",
      )}
    >
      {children}
    </button>
  );
}

function ExecutionRow({ execution }: { execution: ArtifactExecutionListItem }) {
  const href = `${ROUTES.executions}/${execution.id}`;

  return (
    <TableRow>
      <TableCell>
        <div className="min-w-0 space-y-1">
          <Link href={href} className="font-medium hover:underline">
            {execution.title}
          </Link>
          <p className="font-mono text-xs text-muted-foreground">
            {execution.code}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <ExecutionStatusBadge status={execution.status} />
          <RenderStatusBadge status={execution.renderStatus} />
        </div>
      </TableCell>
      <TableCell>
        <ExecutionProgress percentage={execution.progress} />
      </TableCell>
      <TableCell>
        <Link
          href={`${ROUTES.artifacts}/${execution.templateId}`}
          className="text-sm hover:underline"
        >
          Template
        </Link>
        <p className="text-xs text-muted-foreground">
          snapshot {execution.snapshotId.slice(0, 8)}
        </p>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {execution.operationId ? (
            <Link href={`${ROUTES.operations}/${execution.operationId}`}>
              <Badge variant="secondary" className="hover:bg-secondary/80">
                Operação
              </Badge>
            </Link>
          ) : null}
          {execution.customerId ? (
            <Badge variant="secondary">Cliente</Badge>
          ) : null}
          {execution.assetId ? <Badge variant="secondary">Ativo</Badge> : null}
          {!execution.operationId &&
          !execution.customerId &&
          !execution.assetId ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {execution.scheduledStart
          ? formatDateTime(execution.scheduledStart)
          : "—"}
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" asChild>
          <Link href={href} aria-label={`Abrir ${execution.title}`}>
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}
