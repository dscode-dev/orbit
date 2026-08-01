"use client";

/**
 * Filtros da lista de operações.
 *
 * Só expõe filtros que `OperationQueryDto` aceita de fato: busca, status,
 * tipo, prioridade e janela de agendamento. Nada é filtrado no cliente — a
 * paginação é do servidor, e filtrar localmente daria um resultado errado
 * para além da página atual.
 */
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  OperationKind,
  OperationPriority,
  OperationStatus,
} from "@/types/contracts";
import {
  OPERATION_KIND_LABELS,
  OPERATION_PRIORITY_LABELS,
  OPERATION_STATUS_LABELS,
  type OperationQuery,
} from "@/types/operations";

/** Valor usado no `Select` para representar "sem filtro". */
const ANY = "__all__";

export interface OperationsFiltersProps {
  value: OperationQuery;
  onChange: (patch: Partial<OperationQuery>) => void;
  onReset: () => void;
  /** Termo digitado, controlado fora para permitir debounce. */
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
}

export function OperationsFilters({
  value,
  onChange,
  onReset,
  searchTerm,
  onSearchTermChange,
}: OperationsFiltersProps) {
  const hasFilters = Boolean(
    value.search ||
    value.status ||
    value.kind ||
    value.priority ||
    value.scheduledFrom ||
    value.scheduledTo,
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]">
      <div className="space-y-2">
        <Label htmlFor="operations-search">Buscar</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="operations-search"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Código, título ou descrição"
            className="pl-9"
          />
        </div>
      </div>

      <FilterSelect
        id="operations-status"
        label="Status"
        value={value.status}
        options={Object.values(OperationStatus)}
        labels={OPERATION_STATUS_LABELS}
        onChange={(status) =>
          onChange({ status: status as OperationQuery["status"] })
        }
      />

      <FilterSelect
        id="operations-kind"
        label="Tipo"
        value={value.kind}
        options={Object.values(OperationKind)}
        labels={OPERATION_KIND_LABELS}
        onChange={(kind) => onChange({ kind: kind as OperationQuery["kind"] })}
      />

      <FilterSelect
        id="operations-priority"
        label="Prioridade"
        value={value.priority}
        options={Object.values(OperationPriority)}
        labels={OPERATION_PRIORITY_LABELS}
        onChange={(priority) =>
          onChange({ priority: priority as OperationQuery["priority"] })
        }
      />

      <div className="flex items-end">
        <Button
          type="button"
          variant="ghost"
          onClick={onReset}
          disabled={!hasFilters}
        >
          <X className="size-4" />
          Limpar
        </Button>
      </div>
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  options,
  labels,
  onChange,
}: {
  id: string;
  label: string;
  value: string | undefined;
  options: readonly string[];
  labels: Readonly<Record<string, string>>;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value ?? ANY}
        onValueChange={(next) => onChange(next === ANY ? undefined : next)}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder="Todos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Todos</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {labels[option] ?? option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
