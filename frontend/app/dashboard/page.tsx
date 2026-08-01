import { AppShell } from "@/components/layout/app-shell";
import { DashboardView } from "@/components/dashboard-widgets/dashboard-view";
import {
  RequireActiveSubscription,
  RequireAuth,
  RequireCapability,
} from "@/guards";

/**
 * Dashboard.
 *
 * Server Component: só compõe o shell e os guards, sem estado nem dados. Toda
 * a interatividade (faixa de período, atualização automática, gráficos) vive
 * no `DashboardView`, que é Client Component.
 *
 * Não há prefetch no servidor: as leituras dependem da unidade ativa, que é
 * uma escolha do cliente (`RequestContextProvider`). Buscar no servidor
 * duplicaria a consulta ou serviria o escopo errado — o benefício de
 * hydration não se sustenta aqui.
 *
 * `dashboard.read` é exigido pelo backend em `@Capabilities` e `@Permissions`;
 * os guards evitam abrir a tela para quem receberia 403 em tudo.
 */
export default function DashboardPage() {
  return (
    <RequireAuth>
      <RequireActiveSubscription>
        <RequireCapability capability="dashboard.read">
          <AppShell
            activeLabel="Visão geral"
            breadcrumb={<span>Dashboard</span>}
          >
            <DashboardView />
          </AppShell>
        </RequireCapability>
      </RequireActiveSubscription>
    </RequireAuth>
  );
}
