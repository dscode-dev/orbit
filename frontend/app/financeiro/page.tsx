import { FinancialWorkspace } from "@/components/financial/financial-workspace";
import { Breadcrumbs, entityCrumbs } from "@/navigation";
import { WorkspacePage } from "@/workspace";

/**
 * Financial Workspace.
 *
 * Server Component: o `WorkspacePage` compõe guards, shell e cabeçalho. Título,
 * descrição e capability vêm do Entity Registry — `financial.read` é a mesma
 * que o backend exige em `@Capabilities`, e ela **não** é concedida por ter
 * acesso a operações ou clientes.
 *
 * `contained={false}` porque as abas gerenciam a própria largura.
 */
export default function FinancialPage() {
  return (
    <WorkspacePage
      entity="financial-entry"
      contained={false}
      breadcrumb={<Breadcrumbs items={entityCrumbs("financial-entry")} />}
    >
      <FinancialWorkspace />
    </WorkspacePage>
  );
}
