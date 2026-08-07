import { ExecutionCenter } from "@/components/artifact-executions/execution-center";
import { WorkspacePage } from "@/workspace";

/**
 * Execuções de artefato — Execution Center.
 *
 * Server Component: o `WorkspacePage` compõe guards, shell e cabeçalho.
 *
 * `contained={false}` porque as abas do centro gerenciam a própria largura —
 * envolvê-las no container do cabeçalho apertaria as filas.
 */
export default function ArtifactExecutionsPage() {
  return (
    <WorkspacePage
      entity="artifact-execution"
      title="Execuções"
      description="Acompanhamento das execuções da unidade ativa: filas, contagens e revisões, tudo calculado pelo backend."
      breadcrumb={<span>Execuções de artefato</span>}
      contained={false}
    >
      <ExecutionCenter />
    </WorkspacePage>
  );
}
