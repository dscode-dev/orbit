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
} from './dashboard.read-models';
import { EnvironmentalIntelligenceProvider } from './environmental-intelligence.provider';

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
  constructor(
    private readonly rls: RlsTransaction,
    private readonly environmental: EnvironmentalIntelligenceProvider,
  ) {}

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

  async read(
    organizationId: string,
    widgetId: string,
    readModel: string,
    range: string,
  ): Promise<DashboardReadModel> {
    if (widgetId === 'hvac-pmoc-status') return this.pmocStatus(organizationId);
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
        return this.environmental.read();
      default:
        return this.segmentMetric(widgetId);
    }
  }

  private pmocStatus(organizationId: string): Promise<SegmentMetricReadModel> {
    return this.rls.run(async (tx) => {
      const plans = await tx.pmocPlan.groupBy({
        by: ['status'],
        where: { organizationId, deletedAt: null },
        _count: { _all: true },
      });
      const executions = await tx.pmocExecution.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: { _all: true },
      });
      const count = (rows: typeof plans, status: string) =>
        rows.find((row) => row.status === status)?._count._all ?? 0;
      const active = count(plans, 'ACTIVE');
      const suspended = count(plans, 'SUSPENDED');
      const completed = count(executions, 'COMPLETED');
      const totalCycles = executions.reduce(
        (total, row) => total + row._count._all,
        0,
      );
      const compliance = totalCycles
        ? Math.round((completed / totalCycles) * 10_000) / 100
        : 100;
      return {
        generatedAt: this.now(),
        status:
          suspended > 0
            ? 'CRITICAL'
            : compliance < 85
              ? 'ATTENTION'
              : 'HEALTHY',
        metrics: [
          { key: 'active', label: 'Planos ativos', value: active },
          { key: 'attention', label: 'Planos suspensos', value: suspended },
          {
            key: 'compliance',
            label: 'Ciclos concluídos',
            value: compliance,
            unit: '%',
            target: 95,
          },
        ],
        highlights:
          suspended > 0
            ? [
                {
                  id: 'pmoc-suspended-plans',
                  title: 'Planos suspensos exigem atenção',
                  description: `${suspended} plano(s) PMOC estão suspensos.`,
                  severity: 'WARNING',
                },
              ]
            : [],
      };
    });
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
}
