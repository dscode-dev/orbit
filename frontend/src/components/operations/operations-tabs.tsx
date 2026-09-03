"use client";

/**
 * Operações em duas leituras.
 *
 * - **Visão geral** — o centro de gestão: lista, filtros e todas as ações do
 *   Owner sobre cada operação.
 * - **Autorização** — a única configuração do módulo, deliberadamente única.
 *   Configurações por unidade, por tipo ou por técnico não existem no
 *   contrato e não seriam granularidade, seriam invenção.
 */
import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OperationAuthorizationSection } from "./authorization.section";
import { OperationsList } from "./operations-list";

const TABS = { overview: "overview", authorization: "authorization" } as const;

type OperationsTab = (typeof TABS)[keyof typeof TABS];

export function OperationsTabs() {
  const [tab, setTab] = useState<OperationsTab>(TABS.overview);

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as OperationsTab)}
    >
      <TabsList>
        <TabsTrigger value={TABS.overview}>Visão geral</TabsTrigger>
        <TabsTrigger value={TABS.authorization}>Autorização</TabsTrigger>
      </TabsList>

      <TabsContent value={TABS.overview}>
        {tab === TABS.overview ? <OperationsList /> : null}
      </TabsContent>

      <TabsContent value={TABS.authorization}>
        {/* A página já provê o container; aqui basta limitar a largura. */}
        {tab === TABS.authorization ? (
          <div className="max-w-3xl">
            <OperationAuthorizationSection />
          </div>
        ) : null}
      </TabsContent>
    </Tabs>
  );
}
