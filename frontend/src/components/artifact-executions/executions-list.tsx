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
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Boxes, ListFilter, Search, UserRound } from "lucide-react";

import { EmptyState } from "@/components/feedback/states";
import { PanelError, PanelLoading } from "@/components/panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

export function ExecutionsList({
  initialQuery,
}: {
  /** Permite embutir a lista já filtrada (por operação, cliente ou ativo). */
  initialQuery?: ArtifactExecutionQuery;
}) {
  const session = useSession();
  const { businessUnitId } = useActiveScope();
  const [filters, setFilters] = useState<ArtifactExecutionQuery>({
    page: 1,
    limit: PAGE_SIZE,
    ...initialQuery,
  });
  const [searchTerm, setSearchTerm] = useState(initialQuery?.search ?? "");

  /** Busca só viaja depois que o usuário para de digitar. */
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) =>
        current.search === (searchTerm || undefined)
          ? current
          : { ...current, search: searchTerm || undefined, page: 1 },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  /** A unidade ativa é filtro real da consulta quando não há escolha explícita. */
  const scopedQuery = useMemo<ArtifactExecutionQuery>(
    () => ({
      ...filters,
      businessUnitId: filters.businessUnitId ?? businessUnitId ?? undefined,
    }),
    [filters, businessUnitId],
  );

  const query = useArtifactExecutionsList(scopedQuery);
  const executions = query.data?.data ?? [];
  const meta = query.data?.meta;

  const summary = useMemo(() => {
    if (!meta) return null;
    const first = (meta.page - 1) * meta.limit + 1;
    const last = Math.min(meta.page * meta.limit, meta.total);
    return meta.total === 0
      ? "Nenhuma execução"
      : `${first}–${last} de ${meta.total}`;
  }, [meta]);

  const mine = filters.responsibleUserId === session.user?.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-64 flex-1 space-y-2">
          <Label htmlFor="executions-search">Buscar</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="executions-search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Código ou título"
              className="pl-9"
            />
          </div>
        </div>

        {session.user ? (
          <Button
            variant={mine ? "default" : "outline"}
            onClick={() =>
              setFilters((current) => ({
                ...current,
                responsibleUserId: mine ? undefined : session.user?.id,
                page: 1,
              }))
            }
          >
            <UserRound className="size-4" />
            Sob minha responsabilidade
          </Button>
        ) : null}
      </div>

      <StatusTabs
        value={filters.status}
        onChange={(status) =>
          setFilters((current) => ({ ...current, status, page: 1 }))
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <ListFilter className="size-4" aria-hidden />
          <span>{summary ?? "Carregando…"}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Ordenado por criação, da mais recente (ordem definida pelo backend)
        </p>
      </div>

      {query.isPending ? (
        <PanelLoading rows={6} />
      ) : query.error ? (
        <PanelError error={query.error} onRetry={() => void query.refetch()} />
      ) : executions.length === 0 ? (
        <EmptyState
          icon={<Boxes className="size-5" />}
          title="Nenhuma execução encontrada"
          description="Ajuste a busca ou o filtro de status para ver mais resultados."
        />
      ) : (
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
              {executions.map((execution) => (
                <ExecutionRow key={execution.id} execution={execution} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={!meta.hasPreviousPage || query.isFetching}
            onClick={() =>
              setFilters((current) => ({
                ...current,
                page: Math.max(1, (current.page ?? 1) - 1),
              }))
            }
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {meta.page} de {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!meta.hasNextPage || query.isFetching}
            onClick={() =>
              setFilters((current) => ({
                ...current,
                page: (current.page ?? 1) + 1,
              }))
            }
          >
            Próxima
          </Button>
        </div>
      ) : null}
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
