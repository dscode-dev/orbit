/**
 * Metric Registry — definição única de como cada métrica é apresentada.
 *
 * O backend publica **valor, unidade, status, direção e procedência**. O que
 * ele não publica é apresentação: rótulo curto, descrição, ícone, cor, se
 * subir é bom, prioridade de exibição e quando marcar a procedência. Sem um
 * lugar para isso, essa decisão se espalha em `switch`, `if` e mapas dentro
 * dos componentes — foi o que aconteceu no Dashboard antes desta camada.
 *
 * Regras:
 *
 * - **Nenhum componente decide apresentação de métrica.** Ele resolve pelo
 *   registry e renderiza o que voltar.
 * - **O registry não calcula valores.** Ele formata e classifica o que o
 *   backend já produziu.
 * - **Métrica desconhecida não quebra a tela.** `resolveMetric` devolve uma
 *   definição derivada do próprio contrato do backend.
 *
 * Para registrar uma métrica nova, adicione uma entrada em `DEFINITIONS` com
 * o mesmo `id` que o backend publica. Ver `docs/metric-registry.md`.
 */
import type { ComponentType } from "react";
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Cloud,
  Gauge,
  Handshake,
  Thermometer,
  Timer,
  Users,
  Wrench,
  type LucideProps,
} from "lucide-react";

import type {
  AnalyticsDirection,
  AnalyticsDomain,
  DataQuality,
} from "@/types/dashboard";

export type MetricIcon = ComponentType<LucideProps>;

/** Agrupamento de negócio da métrica; espelha `AnalyticsDomain`. */
export type MetricCategory = AnalyticsDomain;

export type MetricUnit = "count" | "percent" | "hours" | "index" | "currency";

/**
 * Como a procedência é sinalizada na interface.
 *
 * - `none` — informação legítima, marcar só poluiria.
 * - `discreet` — muda a interpretação do número; marca pequena com tooltip.
 * - `explicit` — não é observação real; precisa ficar evidente.
 */
export type ProvenanceMark = "none" | "discreet" | "explicit";

export type DataQualityBehavior = Readonly<Record<DataQuality, ProvenanceMark>>;

/** Leitura visual da variação: favorável, desfavorável ou neutra. */
export type TrendTone = "positive" | "negative" | "neutral";

export interface MetricDefinition {
  id: string;
  label: string;
  description: string;
  category: MetricCategory;
  unit?: MetricUnit;
  format: (value: number) => string;
  icon: MetricIcon;
  /** Classe de cor do ícone, sobre tokens existentes do Design System. */
  color: string;
  /** Traduz a direção publicada pelo backend em leitura visual. */
  trendColor: (direction: AnalyticsDirection) => TrendTone;
  dataQualityBehavior: DataQualityBehavior;
  /** Menor aparece primeiro. */
  priority: number;
  /** Quando definida, a métrica só aparece se o plano conceder a capability. */
  capability?: string;
}

/* ------------------------------------------------------------------ */
/* Formatação                                                          */
/* ------------------------------------------------------------------ */

const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const FORMATTERS: Readonly<
  Record<MetricUnit, (value: number) => string>
> = {
  count: (value) => integer.format(value),
  percent: (value) => `${decimal.format(value)}%`,
  hours: (value) => `${decimal.format(value)} h`,
  index: (value) => decimal.format(value),
  currency: (value) => currency.format(value),
};

/* ------------------------------------------------------------------ */
/* Comportamentos de procedência                                       */
/* ------------------------------------------------------------------ */

/**
 * Padrão da plataforma.
 *
 * `OBSERVED` e `DERIVED` não recebem marca: são informação legítima e marcá-los
 * poluiria o painel. `PROXY` recebe marca discreta porque muda como o número
 * deve ser lido. `MOCK` recebe marca explícita: nunca pode parecer observação.
 */
export const DEFAULT_DATA_QUALITY_BEHAVIOR: DataQualityBehavior = {
  OBSERVED: "none",
  DERIVED: "none",
  PROXY: "discreet",
  MOCK: "explicit",
};

/** Para métricas em que até o cálculo derivado merece contexto. */
const DERIVED_IS_NOTABLE: DataQualityBehavior = {
  ...DEFAULT_DATA_QUALITY_BEHAVIOR,
  DERIVED: "discreet",
};

/* ------------------------------------------------------------------ */
/* Leitura da tendência                                                */
/* ------------------------------------------------------------------ */

/**
 * O backend informa a direção, não se ela é boa.
 *
 * A favorabilidade é convenção de apresentação e mora aqui — não é regra de
 * negócio: nenhum valor é recalculado, só pintado.
 */
