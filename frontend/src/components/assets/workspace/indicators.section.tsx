"use client";

/**
 * Indicadores operacionais do ativo.
 *
 * ## De onde vêm os números
 *
 * **Não há analytics por ativo.** `AnalyticsQueryDto` aceita `from`, `to`,
 * `granularity` e `businessUnitId` — não `assetId`. Nenhum Read Model do
 * módulo Analytics é do equipamento.
 *
 * O que existe de verdade é a **contagem que o servidor faz** ao responder uma
 * consulta filtrada: `meta.total` de `GET /operations?assetId=…` e de
 * `GET /artifact-executions?assetId=…`. Esses números são contados no banco,
 * não somados aqui — a consulta pede `limit: 1` justamente porque só o total
 * interessa.
 *
 * ## Por que passam pelo Metric Registry
 *
 * O backend publica o número; rótulo, descrição, ícone, cor, formato e
 * procedência são apresentação, e apresentação de indicador tem um único dono
 * nesta base. As definições estão registradas em `metric-registry.ts` com os
 * mesmos ids usados aqui.
 *
 * ## O que **não** está aqui
 *
 * MTBF, disponibilidade, custo acumulado e tempo médio de reparo. São
 * indicadores legítimos de gestão de ativos e nenhum deles tem fonte: derivá-los
 * das listas seria cálculo de métrica no cliente, exatamente o que esta base
 * não faz.
 */
import { PanelFrame, PanelWithoutSource } from "@/components/panels";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAssetExecutionsCount,
  useAssetOperationsCount,
} from "@/hooks/assets/use-assets";
import { formatMetricValue, resolveMetric } from "@/metrics";
import { cn } from "@/lib/utils";

/** Ids registrados no Metric Registry para os contadores do ativo. */
const METRIC_IDS = {
  operations: "asset.operations.total",
  openOperations: "asset.operations.open",
  executions: "asset.artifact_executions.total",
} as const;

export function IndicatorsSection({ assetId }: { assetId: string }) {
  const operations = useAssetOperationsCount(assetId);
  const openOperations = useAssetOperationsCount(assetId, "IN_PROGRESS");
  const executions = useAssetExecutionsCount(assetId);

  return (
    <PanelFrame
      panelId="asset-indicators"
      title="Indicadores"
      description="Contagens do servidor para este ativo"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Counter
          metricId={METRIC_IDS.operations}
          value={operations.data?.meta.total}
          pending={operations.isPending}
          failed={Boolean(operations.error)}
        />
        <Counter
          metricId={METRIC_IDS.openOperations}
          value={openOperations.data?.meta.total}
          pending={openOperations.isPending}
          failed={Boolean(openOperations.error)}
        />
        <Counter
          metricId={METRIC_IDS.executions}
          value={executions.data?.meta.total}
          pending={executions.isPending}
          failed={Boolean(executions.error)}
        />
      </div>

      <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
        Indicadores de engenharia de manutenção — MTBF, disponibilidade, custo
        acumulado — dependem de Read Models por ativo que o Analytics ainda não
        publica.
      </p>
    </PanelFrame>
  );
}

function Counter({
  metricId,
  value,
  pending,
  failed,
}: {
  metricId: string;
  value: number | undefined;
  pending: boolean;
  failed: boolean;
}) {
  const definition = resolveMetric({ id: metricId });
  const Icon = definition.icon;

  return (
    <div className="space-y-1 rounded-lg border border-border px-3 py-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={cn("size-3.5", definition.color)} aria-hidden />
        {definition.label}
      </p>

      {pending ? (
        <Skeleton className="h-7 w-16" />
      ) : failed || value === undefined ? (
        <p className="text-sm text-muted-foreground">indisponível</p>
      ) : (
        <p className="font-display text-2xl font-bold tabular-nums">
          {formatMetricValue(definition, value)}
        </p>
      )}

      <p className="text-[10px] text-muted-foreground">
        {definition.description}
      </p>
    </div>
  );
}

/**
 * Saúde do ativo.
 *
 * `GET /analytics/health` existe, mas é da **organização ou da unidade** —
 * `AnalyticsQueryDto` não aceita `assetId`. Exibir aquele índice nesta tela
 * atribuiria ao equipamento um número que descreve a operação inteira.
 */
export function HealthSection() {
  return (
    <PanelFrame
      panelId="asset-health"
      title="Saúde do ativo"
      description="Índice de condição do equipamento"
    >
      <PanelWithoutSource reason="O índice de saúde publicado pelo Analytics é da organização ou da unidade — GET /analytics/health não aceita assetId. Não há Read Model de saúde por equipamento, e atribuir o índice da operação a este ativo seria falso." />
    </PanelFrame>
  );
}

/**
 * Histórico do ativo.
 *
 * O modelo `Asset` não tem tabela de eventos, e não há endpoint de auditoria.
 * Reconstruir a linha do tempo a partir das operações e execuções foi
 * explicitamente descartado: seria história montada no cliente, com risco de
 * divergir do que o servidor registra.
 */
export function HistorySection() {
  return (
    <PanelFrame
      panelId="asset-history"
      title="Histórico"
      description="Eventos do equipamento ao longo do tempo"
    >
      <PanelWithoutSource reason="Não há tabela de histórico do ativo nem endpoint de auditoria. Os painéis de operações, agenda e artefatos mostram os registros vinculados; uma linha do tempo do equipamento depende de o backend publicá-la." />
    </PanelFrame>
  );
}

/**
 * Orbit Intelligence do ativo.
 *
 * Os três caminhos de IA existentes têm outro escopo:
 * `GET /analytics/intelligence` é da organização, `GET /ai-executions` filtra
 * por `operationId`, e os insights de artefato pertencem à execução. Nenhum
 * responde "o que a IA observou sobre este equipamento".
 */
export function IntelligenceSection() {
  return (
    <PanelFrame
      panelId="asset-intelligence"
      title="Orbit Intelligence"
      description="Alertas, recomendações, anomalias e tendências do ativo"
    >
      <PanelWithoutSource reason="Nenhum endpoint devolve inteligência com escopo de ativo: /analytics/intelligence é da organização, /ai-executions filtra por operação e os insights de artefato pertencem à execução. Enquanto não houver, este painel declara a ausência em vez de reaproveitar dados de outro escopo." />
    </PanelFrame>
  );
}
