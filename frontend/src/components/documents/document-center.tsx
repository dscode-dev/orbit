"use client";

/**
 * Document Center — a central documental.
 *
 * ## De onde vem a lista
 *
 * **Não existe listagem global de manifests.** O backend publica revisões
 * sempre sob uma execução — decisão explícita da PR-19 de não criar endpoint
 * administrativo. A central parte de `GET /artifact-executions`, que carrega o
 * `renderStatus` real de cada execução. As revisões de uma execução são
 * carregadas quando ela é aberta.
 *
 * ## As filas passaram a ser consulta, não recorte da página
 *
 * Antes, `renderStatus` não era filtro do contrato: a tela carregava uma página
 * de execuções e as separava em memória. As contagens eram da página, não da
 * organização — a aba "Emitidos" dizia 3 enquanto havia 200 —, e a paginação
 * ficava sem sentido: a página 2 podia estar inteira numa fila que não era a
 * aberta.
 *
 * Agora `renderStatus`, `artifactType` e o período são filtros do servidor
 * (`ArtifactExecutionQueryDto`), a fila aberta é a consulta, e o total é o
 * total. A contagem das filas fechadas deixou de existir em vez de existir
 * errada: uma contagem por fila exigiria cinco consultas por navegação, e o
 * caminho honesto é o backend publicar o agrupamento — não a tela fingir.
 *
 * ## O que ainda não se pode filtrar
 *
 * Formato e renderizador não estão no contrato de execuções, e a busca é a que
 * o servidor suporta: código e título. Buscar pelo conteúdo do documento
 * exigiria indexar o texto emitido, que não existe.
 */
import { useMemo, useState } from "react";
import { FileStack } from "lucide-react";

import { ContentContainer } from "@/components/layout/page-primitives";
import { ReferencePicker } from "@/components/scheduling/reference-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resolveRenderStatus } from "@/documents";
import { allTemplateTypes } from "@/artifacts";
import { useArtifactExecutionsList } from "@/hooks/artifact-executions/use-artifact-executions";
import { useActiveScope } from "@/providers/use-active-scope";
import { schedulingReferencesService } from "@/services/scheduling-references.service";
import { executionStatusLabel } from "@/components/artifact-executions/execution-badges";
import { ARTIFACT_EXECUTION_STATUSES } from "@/types/artifact-executions";
import type {
  ArtifactExecutionStatus,
  ArtifactExecutionQuery,
} from "@/types/artifact-executions";
import type { RenderStatus } from "@/types/documents";
import {
  FilterBar,
  FilterSelect,
  ListState,
  Pagination,
  ResultSummary,
  SearchField,
  useListController,
} from "@/workspace";
import { DocumentList } from "./document-list";
import { DocumentViewer } from "./document-viewer";

/**
 * Filas da central, na ordem em que interessam.
 *
 * `READY` primeiro: a pergunta mais comum é "cadê o documento". As filas de
 * produção e falha vêm em seguida, e as execuções sem documento por último —
 * são a maioria e a menos urgente.
 */
const QUEUES: readonly RenderStatus[] = [
  "READY",
  "RENDERING",
  "PENDING",
  "FAILED",
  "NOT_RENDERED",
];

/** As filas na ordem acima, com a apresentação do Document Registry. */
const QUEUE_TABS = QUEUES.map((id) => resolveRenderStatus(id));

const TYPE_OPTIONS = allTemplateTypes().map((type) => ({
  value: type.id,
  label: type.name,
}));

const STATUS_OPTIONS = ARTIFACT_EXECUTION_STATUSES.map((status) => ({
  value: status,
  label: executionStatusLabel(status),
}));

