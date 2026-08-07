import { DashboardView } from "@/components/dashboard-widgets/dashboard-view";
import { WorkspacePage } from "@/workspace";

/**
 * Dashboard.
 *
 * Server Component: o `WorkspacePage` compõe os guards e o shell. Toda a
 * interatividade (faixa de período, atualização automática, gráficos) vive no
 * `DashboardView`, que é Client Component.
 *
 * Sem `title`: o cabeçalho do dashboard carrega o seletor de período e por isso
 * pertence ao `DashboardView`. Dois cabeçalhos empilhados seriam pior.
 *
 * Não há prefetch no servidor: as leituras dependem da unidade ativa, que é uma
 * escolha do cliente (`RequestContextProvider`). Buscar no servidor duplicaria
 * a consulta ou serviria o escopo errado.
 */
export default function DashboardPage() {
  return (
    <WorkspacePage
      capability="dashboard.read"
      activeLabel="Visão geral"
      breadcrumb={<span>Dashboard</span>}
      suspense={false}
    >
      <DashboardView />
    </WorkspacePage>
  );
}
