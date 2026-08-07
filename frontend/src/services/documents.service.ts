/**
 * Serviços do Document Center.
 *
 * Cobre dois módulos do backend, porque um documento emitido é a junção deles:
 *
 * | Módulo               | O que traz                                   |
 * | -------------------- | -------------------------------------------- |
 * | `artifact-manifests` | revisões, arquivo, hash e URL assinada        |
 * | `artifact-rendering` | estado da renderização e solicitação          |
 *
 * **Não existe listagem global de manifests.** O backend publica revisões
 * sempre sob uma execução (`GET /artifact-executions/:id/manifests`) — foi uma
 * decisão explícita da PR-19 de não criar endpoint administrativo. A central
 * parte das execuções, que já carregam `renderStatus`, e busca as revisões de
 * cada uma sob demanda. Ver `docs/document-center.md`.
 */
import { apiClient } from "@/api/client";
import { queryKeys, type QueryKey } from "@/api/query-keys";
import type { RequestOptions } from "@/types/api";
import type {
  ArtifactManifest,
  ArtifactManifestList,
  RenderMetrics,
  RenderState,
  RequestRenderInput,
  SignedUrl,
  SignedUrlOperation,
} from "@/types/documents";

const RESOURCE = "documents";

const execution = (id: string): string =>
  `/artifact-executions/${encodeURIComponent(id)}`;
const manifest = (id: string): string =>
  `/artifact-manifests/${encodeURIComponent(id)}`;

export const documentsService = {
  /** Revisões de uma execução, da mais recente para a mais antiga. */
  manifests: (
    executionId: string,
    options?: RequestOptions,
  ): Promise<ArtifactManifestList> =>
    apiClient.get<ArtifactManifestList>(
      `${execution(executionId)}/manifests`,
      options,
    ),

  manifest: (id: string, options?: RequestOptions): Promise<ArtifactManifest> =>
    apiClient.get<ArtifactManifest>(manifest(id), options),

  /**
   * URL assinada.
   *
   * **É o único caminho de acesso ao arquivo.** O storage nunca é endereçado
   * pelo cliente: `bucket` e `objectKey` não aparecem em contrato nenhum, e a
   * URL vem com prazo curto e escopo de um objeto.
   */
  signedUrl: (
    id: string,
    operation: SignedUrlOperation,
    options?: RequestOptions,
  ): Promise<SignedUrl> =>
    apiClient.get<SignedUrl>(`${manifest(id)}/download`, {
      ...options,
      query: { operation },
    }),

  renderState: (
    executionId: string,
    options?: RequestOptions,
  ): Promise<RenderState> =>
    apiClient.get<RenderState>(`${execution(executionId)}/render`, options),

  requestRender: (
    executionId: string,
    input: RequestRenderInput,
  ): Promise<RenderState> =>
    apiClient.post<RenderState>(`${execution(executionId)}/render`, input),

  /** Contadores do processo — usados para saber quais renderers existem. */
  metrics: (options?: RequestOptions): Promise<RenderMetrics> =>
    apiClient.get<RenderMetrics>("/artifact-rendering/metrics", options),

  keys: {
    module: (): QueryKey => queryKeys.module(RESOURCE),
    manifests: (executionId: string): QueryKey =>
      queryKeys.nested(RESOURCE, executionId, "manifests"),
    manifest: (id: string): QueryKey => queryKeys.detail(RESOURCE, id),
    renderState: (executionId: string): QueryKey =>
      queryKeys.nested(RESOURCE, executionId, "render"),
    metrics: (): QueryKey => queryKeys.query(RESOURCE, "metrics"),
  },
} as const;
