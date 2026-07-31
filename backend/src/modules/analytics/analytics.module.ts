import { Module } from '@nestjs/common';
import { DashboardModule } from '../dashboards/dashboard.module';
import { ANALYTICS_READ_PORT } from './analytics.port';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';
import { EnvironmentalImpactEngine } from './engines/environmental-impact.engine';
import { ForecastEngine } from './engines/forecast.engine';
import { HealthEngine } from './engines/health.engine';
import { KpiEngine } from './engines/kpi.engine';
import { TrendEngine } from './engines/trend.engine';

@Module({
  imports: [DashboardModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsRepository,
    AnalyticsService,
    KpiEngine,
    TrendEngine,
    HealthEngine,
    ForecastEngine,
    EnvironmentalImpactEngine,
    { provide: ANALYTICS_READ_PORT, useExisting: AnalyticsService },
  ],
  exports: [AnalyticsService, ANALYTICS_READ_PORT],
})
export class AnalyticsModule {}
