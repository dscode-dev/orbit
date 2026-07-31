import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardRepository } from './dashboard.repository';
import { DashboardService } from './dashboard.service';
import { WidgetFactory } from './widget-factory';
import { WidgetRegistry } from './widget-registry';
import { WidgetResolver } from './widget-resolver';
import { EnvironmentalIntelligenceProvider } from './environmental-intelligence.provider';

@Module({
  controllers: [DashboardController],
  providers: [
    DashboardRepository,
    DashboardService,
    WidgetRegistry,
    WidgetResolver,
    WidgetFactory,
    EnvironmentalIntelligenceProvider,
  ],
  exports: [
    DashboardService,
    WidgetRegistry,
    EnvironmentalIntelligenceProvider,
  ],
})
export class DashboardModule {}
