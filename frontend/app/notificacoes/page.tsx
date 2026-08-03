import { Suspense } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { ContentContainer } from "@/components/layout/page-primitives";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { PanelLoading } from "@/components/panels";
import {
  RequireActiveSubscription,
  RequireAuth,
  RequireCapability,
} from "@/guards";

/**
 * Notification Center.
 *
 * Server Component: compõe guards e shell, sem estado nem dados. A central é
 * Client Component porque tem polling, filtros e mutações.
 *
 * `RequireActiveSubscription` cobre o `@RequiresActivePlan()` do controller:
 * plano inativo vê o estado de assinatura bloqueada, não uma lista vazia.
 */
export default function NotificationsPage() {
  return (
    <RequireAuth>
      <RequireActiveSubscription>
        <RequireCapability capability="notifications.read">
          <AppShell
            activeLabel="Notificações"
            breadcrumb={<span>Notificações</span>}
          >
            <ContentContainer size="wide" className="space-y-8">
              <header className="space-y-2 border-b border-border pb-6">
                <h1 className="font-display text-3xl font-bold tracking-tight">
                  Notificações
                </h1>
                <p className="text-sm text-muted-foreground">
                  Avisos de operações, agenda, artefatos, plano e sistema.
                </p>
              </header>
              <Suspense fallback={<PanelLoading rows={6} />}>
                <NotificationCenter />
              </Suspense>
            </ContentContainer>
          </AppShell>
        </RequireCapability>
      </RequireActiveSubscription>
    </RequireAuth>
  );
}
