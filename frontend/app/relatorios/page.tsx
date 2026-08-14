import { ReportsWorkspace } from "@/components/management-reports/reports-workspace";
import { WorkspacePage } from "@/workspace";

/**
 * Reports Center — relatórios gerenciais.
 *
 * Server Component: o `WorkspacePage` compõe guards, shell e cabeçalho. O
 * guard sai do Entity Registry (`management-report`), que declara
 * `reports.management.read` — a mesma capability que o backend exige na rota.
 *
 * `contained={false}` porque as abas gerenciam a própria largura.
 */
export default function ManagementReportsPage() {
  return (
    <WorkspacePage
      entity="management-report"
      title="Relatórios"
      description="Fotografias reproduzíveis de um período — não é o painel exportado."
      contained={false}
    >
      <ReportsWorkspace />
    </WorkspacePage>
  );
}
