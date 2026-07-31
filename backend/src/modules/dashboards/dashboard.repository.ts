import { Injectable } from '@nestjs/common';
import { RlsTransaction } from '../../database';
import type {
  AttentionCenterReadModel,
  DashboardReadModel,
  ExecutiveKpiReadModel,
  HealthScoreReadModel,
  OrbitIntelligenceReadModel,
  RecentActivityReadModel,
  SegmentMetricReadModel,
  TeamPerformanceReadModel,
  TrendReadModel,
  UpcomingEventsReadModel,
  WeatherEnvironmentalIntelligenceReadModel,
} from './dashboard.read-models';

export type DashboardTenantContext = {
  organizationId: string;
  organizationName: string;
  segment: string;
  planKey: string;
  subscriptionStatus: string;
  modules: readonly string[];
  planCapabilities: readonly string[];
};

@Injectable()
export class DashboardRepository {
  constructor(private readonly rls: RlsTransaction) {}

  context(organizationId: string): Promise<DashboardTenantContext | null> {
    return this.rls.run(async (tx) => {
      const organization = await tx.organization.findFirst({
        where: { id: organizationId, deletedAt: null },
        select: {
          id: true,
          displayName: true,
          primarySegment: true,
          subscriptionStatus: true,
          plan: {
            select: {
              key: true,
              moduleTags: true,
              capabilities: true,
              isActive: true,
            },
          },
        },
      });
      if (!organization || !organization.plan.isActive) return null;
      const modules = organization.plan.moduleTags.length
        ? await tx.module.findMany({
            where: {
              tag: { in: organization.plan.moduleTags },
              isActive: true,
            },
            select: { key: true },
          })
        : [];
      return {
        organizationId: organization.id,
        organizationName: organization.displayName,
        segment: organization.primarySegment,
        planKey: organization.plan.key,
        subscriptionStatus: organization.subscriptionStatus,
        modules: modules.map((module) => module.key.toLowerCase()),
        planCapabilities: organization.plan.capabilities,
      };
    });
  }

  read(widgetId: string, readModel: string, range: string): DashboardReadModel {
    switch (readModel) {
      case 'attention-center':
        return this.attention();
      case 'executive-kpis':
        return this.kpis();
      case 'health-score':
        return this.health();
      case 'operational-trend':
        return this.trend(range);
      case 'team-performance':
        return this.team();
      case 'recent-activity':
        return this.activity();
      case 'upcoming-events':
        return this.events();
      case 'orbit-intelligence':
        return this.intelligence();
      case 'weather-environmental-intelligence':
        return this.environment();
      default:
        return this.segmentMetric(widgetId);
    }
  }

  private now() {
    return new Date().toISOString();
  }

  private attention(): AttentionCenterReadModel {
    return {
      generatedAt: this.now(),
      totals: { critical: 2, warning: 5, information: 3 },
      items: [
        {
          id: 'attention-1',
          severity: 'CRITICAL',
          title: 'Operação com SLA em risco',
          description:
            'Atendimento prioritário se aproxima do limite previsto.',
          entityType: 'OPERATION',
          dueAt: this.future(2),
        },
        {
          id: 'attention-2',
          severity: 'WARNING',
          title: 'Documento aguardando assinatura',
          description: 'Relatório aprovado ainda possui assinatura pendente.',
          entityType: 'REPORT',
          dueAt: this.future(24),
        },
      ],
    };
  }

  private kpis(): ExecutiveKpiReadModel {
    return {
      generatedAt: this.now(),
      metrics: [
        {
          key: 'active_operations',
          label: 'Operações ativas',
          value: 42,
          trend: {
            direction: 'UP',
            change: 8.2,
            period: '30D',
            favorable: true,
          },
        },
        {
          key: 'sla_compliance',
          label: 'SLA atendido',
          value: 94.6,
          unit: '%',
          trend: {
            direction: 'UP',
            change: 2.1,
            period: '30D',
            favorable: true,
          },
        },
        {
          key: 'customer_health',
          label: 'Saúde da carteira',
          value: 86,
          unit: '/100',
          trend: {
            direction: 'STABLE',
            change: 0.4,
            period: '30D',
            favorable: true,
          },
        },
      ],
    };
  }

  private health(): HealthScoreReadModel {
    return {
      generatedAt: this.now(),
      score: 87,
      classification: 'GOOD',
      dimensions: [
        { key: 'operations', label: 'Operações', score: 91 },
        { key: 'customers', label: 'Clientes', score: 88 },
        { key: 'compliance', label: 'Conformidade', score: 82 },
      ],
    };
  }

