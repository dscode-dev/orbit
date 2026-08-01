/**
 * ARQUIVO GERADO — NÃO EDITE MANUALMENTE.
 * Fonte: backend/src
 * Regenerar: npm run contracts:sync
 */

export type WidgetSize = 'SMALL' | 'MEDIUM' | 'LARGE' | 'FULL';
export type WidgetCategory =
  | 'ATTENTION'
  | 'EXECUTIVE'
  | 'OPERATIONS'
  | 'TEAM'
  | 'ACTIVITY'
  | 'EVENTS'
  | 'INTELLIGENCE'
  | 'ENVIRONMENT'
  | 'INVENTORY'
  | 'ASSETS'
  | 'COMMERCIAL';

export type MetricTrend = {
  direction: 'UP' | 'DOWN' | 'STABLE';
  change: number;
  period: string;
  favorable: boolean;
};

export type ExecutiveKpiReadModel = {
  generatedAt: string;
  metrics: Array<{
    key: string;
    label: string;
    value: number;
    unit?: string;
    trend: MetricTrend;
  }>;
};

export type AttentionCenterReadModel = {
  generatedAt: string;
  totals: { critical: number; warning: number; information: number };
  items: Array<{
    id: string;
    severity: 'CRITICAL' | 'WARNING' | 'INFORMATION';
    title: string;
    description: string;
    entityType?: string;
    entityId?: string;
    dueAt?: string;
  }>;
};

export type HealthScoreReadModel = {
  generatedAt: string;
  score: number;
  classification: 'EXCELLENT' | 'GOOD' | 'ATTENTION' | 'CRITICAL';
  dimensions: Array<{ key: string; label: string; score: number }>;
};

export type TrendReadModel = {
  generatedAt: string;
  series: Array<{
    key: string;
    label: string;
    points: Array<{ timestamp: string; value: number }>;
  }>;
};

export type TeamPerformanceReadModel = {
  generatedAt: string;
  members: Array<{
    id: string;
    name: string;
    completed: number;
    slaCompliance: number;
    averageResolutionHours: number;
  }>;
};

export type RecentActivityReadModel = {
  generatedAt: string;
  activities: Array<{
    id: string;
    type: string;
    title: string;
    actor: string;
    occurredAt: string;
  }>;
};

export type UpcomingEventsReadModel = {
  generatedAt: string;
  events: Array<{
    id: string;
    type: string;
    title: string;
    startsAt: string;
    priority: 'LOW' | 'NORMAL' | 'HIGH';
  }>;
};

export type OrbitIntelligenceReadModel = {
  generatedAt: string;
  summary: string;
  recommendations: Array<{
    id: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    title: string;
    rationale: string;
    recommendedAction: string;
    confidence: number;
    sourceExecutionId?: string;
  }>;
  risks: Array<{
    id: string;
    title: string;
    probability: number;
    impact: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
  trends: Array<{
    key: string;
    label: string;
    direction: 'UP' | 'DOWN' | 'STABLE';
    confidence: number;
  }>;
  insights: string[];
};

export type EnvironmentalIndex = {
  key:
    | 'TEMPERATURE'
    | 'PRECIPITATION'
    | 'WIND'
    | 'HUMIDITY'
    | 'UV'
    | 'AIR_QUALITY'
    | 'FROST_RISK'
    | 'HEAT_STRESS';
  label: string;
  value: number;
  unit: string;
  classification: string;
  trend: 'RISING' | 'FALLING' | 'STABLE';
};

export type WeatherEnvironmentalIntelligenceReadModel = {
  generatedAt: string;
  source: 'MOCK';
  location: {
    name: string;
    latitude: number;
    longitude: number;
    timezone: string;
  };
  current: {
    observedAt: string;
    condition: string;
    temperatureCelsius: number;
    feelsLikeCelsius: number;
    precipitationMillimeters: number;
    windKilometersPerHour: number;
    windDirection: string;
    humidityPercent: number;
  };
  forecast: Array<{
    date: string;
    condition: string;
    minimumCelsius: number;
    maximumCelsius: number;
    precipitationProbability: number;
    precipitationMillimeters: number;
    windKilometersPerHour: number;
    humidityPercent: number;
  }>;
  alerts: Array<{
    id: string;
    severity: 'INFORMATION' | 'WARNING' | 'CRITICAL';
    event: string;
    startsAt: string;
    endsAt: string;
    guidance: string;
  }>;
  indices: EnvironmentalIndex[];
  trends: Array<{
    metric: string;
    direction: 'RISING' | 'FALLING' | 'STABLE';
    horizon: string;
    description: string;
  }>;
  intelligence: {
    operationalImpact: string[];
    predictedRisks: string[];
    opportunities: string[];
    practicalRecommendations: string[];
  };
};

export type SegmentMetricReadModel = {
  generatedAt: string;
  status: 'HEALTHY' | 'ATTENTION' | 'CRITICAL';
  metrics: Array<{
    key: string;
    label: string;
    value: number;
    unit?: string;
    target?: number;
  }>;
  highlights: Array<{
    id: string;
    title: string;
    description: string;
    severity: 'INFORMATION' | 'WARNING' | 'CRITICAL';
  }>;
};

export type DashboardReadModel =
  | ExecutiveKpiReadModel
  | AttentionCenterReadModel
  | HealthScoreReadModel
  | TrendReadModel
  | TeamPerformanceReadModel
  | RecentActivityReadModel
  | UpcomingEventsReadModel
  | OrbitIntelligenceReadModel
  | WeatherEnvironmentalIntelligenceReadModel
  | SegmentMetricReadModel;

export type DashboardWidgetDefinition = {
  id: string;
  title: string;
  description: string;
  category: WidgetCategory;
  order: number;
  size: WidgetSize;
  tags: readonly string[];
  supportedSegments: readonly string[];
  requiredModules: readonly string[];
  requiredPlans: readonly string[];
  requiredPermissions: readonly string[];
  readModel: string;
};

export type ResolvedDashboardWidget = DashboardWidgetDefinition & {
  data: DashboardReadModel;
};
