import { Injectable } from '@nestjs/common';
import { ValidationException } from '../../exceptions';
import { EnvironmentalIntelligenceProvider } from '../dashboards/environmental-intelligence.provider';
import type { AnalyticsReadPort } from './analytics.port';
import type {
  AnalyticsDashboardReadModel,
  AnalyticsOverviewReadModel,
  OrbitIntelligenceAnalyticsContext,
} from './analytics.read-models';
import { AnalyticsRepository } from './analytics.repository';
import type { AnalyticsRange } from './analytics.types';
import type { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { EnvironmentalImpactEngine } from './engines/environmental-impact.engine';
import { ForecastEngine } from './engines/forecast.engine';
import { HealthEngine } from './engines/health.engine';
import { KpiEngine } from './engines/kpi.engine';
import { TrendEngine } from './engines/trend.engine';

/** Thin application orchestrator; all calculations live in specialized engines. */
@Injectable()
export class AnalyticsService implements AnalyticsReadPort {
  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly environmentalProvider: EnvironmentalIntelligenceProvider,
    private readonly kpiEngine: KpiEngine,
    private readonly trendEngine: TrendEngine,
    private readonly healthEngine: HealthEngine,
    private readonly forecastEngine: ForecastEngine,
    private readonly environmentalImpactEngine: EnvironmentalImpactEngine,
  ) {}

  async overview(
    organizationId: string,
    query: AnalyticsQueryDto,
  ): Promise<AnalyticsOverviewReadModel> {
    const range = this.range(query);
    const [snapshot, environmental] = await Promise.all([
      this.repository.snapshot(organizationId, range),
      Promise.resolve(this.environmentalProvider.read()),
    ]);
    const kpis = this.kpiEngine.execute(snapshot);
    const trends = this.trendEngine.execute(snapshot);
    const environmentalImpact =
      this.environmentalImpactEngine.execute(environmental);
    const health = this.healthEngine.execute(kpis, environmentalImpact);
    const forecasts = this.forecastEngine.execute(trends);
    return {
      generatedAt: new Date().toISOString(),
      period: kpis.period,
      kpis,
      trends,
      health,
      forecasts,
      environmentalImpact,
    };
  }

  async kpis(organizationId: string, query: AnalyticsQueryDto) {
    return (await this.overview(organizationId, query)).kpis;
  }
  async trends(organizationId: string, query: AnalyticsQueryDto) {
    return (await this.overview(organizationId, query)).trends;
  }
  async health(organizationId: string, query: AnalyticsQueryDto) {
    return (await this.overview(organizationId, query)).health;
  }
  async forecasts(organizationId: string, query: AnalyticsQueryDto) {
    return (await this.overview(organizationId, query)).forecasts;
  }
  environmentalImpact() {
    return this.environmentalImpactEngine.execute(
      this.environmentalProvider.read(),
    );
  }

  async dashboard(
    organizationId: string,
    query: AnalyticsQueryDto,
  ): Promise<AnalyticsDashboardReadModel> {
    const model = await this.overview(organizationId, query);
    const metric = (id: string) =>
      model.kpis.indicators.find((item) => item.id === id)?.value ?? 0;
    return {
      generatedAt: model.generatedAt,
      headline: {
        healthScore: model.health.score,
        openOperations: Math.max(
          0,
          metric('operations.total') *
            (1 - metric('operations.completion_rate') / 100),
        ),
        slaCompliance: metric('operations.sla_compliance'),
        equipmentAvailability: metric('equipment.availability'),
      },
      metrics: model.kpis.indicators,
      series: model.trends.series,
      forecasts: model.forecasts.forecasts,
      environmentalImpact: model.environmentalImpact.indicators,
    };
  }

  async intelligenceContext(
    organizationId: string,
    query: AnalyticsQueryDto,
  ): Promise<OrbitIntelligenceAnalyticsContext> {
    const model = await this.overview(organizationId, query);
    return {
      generatedAt: model.generatedAt,
      healthScore: model.health.score,
      priorities: model.kpis.indicators
        .filter((item) => item.status !== 'HEALTHY')
        .map((item) => ({
          domain: item.domain,
          indicator: item.id,
          status: item.status,
          value: item.value,
        })),
      risks: [
        ...model.environmentalImpact.impacts,
        ...model.health.dimensions
          .filter((item) => item.status !== 'HEALTHY')
          .map((item) => `${item.label}: ${item.drivers.join(', ')}`),
      ],
      trends: model.trends.series.map((item) => ({
        id: item.id,
        direction: item.direction,
        changePercent: item.changePercent,
      })),
      forecasts: model.forecasts.forecasts.map((item) => ({
        id: item.id,
        nextValue: item.projected[0]?.value ?? 0,
        confidence: item.confidence,
      })),
      environmental: model.environmentalImpact.indicators,
    };
  }

  private range(query: AnalyticsQueryDto): AnalyticsRange {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - 30 * 86_400_000);
    if (from >= to)
      throw new ValidationException('Analytics from must be before to');
    const duration = to.getTime() - from.getTime();
    if (duration > 366 * 86_400_000)
      throw new ValidationException('Analytics range cannot exceed 366 days');
    const granularity =
      query.granularity ??
      (duration > 120 * 86_400_000
        ? 'MONTH'
        : duration > 45 * 86_400_000
          ? 'WEEK'
          : 'DAY');
    return {
      from,
      to,
      previousFrom: new Date(from.getTime() - duration),
      previousTo: new Date(to.getTime() - duration),
      granularity,
      businessUnitId: query.businessUnitId,
    };
  }
}
