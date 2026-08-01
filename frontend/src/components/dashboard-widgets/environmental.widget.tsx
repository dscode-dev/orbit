"use client";

/**
 * Clima e impacto ambiental — `GET /analytics/environmental-impact`.
 *
 * **Procedência**: o contrato declara `source: 'MOCK_DERIVED'` no impacto e
 * `source: 'MOCK'` no clima que o alimenta — o backend ainda não integra um
 * provedor meteorológico real. O widget carrega essa marca de forma visível,
 * porque apresentar previsão simulada como observação induziria decisão
 * operacional errada.
 */
import { CloudSun, Droplets, Thermometer, Wind } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { KpiCard } from "@/components/ui/stat-card";
import type { EnvironmentalImpactReadModel } from "@/types/dashboard";
import { formatMetric } from "./format";
import { SimulatedSourceNotice } from "./provenance";
import type { WidgetProps } from "./widget-registry";
import { WidgetFrame, WidgetState } from "./widget-frame";

const IMPACT_LABELS: Readonly<
  Record<keyof EnvironmentalImpactReadModel["indicators"], string>
> = {
  coolingLoadIndex: "Carga térmica",
  fieldWorkRiskIndex: "Risco em campo",
  delayRiskPercent: "Risco de atraso",
  equipmentStressIndex: "Estresse de equipamento",
};

export function EnvironmentalWidget({ widget, analytics }: WidgetProps) {
  const source = analytics.environmentalImpact.data?.source;

  return (
    <WidgetFrame
      widgetId={widget.id}
      title={widget.title}
      description={widget.description}
      actions={source ? <SimulatedSourceNotice source={source} /> : null}
    >
      <WidgetState query={analytics.environmentalImpact} loadingRows={4}>
        {(data) => (
          <div className="space-y-5">
            <Alert>
              <CloudSun className="size-4" />
              <AlertTitle>Fonte meteorológica simulada</AlertTitle>
              <AlertDescription>
                O backend ainda não integra um provedor de clima. Estes números
                não descrevem as condições reais da sua operação e não devem
                embasar decisão de campo.
              </AlertDescription>
            </Alert>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(
                Object.keys(data.indicators) as Array<
                  keyof EnvironmentalImpactReadModel["indicators"]
                >
              ).map((key) => (
                <KpiCard
                  key={key}
                  label={IMPACT_LABELS[key]}
                  value={formatMetric(
                    data.indicators[key],
                    key === "delayRiskPercent" ? "%" : undefined,
                  )}
                  progress={Math.min(100, Math.max(0, data.indicators[key]))}
                />
              ))}
            </div>

            <CurrentConditions environment={data.environment} />

            {data.impacts.length > 0 || data.recommendations.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <TextList title="Impactos previstos" items={data.impacts} />
                <TextList title="Recomendações" items={data.recommendations} />
              </div>
            ) : null}
          </div>
        )}
      </WidgetState>
    </WidgetFrame>
  );
}

function CurrentConditions({
  environment,
}: {
  environment: EnvironmentalImpactReadModel["environment"];
}) {
  const { current, location } = environment;
  return (
    <div className="space-y-2 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {location.name}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {current.condition}
          </span>
        </p>
        <SimulatedSourceNotice source={environment.source} />
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Thermometer className="size-3.5" aria-hidden />
          {formatMetric(current.temperatureCelsius, "°C")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Droplets className="size-3.5" aria-hidden />
          {formatMetric(current.humidityPercent, "%")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Wind className="size-3.5" aria-hidden />
          {formatMetric(current.windKilometersPerHour, "km/h")}
        </span>
      </div>
    </div>
  );
}

function TextList({
  title,
  items,
}: {
  title: string;
  items: readonly string[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="text-sm text-muted-foreground">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
