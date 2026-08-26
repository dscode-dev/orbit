import { Injectable } from '@nestjs/common';
import type {
  DashboardWidgetDefinition,
  ResolvedDashboardWidget,
} from './dashboard.read-models';
import { DashboardRepository } from './dashboard.repository';

@Injectable()
export class WidgetFactory {
  constructor(private readonly repository: DashboardRepository) {}

  async create(
    definition: DashboardWidgetDefinition,
    range: string,
    organizationId: string,
  ): Promise<ResolvedDashboardWidget> {
    return {
      ...definition,
      data: await this.repository.read(
        organizationId,
        definition.id,
        definition.readModel,
        range,
      ),
    };
  }
}
