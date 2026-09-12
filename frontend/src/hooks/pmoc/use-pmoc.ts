"use client";

/**
 * Hooks do PMOC V2.
 *
 * A cadência segue a volatilidade de cada coisa: a configuração muda por ação
 * humana, o ciclo muda quando alguém executa, a preparação de execução muda
 * assim que o RT perde a assinatura ou o plano é suspenso.
 */
import { queryKeys } from "@/api/query-keys";
import { CACHE } from "@/hooks/api/cache-policy";
import { useApiMutation } from "@/hooks/api/use-api-mutation";
import { useApiQuery } from "@/hooks/api/use-api-query";
import { useActiveScope } from "@/providers/use-active-scope";
import { pmocService } from "@/services/pmoc.service";
import type {
  PmocPreviewInput,
  CreatePmocPlanInput,
  PmocCoveragePageQuery,
  PmocPlanQuery,
  PmocTimelineQuery,
  UpdatePmocPlanInput,
  CreatePmocUnitInput,
  UpdatePmocUnitInput,
} from "@/types/pmoc";
import { useMemo } from "react";

export const PMOC_REFRESH = {
  plans: CACHE.stable,
  plan: CACHE.fresh,
  coverage: CACHE.stable,
  cycles: CACHE.fresh,
  executions: CACHE.fresh,
  /** Elegibilidade muda sem aviso; nunca servir uma decisão velha. */
  preparation: CACHE.live,
  timeline: CACHE.stable,
} as const;

/** Lista de configurações. A unidade ativa recorta, como nos demais módulos. */
export function usePmocPlans(query: PmocPlanQuery) {
  const { businessUnitId } = useActiveScope();
  const scoped = useMemo<PmocPlanQuery>(
    () => ({
      ...query,
      businessUnitId: query.businessUnitId ?? businessUnitId ?? undefined,
    }),
    [businessUnitId, query],
  );

  return useApiQuery(
    pmocService.keys.plans(scoped),
    ({ signal }) => pmocService.list(scoped, { signal }),
    { ...PMOC_REFRESH.plans, placeholderData: (previous) => previous },
  );
}

export function usePmocPlan(id: string) {
  return useApiQuery(
    pmocService.keys.plan(id),
    ({ signal }) => pmocService.get(id, { signal }),
    PMOC_REFRESH.plan,
  );
}

export function usePmocCoverage(id: string, query?: PmocCoveragePageQuery) {
  return useApiQuery(
    pmocService.keys.coverage(id, query),
    ({ signal }) => pmocService.coveragePage(id, query, { signal }),
    { ...PMOC_REFRESH.coverage, placeholderData: (previous) => previous },
  );
}

export function usePmocCycles(id: string) {
  return useApiQuery(
    pmocService.keys.cycles(id),
    ({ signal }) => pmocService.cycles(id, { signal }),
    PMOC_REFRESH.cycles,
  );
}

/**
 * As execuções de um ciclo, em uma consulta.
 *
 * O Read Model já traz equipamento, técnicos, evidências e documento de cada
 * linha — nada de buscar equipamento por linha depois.
 */
export function usePmocEquipmentExecutions(
  planId: string,
  cycleId: string | null,
) {
  return useApiQuery(
    pmocService.keys.equipmentExecutions(planId, cycleId ?? ""),
    ({ signal }) =>
      pmocService.equipmentExecutions(planId, cycleId!, { signal }),
    { ...PMOC_REFRESH.executions, enabled: Boolean(cycleId) },
  );
}

export function usePmocExecutionPreparation(
  planId: string,
  cycleId: string | null,
  assetId: string | null,
) {
  return useApiQuery(
    pmocService.keys.preparation(planId, cycleId ?? "", assetId ?? ""),
    ({ signal }) =>
      pmocService.executionPreparation(planId, cycleId!, assetId!, { signal }),
    {
      ...PMOC_REFRESH.preparation,
      enabled: Boolean(cycleId && assetId),
    },
  );
}

export function usePmocTimeline(id: string, query?: PmocTimelineQuery) {
  return useApiQuery(
    pmocService.keys.timeline(id, query),
    ({ signal }) => pmocService.timeline(id, query, { signal }),
    { ...PMOC_REFRESH.timeline, placeholderData: (previous) => previous },
  );
}

/* ------------------------------------------------------------------ */
/* Mutações                                                            */
/* ------------------------------------------------------------------ */

/**
 * O que uma mudança de configuração afeta.
 *
 * O plano e a listagem — e mais nada. Cobertura, ciclos e linha do tempo têm
 * keys próprias e só entram quando a escrita realmente as toca.
 */
function planKeys(id: string) {
  return [pmocService.keys.plan(id), queryKeys.lists("pmoc")];
}

