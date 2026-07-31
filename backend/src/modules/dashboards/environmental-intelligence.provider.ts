import { Injectable } from '@nestjs/common';
import type { WeatherEnvironmentalIntelligenceReadModel } from './dashboard.read-models';

/** Shared contract boundary for the future environmental data integration. */
@Injectable()
export class EnvironmentalIntelligenceProvider {
  read(): WeatherEnvironmentalIntelligenceReadModel {
    return {
      generatedAt: this.now(),
      source: 'MOCK',
      location: {
        name: 'Unidade principal',
        latitude: -8.0476,
        longitude: -34.877,
        timezone: 'America/Recife',
      },
      current: {
        observedAt: this.now(),
        condition: 'Parcialmente nublado',
        temperatureCelsius: 29,
        feelsLikeCelsius: 32,
        precipitationMillimeters: 0.4,
        windKilometersPerHour: 18,
        windDirection: 'SE',
        humidityPercent: 74,
      },
      forecast: [
        {
          date: this.date(1),
          condition: 'Pancadas isoladas',
          minimumCelsius: 24,
          maximumCelsius: 30,
          precipitationProbability: 55,
          precipitationMillimeters: 8,
          windKilometersPerHour: 21,
          humidityPercent: 78,
        },
        {
          date: this.date(2),
          condition: 'Nublado',
          minimumCelsius: 23,
          maximumCelsius: 29,
          precipitationProbability: 35,
          precipitationMillimeters: 3,
          windKilometersPerHour: 17,
          humidityPercent: 76,
        },
      ],
      alerts: [
        {
          id: 'weather-alert-1',
          severity: 'WARNING',
          event: 'Chuva intensa localizada',
          startsAt: this.future(12),
          endsAt: this.future(20),
          guidance: 'Revisar atividades externas e proteger insumos sensíveis.',
        },
      ],
      indices: [
        {
          key: 'TEMPERATURE',
          label: 'Temperatura',
          value: 29,
          unit: '°C',
          classification: 'Elevada',
          trend: 'RISING',
        },
        {
          key: 'HUMIDITY',
          label: 'Umidade',
          value: 74,
          unit: '%',
          classification: 'Alta',
          trend: 'STABLE',
        },
        {
          key: 'WIND',
          label: 'Vento',
          value: 18,
          unit: 'km/h',
          classification: 'Moderado',
          trend: 'FALLING',
        },
        {
          key: 'HEAT_STRESS',
          label: 'Estresse térmico',
          value: 67,
          unit: '/100',
          classification: 'Atenção',
          trend: 'RISING',
        },
      ],
      trends: [
        {
          metric: 'temperature',
          direction: 'RISING',
          horizon: '48H',
          description: 'Elevação gradual durante o período da tarde.',
        },
        {
          metric: 'precipitation',
          direction: 'RISING',
          horizon: '24H',
          description: 'Maior probabilidade de chuva no fim do dia.',
        },
      ],
      intelligence: {
        operationalImpact: [
          'Maior carga térmica pode elevar o esforço dos equipamentos.',
          'Atividades externas podem sofrer interrupções localizadas.',
        ],
        predictedRisks: [
          'Estresse térmico moderado para equipes em campo.',
          'Possível perda de eficiência energética no pico da tarde.',
        ],
        opportunities: [
          'Antecipar atividades externas para o início da manhã.',
          'Ajustar estratégias de climatização antes do pico térmico.',
        ],
        practicalRecommendations: [
          'Reforçar pausas e hidratação das equipes.',
          'Verificar drenagem e proteção de materiais expostos.',
        ],
      },
    };
  }

  private now() {
    return new Date().toISOString();
  }
  private future(hours: number) {
    return new Date(Date.now() + hours * 3_600_000).toISOString();
  }
  private date(days: number) {
    return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  }
}
