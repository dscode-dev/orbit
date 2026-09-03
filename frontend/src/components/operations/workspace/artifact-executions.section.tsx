"use client";

/**
 * As execuções de artefato desta operação.
 *
 * `ArtifactExecution` é o preenchimento de um artefato — o documento que a
 * equipe responde em campo. Nasce por quatro caminhos independentes, e a
 * operação é um deles: `GET /artifact-executions?operationId=` é contrato
 * publicado, e é o recorte que esta seção usa.
 *
 * **Não é a seção de checklists.** `ChecklistExecution` é outro conceito, com
 * contrato próprio, e continua onde estava. As duas convivem porque são coisas
 * diferentes, e juntá-las apagaria a diferença.
 *
 * O recorte vai para o servidor e viaja também no "Ver tudo": a fila abre já
 * filtrada por esta operação, em vez da organização inteira.
 */
import { RelatedRecordsPanel } from "@/entities/related-records";
import { useOperationArtifactExecutions } from "@/hooks/operations/use-operations";
import { ROUTES } from "@/lib/routes";

export function OperationArtifactExecutionsSection({
  operationId,
}: {
  operationId: string;
}) {
  const query = useOperationArtifactExecutions(operationId);

  return (
    <RelatedRecordsPanel
      entity="artifact-execution"
      panelId="operation-artifact-executions"
      title="Execuções de artefato"
      description="Documentos preenchidos no atendimento desta operação"
      query={query}
      emptyMessage="Nenhuma execução de artefato vinculada a esta operação."
      seeAllHref={`${ROUTES.executions}?operationId=${operationId}`}
      toRows={(page) =>
        page.data.map((execution) => ({
          key: execution.id,
          entityId: execution.id,
          title: execution.title,
          subtitle: `${execution.code} · ${execution.progress}% concluído`,
          status: execution.status,
        }))
      }
    />
  );
}
