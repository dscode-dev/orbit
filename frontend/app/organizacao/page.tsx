import { Suspense } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { ContentContainer } from "@/components/layout/page-primitives";
import { OrganizationWorkspace } from "@/components/organization/organization-workspace";
import { PanelLoading } from "@/components/panels";
import {
  RequireActiveSubscription,
  RequireAuth,
  RequirePermission,
} from "@/guards";

/**
 * Organization Workspace.
 *
 * Server Component: compõe guards e shell, sem estado nem dados.
 *
 * O guard usa **permissão**, não capability: `organization.read` é o que
 * distingue o Owner de um operador. As capabilities entram painel a painel,
 * porque cada área da administração exige a sua — e é assim que o backend
 * também decide.
 *
 * `RequireActiveSubscription` cobre o `@RequiresActivePlan()` de
 * `GET /organizations/current`: plano inativo vê o estado de assinatura
 * bloqueada, com o status vindo da sessão, e não uma tela vazia.
 */
export default function OrganizationPage() {
  return (
    <RequireAuth>
      <RequireActiveSubscription>
        <RequirePermission permission="organization.read">
          <AppShell
            activeLabel="Organização"
            breadcrumb={<span>Organização</span>}
          >
            <ContentContainer size="wide">
              <header className="space-y-2 border-b border-border pb-6">
                <h1 className="font-display text-3xl font-bold tracking-tight">
                  Administração
                </h1>
                <p className="text-sm text-muted-foreground">
                  Organização, plano, unidades, integrações e capabilities.
                </p>
              </header>
            </ContentContainer>
            <Suspense fallback={<PanelLoading rows={8} />}>
              <OrganizationWorkspace />
            </Suspense>
          </AppShell>
        </RequirePermission>
      </RequireActiveSubscription>
    </RequireAuth>
  );
}
