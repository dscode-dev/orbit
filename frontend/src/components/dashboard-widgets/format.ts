/**
 * Formatação de apresentação.
 *
 * Só converte para texto o que o backend já calculou. Nenhum KPI, projeção,
 * score ou insight é computado aqui — o Analytics é a única autoridade
 * numérica.
 */
import type { AnalyticsDirection, AnalyticsStatus } from "@/types/dashboard";

const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** Formata um valor com a unidade declarada pelo backend. */
export function formatMetric(value: number, unit?: string): string {
  if (unit === "%") return `${decimal.format(value)}%`;
  const formatted = Number.isInteger(value)
    ? integer.format(value)
    : decimal.format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

/** Variação percentual já calculada pelo backend (`changePercent`). */
export function formatChange(changePercent: number): string | undefined {
  if (!Number.isFinite(changePercent) || changePercent === 0) return undefined;
  const sign = changePercent > 0 ? "+" : "";
  return `${sign}${decimal.format(changePercent)}%`;
}

/**
 * Converte direção + favorabilidade na tendência visual do Design System.
 *
 * O backend informa a direção, não se ela é boa. Para indicadores onde subir
 * é ruim seria necessário um campo próprio — hoje `AnalyticsKpi` não o tem,
 * então a direção é apresentada de forma neutra quanto a juízo de valor.
 */
export function toTrend(
  direction: AnalyticsDirection,
): "up" | "down" | "neutral" {
  if (direction === "UP") return "up";
  if (direction === "DOWN") return "down";
  return "neutral";
}

export const STATUS_LABELS: Readonly<Record<AnalyticsStatus, string>> = {
  HEALTHY: "Saudável",
  ATTENTION: "Atenção",
  CRITICAL: "Crítico",
};

/** Classes de cor por status, usando tokens existentes do Design System. */
export const STATUS_CLASSES: Readonly<Record<AnalyticsStatus, string>> = {
  HEALTHY: "bg-success/15 text-success",
  ATTENTION: "bg-warning/15 text-warning",
  CRITICAL: "bg-destructive/15 text-destructive",
};

/** Rótulo curto de data para eixos de gráfico. */
export function formatAxisDate(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

export function formatDateTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Percentual de confiança já produzido pelo backend (0–1). */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}% de confiança`;
}
