"use client";

/**
 * Query Layer do Management Reports Engine.
 *
 * ## Um relatório pronto não muda mais
 *
 * `CACHE.immutable` no detalhe de um relatório `READY`: o snapshot é o retrato
 * de um período e o backend nunca o recompõe. Revalidar seria gastar
 * requisição para receber byte por byte o mesmo conteúdo — e sugeriria, a quem
 * lê o código, que o número pode ter mudado.
 *
 * Enquanto está sendo composto é o oposto: o estado muda **sozinho**, sem
 * ninguém clicar, e é o único lugar desta tela onde isso acontece.
 *
 * ## O acompanhamento para quando termina
 *
 * `pollWhile` — o mesmo mecanismo do Rendering Engine: enquanto o servidor diz
 * `PENDING` ou `GENERATING`, pergunta de novo; quando termina, para. Não há
 * laço próprio, não há WebSocket e **não há porcentagem inventada**: o backend
 * publica quatro estados, não progresso, e desenhar uma barra subindo seria
 * fabricar um dado que ninguém mediu.
 *
 * ## Nenhum optimistic update
 *
 * Gerar pode ser recusado por autorização composta (403), por período fora da
 * janela (400) ou por já haver uma geração idêntica em andamento — caso em que
 * o backend devolve **a que já existe**. Antecipar um relatório novo mostraria
 * na lista algo que o servidor não criou.
 */
import { useQueryClient } from "@tanstack/react-query";

import { CACHE, SECOND, pollWhile } from "@/hooks/api/cache-policy";
import { useApiMutation } from "@/hooks/api/use-api-mutation";
import { useApiQuery } from "@/hooks/api/use-api-query";
import { useSignedUrlLifecycle } from "@/hooks/documents/use-signed-url";
import {
  managementReportsService,
  type ReportSignedUrlOperation,
} from "@/services/management-reports.service";
import {
  isInFlight,
  type GenerateReportInput,
  type ManagementReportQuery,
  type ManagementReportStatus,
} from "@/types/management-reports";

/** De quanto em quanto tempo se pergunta se já terminou. */
const POLL_INTERVAL_MS = 3 * SECOND;

export const REPORT_REFRESH = {
  /** Tipos e exigências mudam com o backend, não durante a sessão. */
  catalog: CACHE.catalog,
  /** Outra pessoa gera enquanto esta lista está aberta. */
  list: CACHE.live,
} as const;

/* ------------------------------------------------------------------ */
/* Leituras                                                            */
/* ------------------------------------------------------------------ */

/**
 * O catálogo publicado.
 *
 * `enabled` existe para a tela não perguntar sem `reports.management.read` —
 * a resposta seria 403, e um erro no lugar de uma explicação.
 */
export function useReportCatalog(enabled = true) {
  return useApiQuery(
    managementReportsService.keys.catalog(),
    ({ signal }) => managementReportsService.catalog({ signal }),
    { ...REPORT_REFRESH.catalog, enabled },
  );
}

export function useManagementReports(
  query?: ManagementReportQuery,
  enabled = true,
) {
  return useApiQuery(
    managementReportsService.keys.list(query),
    ({ signal }) => managementReportsService.list(query, { signal }),
    { ...REPORT_REFRESH.list, enabled },
  );
}

/**
 * Contagem de um recorte, **pelo servidor**.
 *
 * `limit: 1` e o número sai de `meta.total`. Contar itens da página daria o
 * total da página — e um indicador que muda de valor conforme a paginação é
 * pior que indicador nenhum.
 */
export function useManagementReportCount(
  query: ManagementReportQuery,
  enabled = true,
) {
  const scoped: ManagementReportQuery = { ...query, page: 1, limit: 1 };
  const result = useApiQuery(
    managementReportsService.keys.list(scoped),
    ({ signal }) => managementReportsService.list(scoped, { signal }),
    { ...REPORT_REFRESH.list, enabled },
  );

  return {
    total: result.data?.meta.total,
    isPending: result.isPending,
    failed: Boolean(result.error),
  };
}

/**
 * O relatório inteiro, com o snapshot.
 *
 * Enquanto está compondo, revalida junto com o acompanhamento; depois de
 * pronto, congela — `immutable` porque o backend garante imutabilidade, não
 * porque a tela prefere assim.
 */
export function useManagementReport(id: string | null) {
  return useApiQuery(
    managementReportsService.keys.detail(id ?? "none"),
    ({ signal }) => managementReportsService.get(id as string, { signal }),
    {
      enabled: Boolean(id),
      staleTime: CACHE.immutable.staleTime,
      refetchInterval: pollWhile<{ status: string }>(
        (data) => isInFlight(data.status),
        POLL_INTERVAL_MS,
      ),
      refetchIntervalInBackground: false,
    },
  );
}

/**
 * O acompanhamento de uma geração.
 *
 * Consulta barata — só a situação —, para a tela poder continuar sendo usada
 * enquanto o relatório é composto. Desliga sozinha quando o servidor termina.
 */
export function useManagementReportStatus(id: string | null, enabled = true) {
  return useApiQuery(
    managementReportsService.keys.status(id ?? "none"),
    ({ signal }) => managementReportsService.status(id as string, { signal }),
    {
      enabled: Boolean(id) && enabled,
      staleTime: 0,
      refetchInterval: pollWhile<ManagementReportStatus>(
        (data) => isInFlight(data.status),
        POLL_INTERVAL_MS,
      ),
      refetchIntervalInBackground: false,
    },
  );
}

/**
 * A URL assinada do arquivo, renovada antes de vencer.
 *
 * Reaproveita o ciclo de vida do Document Center: margem, piso, renovação
 * agendada pelo `expiresAt` que o backend publicou e `gcTime` acompanhando o
 * prazo. Uma segunda implementação do mesmo cuidado seria a que ficaria para
 * trás na primeira correção.
 */
export function useReportSignedUrl(
  reportId: string,
  operation: ReportSignedUrlOperation,
  enabled = true,
) {
  return useSignedUrlLifecycle(
    [...managementReportsService.keys.detail(reportId), "url", operation],
    ({ signal }) =>
      managementReportsService.signedUrl(reportId, operation, { signal }),
    { enabled: enabled && Boolean(reportId) },
  );
}

/* ------------------------------------------------------------------ */
/* Escrita                                                             */
/* ------------------------------------------------------------------ */

/**
 * Pedir a geração.
 *
 * Invalida a listagem no sucesso **e no erro**: um 409 ou um 403 significam
 * que a tela está velha — outra pessoa já pediu o mesmo recorte, ou o acesso
 * mudou. Insistir no que está na tela faria a recusa parecer inexplicável.
 */
export function useGenerateReport() {
  const queryClient = useQueryClient();

  const revalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: managementReportsService.keys.all(),
    });
  };

  return useApiMutation(
    (input: GenerateReportInput) => managementReportsService.generate(input),
    {
      onSuccess: revalidate,
      onError: revalidate,
      /** Dois cliques no mesmo botão não viram dois pedidos. */
      scope: { id: "management-report-generate" },
    },
  );
}
