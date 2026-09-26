import { TemplatesList } from "@/components/artifact-studio/templates-list";
import { WorkspacePage } from "@/workspace";

/**
 * Modelos de documento — os que a operação pode emitir.
 *
 * Server Component: o `WorkspacePage` compõe guards, shell e cabeçalho. A lista
 * é Client Component porque abrir o exemplo é interação.
 *
 * ## O botão de novo modelo saiu
 *
 * A tela oferecia criar um modelo do zero. Quem administra uma empresa de
 * refrigeração não desenha um formulário de PMOC campo por campo — usa o modelo
 * que já atende a norma, e é isso que o Orbit instala junto com o sistema. O
 * diálogo de criação continua no repositório, sem porta de entrada.
 */
export default function ArtifactTemplatesPage() {
  return (
    <WorkspacePage
      title="Modelos de documento"
      description="Os modelos que a sua operação pode emitir. Abra um para ver como o documento sai."
      capability="artifact_templates.read"
      activeLabel="Modelos de documento"
    >
      <TemplatesList />
    </WorkspacePage>
  );
}
