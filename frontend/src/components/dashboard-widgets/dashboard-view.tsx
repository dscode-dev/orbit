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
  useMonthComparison,
  useOrbitIntelligence,
} from "@/hooks/dashboard/use-dashboard";
import { useSchedulingTimeZone } from "@/components/scheduling/use-scheduling-timezone";
import { useSession } from "@/providers/session-provider";
import { useActiveScope } from "@/providers/use-active-scope";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_RANGES,
  DASHBOARD_RANGE_LABELS,
  type DashboardRangeKey,
} from "@/types/dashboard";
import { formatDateTime } from "@/lib/formatters";
import { PanelError, toPanelQuery } from "@/components/panels";
import { resolveWidgets, type WidgetDataSources } from "./widget-registry";
import { ehEstreito, organizarPainel } from "./dashboard-layout";

export function DashboardView() {
  const [range, setRange] = useState<DashboardRangeKey>("30D");
  const session = useSession();
  const scope = useActiveScope();
  const analyticsQuery = useAnalyticsQuery(range);
  /**
   * Fuso da unidade ativa.
   *
   * As janelas de comparação começam no primeiro dia do mês **na unidade**;
   * em UTC a fronteira cairia três horas antes e jogaria o início do mês para
   * o mês anterior. O resolvedor é o mesmo da agenda — não há um segundo.
   */
  const { timeZone } = useSchedulingTimeZone();

  const layout = useDashboardLayout(range);
  const comparison = useMonthComparison(timeZone);

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
      query: analyticsQuery,
      dashboard: toPanelQuery(useAnalyticsDashboard(analyticsQuery)),
      health: toPanelQuery(useAnalyticsHealth(analyticsQuery)),
      intelligence: toPanelQuery(useOrbitIntelligence(analyticsQuery)),
      environmentalImpact: toPanelQuery(useEnvironmentalImpact()),
    },
    scheduling: {
      agenda: toPanelQuery(useAgenda()),
    },
    comparison: {
      current: toPanelQuery(comparison.current),
      previous: toPanelQuery(comparison.previous),
      windows: comparison.windows,
    },
  };

  const widgets = layout.data ? resolveWidgets(layout.data.layout.widgets) : [];

  /**
   * As seções do painel, e o componente de cada widget por id.
   *
   * O mapa existe para o `organizarPainel` poder trabalhar só com o widget —
   * a arrumação depende do tamanho, não do componente — sem obrigar a
   * renderização a procurar em lista a cada item.
   */
  const secoes = organizarPainel(widgets.map((item) => item.widget));
  const componentePorId = new Map(
    widgets.map((item) => [item.widget.id, item] as const),
  );

  const renderizar = (id: string) => {
    const item = componentePorId.get(id);
    if (!item) return null;
    const { widget, Component } = item;
    return <Component widget={widget} {...sources} />;
  };

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
              void sources.comparison.current.refetch();
              void sources.comparison.previous.refetch();
            }}
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </header>

      {layout.isPending ? (
        <LayoutSkeleton />
      ) : layout.error ? (
        <PanelError
          error={layout.error}
          onRetry={() => void layout.refetch()}
        />
      ) : widgets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum widget disponível para o seu plano e permissões.
        </p>
      ) : (
        <div className="space-y-6">
          {secoes.map((secao, posicao) =>
            secao.tipo === "faixa" ? (
              <div key={secao.widget.id} className="min-w-0">
                {renderizar(secao.widget.id)}
              </div>
            ) : (
              <div
                key={`bloco-${posicao}`}
                className="grid gap-6 lg:grid-cols-12"
              >
                {/*
                    Coluna principal. Os estreitos se emparelham de dois em
                    dois; os largos ocupam a coluna inteira.
                  */}
                <div
                  className={cn(
                    "grid min-w-0 gap-6 sm:grid-cols-2",
                    secao.lateral.length > 0
                      ? "lg:col-span-8"
                      : "lg:col-span-12",
                  )}
                >
                  {secao.principal.map((widget) => (
                    <div
                      key={widget.id}
                      className={cn(
                        "min-w-0",
                        ehEstreito(widget) ? "" : "sm:col-span-2",
                      )}
                    >
                      {renderizar(widget.id)}
                    </div>
                  ))}
                </div>

                {/*
                    Coluna lateral. Empilha por conta própria: é isso que
                    impede a altura dela de abrir buraco na principal.
                  */}
                {secao.lateral.length > 0 ? (
                  <div className="min-w-0 space-y-6 lg:col-span-4">
                    {secao.lateral.map((widget) => (
                      <div key={widget.id} className="min-w-0">
                        {renderizar(widget.id)}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ),
          )}
        </div>
      )}
    </ContentContainer>
  );
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
