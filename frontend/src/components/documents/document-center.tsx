"use client";

/**
 * Document Center — a central documental.
 *
 * ## De onde vem a lista
 *
 * **Não existe listagem global de manifests.** O backend publica revisões
 * sempre sob uma execução — decisão explícita da PR-19 de não criar endpoint
 * administrativo. A central parte de `GET /artifact-executions`, que desde a
 * PR-20 carrega o `renderStatus` real de cada execução, e agrupa por esse
 * estado. As revisões de uma execução são carregadas quando ela é aberta.
 *
 * A consequência honesta: filtrar por **formato**, por **renderizador** ou
 * buscar pelo conteúdo do documento não é possível — nada disso é filtro de
 * `ArtifactExecutionQueryDto`. A busca oferecida é a que o backend suporta
 * (código e título da execução), e está dito na tela.
 *
 * ## O que a central substitui
 *
 * Antes, chegar a um documento exigia abrir a execução, rolar até a seção certa
 * e descobrir que não havia documento nenhum. Aqui os documentos são o assunto:
 * emitidos, em produção, falhos — cada um com sua fila.
 */
import { useMemo, useState } from "react";
import { FileStack } from "lucide-react";

import { ContentContainer } from "@/components/layout/page-primitives";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resolveRenderStatus } from "@/documents";
import { useArtifactExecutionsList } from "@/hooks/artifact-executions/use-artifact-executions";
import { useActiveScope } from "@/providers/use-active-scope";
import type {
  ArtifactExecutionListItem,
  ArtifactExecutionQuery,
} from "@/types/artifact-executions";
import type { RenderStatus } from "@/types/documents";
import {
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

export function DocumentCenter() {
  const { businessUnitId } = useActiveScope();
  const [queue, setQueue] = useState<RenderStatus>("READY");
  const [selected, setSelected] = useState<string | null>(null);
  const list = useListController<ArtifactExecutionQuery>({ limit: 20 });

  const query = useMemo<ArtifactExecutionQuery>(
    () => ({ ...list.query, businessUnitId: businessUnitId ?? undefined }),
    [list.query, businessUnitId],
  );

  const executions = useArtifactExecutionsList(query);

  /**
   * Agrupamento por estado de renderização — no cliente, e por quê.
   *
   * `ArtifactExecutionQueryDto` **não filtra por `renderStatus`**: o filtro
   * existente é sobre o status da execução, que é outra coisa. Sem esse filtro
   * no servidor, a alternativa seria não oferecer filas — e a central perderia
   * o que a torna útil.
   *
   * O recorte é, portanto, **da página carregada**, e a tela diz isso. Não é
   * uma contagem da organização: é o que está nesta página. A lacuna está
   * registrada para a próxima evolução do backend.
   */
  const items = useMemo(() => executions.data?.data ?? [], [executions.data]);

  const buckets = useMemo(() => {
    const map = new Map<string, ArtifactExecutionListItem[]>();
    for (const status of QUEUES) map.set(status, []);
    for (const execution of items) {
      map.get(execution.renderStatus)?.push(execution);
    }
    return map;
  }, [items]);

  const meta = executions.data?.meta;

  return (
    <ContentContainer size="wide" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SearchField
          id="documents-search"
          value={list.searchTerm}
          onChange={list.setSearchTerm}
          placeholder="Código ou título da execução"
          hint="A busca considera o código e o título do atendimento, não o conteúdo do documento."
          className="min-w-64 flex-1"
        />

        <ResultSummary meta={meta} noun="execução" gender="f" />
      </div>

      <ListState
        isPending={executions.isPending}
        error={executions.error}
        onRetry={() => void executions.refetch()}
        items={items}
        empty={{
          icon: <FileStack className="size-5" />,
          title: "Nenhum documento nesta unidade",
          description:
            "Os documentos aparecem aqui depois que uma execução é submetida e renderizada.",
        }}
      >
        {() => (
          <Tabs
            value={queue}
            onValueChange={(value) => setQueue(value as RenderStatus)}
            className="space-y-4"
          >
            <TabsList>
              {QUEUE_TABS.map((status) => (
                <TabsTrigger key={status.id} value={status.id}>
                  {status.label}
                  <Badge variant="secondary" className="ml-1.5">
                    {buckets.get(status.id)?.length ?? 0}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            <p className="text-xs text-muted-foreground">
              As contagens são desta página. Ainda não é possível filtrar por
              situação de emissão.
            </p>

            {QUEUES.map((status) => (
              <TabsContent key={status} value={status}>
                <DocumentList
                  executions={buckets.get(status) ?? []}
                  onOpen={setSelected}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </ListState>

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
