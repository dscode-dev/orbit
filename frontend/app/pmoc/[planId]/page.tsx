import { PmocWorkspace } from "@/components/pmoc/pmoc-workspace";
import { WorkspacePage } from "@/workspace";

/**
 * Detalhe de um PMOC — URL estável para deep link e recarga.
 */
export default async function PmocPlanPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;

  return (
    <WorkspacePage
      entity="pmoc-plan"
      title="Plano de PMOC"
      description="Configuração, cobertura, ciclos e histórico."
      activeLabel="Detalhe"
      suspense={false}
    >
      <PmocWorkspace planId={planId} />
    </WorkspacePage>
  );
}
