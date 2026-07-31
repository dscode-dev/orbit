import type { AnalyticsQueryDto } from './dto/analytics-query.dto';
import type {
  AnalyticsDashboardReadModel,
  OrbitIntelligenceAnalyticsContext,
} from './analytics.read-models';

export const ANALYTICS_READ_PORT = Symbol('ANALYTICS_READ_PORT');

export interface AnalyticsReadPort {
  dashboard(
    organizationId: string,
    query: AnalyticsQueryDto,
  ): Promise<AnalyticsDashboardReadModel>;
  intelligenceContext(
    organizationId: string,
    query: AnalyticsQueryDto,
  ): Promise<OrbitIntelligenceAnalyticsContext>;
}
