import type { WeatherEnvironmentalIntelligenceReadModel } from '../dashboards/dashboard.read-models';

export type AnalyticsDomain =
  | 'OPERATIONS'
  | 'PMOC'
  | 'EQUIPMENT'
  | 'TECHNICIANS'
  | 'CONTRACTS'
  | 'ENVIRONMENT';
export type AnalyticsDirection = 'UP' | 'DOWN' | 'STABLE';
export type AnalyticsStatus = 'HEALTHY' | 'ATTENTION' | 'CRITICAL';

export type AnalyticsPeriod = {
  from: string;
  to: string;
  granularity: 'DAY' | 'WEEK' | 'MONTH';
};

export type AnalyticsKpi = {
  id: string;
  domain: AnalyticsDomain;
  label: string;
  value: number;
  unit?: string;
  target?: number;
  status: AnalyticsStatus;
  direction: AnalyticsDirection;
  changePercent: number;
  source: string;
  dataQuality: 'OBSERVED' | 'DERIVED' | 'PROXY' | 'MOCK';
};

export type KpiReadModel = {
  generatedAt: string;
  period: AnalyticsPeriod;
  indicators: AnalyticsKpi[];
};

export type TrendPoint = { timestamp: string; value: number };
export type AnalyticsTrend = {
  id: string;
  domain: AnalyticsDomain;
  label: string;
  unit?: string;
  direction: AnalyticsDirection;
  changePercent: number;
  points: TrendPoint[];
};
export type TrendReadModel = {
  generatedAt: string;
  period: AnalyticsPeriod;
  series: AnalyticsTrend[];
};

export type HealthDimension = {
  id: string;
  domain: AnalyticsDomain;
  label: string;
  score: number;
  weight: number;
  status: AnalyticsStatus;
  drivers: string[];
};
export type AnalyticsHealthReadModel = {
  generatedAt: string;
  score: number;
  status: AnalyticsStatus;
  dimensions: HealthDimension[];
};

export type AnalyticsForecast = {
  id: string;
  domain: AnalyticsDomain;
  label: string;
  unit?: string;
  method: 'LINEAR_REGRESSION' | 'MOVING_AVERAGE';
  horizon: string;
  confidence: number;
  projected: TrendPoint[];
};
export type ForecastReadModel = {
  generatedAt: string;
  forecasts: AnalyticsForecast[];
};

export type EnvironmentalImpactReadModel = {
  generatedAt: string;
  source: 'MOCK_DERIVED';
  indicators: {
    coolingLoadIndex: number;
    fieldWorkRiskIndex: number;
    delayRiskPercent: number;
    equipmentStressIndex: number;
  };
  impacts: string[];
  recommendations: string[];
  environment: WeatherEnvironmentalIntelligenceReadModel;
};

export type AnalyticsOverviewReadModel = {
  generatedAt: string;
  period: AnalyticsPeriod;
  kpis: KpiReadModel;
  trends: TrendReadModel;
  health: AnalyticsHealthReadModel;
  forecasts: ForecastReadModel;
  environmentalImpact: EnvironmentalImpactReadModel;
};

export type AnalyticsDashboardReadModel = {
  generatedAt: string;
  headline: {
    healthScore: number;
    openOperations: number;
    slaCompliance: number;
    equipmentAvailability: number;
  };
  metrics: AnalyticsKpi[];
  series: AnalyticsTrend[];
  forecasts: AnalyticsForecast[];
  environmentalImpact: EnvironmentalImpactReadModel['indicators'];
};

/** Stable, UI-agnostic input contract for Orbit Intelligence. */
export type OrbitIntelligenceAnalyticsContext = {
  generatedAt: string;
  healthScore: number;
  priorities: Array<{
    domain: AnalyticsDomain;
    indicator: string;
    status: AnalyticsStatus;
    value: number;
  }>;
  risks: string[];
  trends: Array<{
    id: string;
    direction: AnalyticsDirection;
    changePercent: number;
  }>;
  forecasts: Array<{ id: string; nextValue: number; confidence: number }>;
  environmental: EnvironmentalImpactReadModel['indicators'];
};
