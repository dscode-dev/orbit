"use client";

/**
 * A equipe do atendimento.
 *
 * Até a PR-FE-02 esta seção listava `operation.users` — o vínculo genérico,
 * sem distinguir quem responde de quem acompanha — e o cabeçalho registrava
 * que atribuir era impossível por falta de um seletor no backend. Os dois
 * fatos mudaram: a PR-28 publicou responsável e auxiliares como conceitos
 * separados, e a PR-27 publicou os seletores por papel profissional.
 *
 * O conteúdo é o `OperationTeamPanel`, compartilhado com o que PMOC e RVT vão
 * precisar. O que fica aqui é a moldura do Workspace — título, contagem e os
 * estados de carregamento e erro que todas as seções usam.
 */
import { PanelFrame, PanelState, type PanelQuery } from "@/components/panels";
import { Badge } from "@/components/ui/badge";
import type { Operation } from "@/types/operations";
import { OperationTeamPanel } from "../operation-team.panel";

export function AssigneesSection({ query }: { query: PanelQuery<Operation> }) {
  const operation = query.data;
  /** Responsável conta como pessoa na equipe, não só os auxiliares. */
  const size = operation
    ? (operation.responsibleFieldTechnician ? 1 : 0) +
      operation.auxiliaryTechnicians.length
    : null;

  return (
    <PanelFrame
      panelId="operation-assignees"
      title="Equipe"
      description="Responsável, auxiliares técnico e histórico de execução"
      actions={size === null ? null : <Badge variant="secondary">{size}</Badge>}
    >
      <PanelState query={query} loadingRows={3}>
        {(current) => <OperationTeamPanel operation={current} />}
      </PanelState>
    </PanelFrame>
  );
}
