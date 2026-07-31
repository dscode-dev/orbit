import { EnvironmentalIntelligenceProvider } from '../dashboards/environmental-intelligence.provider';
import type { AnalyticsSnapshot } from './analytics.types';
import { EnvironmentalImpactEngine } from './engines/environmental-impact.engine';
import { ForecastEngine } from './engines/forecast.engine';
import { HealthEngine } from './engines/health.engine';
import { KpiEngine } from './engines/kpi.engine';
import { TrendEngine } from './engines/trend.engine';

const date = (value: string) => new Date(value);
const snapshot: AnalyticsSnapshot = {
  organization: { id: 'tenant', segment: 'HVAC_R' },
  range: {
    from: date('2026-07-01T00:00:00.000Z'),
    to: date('2026-07-07T23:59:59.000Z'),
    previousFrom: date('2026-06-24T00:00:00.000Z'),
    previousTo: date('2026-06-30T23:59:59.000Z'),
    granularity: 'DAY',
  },
  operations: [
    {
      id: '1',
      status: 'COMPLETED',
      scheduledEnd: date('2026-07-02T12:00:00Z'),
      startedAt: date('2026-07-02T08:00:00Z'),
      completedAt: date('2026-07-02T11:00:00Z'),
      createdAt: date('2026-07-01T10:00:00Z'),
      users: [{ user: { id: 'u1', displayName: 'Técnico 1' } }],
    },
    {
      id: '2',
      status: 'OPEN',
      scheduledEnd: date('2026-07-08T12:00:00Z'),
      startedAt: null,
      completedAt: null,
      createdAt: date('2026-07-03T10:00:00Z'),
      users: [],
    },
  ],
  previousOperations: [
    {
      id: '0',
      status: 'COMPLETED',
      scheduledEnd: date('2026-06-26T12:00:00Z'),
      startedAt: date('2026-06-26T08:00:00Z'),
      completedAt: date('2026-06-26T11:00:00Z'),
      createdAt: date('2026-06-25T10:00:00Z'),
      users: [],
    },
  ],
  pmocs: [
    {
      status: 'FINALIZED',
      createdAt: date('2026-07-01T10:00:00Z'),
      finalizedAt: date('2026-07-02T10:00:00Z'),
    },
  ],
  assets: [{ status: 'ACTIVE' }, { status: 'MAINTENANCE' }],
  customers: [{ status: 'ACTIVE' }, { status: 'INACTIVE' }],
};

describe('Analytics engines', () => {
  const kpis = new KpiEngine().execute(snapshot);
  const trends = new TrendEngine().execute(snapshot);
  const environment = new EnvironmentalImpactEngine().execute(
    new EnvironmentalIntelligenceProvider().read(),
  );

  it('aggregates all requested domains and exposes proxy provenance', () => {
    expect(new Set(kpis.indicators.map((item) => item.domain))).toEqual(
      new Set(['OPERATIONS', 'PMOC', 'EQUIPMENT', 'TECHNICIANS', 'CONTRACTS']),
    );
    expect(
      kpis.indicators.find((item) => item.id === 'contracts.active_proxy')
        ?.dataQuality,
    ).toBe('PROXY');
    expect(
      kpis.indicators.find((item) => item.id === 'operations.sla_compliance')
        ?.value,
    ).toBe(100);
  });

  it('creates deterministic bucketed trends and simple projections', () => {
    expect(trends.series[0]?.points).toHaveLength(7);
    const forecasts = new ForecastEngine().execute(trends);
    expect(forecasts.forecasts).toHaveLength(3);
    expect(
      forecasts.forecasts.every((item) => item.projected.length === 3),
    ).toBe(true);
  });

  it('derives environmental impact and includes it in health', () => {
    expect(environment.source).toBe('MOCK_DERIVED');
    expect(environment.indicators.delayRiskPercent).toBeGreaterThan(0);
    const health = new HealthEngine().execute(kpis, environment);
    expect(health.score).toBeGreaterThanOrEqual(0);
    expect(health.score).toBeLessThanOrEqual(100);
    expect(health.dimensions).toHaveLength(5);
  });
});
