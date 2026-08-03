"use client";

/**
 * Hooks do Artifact Studio.
 *
 * Cada leitura tem a sua query key e a sua cadência. Estruturas de template
 * mudam por ato deliberado de configuração, não por evento operacional — não
 * há `refetchInterval` em lugar nenhum aqui: recarregar sozinho um formulário
 * em edição só teria como efeito atrapalhar quem edita.
 */
import { useApiMutation } from "@/hooks/api/use-api-mutation";
import { useApiQuery, type ApiQueryOptions } from "@/hooks/api/use-api-query";
import { artifactTemplatesService } from "@/services/artifact-templates.service";
import type {
  ArtifactTemplateListItem,
  ArtifactTemplateQuery,
  ArtifactTemplateVersion,
  CreateArtifactTemplateInput,
  CreateArtifactTemplateVersionInput,
  DuplicateArtifactTemplateInput,
  UpdateArtifactTemplateInput,
} from "@/types/artifact-templates";
import type { PaginatedResult } from "@/types/api";

const MINUTE = 60_000;

export const ARTIFACT_TEMPLATES_REFRESH = {
  list: { staleTime: MINUTE },
  detail: { staleTime: 30_000 },
  /** Versões são imutáveis: uma vez lidas, não mudam. */
  versions: { staleTime: 5 * MINUTE },
  version: { staleTime: Infinity },
} as const;

export function useArtifactTemplatesList(
  query: ArtifactTemplateQuery,
  options?: ApiQueryOptions<PaginatedResult<ArtifactTemplateListItem>>,
) {
  return useApiQuery(
    artifactTemplatesService.keys.list(query),
    ({ signal }) => artifactTemplatesService.list(query, { signal }),
    {
      ...ARTIFACT_TEMPLATES_REFRESH.list,
      /** Mantém a página anterior visível durante a troca de página. */
      placeholderData: (previous) => previous,
      ...options,
    },
  );
}

export function useArtifactTemplate(id: string) {
  return useApiQuery(
    artifactTemplatesService.keys.detail(id),
    ({ signal }) => artifactTemplatesService.get(id, { signal }),
    ARTIFACT_TEMPLATES_REFRESH.detail,
  );
}

export function useArtifactTemplateVersions(id: string) {
  return useApiQuery(
    artifactTemplatesService.keys.versions(id),
    ({ signal }) => artifactTemplatesService.versions(id, { signal }),
    ARTIFACT_TEMPLATES_REFRESH.versions,
  );
}

/**
 * Uma versão específica.
 *
 * `enabled` desliga a consulta enquanto não há versão escolhida — é o caso da
 * comparação antes do usuário escolher o lado esquerdo.
 */
export function useArtifactTemplateVersion(id: string, version: number | null) {
  return useApiQuery<ArtifactTemplateVersion>(
    artifactTemplatesService.keys.version(id, version ?? 0),
    ({ signal }) =>
      artifactTemplatesService.version(id, version as number, { signal }),
    { ...ARTIFACT_TEMPLATES_REFRESH.version, enabled: version !== null },
  );
}

/**
 * Template oficial de um tipo de artefato.
 *
 * O catálogo oficial é composto de templates **globais** — `organizationId`
 * nulo — e o repositório do backend já os devolve na mesma listagem que traz
 * os da organização. Não há endpoint de catálogo: a busca é a listagem
 * filtrada por `artifactType`, e o oficial é o item sem organização.
 *
 * Serve a dois usos: oferecer "começar do oficial" ao criar, e "restaurar do
 * oficial" em uma cópia que se afastou demais.
 */
export function useOfficialTemplate(artifactType: string | undefined) {
  const query = useArtifactTemplatesList(
    { artifactType, limit: 50, page: 1 },
    { enabled: Boolean(artifactType) },
  );

  const official = (query.data?.data ?? []).find(
    (template) => template.organizationId === null,
  );

  return { ...query, official };
}

/** Estrutura corrente do template oficial, carregada sob demanda. */
export function useOfficialTemplateDetail(id: string | undefined) {
  return useApiQuery(
    artifactTemplatesService.keys.detail(id ?? ""),
    ({ signal }) => artifactTemplatesService.get(id as string, { signal }),
    { ...ARTIFACT_TEMPLATES_REFRESH.detail, enabled: Boolean(id) },
  );
}

export function useCreateArtifactTemplate() {
  return useApiMutation(
    (input: CreateArtifactTemplateInput) =>
      artifactTemplatesService.create(input),
    { invalidate: [artifactTemplatesService.keys.module()] },
  );
}

/**
 * Atualização de metadados — a mutação por trás do salvamento automático.
 *
 * Invalida o módulo inteiro porque nome, tipo e tags aparecem também na
 * listagem.
 */
export function useUpdateArtifactTemplate(id: string) {
  return useApiMutation(
    (input: UpdateArtifactTemplateInput) =>
      artifactTemplatesService.update(id, input),
    { invalidate: [artifactTemplatesService.keys.module()] },
  );
}

/**
 * Publicação de estrutura.
 *
 * Invalida detalhe e histórico: o backend incrementou `currentVersion` e o
 * detalhe agora responde com outra `current`.
 */
export function useCreateArtifactTemplateVersion(id: string) {
  return useApiMutation(
    (input: CreateArtifactTemplateVersionInput) =>
      artifactTemplatesService.createVersion(id, input),
    {
      invalidate: [
        artifactTemplatesService.keys.detail(id),
        artifactTemplatesService.keys.versions(id),
        artifactTemplatesService.keys.list(),
      ],
    },
  );
}

export function useArtifactTemplateLifecycle(id: string) {
  const invalidate = [
    artifactTemplatesService.keys.detail(id),
    artifactTemplatesService.keys.list(),
  ];

  const activate = useApiMutation(() => artifactTemplatesService.activate(id), {
    invalidate,
  });
  const deactivate = useApiMutation(
    () => artifactTemplatesService.deactivate(id),
    { invalidate },
  );

  return { activate, deactivate };
}

export function useDuplicateArtifactTemplate(id: string) {
  return useApiMutation(
    (input: DuplicateArtifactTemplateInput) =>
      artifactTemplatesService.duplicate(id, input),
    { invalidate: [artifactTemplatesService.keys.module()] },
  );
}
