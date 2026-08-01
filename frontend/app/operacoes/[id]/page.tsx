import { AppShell } from "@/components/layout/app-shell";
import { OperationWorkspace } from "@/components/operations/workspace/operation-workspace";
import {
  RequireActiveSubscription,
  RequireAuth,
  RequireCapability,
} from "@/guards";

/**
 * Workspace da operação.
 *
 * Server Component: resolve o parâmetro da rota, compõe guards e shell. Todas
 * as seções são Client Components — dependem de interação, atualização
 * automática e upload.
 */
export default async function OperationWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <RequireAuth>
      <RequireActiveSubscription>
        <RequireCapability capability="operations.read">
          <AppShell
            activeLabel="Operações"
            breadcrumb={<span>Operações · Detalhe</span>}
          >
            <OperationWorkspace operationId={id} />
          </AppShell>
        </RequireCapability>
      </RequireActiveSubscription>
    </RequireAuth>
  );
}
