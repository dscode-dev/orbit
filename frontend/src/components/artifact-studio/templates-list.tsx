"use client";

/**
 * Listagem de Artifact Templates.
 *
 * A consulta devolve os templates da organização **e** os globais ativos da
 * plataforma, na mesma página — é o comportamento do repositório, não uma
 * junção feita aqui.
 *
 * Os templates **oficiais** do Orbit são os globais (`organizationId` nulo):
 * chegam nesta mesma listagem, sem endpoint extra, e são somente leitura. A
 * ação oferecida neles é **duplicar** — é assim que a organização os
 * personaliza sem nunca perder o original.
 *
 * **Ordenação**: `ArtifactTemplateQueryDto` não aceita parâmetro de ordenação;
 * o backend ordena por `sortOrder asc, name asc`. Ordenar no cliente
 * reordenaria só a página atual, então a ordem do servidor é declarada e as
 * colunas não são clicáveis — mesma decisão da listagem de operações.
 */
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Copy, LayoutTemplate } from "lucide-react";

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
import { TemplateTypeLabel } from "@/artifacts";
import { CreateTemplateDialog } from "./create-template-dialog";
import { DuplicateTemplateDialog } from "./duplicate-template-dialog";
import {
  isPlatformTemplate,
  PlatformTemplateBadge,
  TemplateStatusBadge,
  templateVisibilityLabel,
} from "./template-badges";
import { TemplatesFilters } from "./templates-filters";
import {
  ListState,
  Pagination,
  ResultSummary,
  useListController,
} from "@/workspace";

export function TemplatesList() {
  const list = useListController<ArtifactTemplateQuery>({ limit: 20 });
  const [duplicating, setDuplicating] =
    useState<ArtifactTemplateListItem | null>(null);

  const query = useArtifactTemplatesList(list.query);
  const templates = query.data?.data ?? [];
  const meta = query.data?.meta;

  return (
    <div className="space-y-6">
      <TemplatesFilters
        value={list.query}
        onChange={list.patch}
        onReset={list.reset}
        searchTerm={list.searchTerm}
        onSearchTermChange={list.setSearchTerm}
      />

      <ResultSummary
        meta={meta}
        noun="template"
        note="Ordenado por prioridade e nome"
      />

      <ListState
        isPending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        items={templates}
        empty={{
          icon: <LayoutTemplate className="size-5" />,
          title: "Nenhum template encontrado",
          description: "Crie um template ou ajuste os filtros da busca.",
          action: <CreateTemplateDialog />,
        }}
      >
        {(rows) => (
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
                {rows.map((template) => (
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
      </ListState>

      <Pagination
        meta={meta}
        onPrevious={list.previousPage}
        onNext={list.nextPage}
        isFetching={query.isFetching}
      />

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
          {/* Rótulo, ícone e cor vêm do Template Type Registry. */}
          <TemplateTypeLabel
            artifactType={template.artifactType}
            className="text-sm"
            showCategory
          />
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
