import { CustomerWorkspace } from "@/components/customers/workspace/customer-workspace";
import { Breadcrumbs, entityCrumbs } from "@/navigation";
import { WorkspacePage } from "@/workspace";

/**
 * Customer Workspace.
 *
 * Server Component: resolve o parâmetro da rota; o `WorkspacePage` compõe
 * guards e shell. O Workspace é Client Component porque cada painel tem
 * consulta própria e estado de carregamento independente.
 *
 * A capability do guard é a de leitura do CRM, vinda do Entity Registry. Os
 * painéis cruzados verificam as suas próprias e falham isoladamente.
 */
export default async function CustomerWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <WorkspacePage
      entity="customer"
      header={false}
      suspense={false}
      breadcrumb={<Breadcrumbs items={entityCrumbs("customer", "Workspace")} />}
    >
      <CustomerWorkspace customerId={id} />
    </WorkspacePage>
  );
}