export function useCreatePmocPlan() {
  return useApiMutation(
    (input: CreatePmocPlanInput) => pmocService.create(input),
    { invalidate: [queryKeys.lists("pmoc")] },
  );
}

export function useUpdatePmocPlan(id: string) {
  return useApiMutation(
    (input: UpdatePmocPlanInput) => pmocService.update(id, input),
    { scope: { id: `pmoc:${id}` }, invalidate: planKeys(id) },
  );
}

/**
 * Transições do plano.
 *
 * A máquina de estados é do servidor e chega em `allowedTransitions`; estes
 * hooks apenas enviam o comando que o plano declarou aceitar. Ativar cria o
 * primeiro ciclo, então ciclos e linha do tempo entram na invalidação.
 */
function transitionKeys(id: string) {
  return [
    ...planKeys(id),
    pmocService.keys.cycles(id),
    queryKeys.query("pmoc", "timeline", { id }),
  ];
}

export function useActivatePmocPlan(id: string) {
  return useApiMutation(() => pmocService.activate(id), {
    invalidate: transitionKeys(id),
  });
}

export function useSuspendPmocPlan(id: string) {
  return useApiMutation(() => pmocService.suspend(id), {
    invalidate: transitionKeys(id),
  });
}

export function useCancelPmocPlan(id: string) {
  return useApiMutation(() => pmocService.cancel(id), {
    invalidate: transitionKeys(id),
  });
}

/** Cobertura: invalida a cobertura e o plano (o contador `coveredEquipment`). */
function coverageKeys(id: string) {
  return [
    queryKeys.query("pmoc", "coverage", { id }),
    pmocService.keys.plan(id),
  ];
}

export function useAddPmocCoverage(id: string) {
  return useApiMutation(
    (input: { assetId: string; notes?: string }) =>
      pmocService.addCoverage(id, input.assetId, input.notes),
    { invalidate: coverageKeys(id) },
  );
}

export function useRemovePmocCoverage(id: string) {
  return useApiMutation(
    (coverageId: string) => pmocService.removeCoverage(id, coverageId),
    { invalidate: coverageKeys(id) },
  );
}

/**
 * O código sugerido para o cliente escolhido.
 *
 * `enabled` amarrado ao cliente: sem cliente não há sequência, e pedir a
 * sugestão antes seria uma requisição que o servidor recusa com 400.
 */
export function usePmocCodeSuggestion(customerId: string | null) {
  return useApiQuery(
    ["pmoc", "code-suggestion", customerId ?? ""],
    ({ signal }) => pmocService.codeSuggestion(customerId!, { signal }),
    { enabled: Boolean(customerId), staleTime: 0, gcTime: 0 },
  );
}

/**
 * A projeção da configuração — ciclos, equipamentos e matriz.
 *
 * Roda por mutação, e não por query, porque a entrada é um corpo e porque a
 * tela decide **quando** projetar: a cada tecla digitada na data seria uma
 * requisição por caractere.
 */
export function usePmocPreview() {
  return useApiMutation((input: PmocPreviewInput) =>
    pmocService.preview(input),
  );
}

/**
 * Os nomes sugeridos para um plano.
 *
 * Catálogo da plataforma: não muda por organização, não muda durante a
 * sessão, e por isso pode ser lido uma vez e reaproveitado.
 */
export function usePmocPlanNameOptions() {
  return useApiQuery(
    pmocService.keys.planNameOptions(),
    ({ signal }) => pmocService.planNameOptions({ signal }),
    CACHE.stable,
  );
}

/* ------------------------------------------------------------------ */
/* Unidades                                                            */
/* ------------------------------------------------------------------ */

/**
 * As unidades da organização, com o roteiro de cada uma.
 *
 * O roteiro vem junto porque é o que a tela precisa mostrar na hora de
 * escolher: uma unidade sem checklist entra no plano e não descreve serviço
 * nenhum, e quem marca tem de ver isso antes.
 */
export function usePmocUnits() {
  return useApiQuery(
    pmocService.keys.units(),
    ({ signal }) => pmocService.units({ signal }),
    CACHE.stable,
  );
}

export function useCreatePmocUnit() {
  return useApiMutation(
    (input: CreatePmocUnitInput) => pmocService.createUnit(input),
    { invalidate: [pmocService.keys.units()] },
  );
}

export function useUpdatePmocUnit(id: string) {
  return useApiMutation(
    (input: UpdatePmocUnitInput) => pmocService.updateUnit(id, input),
    { invalidate: [pmocService.keys.units()] },
  );
}

export function useRemovePmocUnit() {
  return useApiMutation((id: string) => pmocService.removeUnit(id), {
    invalidate: [pmocService.keys.units()],
  });
}
