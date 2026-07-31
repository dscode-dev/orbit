import { Injectable } from '@nestjs/common';
import type { WeatherEnvironmentalIntelligenceReadModel } from '../../dashboards/dashboard.read-models';
import type { EnvironmentalImpactReadModel } from '../analytics.read-models';
import { clamp, round } from '../analytics.math';

@Injectable()
export class EnvironmentalImpactEngine {
  execute(
    environment: WeatherEnvironmentalIntelligenceReadModel,
  ): EnvironmentalImpactReadModel {
    const {
      temperatureCelsius,
      feelsLikeCelsius,
      humidityPercent,
      windKilometersPerHour,
    } = environment.current;
    const rainProbability = Math.max(
      0,
      ...environment.forecast.map((day) => day.precipitationProbability),
    );
    const coolingLoadIndex = clamp(
      (temperatureCelsius - 18) * 4 + humidityPercent * 0.35,
    );
    const fieldWorkRiskIndex = clamp(
      (feelsLikeCelsius - 24) * 4 +
        rainProbability * 0.45 +
        windKilometersPerHour * 0.3,
    );
    const equipmentStressIndex = clamp(
      coolingLoadIndex * 0.72 + humidityPercent * 0.2,
    );
    const delayRiskPercent = clamp(
      fieldWorkRiskIndex * 0.62 + rainProbability * 0.25,
    );
    return {
      generatedAt: new Date().toISOString(),
      source: 'MOCK_DERIVED',
      indicators: {
        coolingLoadIndex: round(coolingLoadIndex),
        fieldWorkRiskIndex: round(fieldWorkRiskIndex),
        delayRiskPercent: round(delayRiskPercent),
        equipmentStressIndex: round(equipmentStressIndex),
      },
      impacts: environment.intelligence.operationalImpact,
      recommendations: environment.intelligence.practicalRecommendations,
      environment,
    };
  }
}
