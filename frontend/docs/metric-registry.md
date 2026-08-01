# Orbit V2 — Metric Registry

Definição única de **como cada métrica é apresentada**. Entregue no Stage 0 da
PR-04 e já consumido pelo Dashboard e pelo Analytics.

---

## 1. Por que existe

O backend publica valor, unidade, status, direção e procedência. O que ele não
publica é apresentação: rótulo curto, descrição, ícone, cor, se subir é bom,
prioridade de exibição e quando marcar a procedência.

Sem um lugar para isso, a decisão se espalha. Era exatamente o estado do
Dashboard depois da PR-03:

| Antes | Onde estava |
| --- | --- |
| `DOMAIN_ICONS` | `executive-kpis.widget.tsx` |
| `IMPACT_LABELS` | `environmental.widget.tsx` |
| `formatMetric` / `formatChange` / `toTrend` | `dashboard-widgets/format.ts` |
| `STATUS_CLASSES` / `STATUS_LABELS` | `dashboard-widgets/format.ts` |
| decisão de marcar procedência | `provenance.tsx` |

Hoje tudo isso está em `src/metrics/`, e nenhum componente decide apresentação
de métrica.

---

## 2. Anatomia de uma métrica

```ts
interface MetricDefinition {
  id: string;                    // mesmo id publicado pelo backend
  label: string;                 // rótulo curto, curado
  description: string;           // o que o número significa
  category: MetricCategory;      // OPERATIONS | PMOC | EQUIPMENT | TECHNICIANS | CONTRACTS | ENVIRONMENT
  unit?: MetricUnit;             // count | percent | hours | index | currency
  format: (value: number) => string;
  icon: MetricIcon;
  color: string;                 // classe sobre tokens do Design System
  trendColor: (direction) => TrendTone;   // favorabilidade
  dataQualityBehavior: Record<DataQuality, ProvenanceMark>;
  priority: number;              // menor aparece primeiro
  capability?: string;           // visibilidade por plano
}
```

### Favorabilidade (`trendColor`)

O backend informa a **direção** (`UP`/`DOWN`/`STABLE`), não se ela é boa. Subir
o SLA é ótimo; subir o risco de atraso não é. Essa leitura é convenção de
apresentação e mora no registry:

```ts
trendColor: higherIsBetter   // SLA, conclusão, disponibilidade
trendColor: lowerIsBetter    // risco de atraso, estresse de equipamento
trendColor: neutralTrend     // padrão, quando não há juízo definido
```

Não é regra de negócio: nenhum valor é recalculado, só pintado.

### Procedência (`dataQualityBehavior`)

| Valor | Marca padrão | Motivo |
| --- | --- | --- |
| `OBSERVED` | `none` | contagem direta; marcar poluiria |
| `DERIVED` | `none` | cálculo do backend sobre fatos observados |
| `PROXY` | `discreet` | muda a interpretação do número |
| `MOCK` | `explicit` | não pode parecer observação real |

Uma métrica pode sobrescrever esse comportamento — `contracts.active_proxy`
usa `DERIVED_IS_NOTABLE`, porque mesmo o derivado ali merece contexto.

---

## 3. Registrar uma métrica nova

Uma entrada em `DEFINITIONS`, em `src/metrics/metric-registry.ts`:

```ts
define({
  id: "operations.reopen_rate",        // exatamente o id do backend
  label: "Taxa de reabertura",
  description: "Operações reabertas após conclusão, no período.",
  category: "OPERATIONS",
  unit: "percent",
  icon: RotateCcw,
  trendColor: lowerIsBetter,           // reabrir mais é pior
  priority: 35,
  capability: "operations.read",
}),
```

Só isso. Todo consumidor — Dashboard, Analytics, módulos futuros — passa a
exibir a métrica com rótulo, ícone, cor, formato, favorabilidade, ordem e marca
de procedência corretos.

**Métrica não registrada não quebra a tela.** `resolveMetric` deriva uma
definição do próprio contrato do backend (rótulo e unidade que vieram na
resposta) e avisa no console em desenvolvimento, uma vez por id.

---

## 4. Como consumir

Uma única porta:

```tsx
import { presentMetric, MetricProvenanceMark, sortByPriority } from "@/metrics";

const metric = presentMetric(kpi);   // AnalyticsKpi → tudo pronto para a UI

<StatCard
  label={metric.label}
  value={metric.value}          // já formatado pela unidade
  delta={metric.change}
  trend={metric.trendTone}
  icon={<metric.icon className={metric.iconColor} />}
/>
<MetricProvenanceMark
  quality={metric.provenance.quality}
  mark={metric.provenance.mark}   // decidido pelo registry, não pelo componente
  source={metric.provenance.source}
/>
```

Para valores que não chegam como `AnalyticsKpi` — os indicadores ambientais são
números nus dentro de `EnvironmentalImpactReadModel.indicators` — use
`presentValue(metricId, value, { quality })`.

Para ordenar por relevância: `sortByPriority(metrics)`.

Para esconder por plano: `isMetricVisible(metric, session.hasCapability)`.

---

## 5. Limites

- **O registry não calcula.** Formata e classifica o que o backend produziu.
  KPI, projeção, score e insight continuam sendo do Analytics.
- **O `id` é o contrato.** Se o backend renomear uma métrica, a entrada precisa
  acompanhar — o aviso de "métrica não registrada" no console é o sinal.
- **Formatação de data e hora não é métrica** e mora em `@/lib/formatters`.