export function DocumentCenter() {
  const { businessUnitId, businessUnits } = useActiveScope();
  const [queue, setQueue] = useState<RenderStatus>("READY");
  const [selected, setSelected] = useState<string | null>(null);
  /** O rótulo do cliente escolhido, para o seletor não mostrar um id. */
  const [customerLabel, setCustomerLabel] = useState<string>();
  const list = useListController<ArtifactExecutionQuery>({ limit: 20 });

  const query = useMemo<ArtifactExecutionQuery>(
    () => ({
      ...list.query,
      /* A unidade ativa do escopo vence o filtro: é a mesma regra das outras
         listas, e o seletor de unidade só aparece quando o acesso é de
         organização. */
      businessUnitId: businessUnitId ?? list.query.businessUnitId,
      renderStatus: queue,
    }),
    [list.query, businessUnitId, queue],
  );

  const executions = useArtifactExecutionsList(query);
  const items = useMemo(() => executions.data?.data ?? [], [executions.data]);
  const meta = executions.data?.meta;

  return (
    <ContentContainer size="wide" className="space-y-6">
      {/* O `data-testid` é do e2e de alinhamento: a faixa de filtros e a
          lista precisam terminar na mesma coluna. */}
      <div data-testid="documents-filters">
        <FilterBar onClear={list.reset} canClear={list.isFiltered}>
          <SearchField
            id="documents-search"
            value={list.searchTerm}
            onChange={list.setSearchTerm}
            placeholder="Código ou título da execução"
            hint="A busca considera o código e o título do atendimento, não o conteúdo do documento."
          />

          <ReferencePicker
            id="documents-customer"
            label="Cliente"
            placeholder="Todos"
            value={list.query.customerId}
            selectedLabel={customerLabel}
            queryKey={schedulingReferencesService.keys.customers}
            fetcher={(search, options) =>
              schedulingReferencesService.customers(search, options)
            }
            toOption={(customer) => ({
              id: customer.id,
              label: customer.tradeName ?? customer.legalName,
            })}
            onChange={(customerId, label) => {
              list.setFilter("customerId", customerId);
              setCustomerLabel(label);
            }}
          />

          <FilterSelect
            id="documents-type"
            label="Tipo"
            value={list.query.artifactType}
            onChange={(value) => list.setFilter("artifactType", value)}
            options={TYPE_OPTIONS}
            anyLabel="Todos"
          />

          <FilterSelect
            id="documents-status"
            label="Situação do atendimento"
            value={list.query.status}
            onChange={(value) =>
              list.setFilter("status", value as ArtifactExecutionStatus)
            }
            options={STATUS_OPTIONS}
            anyLabel="Todas"
          />

          {businessUnits.length > 1 && !businessUnitId ? (
            <FilterSelect
              id="documents-unit"
              label="Unidade"
              value={list.query.businessUnitId}
              onChange={(value) => list.setFilter("businessUnitId", value)}
              options={businessUnits.map((unit) => ({
                value: unit.id,
                label: unit.tradeName ?? unit.legalName,
              }))}
              anyLabel="Todas"
            />
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="documents-from">Criados de</Label>
            <Input
              id="documents-from"
              type="date"
              value={list.query.createdFrom ?? ""}
              onChange={(event) =>
                list.setFilter("createdFrom", event.target.value || undefined)
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="documents-to">até</Label>
            <Input
              id="documents-to"
              type="date"
              value={list.query.createdTo ?? ""}
              onChange={(event) =>
                list.setFilter("createdTo", event.target.value || undefined)
              }
            />
          </div>
        </FilterBar>
      </div>

      <Tabs
        value={queue}
        onValueChange={(value) => setQueue(value as RenderStatus)}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            {QUEUE_TABS.map((status) => (
              <TabsTrigger key={status.id} value={status.id}>
                {status.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <ResultSummary meta={meta} noun="execução" gender="f" />
        </div>

        <div data-testid="documents-results">
          <ListState
            isPending={executions.isPending}
            error={executions.error}
            onRetry={() => void executions.refetch()}
            items={items}
            empty={{
              icon: <FileStack className="size-5" />,
              title: emptyTitleFor(queue),
              description:
                "Os documentos aparecem aqui depois que uma execução é submetida e renderizada.",
            }}
          >
            {/*
             * Um `TabsContent` só, o da fila aberta.
             *
             * Cinco continham a mesma lista — a consulta já é por fila — e o
             * Radix escondia quatro. Eram quatro árvores de React montadas
             * para não aparecer.
             */}
            {() => (
              <TabsContent value={queue}>
                <DocumentList executions={items} onOpen={setSelected} />
              </TabsContent>
            )}
          </ListState>
        </div>
      </Tabs>

      <Pagination
        meta={meta}
        onPrevious={list.previousPage}
        onNext={list.nextPage}
        isFetching={executions.isFetching}
      />

      <DocumentViewer
        executionId={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </ContentContainer>
  );
}

/**
 * O vazio fala da fila aberta.
 *
 * "Nenhum documento nesta unidade" era a mesma frase nas cinco filas, e na de
 * falhas dizia o contrário do que se queria ler: nenhuma falha é boa notícia.
 */
function emptyTitleFor(queue: RenderStatus): string {
  const titles: Readonly<Record<RenderStatus, string>> = {
    READY: "Nenhum documento emitido por aqui",
    RENDERING: "Nada sendo produzido agora",
    PENDING: "Nenhuma emissão na fila",
    FAILED: "Nenhuma emissão falhou",
    NOT_RENDERED: "Nenhum atendimento sem documento",
  };
  return titles[queue];
}
