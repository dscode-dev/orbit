"use client";

/**
 * Orbit Intelligence no Execution Center.
 *
 * ## Qual endpoint, e por quê
 *
 * `GET /analytics/intelligence` — o contexto de inteligência **da
 * organização**, que já alimenta o Dashboard. É o único endpoint que publica
 * prioridades, riscos, tendências e projeções em escopo de tenant.
 *
 * As `insights` por execução (`kind`, `severity`, `source`, `title`) existem
 * **dentro** do detalhe de cada execução, e não há rota que as liste em
 * conjunto. Montar um painel de inconsistências da organização exigiria abrir
 * uma execução por vez e juntar aqui — o que seria agregação no cliente,
 * cara e frágil. Elas continuam onde o contrato as coloca: no Workspace da
 * execução.
 *
 * Nada é gerado localmente: o que aparece é o que o backend publicou.
 */
import { AlertTriangle, Lightbulb, TrendingUp } from "lucide-react";

import { PanelFrame, PanelState, toPanelQuery } from "@/components/panels";
import { Badge } from "@/components/ui/badge";
import {
  useAnalyticsQuery,
  useOrbitIntelligence,
} from "@/hooks/dashboard/use-dashboard";
import { metricLabel } from "@/metrics";

export function ExecutionIntelligencePanel() {
  const query = useAnalyticsQuery("30D");
  const intelligence = useOrbitIntelligence(query);

  return (
    <PanelFrame
      panelId="execution-center-intelligence"
      title="Orbit Intelligence"
      description="Prioridades, riscos e tendências publicados pelo Analytics nos últimos 30 dias."
    >
      <PanelState
        query={toPanelQuery(intelligence)}
        loadingRows={5}
        isEmpty={(data) =>
          data.priorities.length === 0 &&
          data.risks.length === 0 &&
          data.trends.length === 0
        }
        emptyMessage="Nada apontado no período."
      >
        {(data) => (
          <div className="space-y-5">
            {data.priorities.length > 0 ? (
              <Group
                icon={<AlertTriangle className="size-4 text-amber-400" />}
                title="Indicadores fora do saudável"
              >
                <ul className="space-y-1.5">
                  {data.priorities.map((priority) => (
                    <li
                      key={priority.indicator}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span>{metricLabel(priority.indicator)}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs tabular-nums">
                          {priority.value}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {priority.status}
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              </Group>
            ) : null}

            {data.risks.length > 0 ? (
              <Group
                icon={<Lightbulb className="size-4 text-primary" />}
                title="Observações"
              >
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {data.risks.map((risk, index) => (
                    <li key={`${index}-${risk.slice(0, 24)}`}>{risk}</li>
                  ))}
                </ul>
              </Group>
            ) : null}

            {data.trends.length > 0 ? (
              <Group
                icon={<TrendingUp className="size-4 text-emerald-400" />}
                title="Tendências"
              >
                <ul className="space-y-1.5">
                  {data.trends.map((trend) => (
                    <li
                      key={trend.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span>{metricLabel(trend.id)}</span>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {trend.direction} · {trend.changePercent}%
                      </span>
                    </li>
                  ))}
                </ul>
              </Group>
            ) : null}

            <p className="border-t border-border pt-3 text-xs text-muted-foreground">
              As inconsistências apontadas em cada execução aparecem dentro dela. Uma lista consolidada ainda não está disponível.
            </p>
          </div>
        )}
      </PanelState>
    </PanelFrame>
  );
}

function Group({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}
