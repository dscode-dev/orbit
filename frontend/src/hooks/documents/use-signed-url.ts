"use client";

/**
 * URL assinada, viva enquanto a tela estiver aberta.
 *
 * ## O problema
 *
 * A primeira versão pedia a URL com `staleTime: 30_000` — um número escolhido
 * sem relação com nada. A URL assinada tem prazo próprio, publicado pelo
 * backend em `expiresAt`, e os dois números não conversavam:
 *
 * - **prazo maior que o `staleTime`**: a consulta reassinava a cada 30 s uma
 *   URL que ainda valeria minutos, gastando requisições à toa;
 * - **prazo menor que a permanência na tela**: o visualizador ficava aberto
 *   com uma URL vencida, e o próximo clique dava erro — sem que nada na tela
 *   indicasse o motivo.
 *
 * ## A correção
 *
 * O prazo passa a vir do dado. `staleTime` é calculado a partir de
 * `expiresAt`, com uma margem de segurança, e o refetch é agendado para o
 * momento em que a margem começa — não antes, não depois.
 *
 * ```
 * emitida ─────────────────────────────┬──── margem ────┬ expira
 *          reutiliza do cache          │  reassina aqui │
 * ```
 *
 * ## Por que não entra em laço
 *
 * Três guardas:
 *
 * 1. **`refetchInterval` é função do dado**, não constante: ele lê o
 *    `expiresAt` que voltou e devolve o tempo até a próxima renovação. Uma
 *    resposta com prazo longo agenda longe.
 * 2. **Piso de intervalo.** Um `expiresAt` já vencido — relógio fora de sincronia,
 *    resposta que demorou — agendaria `0` e giraria sem parar. O piso força a
 *    espera mínima.
 * 3. **`refetchIntervalInBackground: false`.** Aba escondida não reassina; ao
 *    voltar, `refetchOnWindowFocus` cuida do caso.
 *
 * ## URL vencida não fica no cache
 *
 * `gcTime` acompanha o prazo: assim que a URL não serve mais e ninguém a
 * observa, ela sai da memória. Sem isso, voltar para uma revisão visitada há
 * uma hora entregaria a URL antiga do cache antes de qualquer refetch — e o
 * primeiro clique falharia.
 */
import { useApiQuery } from "@/hooks/api/use-api-query";
import { SECOND } from "@/hooks/api/cache-policy";
import { documentsService } from "@/services/documents.service";
import type { SignedUrlOperation } from "@/types/documents";

/**
 * Margem antes do vencimento.
 *
 * Cobre o tempo entre a tela decidir usar a URL e o servidor de storage
 * recebê-la — clique, redirecionamento, latência. Trinta segundos é folgado
 * para isso e ainda curto perto do TTL padrão do backend.
 */
const RENEW_MARGIN_MS = 30 * SECOND;

/**
 * Espera mínima entre duas assinaturas.
 *
 * É a guarda contra laço: um `expiresAt` no passado produziria intervalo
 * negativo, e sem piso a consulta reassinaria a cada render.
 */
const MIN_INTERVAL_MS = 5 * SECOND;

/** Quanto falta para renovar, em milissegundos, nunca abaixo do piso. */
function millisecondsUntilRenewal(expiresAt: string): number {
  const deadline = new Date(expiresAt).getTime();

  /**
   * `expiresAt` ilegível não deve travar a tela.
   *
   * Trata como "renove logo": o pior caso é uma assinatura extra, contra uma
   * URL que nunca mais se renova.
   */
  if (!Number.isFinite(deadline)) return MIN_INTERVAL_MS;

  return Math.max(deadline - Date.now() - RENEW_MARGIN_MS, MIN_INTERVAL_MS);
}

export interface UseSignedUrlOptions {
  /** Desliga a consulta — revisão revogada, rascunho sem conteúdo. */
  readonly enabled?: boolean;
}

/**
 * A URL assinada de um manifest, renovada antes de vencer.
 *
 * A mesma infraestrutura serve `preview` e `download`: são a mesma assinatura
 * sobre o mesmo objeto, e o que muda é o `Content-Disposition` que o **backend**
 * decide. A operação entra na query key, então as duas coexistem no cache sem
 * uma sobrescrever a outra.
 */
export function useSignedUrl(
  manifestId: string,
  operation: SignedUrlOperation,
  options: UseSignedUrlOptions = {},
) {
  const { enabled = true } = options;

  return useApiQuery(
    [...documentsService.keys.manifest(manifestId), "url", operation],
    ({ signal }) =>
      documentsService.signedUrl(manifestId, operation, { signal }),
    {
      enabled: enabled && Boolean(manifestId),

      /**
       * Fresca enquanto valer, considerada velha na margem.
       *
       * Sem dado ainda, `0`: a primeira busca não deve ser adiada.
       */
      staleTime: (query) => {
        const data = query.state.data;
        return data ? millisecondsUntilRenewal(data.expiresAt) : 0;
      },

      /**
       * Renova sozinha enquanto a tela estiver aberta.
       *
       * É o que separa esta correção de um `staleTime` bem escolhido:
       * `staleTime` sozinho só evita refetch, não provoca nenhum. Um
       * visualizador aberto e parado continuaria com a URL vencida.
       */
      refetchInterval: (query) => {
        const data = query.state.data;
        return data ? millisecondsUntilRenewal(data.expiresAt) : false;
      },

      /** Aba escondida não gasta assinatura; o foco cuida do retorno. */
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,

      /**
       * A URL não sobrevive ao próprio prazo dentro do cache.
       *
       * Sem isto, reabrir uma revisão visitada há muito tempo entregaria a URL
       * antiga antes do refetch, e o primeiro clique falharia.
       */
      gcTime: RENEW_MARGIN_MS,
    },
  );
}
