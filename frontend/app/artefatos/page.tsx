import { CreateTemplateDialog } from "@/components/artifact-studio/create-template-dialog";
import { TemplatesList } from "@/components/artifact-studio/templates-list";
import { WorkspacePage } from "@/workspace";

/**
 * Artifact Studio — listagem.
 *
 * Server Component: o `WorkspacePage` compõe guards, shell e cabeçalho. A lista
 * é Client Component porque filtros, paginação e diálogos são interação.
 *
 * Não há prefetch no servidor: a consulta depende de filtros escolhidos no
 * cliente, e buscar no servidor duplicaria a requisição.
 *
 * O título é próprio, e não o do Entity Registry: a entidade se chama
 * "Artefatos" no menu, mas a tela é o Studio — são nomes diferentes de
 * propósito, e por isso `activeLabel` aponta para o item do menu.
 */
export default function ArtifactTemplatesPage() {
  return (
    <WorkspacePage
      title="Artifact Studio"
      description="Templates de artefatos da organização e da plataforma. Estrutura, versões e publicação."
      capability="artifact_templates.read"
      activeLabel="Artefatos"
      action={<CreateTemplateDialog />}
    >
      <TemplatesList />
    </WorkspacePage>
  );
}
