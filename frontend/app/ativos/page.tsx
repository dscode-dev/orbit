import { AssetsList } from "@/components/assets/assets-list";
import { Breadcrumbs, entityCrumbs } from "@/navigation";
import { WorkspacePage } from "@/workspace";

/**
 * Equipamentos — listagem geral.
 *
 * **Fora do menu principal desde a PR-15.** A entrada natural do parque
 * instalado é o cliente que o contratou: a aba **Equipamentos** do Customer
 * Workspace. Esta rota permanece por três motivos concretos:
 *
 * - **deep link** — links salvos e compartilhados para `/ativos` continuam
 *   funcionando;
 * - **destino de fallback** — um equipamento sem cliente vinculado
 *   (`customerId` é opcional no contrato) não tem para onde voltar senão aqui;
 * - **paleta de comandos** — ⌘K ainda leva à visão geral do parque, que é
 *   legítima quando a pergunta é sobre a frota e não sobre um contrato.
 *
 * A rota mantém o caminho `/ativos`: renomeá-la para `/equipamentos` quebraria
 * links existentes e QR Codes já impressos, sem ganho nenhum — o usuário lê
 * "Equipamentos" porque é o que o Entity Registry publica.
 */
export default function AssetsPage() {
  return (
    <WorkspacePage
      entity="asset"
      breadcrumb={<Breadcrumbs items={entityCrumbs("asset")} />}
    >
      <AssetsList />
    </WorkspacePage>
  );
}
