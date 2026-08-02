import { CustomerWorkspace } from "@/components/customers/workspace/customer-workspace";
import { AppShell } from "@/components/layout/app-shell";
import { getEntity } from "@/entities";
import {
  RequireActiveSubscription,
  RequireAuth,
  RequireCapability,
} from "@/guards";

/**
 * Customer Workspace.
 *
 * Server Component: resolve o parâmetro da rota, compõe guards e shell. O
 * Workspace é Client Component porque cada painel tem consulta própria e
 * estado de carregamento independente.
 *
 * A capability do guard é a de leitura do CRM. Os painéis cruzados verificam
 * as suas próprias e falham isoladamente.
 */
export default async function CustomerWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entity = getEntity("customer");

  return (
    <RequireAuth>
      <RequireActiveSubscription>
        <RequireCapability capability={entity.capability.read}>
          <AppShell
            activeLabel={entity.labelPlural}
            breadcrumb={<span>{entity.labelPlural} · Workspace</span>}
          >
            <CustomerWorkspace customerId={id} />
          </AppShell>
        </RequireCapability>
      </RequireActiveSubscription>
    </RequireAuth>
  );
}
