import { Injectable } from '@nestjs/common';
import type {
  DashboardWidgetDefinition,
  ResolvedDashboardWidget,
} from './dashboard.read-models';
import { DashboardRepository } from './dashboard.repository';

@Injectable()
export class WidgetFactory {
  constructor(private readonly repository: DashboardRepository) {}

  create(
    definition: DashboardWidgetDefinition,
    range: string,
  ): ResolvedDashboardWidget {
    return {
      ...definition,
      data: this.repository.read(definition.id, definition.readModel, range),
    };
  }
}
