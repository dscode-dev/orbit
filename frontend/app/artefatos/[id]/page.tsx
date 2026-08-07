import { ArtifactStudio } from "@/components/artifact-studio/studio/artifact-studio";
import { Breadcrumbs, entityCrumbs } from "@/navigation";
import { WorkspacePage } from "@/workspace";

/**
 * Artifact Studio — editor.
 *
 * Server Component: resolve o parâmetro da rota; o `WorkspacePage` compõe
 * guards e shell. O editor é Client Component por natureza — é uma sessão de
 * edição com estado local, salvamento automático de propriedades e publicação
 * de versão.
 *
 * A capability exigida é a de **leitura**: quem só lê ainda deve poder abrir o
 * template e inspecionar a estrutura. O que exige `artifact_templates.manage`
 * fica desabilitado dentro da tela, e o backend recusa de todo modo.
 */
export default async function ArtifactStudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <WorkspacePage
      entity="artifact-template"
      header={false}
      suspense={false}
      activeLabel="Artefatos"
      breadcrumb={
        <Breadcrumbs items={entityCrumbs("artifact-template", "Studio")} />
      }
    >
      <ArtifactStudio templateId={id} />
    </WorkspacePage>
  );
}
