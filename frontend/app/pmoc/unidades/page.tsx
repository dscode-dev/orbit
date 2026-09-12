import { PmocUnitsSection } from "@/components/pmoc/pmoc-units.section";
import { Breadcrumbs, entityCrumbs } from "@/navigation";
import { WorkspacePage } from "@/workspace";

/**
 * Cadastro das unidades de PMOC.
 *
 * Rota estática antes de `[planId]`: o Next resolve o segmento literal
 * primeiro, então `/pmoc/unidades` nunca é lido como id de plano.
 */
export default function PmocUnitsPage() {
  return (
    <WorkspacePage
      entity="pmoc-plan"
      title="Unidades de PMOC"
      description="As partes do sistema que recebem manutenção — condensadora, evaporadora, dutos —, cada uma com o roteiro que o relatório descreve."
      activeLabel="Unidades"
      suspense={false}
      breadcrumb={<Breadcrumbs items={entityCrumbs("pmoc-plan", "Unidades")} />}
    >
      <PmocUnitsSection />
    </WorkspacePage>
  );
}
