import { OperationWorkspace } from "@/components/operations/workspace/operation-workspace";
import { Breadcrumbs, entityCrumbs } from "@/navigation";
import { WorkspacePage } from "@/workspace";

/**
 * Workspace da operação.
 *
 * Server Component: resolve o parâmetro da rota; o `WorkspacePage` compõe
 * guards e shell. Todas as seções são Client Components — dependem de
 * interação, atualização automática e upload.
 */
export default async function OperationWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <WorkspacePage
      entity="operation"
      header={false}
      suspense={false}
      breadcrumb={<Breadcrumbs items={entityCrumbs("operation", "Detalhe")} />}
    >
      <OperationWorkspace operationId={id} />
    </WorkspacePage>
  );
}
