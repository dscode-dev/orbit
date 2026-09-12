import { DocumentCenter } from "@/components/documents/document-center";
import { WorkspacePage } from "@/workspace";

/**
 * Document Center.
 *
 * Server Component: o `WorkspacePage` compõe guards, shell e cabeçalho. A
 * capability é a que o backend exige em `@Capabilities('artifact_manifests.read')`.
 *
 * `contained={false}` porque a central gerencia a própria largura.
 */
export default function DocumentsPage() {
  return (
    <WorkspacePage
      title="Documentos"
      /**
       * O título da página e o rótulo do menu são diferentes de propósito:
       * dentro da página o cabeçalho "Documentos" basta, mas no menu ele
       * precisa se distinguir de "Relatórios" e "Modelos de documento". Sem
       * isto o item perderia o realce de ativo, que casa os dois textos.
       */
      activeLabel="Documentos emitidos"
      description="Documentos emitidos pela plataforma: revisões, conteúdo, histórico e situação da emissão."
      capability="artifact_manifests.read"
      contained={false}
    >
      <DocumentCenter />
    </WorkspacePage>
  );
}
