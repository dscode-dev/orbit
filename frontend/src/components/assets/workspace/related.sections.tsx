"use client";

/**
 * Registros relacionados ao ativo: operações, agenda futura e artefatos.
 *
 * Os três painéis são o **mesmo componente** com fontes diferentes. É o Entity
 * Registry que torna isso possível: cada linha resolve rótulo, ícone, cor,
 * rota e badge de status pelo `EntityId`, sem que este arquivo saiba o que é
 * uma operação, um agendamento ou uma execução.
 *
 * **Nada é filtrado no cliente.** `assetId` é filtro real nos três contratos
 * (`OperationQueryDto`, `EventQueryDto`, `ArtifactExecutionQueryDto`), e a
 * navegação para os respectivos Workspaces sai do registry.
 */
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { PanelFrame, PanelState, toPanelQuery } from "@/components/panels";
import { Button } from "@/components/ui/button";
import {
  EntityBadge,
  EntityLink,
  resolveEntity,
  type EntityId,
} from "@/entities";
import {
  useAssetExecutions,
  useAssetOperations,
  useAssetSchedule,
} from "@/hooks/assets/use-assets";
import { formatDateTime } from "@/lib/formatters";
import { ROUTES } from "@/lib/routes";

interface RelatedRow {
  readonly key: string;
  /** Id do registro na entidade — é o que o `EntityLink` navega. */
  readonly entityId: string;
  readonly title: string;
  readonly subtitle: string;
  readonly status?: string;
}

interface RelatedQuery<TData> {
  data: TData | undefined;
  isPending: boolean;
  error: unknown;
  refetch: () => unknown;
}

/** Moldura comum: cabeçalho, estado da consulta, linhas e atalho. */
function RelatedPanel<TData>({
  entity,
  panelId,
  title,
  description,
  query,
  toRows,
  emptyMessage,
  seeAllHref,
}: {
  entity: EntityId;
  panelId: string;
  title: string;
  description: string;
  query: RelatedQuery<TData>;
  toRows: (data: TData) => readonly RelatedRow[];
  emptyMessage: string;
  seeAllHref: string;
}) {
  const definition = resolveEntity(entity);

  return (
    <PanelFrame
      panelId={panelId}
      title={title}
      description={description}
      actions={
        <Button size="sm" variant="ghost" asChild>
          <Link href={seeAllHref}>
            Ver tudo
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      }
    >
      <PanelState
        query={toPanelQuery(query)}
        loadingRows={3}
        isEmpty={(data) => toRows(data).length === 0}
        emptyMessage={emptyMessage}
      >
        {(data) => (
          <ul className="space-y-2">
            {toRows(data).map((row) => (
              <li
                key={row.key}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2"
              >
                <definition.icon
                  className={`size-4 shrink-0 ${definition.color}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <EntityLink
                    entity={entity}
                    id={row.entityId}
                    className="text-sm font-medium"
                  >
                    <span className="truncate">{row.title}</span>
                  </EntityLink>
                  <p className="text-xs text-muted-foreground">
                    {row.subtitle}
                  </p>
                </div>
                {row.status ? (
                  <EntityBadge
                    entity={entity}
                    group="status"
                    value={row.status}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </PanelState>
    </PanelFrame>
  );
}

export function AssetOperationsSection({ assetId }: { assetId: string }) {
  const query = useAssetOperations(assetId);

  return (
    <RelatedPanel
      entity="operation"
      panelId="asset-operations"
      title="Operações"
      description="Ordens de serviço executadas neste ativo"
      query={query}
      emptyMessage="Nenhuma operação registrada para este ativo."
      seeAllHref={ROUTES.operations}
      toRows={(page) =>
        page.data.map((operation) => ({
          key: operation.id,
          entityId: operation.id,
          title: operation.title,
          subtitle: `${operation.code}${
            operation.scheduledStart
              ? ` · ${formatDateTime(operation.scheduledStart)}`
              : ""
          }`,
          status: operation.status,
        }))
      }
    />
  );
}

export function AssetScheduleSection({ assetId }: { assetId: string }) {
  const query = useAssetSchedule(assetId);

  return (
    <RelatedPanel
      entity="scheduling-event"
      panelId="asset-schedule"
      title="Agenda futura"
      description="Próximos 90 dias, com recorrências expandidas pelo backend"
      query={query}
      emptyMessage="Nada agendado para este ativo nos próximos 90 dias."
      seeAllHref={ROUTES.scheduling}
      toRows={(occurrences) =>
        occurrences.slice(0, 5).map((occurrence) => ({
          key: occurrence.occurrenceId,
          entityId: occurrence.eventId,
          title: occurrence.title,
          subtitle: `${formatDateTime(occurrence.startsAt)} · ${occurrence.type}`,
          status: occurrence.status,
        }))
      }
    />
  );
}

export function AssetExecutionsSection({ assetId }: { assetId: string }) {
  const query = useAssetExecutions(assetId);

  return (
    <RelatedPanel
      entity="artifact-execution"
      panelId="asset-executions"
      title="Artefatos executados"
      description="PMOCs, relatórios e checklists preenchidos neste ativo"
      query={query}
      emptyMessage="Nenhum artefato executado neste ativo."
      seeAllHref={ROUTES.executions}
      toRows={(page) =>
        page.data.map((execution) => ({
          key: execution.id,
          entityId: execution.id,
          title: execution.title,
          subtitle: `${execution.code} · ${execution.progress}% concluído`,
          status: execution.status,
        }))
      }
    />
  );
}