const higherIsBetter = (direction: AnalyticsDirection): TrendTone =>
  direction === "UP"
    ? "positive"
    : direction === "DOWN"
      ? "negative"
      : "neutral";

const lowerIsBetter = (direction: AnalyticsDirection): TrendTone =>
  direction === "UP"
    ? "negative"
    : direction === "DOWN"
      ? "positive"
      : "neutral";

const neutralTrend = (): TrendTone => "neutral";

/* ------------------------------------------------------------------ */
/* Definições                                                          */
/* ------------------------------------------------------------------ */

interface MetricInput extends Omit<
  MetricDefinition,
  "format" | "trendColor" | "dataQualityBehavior" | "color"
> {
  format?: MetricDefinition["format"];
  trendColor?: MetricDefinition["trendColor"];
  dataQualityBehavior?: DataQualityBehavior;
  color?: string;
}

const CATEGORY_COLORS: Readonly<Record<MetricCategory, string>> = {
  OPERATIONS: "text-chart-1",
  PMOC: "text-chart-2",
  EQUIPMENT: "text-chart-3",
  TECHNICIANS: "text-chart-4",
  CONTRACTS: "text-chart-5",
  ENVIRONMENT: "text-primary",
};

function define(input: MetricInput): MetricDefinition {
  return {
    ...input,
    color: input.color ?? CATEGORY_COLORS[input.category],
    format:
      input.format ?? (input.unit ? FORMATTERS[input.unit] : FORMATTERS.count),
    trendColor: input.trendColor ?? neutralTrend,
    dataQualityBehavior:
      input.dataQualityBehavior ?? DEFAULT_DATA_QUALITY_BEHAVIOR,
  };
}

/**
 * Métricas publicadas hoje pelo backend.
 *
 * Os `id` são exatamente os do `KpiEngine` e do `EnvironmentalImpactEngine` —
 * é a chave de ligação entre backend e apresentação.
 */
const DEFINITIONS: readonly MetricDefinition[] = [
  define({
    id: "operations.total",
    label: "Operações criadas",
    description: "Operações abertas no período, excluindo canceladas.",
    category: "OPERATIONS",
    unit: "count",
    icon: Activity,
    trendColor: higherIsBetter,
    priority: 10,
    capability: "operations.read",
  }),
  define({
    id: "operations.completion_rate",
    label: "Taxa de conclusão",
    description: "Proporção de operações concluídas sobre as criadas.",
    category: "OPERATIONS",
    unit: "percent",
    icon: CheckCircle2,
    trendColor: higherIsBetter,
    priority: 20,
    capability: "operations.read",
  }),
  define({
    id: "operations.sla_compliance",
    label: "SLA atendido",
    description:
      "Operações concluídas dentro do prazo previsto, entre as que tinham prazo.",
    category: "OPERATIONS",
    unit: "percent",
    icon: Timer,
    trendColor: higherIsBetter,
    priority: 30,
    capability: "operations.read",
  }),
  define({
    id: "pmoc.compliance",
    label: "PMOCs finalizados",
    description: "Relatórios PMOC finalizados sobre os gerados no período.",
    category: "PMOC",
    unit: "percent",
    icon: ClipboardCheck,
    trendColor: higherIsBetter,
    priority: 40,
    capability: "reports.read",
  }),
  define({
    id: "equipment.availability",
    label: "Disponibilidade dos equipamentos",
    description: "Ativos em estado ativo sobre o total cadastrado.",
    category: "EQUIPMENT",
    unit: "percent",
    icon: Wrench,
    trendColor: higherIsBetter,
    priority: 50,
    capability: "assets.read",
  }),
  define({
    id: "technicians.assignment_coverage",
    label: "Cobertura de atribuição técnica",
    description: "Operações com ao menos um técnico atribuído.",
    category: "TECHNICIANS",
    unit: "percent",
    icon: Users,
    trendColor: higherIsBetter,
    priority: 60,
    capability: "operations.read",
  }),
  define({
    id: "technicians.active",
    label: "Técnicos alocados",
    description: "Técnicos distintos com pelo menos uma atribuição no período.",
    category: "TECHNICIANS",
    unit: "count",
    icon: Users,
    trendColor: higherIsBetter,
    priority: 70,
    capability: "operations.read",
  }),
  define({
    id: "contracts.active_proxy",
    label: "Contratos ativos",
    description:
      "Aproximação por clientes ativos: o backend ainda não modela contratos.",
    category: "CONTRACTS",
    unit: "count",
    icon: Handshake,
    trendColor: higherIsBetter,
    dataQualityBehavior: DERIVED_IS_NOTABLE,
    priority: 80,
    capability: "customers.read",
  }),
  define({
    id: "environment.coolingLoadIndex",
    label: "Carga térmica",
    description: "Índice de demanda de climatização derivado das condições.",
    category: "ENVIRONMENT",
    unit: "index",
    icon: Thermometer,
    trendColor: lowerIsBetter,
    priority: 110,
  }),
  define({
    id: "environment.fieldWorkRiskIndex",
    label: "Risco em campo",
    description: "Índice de risco para trabalho externo.",
    category: "ENVIRONMENT",
    unit: "index",
    icon: Cloud,
    trendColor: lowerIsBetter,
    priority: 120,
  }),
  define({
    id: "environment.delayRiskPercent",
    label: "Risco de atraso",
    description: "Probabilidade estimada de atraso por condições ambientais.",
    category: "ENVIRONMENT",
    unit: "percent",
    icon: CalendarClock,
    trendColor: lowerIsBetter,
    priority: 130,
  }),
  define({
    id: "environment.equipmentStressIndex",
    label: "Estresse de equipamento",
    description: "Índice de desgaste esperado dos equipamentos.",
    category: "ENVIRONMENT",
    unit: "index",
    icon: Gauge,
    trendColor: lowerIsBetter,
    priority: 140,
  }),
];

