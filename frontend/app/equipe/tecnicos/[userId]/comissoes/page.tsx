import { CommissionDetail } from "@/components/financial/commission-detail";
import { Breadcrumbs, entityCrumbs } from "@/navigation";
import { WorkspacePage } from "@/workspace";

/**
 * Comissão de um técnico — detalhe, histórico e pagamentos.
 *
 * Server Component: resolve o parâmetro da rota; o `WorkspacePage` compõe guards
 * e shell. O conteúdo é Client Component porque escolher período, marcar
 * comissões e pagar é interação.
 *
 * ## O guard é o da equipe, e a tela é financeira
 *
 * A porta é `organization.read` — é a permissão da página de Equipe, de onde se
 * chega aqui. Quanto a pessoa recebe é outra pergunta: a tela só mostra valores
 * com `financial.read`, e o servidor recusa as rotas de comissão sem ela. Exigir
 * a permissão financeira na rota daria 403 de página inteira a quem administra a
 * equipe, quando o que falta é uma seção.
 */
export default async function TechnicianCommissionsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  return (
    <WorkspacePage
      permission="organization.read"
      contained={false}
      activeLabel="Equipe"
      /* A trilha sai do Entity Registry: o caminho da Equipe é o `basePath` da
         entidade, e escrever "/equipe" aqui seria a rota montada à mão que o
         Navigation Core existe para evitar. */
      breadcrumb={
        <Breadcrumbs items={entityCrumbs("team-member", "Comissão")} />
      }
    >
      <CommissionDetail userId={userId} />
    </WorkspacePage>
  );
}
