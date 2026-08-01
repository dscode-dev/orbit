"use client";

/**
 * Composição do Dashboard.
 *
 * Client Component porque o painel é interativo: faixa de período,
 * atualização automática por widget e gráficos. As leituras compartilhadas
 * são feitas **uma vez aqui** e distribuídas aos widgets — nenhum widget
 * repete a mesma consulta, e o cache do TanStack Query mantém a coerência.
 *
 * A ordem, o tamanho e a presença de cada widget vêm de `GET /dashboard`. O
 * frontend não decide o que aparece.
 */
import { useState } from "react";
import { RefreshCw } from "lucide-react";

import { ContentContainer } from "@/components/layout/page-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAgenda,
  useAnalyticsDashboard,
  useAnalyticsHealth,
  useAnalyticsQuery,
  useDashboardLayout,
  useEnvironmentalImpact,
  useOrbitIntelligence,
} from "@/hooks/dashboard/use-dashboard";
import { useSession } from "@/providers/session-provider";
import { useActiveScope } from "@/providers/use-active-scope";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_RANGES,
  DASHBOARD_RANGE_LABELS,
  type DashboardRangeKey,
} from "@/types/dashboard";
import { formatDateTime } from "./format";
import { WidgetError } from "./widget-frame";
import {
  resolveWidgets,
  WIDGET_SPAN,
  type WidgetDataSources,
} from "./widget-registry";

export function DashboardView() {
  const [range, setRange] = useState<DashboardRangeKey>("30D");
  const session = useSession();
  const scope = useActiveScope();
  const analyticsQuery = useAnalyticsQuery(range);

  const layout = useDashboardLayout(range);

  /**
   * Leituras compartilhadas.
   *
   * `/analytics/dashboard` já traz KPIs, séries, projeções e indicadores
   * ambientais — por isso os widgets de KPI, tendência e domínio consomem
   * essa única consulta em vez de chamar `/analytics/kpis` e
   * `/analytics/trends` separadamente.
   */
  const sources: WidgetDataSources = {
    analytics: {
      dashboard: toWidgetQuery(useAnalyticsDashboard(analyticsQuery)),
      health: toWidgetQuery(useAnalyticsHealth(analyticsQuery)),
      intelligence: toWidgetQuery(useOrbitIntelligence(analyticsQuery)),
      environmentalImpact: toWidgetQuery(useEnvironmentalImpact()),
    },
    scheduling: {
      agenda: toWidgetQuery(useAgenda()),
    },
  };

  const widgets = layout.data ? resolveWidgets(layout.data.layout.widgets) : [];

  return (
    <ContentContainer size="wide" className="space-y-8">
      <header className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{session.organization?.displayName ?? "—"}</span>
            {session.entitlements ? (
              <Badge variant="outline">{session.entitlements.planKey}</Badge>
            ) : null}
            {layout.data ? (
              <Badge variant="outline">{layout.data.context.segment}</Badge>
            ) : null}
            {scope.businessUnit ? (
              <Badge variant="secondary">
                {scope.businessUnit.tradeName ?? scope.businessUnit.legalName}
              </Badge>
            ) : null}
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Visão geral
          </h1>
          {layout.data ? (
            <p className="text-sm text-muted-foreground">
              Atualizado em {formatDateTime(layout.data.generatedAt)}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <div
            className="flex rounded-lg border border-border p-0.5"
            role="group"
            aria-label="Período"
          >
            {DASHBOARD_RANGES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRange(option)}
                aria-pressed={option === range}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  option === range
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {DASHBOARD_RANGE_LABELS[option]}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label="Atualizar dashboard"
            onClick={() => {
              void layout.refetch();
              void sources.analytics.dashboard.refetch();
              void sources.analytics.health.refetch();
              void sources.analytics.intelligence.refetch();
              void sources.scheduling.agenda.refetch();
            }}
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </header>

      {layout.isPending ? (
        <LayoutSkeleton />
      ) : layout.error ? (
        <WidgetError
          error={layout.error}
          onRetry={() => void layout.refetch()}
        />
      ) : widgets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum widget disponível para o seu plano e permissões.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {widgets.map(({ widget, Component }) => (
            <div
              key={widget.id}
              className={cn("min-w-0", WIDGET_SPAN[widget.size])}
            >
              <Component widget={widget} {...sources} />
            </div>
          ))}
        </div>
      )}
    </ContentContainer>
  );
}

/** Adapta o resultado do TanStack Query ao contrato consumido pelos widgets. */
function toWidgetQuery<TData>(query: {
  data: TData | undefined;
  isPending: boolean;
  error: unknown;
  refetch: () => unknown;
}) {
  return {
    data: query.data,
    isPending: query.isPending,
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
  };
}

function LayoutSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {[
        "lg:col-span-8",
        "lg:col-span-4",
        "lg:col-span-12",
        "lg:col-span-8",
        "lg:col-span-4",
      ].map((span, index) => (
        <Skeleton key={index} className={cn("h-56 rounded-xl", span)} />
      ))}
    </div>
  );
}
