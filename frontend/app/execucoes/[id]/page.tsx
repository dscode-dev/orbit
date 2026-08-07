import { ExecutionWorkspace } from "@/components/artifact-executions/workspace/execution-workspace";
import { Breadcrumbs, entityCrumbs } from "@/navigation";
import { WorkspacePage } from "@/workspace";

/**
 * Artifact Execution Workspace.
 *
 * Server Component: resolve o parâmetro da rota; o `WorkspacePage` compõe
 * guards e shell. O Workspace é Client Component — é uma tela de trabalho, com
 * escrita campo a campo e estado de mutação por painel.
 */
export default async function ArtifactExecutionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <WorkspacePage
      entity="artifact-execution"
      header={false}
      suspense={false}
      breadcrumb={
        <Breadcrumbs items={entityCrumbs("artifact-execution", "Workspace")} />
      }
    >
      <ExecutionWorkspace executionId={id} />
    </WorkspacePage>
  );
}
