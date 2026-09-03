"use client";

/**
 * Execution Center — o centro operacional das execuções de artefato.
 *
 * ## Composição
 *
 * ```
 * KPIs (contagens do servidor, por fila)
 *   │
 *   ├── Visão geral ......... filas destacadas + inteligência da organização
 *   ├── Filas ............... uma consulta filtrada por status, no servidor
 *   └── Revisões ............ pausadas e aguardando revisão, lado a lado
 * ```
 *
 * Cada fila é **uma consulta ao backend** com `status=…`, não um recorte da
 * página carregada. É o único agrupamento que `ArtifactExecutionQueryDto`
 * suporta.
 *
 * ## O que este centro não faz
 *
 * Não altera execução: mudar status, responder campo, anexar e assinar
 * continuam no Workspace da execução, onde o contexto existe. Aqui se
 * acompanha, encontra e navega.
 */
import { useState } from "react";
import { RefreshCw } from "lucide-react";

import { ContentContainer } from "@/components/layout/page-primitives";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useExecutionCounts } from "@/hooks/artifact-executions/use-execution-center";
import { ExecutionsList } from "./executions-list";
import { ExecutionIntelligencePanel } from "./center/intelligence.panel";
import { ExecutionKpis } from "./center/kpis.section";
import { ExecutionQueues } from "./center/queues.section";
import { ExecutionRevisions } from "./center/revisions.section";

const TABS = {
  overview: "overview",
  queues: "queues",
  revisions: "revisions",
} as const;

type CenterTab = (typeof TABS)[keyof typeof TABS];

export function ExecutionCenter() {
  const [tab, setTab] = useState<CenterTab>(TABS.overview);
  const counts = useExecutionCounts();

  return (
    <ContentContainer size="wide" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Contagens e filas por situação.
        </p>
        <Button
          variant="outline"
          size="sm"
          aria-label="Atualizar contagens"
          onClick={counts.refetch}
        >
          <RefreshCw className="size-4" />
          Atualizar
        </Button>
      </div>

      <ExecutionKpis counts={counts} />

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as CenterTab)}
      >
        <TabsList>
          <TabsTrigger value={TABS.overview}>Visão geral</TabsTrigger>
          <TabsTrigger value={TABS.queues}>Filas</TabsTrigger>
          <TabsTrigger value={TABS.revisions}>Revisões</TabsTrigger>
        </TabsList>

        <TabsContent value={TABS.overview}>
          {tab === TABS.overview ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
              <div className="min-w-0">
                <ExecutionQueues
                  counts={counts}
                  onOpenQueues={() => setTab(TABS.queues)}
                />
              </div>
              <ExecutionIntelligencePanel />
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value={TABS.queues}>
          {tab === TABS.queues ? <ExecutionsList /> : null}
        </TabsContent>

        <TabsContent value={TABS.revisions}>
          {tab === TABS.revisions ? (
            <ExecutionRevisions counts={counts} />
          ) : null}
        </TabsContent>
      </Tabs>
    </ContentContainer>
  );
}
