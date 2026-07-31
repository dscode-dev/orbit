import type {
  AnalyticsDirection,
  AnalyticsStatus,
} from './analytics.read-models';

export const round = (value: number, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
export const percent = (part: number, total: number) =>
  total ? round((part / total) * 100) : 0;
export const change = (current: number, previous: number) =>
  previous ? round(((current - previous) / previous) * 100) : current ? 100 : 0;
export const direction = (value: number): AnalyticsDirection =>
  value > 0.5 ? 'UP' : value < -0.5 ? 'DOWN' : 'STABLE';
export const statusFor = (
  value: number,
  attention: number,
  critical: number,
  higherIsBetter = true,
): AnalyticsStatus => {
  if (higherIsBetter)
    return value < critical
      ? 'CRITICAL'
      : value < attention
        ? 'ATTENTION'
        : 'HEALTHY';
  return value > critical
    ? 'CRITICAL'
    : value > attention
      ? 'ATTENTION'
      : 'HEALTHY';
};
export const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value));
