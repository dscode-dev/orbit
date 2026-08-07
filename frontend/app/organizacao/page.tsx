import { OrganizationWorkspace } from "@/components/organization/organization-workspace";
import { WorkspacePage } from "@/workspace";

/**
 * Organization Workspace.
 *
 * Server Component: o `WorkspacePage` compõe guards, shell e cabeçalho.
 *
 * O guard usa **permissão**, não capability: `organization.read` é o que
 * distingue o Owner de um operador. As capabilities entram painel a painel,
 * porque cada área da administração exige a sua — e é assim que o backend
 * também decide.
 *
 * `RequireActiveSubscription`, dentro do `WorkspacePage`, cobre o
 * `@RequiresActivePlan()` de `GET /organizations/current`: plano inativo vê o
 * estado de assinatura bloqueada, com o status vindo da sessão, e não uma tela
 * vazia.
 */
export default function OrganizationPage() {
  return (
    <WorkspacePage
      title="Administração"
      description="Organização, plano, unidades, integrações e capabilities."
      permission="organization.read"
      activeLabel="Organização"
      breadcrumb={<span>Organização</span>}
      contained={false}
      loadingRows={8}
    >
      <OrganizationWorkspace />
    </WorkspacePage>
  );
}
