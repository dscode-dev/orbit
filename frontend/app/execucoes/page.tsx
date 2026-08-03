import { Suspense } from "react";

import { ExecutionCenter } from "@/components/artifact-executions/execution-center";
import { AppShell } from "@/components/layout/app-shell";
import { ContentContainer } from "@/components/layout/page-primitives";
import { PanelLoading } from "@/components/panels";
import {
  RequireActiveSubscription,
  RequireAuth,
  RequireCapability,
} from "@/guards";

/**
 * Execuções de artefato — listagem.
 *
 * Server Component: compõe guards e shell, sem estado nem dados. O centro é
 * Client Component porque abas, busca, filtros e paginação são interação.
 *
 * Não há prefetch no servidor: a consulta depende da unidade ativa e dos
 * filtros escolhidos no cliente, e buscar no servidor serviria o escopo errado.
 */
export default function ArtifactExecutionsPage() {
  return (
    <RequireAuth>
      <RequireActiveSubscription>
        <RequireCapability capability="artifact_executions.read">
          <AppShell
            activeLabel="Execuções"
            breadcrumb={<span>Execuções de artefato</span>}
          >
            <ContentContainer size="wide">
              <header className="space-y-2 border-b border-border pb-6">
                <h1 className="font-display text-3xl font-bold tracking-tight">
                  Execuções
                </h1>
                <p className="text-sm text-muted-foreground">
                  Acompanhamento das execuções da unidade ativa: filas,
                  contagens e revisões, tudo calculado pelo backend.
                </p>
              </header>
            </ContentContainer>
            <Suspense fallback={<PanelLoading rows={6} />}>
              <ExecutionCenter />
            </Suspense>
          </AppShell>
        </RequireCapability>
      </RequireActiveSubscription>
    </RequireAuth>
  );
}
