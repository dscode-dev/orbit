import { ExecutionWorkspace } from "@/components/artifact-executions/workspace/execution-workspace";
import { AppShell } from "@/components/layout/app-shell";
import {
  RequireActiveSubscription,
  RequireAuth,
  RequireCapability,
} from "@/guards";

/**
 * Artifact Execution Workspace.
 *
 * Server Component: resolve o parâmetro da rota, compõe guards e shell. O
 * Workspace é Client Component — é uma tela de trabalho, com escrita campo a
 * campo e estado de mutação por painel.
 *
 * A capability exigida é a de leitura. Executar exige
 * `artifact_executions.execute`, verificada dentro da tela para desabilitar as
 * ações; o backend recusa de todo modo.
 */
export default async function ArtifactExecutionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <RequireAuth>
      <RequireActiveSubscription>
        <RequireCapability capability="artifact_executions.read">
          <AppShell
            activeLabel="Execuções"
            breadcrumb={<span>Execuções · Workspace</span>}
          >
            <ExecutionWorkspace executionId={id} />
          </AppShell>
        </RequireCapability>
      </RequireActiveSubscription>
    </RequireAuth>
  );
}
