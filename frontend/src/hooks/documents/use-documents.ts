"use client";

/**
 * Query Layer do Document Center.
 *
 * ## Polling: sem infraestrutura nova
 *
 * O enunciado pede para não criar polling próprio se já existir mecanismo
 * reutilizável. Existe: `refetchInterval` do TanStack Query, que já move a
 * agenda, a listagem de execuções e o contador de notificações. É ele que
 * acompanha uma renderização em curso.
 *
 * A cadência é **condicional ao estado**: enquanto o backend diz `PENDING` ou
 * `RENDERING`, a consulta se repete a cada três segundos; em `READY`, `FAILED`
 * ou `NOT_RENDERED`, ela para. Um documento pronto não precisa ser perguntado
 * de novo, e um documento falho não melhora sozinho.
 *
 * Não há WebSocket para renderização — o gateway do backend é de notificações.
 * A lacuna está documentada; nada aqui simula tempo real.
 */
import { useApiMutation } from "@/hooks/api/use-api-mutation";
import { useApiQuery } from "@/hooks/api/use-api-query";
import { documentsService } from "@/services/documents.service";
import type { RenderState, RequestRenderInput } from "@/types/documents";

const SECOND = 1000;

/** Estados em que ainda há trabalho acontecendo no servidor. */
const IN_FLIGHT: readonly string[] = ["PENDING", "RENDERING"];

export const DOCUMENTS_REFRESH = {
  /** Revisões mudam quando uma renderização termina. */
  manifests: { staleTime: 15 * SECOND },
  manifest: { staleTime: 30 * SECOND },
  metrics: { staleTime: 60 * SECOND },
} as const;

export function useExecutionManifests(executionId: string, enabled = true) {
  return useApiQuery(
    documentsService.keys.manifests(executionId),
    ({ signal }) => documentsService.manifests(executionId, { signal }),
    { ...DOCUMENTS_REFRESH.manifests, enabled: enabled && Boolean(executionId) },
  );
}

export function useManifest(id: string | null) {
  return useApiQuery(
    documentsService.keys.manifest(id ?? ""),
    ({ signal }) => documentsService.manifest(id as string, { signal }),
    { ...DOCUMENTS_REFRESH.manifest, enabled: id !== null },
  );
}

/**
 * Estado da renderização, com acompanhamento enquanto está em curso.
 *
 * `refetchInterval` recebe uma função: o TanStack Query a chama com o último
 * dado e decide o próximo ciclo. É assim que a consulta se desliga sozinha
 * quando o backend termina.
 */
export function useRenderState(executionId: string, enabled = true) {
  return useApiQuery(
    documentsService.keys.renderState(executionId),
    ({ signal }) => documentsService.renderState(executionId, { signal }),
    {
      staleTime: 2 * SECOND,
      enabled: enabled && Boolean(executionId),
      refetchInterval: (query) => {
        const state = query.state.data as RenderState | undefined;
        return state && IN_FLIGHT.includes(state.renderStatus)
          ? 3 * SECOND
          : false;
      },
    },
  );
}

/**
 * Solicita a renderização.
 *
 * Sem atualização otimista: o backend pode recusar por estado da execução
 * (409), por renderer desconhecido (400) ou por permissão (403). Invalida o
 * estado e as revisões — quem responde o que aconteceu é o servidor.
 */
export function useRequestRender(executionId: string) {
  return useApiMutation(
    (input: RequestRenderInput) =>
      documentsService.requestRender(executionId, input),
    {
      invalidate: [
        documentsService.keys.renderState(executionId),
        documentsService.keys.manifests(executionId),
      ],
    },
  );
}

/**
 * Renderizadores disponíveis nesta instalação.
 *
 * Vêm de `/artifact-rendering/metrics`, que publica `renderers`. Não há
 * endpoint dedicado de catálogo — a lacuna está registrada; enquanto isso, a
 * lista publicada é a fonte, e não uma constante inventada no cliente.
 */
export function useAvailableRenderers() {
  const query = useApiQuery(
    documentsService.keys.metrics(),
    ({ signal }) => documentsService.metrics({ signal }),
    DOCUMENTS_REFRESH.metrics,
  );

  return { ...query, renderers: query.data?.renderers ?? [] };
}
