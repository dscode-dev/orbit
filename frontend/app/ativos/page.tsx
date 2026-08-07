import { AssetsList } from "@/components/assets/assets-list";
import { WorkspacePage } from "@/workspace";

/**
 * Ativos — listagem.
 *
 * Server Component: o `WorkspacePage` compõe guards, shell e cabeçalho. Título,
 * descrição e capability vêm do Entity Registry — os mesmos valores que o guard
 * usa e que o backend exige.
 *
 * `RequireActiveSubscription`, dentro do `WorkspacePage`, cobre o
 * `@RequiresActivePlan()` do controller: plano inativo vê o estado de
 * assinatura bloqueada, não uma lista vazia.
 */
export default function AssetsPage() {
  return (
    <WorkspacePage entity="asset">
      <AssetsList />
    </WorkspacePage>
  );
}
