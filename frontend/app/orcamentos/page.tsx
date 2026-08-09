import { QuotesWorkspace } from "@/components/quotes/quotes-workspace";
import { Breadcrumbs, entityCrumbs } from "@/navigation";
import { WorkspacePage } from "@/workspace";

/**
 * Quotes Workspace.
 *
 * Server Component: o `WorkspacePage` compõe guards, shell e cabeçalho.
 * Título, descrição e capability vêm do Entity Registry — `quotes.read` é a
 * mesma que o backend exige, e ela não decorre de ter acesso a clientes ou ao
 * catálogo.
 */
export default function QuotesPage() {
  return (
    <WorkspacePage
      entity="quote"
      contained={false}
      breadcrumb={<Breadcrumbs items={entityCrumbs("quote")} />}
    >
      <QuotesWorkspace />
    </WorkspacePage>
  );
}