const BY_ID = new Map(DEFINITIONS.map((metric) => [metric.id, metric]));

/** Ícone padrão por categoria, para métricas ainda não registradas. */
const CATEGORY_ICONS: Readonly<Record<MetricCategory, MetricIcon>> = {
  OPERATIONS: Activity,
  PMOC: ClipboardCheck,
  EQUIPMENT: Wrench,
  TECHNICIANS: Users,
  CONTRACTS: Handshake,
  ENVIRONMENT: Cloud,
};

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

export function getMetric(id: string): MetricDefinition | undefined {
  return BY_ID.get(id);
}

export function allMetrics(): readonly MetricDefinition[] {
  return DEFINITIONS;
}

/** Dados que o backend publica sobre uma métrica. */
export interface MetricContract {
  id: string;
  label?: string;
  unit?: string;
  domain?: MetricCategory;
}

const reportedUnknown = new Set<string>();

/**
 * Resolve a definição de uma métrica.
 *
 * Métrica não registrada não quebra a tela: o registry deriva uma definição
 * do próprio contrato do backend e avisa no console em desenvolvimento, uma
 * vez por id.
 */
export function resolveMetric(contract: MetricContract): MetricDefinition {
  const known = BY_ID.get(contract.id);
  if (known) return known;

  if (
    process.env.NODE_ENV !== "production" &&
    !reportedUnknown.has(contract.id)
  ) {
    reportedUnknown.add(contract.id);
    console.warn(
      `[metrics] métrica "${contract.id}" não registrada — usando apresentação derivada do contrato. ` +
        `Registre-a em src/metrics/metric-registry.ts.`,
    );
  }

  const category = contract.domain ?? "OPERATIONS";
  return define({
    id: contract.id,
    label: contract.label ?? contract.id,
    description: "Métrica publicada pelo backend e ainda não registrada.",
    category,
    unit: contract.unit === "%" ? "percent" : "count",
    icon: CATEGORY_ICONS[category],
    priority: 1000,
  });
}

/** Formata um valor pela definição da métrica. */
export function formatMetricValue(
  metric: MetricDefinition,
  value: number,
): string {
  return metric.format(value);
}

/** Como sinalizar a procedência deste indicador. */
export function provenanceMarkFor(
  metric: MetricDefinition,
  quality: DataQuality,
): ProvenanceMark {
  return metric.dataQualityBehavior[quality];
}

/** `true` quando o plano ativo libera a métrica. */
export function isMetricVisible(
  metric: MetricDefinition,
  hasCapability: (capability: string) => boolean,
): boolean {
  return !metric.capability || hasCapability(metric.capability);
}

/** Ordena pela prioridade do registry, preservando a ordem para empates. */
export function sortByPriority<T extends { id: string }>(
  items: readonly T[],
): readonly T[] {
  return [...items].sort((left, right) => {
    const leftPriority = BY_ID.get(left.id)?.priority ?? 1000;
    const rightPriority = BY_ID.get(right.id)?.priority ?? 1000;
    return leftPriority - rightPriority;
  });
}

/** Classes de cor da variação, sobre tokens existentes. */
export const TREND_TONE_CLASSES: Readonly<Record<TrendTone, string>> = {
  positive: "bg-success/15 text-success",
  negative: "bg-destructive/15 text-destructive",
  neutral: "bg-surface-strong text-muted-foreground",
};
