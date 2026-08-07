import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import { WorkspacePage } from "@/workspace";

/**
 * Configurações — governança da plataforma.
 *
 * Server Component: o `WorkspacePage` compõe guards, shell e cabeçalho.
 *
 * O guard usa **permissão**, não capability: `organization.read` é o que
 * distingue quem administra a organização de um operador — a mesma autorização
 * do Organization Workspace, de onde vêm os dados da primeira aba.
 *
 * `contained={false}` porque as abas gerenciam a própria largura.
 */
export default function SettingsPage() {
  return (
    <WorkspacePage
      title="Configurações"
      description="Organização, operação, agenda, documentos, notificações, segurança e integrações."
      permission="organization.read"
      activeLabel="Configurações"
      contained={false}
    >
      <SettingsWorkspace />
    </WorkspacePage>
  );
}
