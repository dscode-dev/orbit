"use client";

/**
 * Linhas da central.
 *
 * Cada linha é uma **execução** e o documento que ela produziu. Os vínculos —
 * operação, cliente, equipamento, artefato — são resolvidos pelo **Entity
 * Registry**: nenhuma rota é montada à mão, e uma entidade sem tela registrada
 * simplesmente não vira link.
 *
 * A listagem publica identificadores, não nomes. Resolver cada um viraria N+1
 * por página; os nomes aparecem no Workspace da execução, onde é uma leitura
 * por vínculo. É a mesma decisão da listagem de execuções.
 */
import { ArrowRight, FileStack } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RenderStatusBadge } from "@/documents";
import { EntityLink } from "@/entities/entity-components";
import { formatDateTime } from "@/lib/formatters";
import { ROUTES } from "@/lib/routes";
import type { ArtifactExecutionListItem } from "@/types/artifact-executions";

export function DocumentList({
  executions,
  onOpen,
}: {
  executions: readonly ArtifactExecutionListItem[];
  onOpen: (executionId: string) => void;
}) {
  if (executions.length === 0) {
    return (
      <EmptyState
        icon={<FileStack className="size-5" />}
        title="Nada nesta fila"
        description="Nenhum documento desta página está nesta situação."
      />
    );
  }

  return (
    <div className="glass-panel overflow-x-auto rounded-xl">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Execução</TableHead>
            <TableHead>Documento</TableHead>
            <TableHead>Vínculos</TableHead>
            <TableHead>Atualizado</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {executions.map((execution) => (
            <TableRow key={execution.id}>
              <TableCell>
                <Link
                  href={`${ROUTES.executions}/${execution.id}`}
                  className="block min-w-0 space-y-0.5 hover:underline"
                >
                  <span className="block truncate font-medium">
                    {execution.title}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {execution.code}
                  </span>
                </Link>
              </TableCell>

              <TableCell>
                <RenderStatusBadge status={execution.renderStatus} />
              </TableCell>

              <TableCell>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {execution.operationId ? (
                    <EntityLink entity="operation" id={execution.operationId}>
                      Operação
                    </EntityLink>
                  ) : null}
                  {execution.customerId ? (
                    <EntityLink entity="customer" id={execution.customerId}>
                      Cliente
                    </EntityLink>
                  ) : null}
                  {execution.assetId ? (
                    <EntityLink entity="asset" id={execution.assetId}>
                      Equipamento
                    </EntityLink>
                  ) : null}
                  <EntityLink
                    entity="artifact-template"
                    id={execution.templateId}
                  >
                    Artefato
                  </EntityLink>
                </div>
              </TableCell>

              <TableCell className="text-sm text-muted-foreground">
                {formatDateTime(execution.updatedAt)}
              </TableCell>

              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpen(execution.id)}
                >
                  Abrir
                  <ArrowRight className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
