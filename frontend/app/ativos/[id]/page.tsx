import { AssetWorkspace } from "@/components/assets/workspace/asset-workspace";
import { AppShell } from "@/components/layout/app-shell";
import { getEntity } from "@/entities";
import {
  RequireActiveSubscription,
  RequireAuth,
  RequireCapability,
} from "@/guards";

/**
 * Asset Workspace.
 *
 * Server Component: resolve o parâmetro da rota, compõe guards e shell. O
 * Workspace é Client Component porque cada painel tem consulta própria e
 * estado de carregamento independente.
 *
 * A capability exigida sai do Entity Registry — a mesma que o backend valida
 * em `@Capabilities('assets.read')`. Painéis de outros módulos verificam as
 * suas próprias e falham isoladamente.
 */
export default async function AssetWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entity = getEntity("asset");

  return (
    <RequireAuth>
      <RequireActiveSubscription>
        <RequireCapability capability={entity.capability.read}>
          <AppShell
            activeLabel={entity.labelPlural}
            breadcrumb={<span>{entity.labelPlural} · Workspace</span>}
          >
            <AssetWorkspace assetId={id} />
          </AppShell>
        </RequireCapability>
      </RequireActiveSubscription>
    </RequireAuth>
  );
}
