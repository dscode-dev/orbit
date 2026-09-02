import { CreateTemplateDialog } from "@/components/artifact-studio/create-template-dialog";
import { TemplatesList } from "@/components/artifact-studio/templates-list";
import { WorkspacePage } from "@/workspace";

/**
 * Modelos de documento — listagem.
 *
 * Server Component: o `WorkspacePage` compõe guards, shell e cabeçalho. A lista
 * é Client Component porque filtros, paginação e diálogos são interação.
 *
 * Não há prefetch no servidor: a consulta depende de filtros escolhidos no
 * cliente, e buscar no servidor duplicaria a requisição.
 *
 * O título e o item de menu usam o mesmo nome: "Modelos de documento" diz o
 * que a tela faz para quem administra a operação. "Artifact Studio" era o nome
 * interno da ferramenta, em inglês, num produto que fala português.
 */
export default function ArtifactTemplatesPage() {
  return (
    <WorkspacePage
      title="Modelos de documento"
      description="Modelos da organização e da plataforma. Estrutura, versões e publicação."
      capability="artifact_templates.read"
      activeLabel="Modelos de documento"
      action={<CreateTemplateDialog />}
    >
      <TemplatesList />
    </WorkspacePage>
  );
}
