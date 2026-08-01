"use client";

/**
 * Widgets de domínio — PMOC, equipamentos, SLA, técnicos e contratos.
 *
 * O backend resolve esses widgets por segmento (`hvac-*`), mas o Read Model
 * que ele associa a eles (`segment-metric`) é fixture. Os números reais
 * equivalentes existem no Analytics, classificados por `domain`: cada widget
 * aqui filtra os indicadores do seu domínio em `GET /analytics/dashboard`.
 *
 * Quando o domínio não devolve nenhum indicador, o widget declara ausência de
 * dados em vez de exibir zeros.
 */
import { cn } from "@/lib/utils";
import type { AnalyticsDomain, AnalyticsKpi } from "@/types/dashboard";
import {
  formatChange,
  formatMetric,
  STATUS_CLASSES,
  STATUS_LABELS,
} from "./format";
import { ProvenanceMark } from "./provenance";
import type { WidgetProps } from "./widget-registry";
import { WidgetFrame, WidgetState } from "./widget-frame";

export interface KpiDomainWidgetOptions {
  /** Domínio do Analytics que alimenta o widget. */
  domain: AnalyticsDomain;
  /** Restringe a indicadores específicos, quando o domínio é amplo. */
  indicatorIds?: readonly string[];
}

/**
 * Cria um widget ligado a um domínio do Analytics.
 *
 * Fábrica em vez de cinco componentes iguais: a diferença entre PMOC, SLA e
 * técnicos é só o recorte dos indicadores.
 */
export function createKpiDomainWidget(options: KpiDomainWidgetOptions) {
  const select = (metrics: readonly AnalyticsKpi[]): readonly AnalyticsKpi[] =>
    metrics.filter(
      (metric) =>
        metric.domain === options.domain &&
        (!options.indicatorIds || options.indicatorIds.includes(metric.id)),
    );

  function KpiDomainWidget({ widget, analytics }: WidgetProps) {
    return (
      <WidgetFrame
        widgetId={widget.id}
        title={widget.title}
        description={widget.description}
      >
        <WidgetState
          query={analytics.dashboard}
          loadingRows={2}
          emptyMessage="O Analytics não publica indicadores para este domínio no período."
          isEmpty={(data) => select(data.metrics).length === 0}
        >
          {(data) => (
            <ul className="space-y-4">
              {select(data.metrics).map((indicator) => (
                <IndicatorRow key={indicator.id} indicator={indicator} />
              ))}
            </ul>
          )}
        </WidgetState>
      </WidgetFrame>
    );
  }

  KpiDomainWidget.displayName = `KpiDomainWidget(${options.domain})`;
  return KpiDomainWidget;
}

function IndicatorRow({ indicator }: { indicator: AnalyticsKpi }) {
  const change = formatChange(indicator.changePercent);
  return (
    <li className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm text-muted-foreground">
          {indicator.label}
        </span>
        <span className="font-display shrink-0 text-xl font-semibold">
          {formatMetric(indicator.value, indicator.unit)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
            STATUS_CLASSES[indicator.status],
          )}
        >
          {STATUS_LABELS[indicator.status]}
        </span>
        {change ? (
          <span className="text-[11px] text-muted-foreground">{change}</span>
        ) : null}
        {indicator.target === undefined ? null : (
          <span className="text-[11px] text-muted-foreground">
            meta {formatMetric(indicator.target, indicator.unit)}
          </span>
        )}
        <ProvenanceMark
          quality={indicator.dataQuality}
          source={indicator.source}
        />
      </div>
    </li>
  );
}
