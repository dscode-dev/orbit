import { AssetWorkspace } from "@/components/assets/workspace/asset-workspace";
import { Breadcrumbs, entityCrumbs } from "@/navigation";
import { WorkspacePage } from "@/workspace";

/**
 * Asset Workspace.
 *
 * Server Component: resolve o parâmetro da rota; o `WorkspacePage` compõe
 * guards e shell. O Workspace é Client Component porque cada painel tem
 * consulta própria e estado de carregamento independente.
 *
 * `header={false}`: o cabeçalho desta tela mostra o ativo — nome, status,
 * ações — e só o cliente conhece esses dados. A capability continua vindo do
 * Entity Registry, a mesma que o backend valida em `@Capabilities('assets.read')`.
 */
export default async function AssetWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <WorkspacePage
      entity="asset"
      header={false}
      suspense={false}
      breadcrumb={<Breadcrumbs items={entityCrumbs("asset", "Workspace")} />}
    >
      <AssetWorkspace assetId={id} />
    </WorkspacePage>
  );
}
