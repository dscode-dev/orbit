"use client";

/**
 * Editabilidade **aprendida do servidor**, não deduzida no cliente.
 *
 * `ArtifactExecutionPolicy.assertEditable` decide se uma execução aceita
 * escrita. Reproduzir a lista de status editáveis aqui criaria uma segunda
 * fonte de verdade que se desatualiza no primeiro ajuste do backend.
 *
 * Em vez disso o Workspace tenta, e **escuta a recusa**: quando o servidor
 * responde `ARTIFACT_EXECUTION_NOT_EDITABLE`, os painéis de escrita passam a
 * se apresentar como somente leitura pelo resto da visita, com a mensagem que
 * veio de lá. A regra continua sendo do servidor; o que o cliente guarda é a
 * resposta que já recebeu, para não insistir em algo que sabe que será
 * recusado.
 *
 * O estado é reiniciado ao trocar de execução — a recusa é sobre aquela
 * execução naquele momento, não uma configuração do usuário.
 */
import { useCallback, useState } from "react";

import { ApiError } from "@/lib/api-error";
import { ARTIFACT_EXECUTION_ERROR_CODES } from "@/types/artifact-executions";

export interface ExecutionEditability {
  /** `false` depois de o servidor recusar uma escrita por não ser editável. */
  readonly writable: boolean;
  /** Mensagem que o servidor deu ao recusar. */
  readonly reason: string | null;
  /** Passe todo erro de mutação por aqui. */
  readonly observe: (error: unknown) => void;
}

export function useExecutionEditability(
  executionId: string,
): ExecutionEditability {
  const [refusal, setRefusal] = useState<{
    executionId: string;
    reason: string;
  } | null>(null);

  const observe = useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiError)) return;
      if (error.code !== ARTIFACT_EXECUTION_ERROR_CODES.notEditable) return;
      setRefusal({ executionId, reason: error.message });
    },
    [executionId],
  );

  const current = refusal?.executionId === executionId ? refusal : null;

  return {
    writable: current === null,
    reason: current?.reason ?? null,
    observe,
  };
}
