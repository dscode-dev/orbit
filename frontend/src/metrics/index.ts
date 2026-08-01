/**
 * Metric Registry — ponto único de apresentação de métricas.
 *
 * `import { presentMetric, MetricStatusBadge } from "@/metrics";`
 */
export {
  allMetrics,
  formatMetricValue,
  getMetric,
  isMetricVisible,
  provenanceMarkFor,
  resolveMetric,
  sortByPriority,
  DEFAULT_DATA_QUALITY_BEHAVIOR,
  FORMATTERS,
  TREND_TONE_CLASSES,
  type DataQualityBehavior,
  type MetricCategory,
  type MetricContract,
  type MetricDefinition,
  type MetricIcon,
  type MetricUnit,
  type ProvenanceMark,
  type TrendTone,
} from "./metric-registry";
export {
  formatChangePercent,
  presentMetric,
  presentValue,
  STATUS_CLASSES,
  STATUS_LABELS,
  type PresentedMetric,
} from "./present";
export { MetricProvenanceMark, SimulatedSourceNotice } from "./provenance-mark";
