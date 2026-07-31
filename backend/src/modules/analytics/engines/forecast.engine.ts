import { Injectable } from '@nestjs/common';
import type {
  AnalyticsForecast,
  ForecastReadModel,
  TrendPoint,
  TrendReadModel,
} from '../analytics.read-models';
import { clamp, round } from '../analytics.math';

@Injectable()
export class ForecastEngine {
  execute(trends: TrendReadModel): ForecastReadModel {
    return {
      generatedAt: new Date().toISOString(),
      forecasts: trends.series.map((series) => {
        const forecast = this.project(series.points);
        return {
          id: `${series.id}.forecast`,
          domain: series.domain,
          label: `Projeção — ${series.label}`,
          unit: series.unit,
          method: forecast.method,
          horizon: '3_PERIODS',
          confidence: forecast.confidence,
          projected: forecast.points,
        } satisfies AnalyticsForecast;
      }),
    };
  }

  private project(points: TrendPoint[]): {
    method: AnalyticsForecast['method'];
    confidence: number;
    points: TrendPoint[];
  } {
    const values = points.map((point) => point.value);
    const lastDate = new Date(points.at(-1)?.timestamp ?? Date.now());
    const step =
      points.length > 1
        ? Math.max(
            86_400_000,
            lastDate.getTime() - new Date(points.at(-2)!.timestamp).getTime(),
          )
        : 86_400_000;
    if (values.length < 3) {
      const average = values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : 0;
      return {
        method: 'MOVING_AVERAGE',
        confidence: 0.45,
        points: this.points(lastDate, step, [average, average, average]),
      };
    }
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((sum, value) => sum + value, 0) / n;
    const denominator = values.reduce(
      (sum, _, index) => sum + (index - xMean) ** 2,
      0,
    );
    const slope =
      values.reduce(
        (sum, value, index) => sum + (index - xMean) * (value - yMean),
        0,
      ) / denominator;
    const intercept = yMean - slope * xMean;
    const fitted = values.map((_, index) => intercept + slope * index);
    const error =
      values.reduce(
        (sum, value, index) => sum + Math.abs(value - fitted[index]!),
        0,
      ) / n;
    const confidence = round(
      clamp(1 - error / Math.max(1, yMean), 0.35, 0.92),
      2,
    );
    return {
      method: 'LINEAR_REGRESSION',
      confidence,
      points: this.points(
        lastDate,
        step,
        [n, n + 1, n + 2].map((index) =>
          Math.max(0, intercept + slope * index),
        ),
      ),
    };
  }

  private points(last: Date, step: number, values: number[]): TrendPoint[] {
    return values.map((value, index) => ({
      timestamp: new Date(last.getTime() + step * (index + 1)).toISOString(),
      value: round(value),
    }));
  }
}
