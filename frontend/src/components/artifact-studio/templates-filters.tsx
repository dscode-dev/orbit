"use client";

/**
 * Filtros da listagem de templates.
 *
 * Expõe exatamente o que `ArtifactTemplateQueryDto` aceita: busca, tipo de
 * artefato, segmento, status, visibilidade e uma tag. Nada é filtrado no
 * cliente — a paginação é do servidor.
 *
 * `artifactType` e `segment` são campos de texto, não listas: o backend os
 * valida por formato, não por enum, e cada organização define os seus. Uma
 * lista fechada aqui esconderia os tipos que o tenant já usa.
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
import { toTypeIdentifier } from "@/lib/artifact-studio";
import {
  ARTIFACT_TEMPLATE_STATUSES,
  type ArtifactTemplateQuery,
} from "@/types/artifact-templates";
import {
  templateStatusLabel,
  templateVisibilityLabel,
} from "./template-badges";

/** Valor usado no `Select` para representar "sem filtro". */
const ANY = "__all__";

/** `visibility` aceita GLOBAL na consulta, embora não na criação. */
const VISIBILITY_OPTIONS = ["PRIVATE", "ORGANIZATION", "GLOBAL"] as const;

export interface TemplatesFiltersProps {
  value: ArtifactTemplateQuery;
  onChange: (patch: Partial<ArtifactTemplateQuery>) => void;
  onReset: () => void;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
}

export function TemplatesFilters({
  value,
  onChange,
  onReset,
  searchTerm,
  onSearchTermChange,
}: TemplatesFiltersProps) {
  const hasFilters = Boolean(
    value.search ||
    value.artifactType ||
    value.segment ||
    value.status ||
    value.visibility ||
    value.tag,
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]">
      <div className="space-y-2">
        <Label htmlFor="templates-search">Buscar</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="templates-search"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Chave, nome ou descrição"
            className="pl-9"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="templates-type">Tipo de artefato</Label>
        <Input
          id="templates-type"
          value={value.artifactType ?? ""}
          onChange={(event) =>
            onChange({
              artifactType: toTypeIdentifier(event.target.value) || undefined,
            })
          }
          placeholder="Ex.: RELATORIO"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="templates-segment">Segmento</Label>
        <Input
          id="templates-segment"
          value={value.segment ?? ""}
          onChange={(event) =>
            onChange({
              segment: toTypeIdentifier(event.target.value) || undefined,
            })
          }
          placeholder="Ex.: HVAC_R"
        />
      </div>

      <FilterSelect
        id="templates-status"
        label="Status"
        value={value.status}
        options={ARTIFACT_TEMPLATE_STATUSES}
        toLabel={templateStatusLabel}
        onChange={(status) =>
          onChange({ status: status as ArtifactTemplateQuery["status"] })
        }
      />

      <FilterSelect
        id="templates-visibility"
        label="Visibilidade"
        value={value.visibility}
        options={VISIBILITY_OPTIONS}
        toLabel={templateVisibilityLabel}
        onChange={(visibility) => onChange({ visibility })}
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
  toLabel,
  onChange,
}: {
  id: string;
  label: string;
  value: string | undefined;
  options: readonly string[];
  toLabel: (value: string) => string;
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
              {toLabel(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
