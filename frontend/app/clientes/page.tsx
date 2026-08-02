import { Suspense } from "react";

import { CustomersList } from "@/components/customers/customers-list";
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
 * Clientes — listagem.
 *
 * Server Component: compõe guards e shell, sem estado nem dados. Rótulo,
 * descrição e capability saem do Entity Registry — os mesmos valores que o
 * guard usa e que o backend exige em `@Capabilities('crm.read')`.
 */
export default function CustomersPage() {
  const entity = getEntity("customer");

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
                <CustomersList />
              </Suspense>
            </ContentContainer>
          </AppShell>
        </RequireCapability>
      </RequireActiveSubscription>
    </RequireAuth>
  );
}
