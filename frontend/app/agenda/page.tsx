import { Suspense } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { ContentContainer } from "@/components/layout/page-primitives";
import { PanelLoading } from "@/components/panels";
import { SchedulingTabs } from "@/components/scheduling/scheduling-tabs";
import {
  RequireActiveSubscription,
  RequireAuth,
  RequireCapability,
} from "@/guards";

/**
 * Scheduling Workspace.
 *
 * Server Component: compõe guards e shell, sem estado nem dados. As abas e o
 * workspace são Client Components — período, visão, filtros e diálogos são
 * interação.
 *
 * Não há prefetch no servidor: a janela de consulta depende do fuso da unidade
 * ativa e do período escolhido, ambos decididos no cliente. Buscar no servidor
 * serviria a janela errada.
 *
 * `RequireActiveSubscription` cobre o `@RequiresActivePlan()` do controller —
 * plano inativo vê o estado de assinatura bloqueada, não uma agenda vazia.
 */
export default function SchedulingPage() {
  return (
    <RequireAuth>
      <RequireActiveSubscription>
        <RequireCapability capability="scheduling.read">
          <AppShell activeLabel="Agenda" breadcrumb={<span>Agenda</span>}>
            <ContentContainer size="wide">
              <header className="space-y-2 border-b border-border pb-6">
                <h1 className="font-display text-3xl font-bold tracking-tight">
                  Agenda
                </h1>
                <p className="text-sm text-muted-foreground">
                  Operações, visitas, manutenções, compromissos, bloqueios e
                  lembretes da unidade ativa.
                </p>
              </header>
            </ContentContainer>
            <Suspense fallback={<PanelLoading rows={8} />}>
              <SchedulingTabs />
            </Suspense>
          </AppShell>
        </RequireCapability>
      </RequireActiveSubscription>
    </RequireAuth>
  );
}
