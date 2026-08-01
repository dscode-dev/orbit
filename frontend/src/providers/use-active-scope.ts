"use client";

/**
 * Escopo ativo — organização e unidade em uso.
 *
 * Junta o que a sessão conhece (organizações e unidades acessíveis) com o que
 * o usuário selecionou (contexto de requisição da PR-01). É o ponto único que
 * os módulos consultam; ninguém deve ler `session.scope` e o contexto
 * separadamente para chegar à mesma resposta.
 *
 * ```ts
 * const { businessUnit, switchBusinessUnit } = useActiveScope();
 * ```
 */
import { useMemo } from "react";

import type {
  SessionBusinessUnit,
  SessionOrganization,
  SessionOrganizationRef,
} from "@/types/session";
import { useRequestContext } from "./request-context-provider";
import { useSession } from "./session-provider";

export interface ActiveScope {
  organization: SessionOrganization | null;
  organizationId: string | null;
  organizations: readonly SessionOrganizationRef[];
  businessUnit: SessionBusinessUnit | null;
  businessUnitId: string | null;
  businessUnits: readonly SessionBusinessUnit[];
  /**
   * `true` quando a sessão dá acesso a mais de uma organização.
   *
   * Hoje o backend deriva uma única organização das claims do token, então a
   * troca fica indisponível até que ele exponha a lista e passe a aceitar a
   * organização ativa por requisição.
   */
  canSwitchOrganization: boolean;
  canSwitchBusinessUnit: boolean;
  switchOrganization: (organizationId: string) => void;
  switchBusinessUnit: (businessUnitId: string | null) => void;
}

export function useActiveScope(): ActiveScope {
  const session = useSession();
  const context = useRequestContext();

  return useMemo<ActiveScope>(() => {
    const businessUnits = session.businessUnits.filter(
      (unit) =>
        session.scope.businessUnitIds.length === 0 ||
        session.scope.businessUnitIds.includes(unit.id),
    );
    const businessUnit =
      businessUnits.find((unit) => unit.id === context.businessUnitId) ?? null;

    return {
      organization: session.organization,
      organizationId: context.organizationId,
      organizations: session.organizations,
      businessUnit,
      businessUnitId: context.businessUnitId,
      businessUnits,
      canSwitchOrganization: session.organizations.length > 1,
      canSwitchBusinessUnit: businessUnits.length > 1,
      switchOrganization: context.setOrganization,
      switchBusinessUnit: context.setBusinessUnit,
    };
  }, [
    context.businessUnitId,
    context.organizationId,
    context.setBusinessUnit,
    context.setOrganization,
    session.businessUnits,
    session.organization,
    session.organizations,
    session.scope.businessUnitIds,
  ]);
}
