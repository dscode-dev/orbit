/**
 * Serviços do módulo Artifact Templates.
 *
 * Espelho um-para-um do `ArtifactTemplateController`. Nenhuma regra vive aqui:
 * numeração de versão, imutabilidade, unicidade de chave e o que pode ou não
 * ser editado são decisões do backend.
 *
 * Duas características do contrato moldam tudo que vem depois:
 *
 * 1. `PATCH /:id` altera **apenas metadados**. A estrutura (seções, campos,
 *    assinaturas, layout) não tem rota de edição em lugar.
 * 2. `POST /:id/versions` é o único caminho para mudar a estrutura, e ele
 *    **cria uma versão nova**, imutável, incrementando `currentVersion`.
 *
 * É por isso que o Studio salva propriedades continuamente e publica estrutura
 * por ato explícito — ver `docs/artifact-studio.md`.
 */
import { apiClient } from "@/api/client";
import { queryKeys, type QueryKey } from "@/api/query-keys";
import type { PaginatedResult, QueryParams, RequestOptions } from "@/types/api";
import type {
  ArtifactTemplate,
  ArtifactTemplateListItem,
  ArtifactTemplateQuery,
  ArtifactTemplateVersion,
  CreateArtifactTemplateInput,
  CreateArtifactTemplateVersionInput,
  DuplicateArtifactTemplateInput,
  UpdateArtifactTemplateInput,
} from "@/types/artifact-templates";

const RESOURCE = "artifact-templates";
const BASE_PATH = "/artifact-templates";

const asParams = (query: object | undefined): QueryParams | undefined =>
  query as QueryParams | undefined;

const item = (id: string): string => `${BASE_PATH}/${encodeURIComponent(id)}`;

export const artifactTemplatesService = {
  basePath: BASE_PATH,

  /** Traz os templates da organização e os globais ativos, já paginados. */
  list: (
    query?: ArtifactTemplateQuery,
    options?: RequestOptions,
  ): Promise<PaginatedResult<ArtifactTemplateListItem>> =>
    apiClient.get<PaginatedResult<ArtifactTemplateListItem>>(BASE_PATH, {
      ...options,
      query: asParams(query),
    }),

  /** Detalhe com a versão corrente embutida (`current`). */
  get: (id: string, options?: RequestOptions): Promise<ArtifactTemplate> =>
    apiClient.get<ArtifactTemplate>(item(id), options),

  create: (input: CreateArtifactTemplateInput): Promise<ArtifactTemplate> =>
    apiClient.post<ArtifactTemplate>(BASE_PATH, input),

  /** Metadados apenas — a estrutura é imutável fora de uma versão nova. */
  update: (
    id: string,
    input: UpdateArtifactTemplateInput,
  ): Promise<ArtifactTemplate> =>
    apiClient.patch<ArtifactTemplate>(item(id), input),

  versions: (
    id: string,
    options?: RequestOptions,
  ): Promise<readonly ArtifactTemplateVersion[]> =>
    apiClient.get<readonly ArtifactTemplateVersion[]>(
      `${item(id)}/versions`,
      options,
    ),

  version: (
    id: string,
    version: number,
    options?: RequestOptions,
  ): Promise<ArtifactTemplateVersion> =>
    apiClient.get<ArtifactTemplateVersion>(
      `${item(id)}/versions/${version}`,
      options,
    ),

  /** Publica a estrutura como versão nova. O número é atribuído pelo backend. */
  createVersion: (
    id: string,
    input: CreateArtifactTemplateVersionInput,
  ): Promise<ArtifactTemplateVersion> =>
    apiClient.post<ArtifactTemplateVersion>(`${item(id)}/versions`, input),

  activate: (id: string): Promise<ArtifactTemplate> =>
    apiClient.post<ArtifactTemplate>(`${item(id)}/activate`),

  deactivate: (id: string): Promise<ArtifactTemplate> =>
    apiClient.post<ArtifactTemplate>(`${item(id)}/deactivate`),

  /**
   * Cópia como rascunho da organização.
   *
   * É também o caminho de edição de um template global: o backend recusa
   * alterar o que não pertence ao tenant.
   */
  duplicate: (
    id: string,
    input: DuplicateArtifactTemplateInput,
  ): Promise<ArtifactTemplate> =>
    apiClient.post<ArtifactTemplate>(`${item(id)}/duplicate`, input),

  keys: {
    module: (): QueryKey => queryKeys.module(RESOURCE),
    list: (query?: ArtifactTemplateQuery): QueryKey =>
      queryKeys.list(RESOURCE, asParams(query)),
    detail: (id: string): QueryKey => queryKeys.detail(RESOURCE, id),
    versions: (id: string): QueryKey =>
      queryKeys.nested(RESOURCE, id, "versions"),
    version: (id: string, version: number): QueryKey =>
      queryKeys.nested(RESOURCE, id, "versions", { version }),
  },
} as const;
