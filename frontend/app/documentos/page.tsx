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
      description="Documentos emitidos pela plataforma: revisões, conteúdo, histórico e situação da emissão."
      capability="artifact_manifests.read"
      contained={false}
    >
      <DocumentCenter />
    </WorkspacePage>
  );
}
