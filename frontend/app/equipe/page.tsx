import { WorkforceWorkspace } from "@/components/workforce/workforce-workspace";
import { Breadcrumbs, entityCrumbs } from "@/navigation";
import { WorkspacePage } from "@/workspace";

/**
 * Workforce Management — equipe, convites e papéis.
 *
 * Server Component: o `WorkspacePage` compõe guards, shell e cabeçalho.
 *
 * O guard usa **permissão**, não capability: `organization.read` é o que
 * distingue quem administra a organização de um operador — e é a mesma
 * autorização de `GET /organizations/current/members`, de onde a equipe vem.
 * Não é um recurso de plano.
 *
 * `contained={false}` porque as abas gerenciam a própria largura.
 */
export default function TeamPage() {
  return (
    <WorkspacePage
      entity="team-member"
      permission="organization.read"
      contained={false}
      breadcrumb={<Breadcrumbs items={entityCrumbs("team-member")} />}
    >
      <WorkforceWorkspace />
    </WorkspacePage>
  );
}
