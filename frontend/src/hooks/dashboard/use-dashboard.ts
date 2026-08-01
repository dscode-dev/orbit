"use client";

/**
 * Hooks do Dashboard — um por Read Model.
 *
 * Cada consulta tem cadência própria, escolhida pela volatilidade do dado:
 * agenda muda a cada minuto, clima muda a cada hora, layout quase nunca muda.
 *
 * O escopo ativo entra na própria query: `businessUnitId` é aceito por
 * `AnalyticsQueryDto`, então trocar de unidade muda a query key e refaz a
 * leitura — sem nenhuma invalidação manual. Trocar de organização já descarta
 * as queries do escopo anterior (`RequestContextProvider`).
 */
import { useMemo } from "react";

import { useActiveScope } from "@/providers/use-active-scope";
import {
  analyticsService,
  dashboardService,
  schedulingService,
} from "@/services/dashboard.service";
import type {
  AgendaQuery,
  AnalyticsQuery,
  DashboardRangeKey,
} from "@/types/dashboard";
import { DASHBOARD_RANGE_DAYS } from "@/types/dashboard";
import { useApiQuery, type ApiQueryOptions } from "@/hooks/api/use-api-query";

const MINUTE = 60_000;

/**
 * Cadência de atualização por Read Model.
 *
 * `staleTime` evita refetch em navegação; `refetchInterval` mantém vivos os
 * painéis que o usuário observa por longos períodos.
 */
export const REFRESH_POLICY = {
  /** Resolução de widgets: muda quando o plano ou os módulos mudam. */
  layout: { staleTime: 10 * MINUTE, refetchInterval: false as const },
  /** KPIs e séries operacionais. */
  analytics: { staleTime: MINUTE, refetchInterval: 2 * MINUTE },
  /** Health Score deriva dos KPIs; acompanha um pouco mais devagar. */
  health: { staleTime: 2 * MINUTE, refetchInterval: 5 * MINUTE },
  /** Projeções e leitura de IA: caras e pouco voláteis. */
  intelligence: { staleTime: 5 * MINUTE, refetchInterval: false as const },
  /** Clima e impacto ambiental. */
  environment: { staleTime: 10 * MINUTE, refetchInterval: 15 * MINUTE },
  /** Agenda: o dado mais volátil do painel. */
  agenda: { staleTime: MINUTE, refetchInterval: 2 * MINUTE },
} as const;

/**
 * Janela analítica derivada da faixa escolhida.
 *
 * `from` é quantizado no início do dia (UTC) para manter a query key estável
 * entre renders — sem isso, cada render geraria uma key nova e um refetch. `to`
 * é omitido: o backend usa "agora" por padrão.
 */
export function useAnalyticsQuery(range: DashboardRangeKey): AnalyticsQuery {
  const { businessUnitId } = useActiveScope();

  return useMemo(() => {
    const from = new Date();
    from.setUTCHours(0, 0, 0, 0);
    from.setUTCDate(from.getUTCDate() - DASHBOARD_RANGE_DAYS[range]);
    return {
      from: from.toISOString(),
      businessUnitId: businessUnitId ?? undefined,
    };
  }, [businessUnitId, range]);
}

/** Layout resolvido pelo backend: quais widgets este tenant enxerga. */
export function useDashboardLayout(range: DashboardRangeKey) {
  const query = useMemo(() => ({ range }), [range]);
  return useApiQuery(
    dashboardService.keys.layout(query),
    ({ signal }) => dashboardService.layout(query, { signal }),
    REFRESH_POLICY.layout,
  );
}

/** KPIs, séries, projeções e indicadores ambientais em uma única leitura. */
export function useAnalyticsDashboard(
  query: AnalyticsQuery,
  options?: ApiQueryOptions<
    Awaited<ReturnType<typeof analyticsService.dashboard>>
  >,
) {
  return useApiQuery(
    analyticsService.keys.dashboard(query),
    ({ signal }) => analyticsService.dashboard(query, { signal }),
    { ...REFRESH_POLICY.analytics, refetchOnWindowFocus: true, ...options },
  );
}

export function useAnalyticsHealth(query: AnalyticsQuery) {
  return useApiQuery(
    analyticsService.keys.health(query),
    ({ signal }) => analyticsService.health(query, { signal }),
    REFRESH_POLICY.health,
  );
}

export function useAnalyticsKpis(query: AnalyticsQuery) {
  return useApiQuery(
    analyticsService.keys.kpis(query),
    ({ signal }) => analyticsService.kpis(query, { signal }),
    REFRESH_POLICY.analytics,
  );
}

export function useAnalyticsTrends(query: AnalyticsQuery) {
  return useApiQuery(
    analyticsService.keys.trends(query),
    ({ signal }) => analyticsService.trends(query, { signal }),
    REFRESH_POLICY.analytics,
  );
}

export function useAnalyticsForecasts(query: AnalyticsQuery) {
  return useApiQuery(
    analyticsService.keys.forecasts(query),
    ({ signal }) => analyticsService.forecasts(query, { signal }),
    REFRESH_POLICY.intelligence,
  );
}

export function useEnvironmentalImpact() {
  return useApiQuery(
    analyticsService.keys.environmentalImpact(),
    ({ signal }) => analyticsService.environmentalImpact({ signal }),
    REFRESH_POLICY.environment,
  );
}

export function useOrbitIntelligence(query: AnalyticsQuery) {
  return useApiQuery(
    analyticsService.keys.intelligence(query),
    ({ signal }) => analyticsService.intelligence(query, { signal }),
    REFRESH_POLICY.intelligence,
  );
}

/**
 * Agenda da semana corrente.
 *
 * `date` é quantizado no dia para manter a query key estável.
 */
export function useAgenda() {
  const { businessUnitId } = useActiveScope();
  const query = useMemo<AgendaQuery>(() => {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    return {
      view: "WEEK",
      date: date.toISOString(),
      businessUnitId: businessUnitId ?? undefined,
    };
  }, [businessUnitId]);

  return useApiQuery(
    schedulingService.keys.agenda(query),
    ({ signal }) => schedulingService.agenda(query, { signal }),
    { ...REFRESH_POLICY.agenda, refetchOnWindowFocus: true },
  );
}
