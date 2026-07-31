import { DashboardRepository } from './dashboard.repository';

describe('DashboardRepository mock Read Models', () => {
  const repository = new DashboardRepository({} as never);

  it('exposes weather and environmental intelligence as a stable contract', () => {
    const model = repository.read(
      'weather-environmental-intelligence',
      'weather-environmental-intelligence',
      '30D',
    );
    if (!('source' in model)) throw new Error('Unexpected Read Model');
    expect(model.source).toBe('MOCK');
    expect(typeof model.current.temperatureCelsius).toBe('number');
    expect(typeof model.current.humidityPercent).toBe('number');
    expect(model.forecast.length).toBeGreaterThan(0);
    expect(model.alerts.length).toBeGreaterThan(0);
    expect(model.indices.length).toBeGreaterThan(0);
    expect(model.trends.length).toBeGreaterThan(0);
    expect(model.intelligence.operationalImpact.length).toBeGreaterThan(0);
    expect(model.intelligence.predictedRisks.length).toBeGreaterThan(0);
    expect(model.intelligence.opportunities.length).toBeGreaterThan(0);
    expect(model.intelligence.practicalRecommendations.length).toBeGreaterThan(
      0,
    );
  });

  it('returns a modeled Orbit Intelligence payload', () => {
    const model = repository.read(
      'orbit-intelligence',
      'orbit-intelligence',
      '30D',
    );
    if (!('recommendations' in model)) throw new Error('Unexpected Read Model');
    expect(model.recommendations.length).toBeGreaterThan(0);
    expect(model.risks.length).toBeGreaterThan(0);
    expect(model.trends.length).toBeGreaterThan(0);
    expect(model.insights.length).toBeGreaterThan(0);
  });
});
