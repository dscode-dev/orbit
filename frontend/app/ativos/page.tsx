import { Suspense } from "react";

import { AssetsList } from "@/components/assets/assets-list";
import { AppShell } from "@/components/layout/app-shell";
import { ContentContainer } from "@/components/layout/page-primitives";
import { PanelLoading } from "@/components/panels";
import { getEntity } from "@/entities";
import {
  RequireActiveSubscription,
  RequireAuth,
  RequireCapability,
} from "@/guards";

/**
 * Ativos — listagem.
 *
 * Server Component: compõe guards e shell, sem estado nem dados. O cabeçalho
 * vem do Entity Registry, que é a fonte do rótulo, da descrição e da
 * capability exigida — os mesmos valores que o guard usa.
 *
 * `RequireActiveSubscription` cobre o `@RequiresActivePlan()` do controller:
 * plano inativo vê o estado de assinatura bloqueada, não uma lista vazia.
 */
export default function AssetsPage() {
  const entity = getEntity("asset");

  return (
    <RequireAuth>
      <RequireActiveSubscription>
        <RequireCapability capability={entity.capability.read}>
          <AppShell
            activeLabel={entity.labelPlural}
            breadcrumb={<span>{entity.labelPlural}</span>}
          >
            <ContentContainer size="wide" className="space-y-8">
              <header className="space-y-2 border-b border-border pb-6">
                <h1 className="font-display text-3xl font-bold tracking-tight">
                  {entity.labelPlural}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {entity.description}
                </p>
              </header>
              <Suspense fallback={<PanelLoading rows={6} />}>
                <AssetsList />
              </Suspense>
            </ContentContainer>
          </AppShell>
        </RequireCapability>
      </RequireActiveSubscription>
    </RequireAuth>
  );
}
