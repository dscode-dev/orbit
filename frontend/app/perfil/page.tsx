import { ProfileWorkspace } from "@/components/profile/profile-workspace";
import { WorkspacePage } from "@/workspace";

/**
 * Perfil — a própria conta.
 *
 * Server Component: o `WorkspacePage` compõe guards, shell e cabeçalho.
 *
 * **Sem capability nem permissão**: todo mundo administra a própria conta, e
 * exigir algo do plano para alguém trocar a própria senha seria absurdo. O
 * `RequireAuth` do `WorkspacePage` já garante o que importa — estar
 * autenticado.
 *
 * `contained={false}` porque as abas gerenciam a própria largura.
 */
export default function ProfilePage() {
  return (
    <WorkspacePage
      title="Meu perfil"
      description="Seus dados, segurança, preferências e o contexto em que você está trabalhando."
      activeLabel="Perfil"
      subscription={false}
      contained={false}
    >
      <ProfileWorkspace />
    </WorkspacePage>
  );
}
