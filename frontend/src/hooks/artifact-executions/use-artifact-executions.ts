"use client";

/**
 * Query Layer do Artifact Execution Workspace.
 *
 * Três decisões concentram o que este arquivo resolve.
 *
 * **1. A resposta da mutação semeia o cache.** Salvar resposta, mudar status e
 * registrar anexo devolvem `ArtifactExecutionReadModel` **completo**, com
 * `progressDetails` já recalculado pelo servidor. Escrever esse retorno no
 * cache do detalhe evita um `GET` redundante e, principalmente, evita a janela
 * em que a tela mostra progresso velho porque a releitura ainda não voltou.
 *
 * **2. Escritas da mesma execução são serializadas.** `scope` do TanStack
 * Query enfileira as mutações que compartilham o mesmo identificador. Sem
 * isso, dois campos salvos em sequência rápida disputam a última palavra sobre
 * o cache — e o retorno da requisição mais lenta, embora mais antigo,
 * sobrescreveria o da mais rápida. O servidor persiste ambas; o problema é só
 * de ordem de chegada, e é exatamente o que o `scope` resolve.
 *
 * **3. A leitura em voo é cancelada antes de semear.** `cancelQueries` impede
 * que um `GET` disparado antes da escrita aterrisse depois dela e reponha o
 * estado anterior.
 */
import { useQueryClient } from "@tanstack/react-query";

import { useApiMutation } from "@/hooks/api/use-api-mutation";
import { useApiQuery } from "@/hooks/api/use-api-query";
import { queryKeys } from "@/api/query-keys";
import { artifactExecutionsService } from "@/services/artifact-executions.service";
import type {
  ArtifactExecution,
  ArtifactExecutionQuery,
  ChangeArtifactExecutionStatusInput,
  RegisterArtifactAttachmentInput,
  SaveArtifactResponseInput,
  UpdateArtifactExecutionInput,
} from "@/types/artifact-executions";

const RESOURCE = "artifact-executions";
const MINUTE = 60_000;

/**
 * Cadência por leitura.
 *
 * A listagem acompanha execuções em campo e se atualiza sozinha; o detalhe,
 * não — é uma tela de trabalho, e recarregar por conta própria enquanto
 * alguém preenche campos atrapalharia. O detalhe se atualiza pelo retorno das
 * próprias escritas.
 */
export const ARTIFACT_EXECUTIONS_REFRESH = {
  list: { staleTime: 30_000, refetchInterval: MINUTE },
  detail: { staleTime: 15_000, refetchInterval: false as const },
  progress: { staleTime: 15_000, refetchInterval: false as const },
} as const;

export function useArtifactExecutionsList(query: ArtifactExecutionQuery) {
  return useApiQuery(
    artifactExecutionsService.keys.list(query),
    ({ signal }) => artifactExecutionsService.list(query, { signal }),
    {
      ...ARTIFACT_EXECUTIONS_REFRESH.list,
      /** Mantém a página anterior visível durante a troca de página. */
      placeholderData: (previous) => previous,
    },
  );
}

export function useArtifactExecution(id: string) {
  return useApiQuery(
    artifactExecutionsService.keys.detail(id),
    ({ signal }) => artifactExecutionsService.get(id, { signal }),
    ARTIFACT_EXECUTIONS_REFRESH.detail,
  );
}

/**
 * Progresso por endpoint próprio.
 *
 * O detalhe já traz `progressDetails`; esta consulta existe para o painel
 * poder recarregar só o progresso, sem puxar snapshot e respostas junto.
 */
export function useArtifactExecutionProgress(id: string, enabled = true) {
  return useApiQuery(
    artifactExecutionsService.keys.progress(id),
    ({ signal }) => artifactExecutionsService.progress(id, { signal }),
    { ...ARTIFACT_EXECUTIONS_REFRESH.progress, enabled },
  );
}

/**
 * Efeitos comuns a toda escrita que devolve a execução inteira.
 *
 * Devolve as opções de mutação já com serialização por execução, semeadura do
 * cache e invalidação da listagem — que exibe status e progresso e portanto
 * envelhece a cada escrita.
 */
function useExecutionWriteOptions(id: string) {
  const queryClient = useQueryClient();
  const detailKey = artifactExecutionsService.keys.detail(id);

  return {
    /** Enfileira as escritas desta execução, preservando a ordem de chegada. */
    scope: { id: `${RESOURCE}:${id}` },
    onSuccess: async (execution: ArtifactExecution) => {
      await queryClient.cancelQueries({ queryKey: detailKey });
      queryClient.setQueryData(detailKey, execution);
      queryClient.setQueryData(
        artifactExecutionsService.keys.progress(id),
        execution.progressDetails,
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.lists(RESOURCE),
      });
    },
  } as const;
}

/** Transição de status — a validade é da máquina de estados do backend. */
export function useChangeArtifactExecutionStatus(id: string) {
  const options = useExecutionWriteOptions(id);
  return useApiMutation(
    (input: ChangeArtifactExecutionStatusInput) =>
      artifactExecutionsService.changeStatus(id, input),
    options,
  );
}

/** Gravação de uma resposta. Idempotente por `(sectionId, fieldId)`. */
export function useSaveArtifactResponse(id: string) {
  const options = useExecutionWriteOptions(id);
  return useApiMutation(
    (input: SaveArtifactResponseInput) =>
      artifactExecutionsService.saveResponse(id, input),
    options,
  );
}

export function useRegisterArtifactAttachment(id: string) {
  const options = useExecutionWriteOptions(id);
  return useApiMutation(
    (input: RegisterArtifactAttachmentInput) =>
      artifactExecutionsService.registerAttachment(id, input),
    options,
  );
}

export function useUpdateArtifactExecution(id: string) {
  const options = useExecutionWriteOptions(id);
  return useApiMutation(
    (input: UpdateArtifactExecutionInput) =>
      artifactExecutionsService.update(id, input),
    options,
  );
}
