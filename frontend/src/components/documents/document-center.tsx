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
import { useEffect, useMemo, useState } from "react";
import { FileStack, ListFilter, Search } from "lucide-react";

import { EmptyState } from "@/components/feedback/states";
import { ContentContainer } from "@/components/layout/page-primitives";
import { PanelError, PanelLoading } from "@/components/panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { allRenderStatuses } from "@/documents";
import { useArtifactExecutionsList } from "@/hooks/artifact-executions/use-artifact-executions";
import { useActiveScope } from "@/providers/use-active-scope";
import type {
  ArtifactExecutionListItem,
  ArtifactExecutionQuery,
} from "@/types/artifact-executions";
import type { RenderStatus } from "@/types/documents";
import { DocumentList } from "./document-list";
import { DocumentViewer } from "./document-viewer";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

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

export function DocumentCenter() {
  const { businessUnitId } = useActiveScope();
  const [queue, setQueue] = useState<RenderStatus>("READY");
  const [searchTerm, setSearchTerm] = useState("");
  const [search, setSearch] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  /** A busca só viaja depois que a digitação para. */
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchTerm || undefined);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const query = useMemo<ArtifactExecutionQuery>(
    () => ({
      page,
      limit: PAGE_SIZE,
      search,
      businessUnitId: businessUnitId ?? undefined,
    }),
    [page, search, businessUnitId],
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
  const items = useMemo(
    () => executions.data?.data ?? [],
    [executions.data],
  );
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
        <div className="min-w-64 flex-1 space-y-2">
          <Label htmlFor="documents-search">Buscar</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="documents-search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Código ou título da execução"
              className="pl-9"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            O backend busca por código e título da execução. Não há busca pelo
            conteúdo do documento.
          </p>
        </div>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <ListFilter className="size-4" aria-hidden />
          <span>
            {meta
              ? meta.total === 0
                ? "Nenhuma execução"
                : `${items.length} de ${meta.total} nesta página`
              : "Carregando…"}
          </span>
        </div>
      </div>

      {executions.isPending ? (
        <PanelLoading rows={6} />
      ) : executions.error ? (
        <PanelError
          error={executions.error}
          onRetry={() => void executions.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FileStack className="size-5" />}
          title="Nenhum documento nesta unidade"
          description="Os documentos aparecem aqui depois que uma execução é submetida e renderizada."
        />
      ) : (
        <Tabs
          value={queue}
          onValueChange={(value) => setQueue(value as RenderStatus)}
          className="space-y-4"
        >
          <TabsList>
            {allRenderStatuses()
              .slice()
              .sort(
                (left, right) =>
                  QUEUES.indexOf(left.id) - QUEUES.indexOf(right.id),
              )
              .map((status) => (
                <TabsTrigger key={status.id} value={status.id}>
                  {status.label}
                  <Badge variant="secondary" className="ml-1.5">
                    {buckets.get(status.id)?.length ?? 0}
                  </Badge>
                </TabsTrigger>
              ))}
          </TabsList>

          <p className="text-xs text-muted-foreground">
            As contagens são desta página. O backend não filtra execuções por
            estado de renderização — a limitação está documentada.
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

      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={!meta.hasPreviousPage || executions.isFetching}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {meta.page} de {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!meta.hasNextPage || executions.isFetching}
            onClick={() => setPage((current) => current + 1)}
          >
            Próxima
          </Button>
        </div>
      ) : null}

      <DocumentViewer
        executionId={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </ContentContainer>
  );
}
