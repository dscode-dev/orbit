"use client";

/**
 * Lista de operações.
 *
 * Paginação, busca e filtros são do servidor (`OperationQueryDto`). A seleção
 * é local e serve para ações em lote futuras — hoje ela apenas informa quantas
 * operações estão marcadas, porque o backend ainda não expõe endpoint de ação
 * em lote.
 *
 * ## Centro de gestão (PR-12)
 *
 * A lista deixou de ser só leitura: criar, editar, reagendar, reatribuir,
 * alterar prioridade, mudar status e excluir acontecem aqui, sem abrir a
 * operação. Cada ação chama um endpoint que já existia — ver
 * `operation-actions.tsx`.
 *
 * Os acessos rápidos a cliente, equipamento e execuções de artefato usam o
 * **Entity Registry**: nenhuma rota é montada à mão nesta tela, e uma entidade
 * sem tela registrada simplesmente não vira link.
 *
 * **Ordenação**: `OperationQueryDto` não aceita parâmetro de ordenação. O
 * backend ordena por `scheduledStart asc, createdAt desc`. Ordenar no cliente
 * reordenaria apenas a página atual e daria uma impressão falsa de ordem
 * global, então a coluna não é clicável e a ordem do backend é declarada no
 * cabeçalho. Ver `docs/operations-workspace.md`.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ListFilter, Plus } from "lucide-react";

import { PanelError, PanelLoading } from "@/components/panels";
import { EmptyState } from "@/components/feedback/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EntityLink } from "@/entities/entity-components";
import { useSchedulingTimeZone } from "@/components/scheduling/use-scheduling-timezone";
import { useOperationsList } from "@/hooks/operations/use-operations";
import { useSession } from "@/providers/session-provider";
import { formatDateTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";
import type { Operation, OperationQuery } from "@/types/operations";
import {
  operationKindLabel,
  operationPriorityLabel,
  OperationStatusBadge,
} from "./operation-badges";
import { OperationActions } from "./operation-actions";
import { OperationFormDialog } from "./operation-form.dialog";
import { OperationsFilters } from "./operations-filters";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

export function OperationsList() {
  const session = useSession();
  const { timeZone } = useSchedulingTimeZone();
  const [filters, setFilters] = useState<OperationQuery>({
    page: 1,
    limit: PAGE_SIZE,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [editing, setEditing] = useState<Operation | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const canCreate =
    session.hasPermission("operations.create") &&
    session.hasCapability("operations.manage");

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

  const query = useOperationsList(filters);
  const operations = query.data?.data ?? [];
  const meta = query.data?.meta;

  const allSelected =
    operations.length > 0 && operations.every((item) => selected.has(item.id));

  const toggleAll = () => {
    setSelected(
      allSelected ? new Set() : new Set(operations.map((item) => item.id)),
    );
  };

  const toggleOne = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyFilters = (patch: Partial<OperationQuery>) => {
    setFilters((current) => ({ ...current, ...patch, page: 1 }));
    setSelected(new Set());
  };

  const resetFilters = () => {
    setSearchTerm("");
    setFilters({ page: 1, limit: PAGE_SIZE });
    setSelected(new Set());
  };

  const summary = useMemo(() => {
    if (!meta) return null;
    const first = (meta.page - 1) * meta.limit + 1;
    const last = Math.min(meta.page * meta.limit, meta.total);
    return meta.total === 0
      ? "Nenhuma operação"
      : `${first}–${last} de ${meta.total}`;
  }, [meta]);

  return (
    <div className="space-y-6">
      <OperationsFilters
        value={filters}
        onChange={applyFilters}
        onReset={resetFilters}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <ListFilter className="size-4" aria-hidden />
          <span>{summary ?? "Carregando…"}</span>
          {selected.size > 0 ? (
            <Badge variant="secondary">{selected.size} selecionadas</Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-muted-foreground">
            Ordenado por agendamento e data de criação (ordem definida pelo
            backend)
          </p>
          {canCreate ? (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              Nova operação
            </Button>
          ) : null}
        </div>
      </div>

      {query.isPending ? (
        <PanelLoading rows={6} />
      ) : query.error ? (
        <PanelError error={query.error} onRetry={() => void query.refetch()} />
      ) : operations.length === 0 ? (
        <EmptyState
          title="Nenhuma operação encontrada"
          description="Ajuste os filtros ou limpe a busca para ver mais resultados."
        />
      ) : (
        <div className="glass-panel overflow-x-auto rounded-xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Selecionar todas as operações da página"
                  />
                </TableHead>
                <TableHead>Operação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Agendamento</TableHead>
                <TableHead>Equipe</TableHead>
                <TableHead>Acesso rápido</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {operations.map((operation) => (
                <OperationRow
                  key={operation.id}
                  operation={operation}
                  selected={selected.has(operation.id)}
                  timeZone={timeZone}
                  onToggle={() => toggleOne(operation.id)}
                  onEdit={() => {
                    setEditing(operation);
                    setFormOpen(true);
                  }}
                />
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

      <OperationFormDialog
        open={formOpen}
        editing={editing}
        timeZone={timeZone}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
      />
    </div>
  );
}

function OperationRow({
  operation,
  selected,
  timeZone,
  onToggle,
  onEdit,
}: {
  operation: Operation;
  selected: boolean;
  timeZone: string;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const assignees = operation.users;
  return (
    <TableRow className={cn(selected && "bg-secondary/40")}>
      <TableCell>
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          aria-label={`Selecionar operação ${operation.code}`}
        />
      </TableCell>
      <TableCell>
        <Link
          href={`${ROUTES.operations}/${operation.id}`}
          className="block min-w-0 space-y-0.5 hover:underline"
        >
          <span className="block truncate font-medium">{operation.title}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {operation.code} · {operationKindLabel(operation.kind)} ·{" "}
            {operationPriorityLabel(operation.priority)}
          </span>
        </Link>
      </TableCell>
      <TableCell>
        <OperationStatusBadge status={operation.status} />
      </TableCell>
      <TableCell className="max-w-40 truncate text-sm text-muted-foreground">
        {operation.customer?.tradeName ?? operation.customer?.legalName ?? "—"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDateTime(operation.scheduledStart)}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {assignees.length === 0
          ? "Sem técnico"
          : assignees.length === 1
            ? assignees[0].user.displayName
            : `${assignees[0].user.displayName} +${assignees.length - 1}`}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {operation.customer ? (
            <EntityLink entity="customer" id={operation.customer.id}>
              {operation.customer.tradeName ?? operation.customer.legalName}
            </EntityLink>
          ) : null}
          {operation.asset ? (
            <EntityLink entity="asset" id={operation.asset.id}>
              {operation.asset.name}
            </EntityLink>
          ) : null}
          {operation.checklistExecutions.length > 0 ? (
            <span className="text-muted-foreground">
              {operation.checklistExecutions.length} checklist(s)
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-0.5">
          <OperationActions
            operation={operation}
            timeZone={timeZone}
            onEdit={onEdit}
          />
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="Abrir operação"
          >
            <Link href={`${ROUTES.operations}/${operation.id}`}>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
