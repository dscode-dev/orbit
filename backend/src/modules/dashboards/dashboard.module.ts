import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardRepository } from './dashboard.repository';
import { DashboardService } from './dashboard.service';
import { WidgetFactory } from './widget-factory';
import { WidgetRegistry } from './widget-registry';
import { WidgetResolver } from './widget-resolver';

@Module({
  controllers: [DashboardController],
  providers: [
    DashboardRepository,
    DashboardService,
    WidgetRegistry,
    WidgetResolver,
    WidgetFactory,
  ],
  exports: [DashboardService, WidgetRegistry],
})
export class DashboardModule {}
