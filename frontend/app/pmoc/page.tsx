import { PmocCenter } from "@/components/pmoc/pmoc-center";
import { WorkspacePage } from "@/workspace";

/**
 * PMOC — configurações de manutenção preventiva.
 *
 * Server Component: o `WorkspacePage` compõe guards, shell e cabeçalho, e a
 * capability `pmoc.read` decide se a rota abre.
 */
export default function PmocPage() {
  return (
    <WorkspacePage
      entity="pmoc-plan"
      description="Contratos de manutenção preventiva: cobertura de equipamentos, periodicidade e responsável técnico. Ciclos e execuções vivem dentro de cada plano."
      suspense={false}
    >
      <PmocCenter />
    </WorkspacePage>
  );
}
