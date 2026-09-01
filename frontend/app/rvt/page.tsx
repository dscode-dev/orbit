import { RvtCenter } from "@/components/rvt/rvt-center";
import { WorkspacePage } from "@/workspace";

/**
 * RVT — visitas técnicas.
 *
 * Server Component: o `WorkspacePage` compõe guards, shell e cabeçalho, e a
 * capability `rvt.read` decide se a rota abre.
 */
export default function RvtPage() {
  return (
    <WorkspacePage
      entity="rvt-configuration"
      description="Configurações de visita técnica: periodicidade, local e procedimento. As visitas previstas e suas execuções vivem dentro de cada configuração."
      suspense={false}
    >
      <RvtCenter />
    </WorkspacePage>
  );
}
