"use client";

/**
 * Listagem de Artifact Templates.
 *
 * A consulta devolve os templates da organização **e** os globais ativos da
 * plataforma, na mesma página — é o comportamento do repositório, não uma
 * junção feita aqui.
 *
 * **Ordenação**: `ArtifactTemplateQueryDto` não aceita parâmetro de ordenação;
 * o backend ordena por `sortOrder asc, name asc`. Ordenar no cliente
 * reordenaria só a página atual, então a ordem do servidor é declarada e as
 * colunas não são clicáveis — mesma decisão da listagem de operações.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Copy, LayoutTemplate, ListFilter } from "lucide-react";

import { EmptyState } from "@/components/feedback/states";
import { PanelError, PanelLoading } from "@/components/panels";
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
import { useArtifactTemplatesList } from "@/hooks/artifact-templates/use-artifact-templates";
import { formatDateTime } from "@/lib/formatters";
import { ROUTES } from "@/lib/routes";
import type {
  ArtifactTemplateListItem,
  ArtifactTemplateQuery,
} from "@/types/artifact-templates";
import { CreateTemplateDialog } from "./create-template-dialog";
import { DuplicateTemplateDialog } from "./duplicate-template-dialog";
import {
  isPlatformTemplate,
  PlatformTemplateBadge,
  TemplateStatusBadge,
  templateVisibilityLabel,
} from "./template-badges";
import { TemplatesFilters } from "./templates-filters";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

export function TemplatesList() {
  const [filters, setFilters] = useState<ArtifactTemplateQuery>({
    page: 1,
    limit: PAGE_SIZE,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [duplicating, setDuplicating] =
    useState<ArtifactTemplateListItem | null>(null);

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

  const query = useArtifactTemplatesList(filters);
  const templates = query.data?.data ?? [];
  const meta = query.data?.meta;

  const summary = useMemo(() => {
    if (!meta) return null;
    const first = (meta.page - 1) * meta.limit + 1;
    const last = Math.min(meta.page * meta.limit, meta.total);
    return meta.total === 0
      ? "Nenhum template"
      : `${first}–${last} de ${meta.total}`;
  }, [meta]);

  return (
    <div className="space-y-6">
      <TemplatesFilters
        value={filters}
        onChange={(patch) =>
          setFilters((current) => ({ ...current, ...patch, page: 1 }))
        }
        onReset={() => {
          setSearchTerm("");
          setFilters({ page: 1, limit: PAGE_SIZE });
        }}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <ListFilter className="size-4" aria-hidden />
          <span>{summary ?? "Carregando…"}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Ordenado por prioridade e nome (ordem definida pelo backend)
        </p>
      </div>

      {query.isPending ? (
        <PanelLoading rows={6} />
      ) : query.error ? (
        <PanelError error={query.error} onRetry={() => void query.refetch()} />
      ) : templates.length === 0 ? (
        <EmptyState
          icon={<LayoutTemplate className="size-5" />}
          title="Nenhum template encontrado"
          description="Crie um template ou ajuste os filtros da busca."
          action={<CreateTemplateDialog />}
        />
      ) : (
        <div className="glass-panel overflow-x-auto rounded-xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Visibilidade</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead>Atualizado</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TemplateRow
                  key={template.id}
                  template={template}
                  onDuplicate={() => setDuplicating(template)}
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

      {duplicating ? (
        <DuplicateTemplateDialog
          templateId={duplicating.id}
          templateKey={duplicating.key}
          templateName={duplicating.name}
          open
          onOpenChange={(open) => {
            if (!open) setDuplicating(null);
          }}
        />
      ) : null}
    </div>
  );
}

function TemplateRow({
  template,
  onDuplicate,
}: {
  template: ArtifactTemplateListItem;
  onDuplicate: () => void;
}) {
  return (
    <TableRow>
      <TableCell>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`${ROUTES.artifacts}/${template.id}`}
              className="font-medium hover:underline"
            >
              {template.name}
            </Link>
            {isPlatformTemplate(template) ? <PlatformTemplateBadge /> : null}
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            {template.key}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <span className="text-sm">{template.artifactType}</span>
          {template.segment ? (
            <p className="text-xs text-muted-foreground">{template.segment}</p>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <TemplateStatusBadge status={template.status} />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {templateVisibilityLabel(template.visibility)}
      </TableCell>
      <TableCell>
        <Badge variant="secondary">v{template.currentVersion}</Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDateTime(template.updatedAt)}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onDuplicate}
            aria-label={`Duplicar ${template.name}`}
          >
            <Copy className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link
              href={`${ROUTES.artifacts}/${template.id}`}
              aria-label={`Abrir ${template.name}`}
            >
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
