"use client";

/**
 * Query Layer do Organization Workspace.
 *
 * ## Sem atualização otimista
 *
 * Todas as escritas deste módulo **podem ser recusadas** por motivos que o
 * cliente não enxerga: documento duplicado na unidade, limite do plano
 * atingido, capability ausente, permissão insuficiente. Antecipar o resultado
 * mostraria um estado que o servidor talvez rejeite.
 *
 * As mutações que devolvem a entidade **semeiam o cache com a resposta** — o
 * estado confirmado. As que não devolvem nada (remoção) invalidam.
 *
 * ## Invalidação
 *
 * Criar ou remover unidade muda o consumo do plano (`businessUnits`), então a
 * escrita invalida também `usage`. É o servidor que conta; o que se faz aqui é
 * pedir a contagem nova.
 */
import { useQueryClient } from "@tanstack/react-query";

import { useApiMutation } from "@/hooks/api/use-api-mutation";
import { useApiQuery } from "@/hooks/api/use-api-query";
import { CACHE } from "@/hooks/api/cache-policy";
import { queryKeys } from "@/api/query-keys";
import { organizationService } from "@/services/organization.service";
import type {
  CreateBusinessUnitInput,
  Organization,
  UpdateBusinessUnitInput,
  UpdateOrganizationInput,
} from "@/types/organization";

/**
 * Cadência por leitura.
 *
 * Administração muda por ato deliberado, não por evento operacional — nenhuma
 * consulta se atualiza sozinha. O catálogo de planos praticamente não muda.
 */
export const ORGANIZATION_REFRESH = {
  current: CACHE.stable,
  entitlements: CACHE.stable,
  usage: CACHE.fresh,
  businessUnits: CACHE.stable,
  /** Quadro de pessoas muda por convite e desligamento, não por operação. */
  members: CACHE.catalog,
  integrations: CACHE.stable,
  plans: CACHE.catalog,
} as const;

export function useOrganization() {
  return useApiQuery(
    organizationService.keys.current(),
    ({ signal }) => organizationService.current({ signal }),
    ORGANIZATION_REFRESH.current,
  );
}

/**
 * Membros da organização.
 *
 * Única fonte de identificadores de usuário do tenant — é o que permite
 * atribuir e reatribuir uma operação. Somente leitura: convidar, remover e
 * trocar papel não têm endpoint.
 */
export function useOrganizationMembers() {
  return useApiQuery(
    organizationService.keys.members(),
    ({ signal }) => organizationService.members({ signal }),
    ORGANIZATION_REFRESH.members,
  );
}

export function useOrganizationEntitlements() {
  return useApiQuery(
    organizationService.keys.entitlements(),
    ({ signal }) => organizationService.entitlements({ signal }),
    ORGANIZATION_REFRESH.entitlements,
  );
}

/** Consumo do período. Exige a permissão `usage.read` — 403 é ausência de acesso. */
export function useOrganizationUsage() {
  return useApiQuery(
    organizationService.keys.usage(),
    ({ signal }) => organizationService.usage({ signal }),
    ORGANIZATION_REFRESH.usage,
  );
}

/** Catálogo de planos — fonte de "quais capabilities existem". */
export function usePlanCatalog() {
  return useApiQuery(
    organizationService.keys.plans(),
    ({ signal }) => organizationService.plans({ signal }),
    ORGANIZATION_REFRESH.plans,
  );
}

export function useBusinessUnits() {
  return useApiQuery(
    organizationService.keys.businessUnits(),
    ({ signal }) => organizationService.businessUnits({ signal }),
    ORGANIZATION_REFRESH.businessUnits,
  );
}

export function useIntegrations() {
  return useApiQuery(
    organizationService.keys.integrations(),
    ({ signal }) => organizationService.integrations({ signal }),
    ORGANIZATION_REFRESH.integrations,
  );
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useApiMutation(
    (input: UpdateOrganizationInput) => organizationService.update(input),
    {
      onSuccess: async (organization: Organization) => {
        const key = organizationService.keys.current();
        await queryClient.cancelQueries({ queryKey: key });
        queryClient.setQueryData(key, organization);
        /** A sessão carrega a organização — precisa reler. */
        await queryClient.invalidateQueries({
          queryKey: queryKeys.session(),
        });
      },
    },
  );
}

/** Efeitos comuns às escritas de unidade. */
function useBusinessUnitInvalidation() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({
      queryKey: organizationService.keys.businessUnits(),
    });
    /** Unidade conta para o limite do plano. */
    await queryClient.invalidateQueries({
      queryKey: organizationService.keys.usage(),
    });
    await queryClient.invalidateQueries({ queryKey: queryKeys.session() });
  };
}

export function useCreateBusinessUnit() {
  const invalidate = useBusinessUnitInvalidation();
  return useApiMutation(
    (input: CreateBusinessUnitInput) =>
      organizationService.createBusinessUnit(input),
    { onSuccess: invalidate },
  );
}

export function useUpdateBusinessUnit(id: string) {
  const invalidate = useBusinessUnitInvalidation();
  return useApiMutation(
    (input: UpdateBusinessUnitInput) =>
      organizationService.updateBusinessUnit(id, input),
    { scope: { id: `business-units:${id}` }, onSuccess: invalidate },
  );
}

export function useRemoveBusinessUnit() {
  const invalidate = useBusinessUnitInvalidation();
  return useApiMutation(
    (id: string) => organizationService.removeBusinessUnit(id),
    { onSuccess: invalidate },
  );
}

export function useValidateIntegration() {
  const queryClient = useQueryClient();
  return useApiMutation(
    (id: string) => organizationService.validateIntegration(id),
    {
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: organizationService.keys.integrations(),
        }),
    },
  );
}