  private trend(range: string): TrendReadModel {
    const points = range === '7D' ? 7 : range === '90D' ? 12 : 10;
    return {
      generatedAt: this.now(),
      series: [
        {
          key: 'created',
          label: 'Criadas',
          points: Array.from({ length: points }, (_, index) => ({
            timestamp: this.past((points - index) * 24),
            value: 18 + ((index * 7) % 13),
          })),
        },
        {
          key: 'completed',
          label: 'Concluídas',
          points: Array.from({ length: points }, (_, index) => ({
            timestamp: this.past((points - index) * 24),
            value: 15 + ((index * 5) % 11),
          })),
        },
      ],
    };
  }

  private team(): TeamPerformanceReadModel {
    return {
      generatedAt: this.now(),
      members: [
        {
          id: 'team-1',
          name: 'Equipe Norte',
          completed: 38,
          slaCompliance: 96,
          averageResolutionHours: 4.2,
        },
        {
          id: 'team-2',
          name: 'Equipe Sul',
          completed: 31,
          slaCompliance: 92,
          averageResolutionHours: 5.1,
        },
      ],
    };
  }

  private activity(): RecentActivityReadModel {
    return {
      generatedAt: this.now(),
      activities: [
        {
          id: 'activity-1',
          type: 'OPERATION_COMPLETED',
          title: 'Operação concluída',
          actor: 'Equipe técnica',
          occurredAt: this.past(1),
        },
        {
          id: 'activity-2',
          type: 'REPORT_PUBLISHED',
          title: 'Relatório publicado',
          actor: 'Gestão operacional',
          occurredAt: this.past(3),
        },
      ],
    };
  }

  private events(): UpcomingEventsReadModel {
    return {
      generatedAt: this.now(),
      events: [
        {
          id: 'event-1',
          type: 'MAINTENANCE',
          title: 'Manutenção programada',
          startsAt: this.future(24),
          priority: 'HIGH',
        },
        {
          id: 'event-2',
          type: 'DOCUMENT_DUE',
          title: 'Revisão documental',
          startsAt: this.future(72),
          priority: 'NORMAL',
        },
      ],
    };
  }

  private intelligence(): OrbitIntelligenceReadModel {
    return {
      generatedAt: this.now(),
      summary:
        'A operação permanece saudável, com oportunidade de reduzir o backlog preventivo.',
      recommendations: [
        {
          id: 'recommendation-1',
          priority: 'HIGH',
          title: 'Antecipar atendimentos preventivos',
          rationale: 'A demanda projetada cresce nos próximos sete dias.',
          recommendedAction:
            'Realocar uma equipe para a fila preventiva até sexta-feira.',
          confidence: 0.86,
        },
      ],
      risks: [
        {
          id: 'risk-1',
          title: 'Concentração de operações críticas',
          probability: 0.62,
          impact: 'HIGH',
        },
      ],
      trends: [
        {
          key: 'preventive_backlog',
          label: 'Backlog preventivo',
          direction: 'UP',
          confidence: 0.81,
        },
      ],
      insights: [
        'O tempo médio de resolução melhorou nas últimas quatro semanas.',
        'A maior oportunidade está na redistribuição da carga de trabalho.',
      ],
    };
  }

  private environment(): WeatherEnvironmentalIntelligenceReadModel {
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

  private segmentMetric(widgetId: string): SegmentMetricReadModel {
    const label = widgetId
      .split('-')
      .slice(1)
      .map((value) => value[0]?.toUpperCase() + value.slice(1))
      .join(' ');
    return {
      generatedAt: this.now(),
      status: 'HEALTHY',
      metrics: [
        { key: 'active', label: `${label} ativos`, value: 24 },
        { key: 'attention', label: 'Requer atenção', value: 3, target: 0 },
        { key: 'compliance', label: 'Conformidade', value: 92, unit: '%' },
      ],
      highlights: [
        {
          id: `${widgetId}-highlight`,
          title: 'Indicadores dentro do esperado',
          description: 'Read Model mockado e preparado para a fonte real.',
          severity: 'INFORMATION',
        },
      ],
    };
  }

  private future(hours: number) {
    return new Date(Date.now() + hours * 3_600_000).toISOString();
  }

  private past(hours: number) {
    return new Date(Date.now() - hours * 3_600_000).toISOString();
  }

  private date(days: number) {
    return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  }
}
