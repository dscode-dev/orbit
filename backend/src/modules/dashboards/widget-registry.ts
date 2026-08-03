import { Injectable } from '@nestjs/common';
import { ConflictException, EntityNotFoundException } from '../../exceptions';
import type { DashboardWidgetDefinition } from './dashboard.read-models';

const globalWidgets: DashboardWidgetDefinition[] = [
  /**
   * Radar comparativo.
   *
   * `order: 5` e `size: 'MEDIUM'` o colocam à esquerda da Central de Atenção
   * (`order: 10`, `LARGE`): 4 + 8 fecham exatamente a linha de 12 colunas.
   *
   * O Read Model deste widget é o genérico de segmento — como já acontece com
   * os indicadores executivos, quem serve os números é o Analytics, consultado
   * pelo cliente uma vez por janela de comparação. Por isso o widget exige
   * `analytics.read`: sem essa permissão ele só exibiria um cartão de erro.
   */
  {
    id: 'operations-comparative-radar',
    title: 'Radar comparativo',
    description: 'Indicadores operacionais do mês atual contra o mês anterior.',
    category: 'OPERATIONS',
    order: 5,
    size: 'MEDIUM',
    tags: ['global', 'operations', 'kpi', 'comparison'],
    supportedSegments: [],
    /**
     * Sem exigência de módulo.
     *
     * `requiredModules` é conferido contra as `moduleTags` do plano, e o plano
     * STARTER — o único ativo hoje — não tem nenhuma. Exigir `operations` aqui
     * esconderia o radar de todo mundo, como já acontece com a Tendência
     * Operacional e o Desempenho da Equipe.
     */
    requiredModules: [],
    requiredPlans: [],
    /** Consome o Analytics; sem a permissão, só exibiria um cartão de erro. */
    requiredPermissions: ['analytics.read'],
    readModel: 'operations-comparative-radar',
  },
  {
    id: 'attention-center',
    title: 'Central de Atenção',
    description: 'Prioridades, alertas e pendências que exigem ação.',
    category: 'ATTENTION',
    order: 10,
    size: 'LARGE',
    tags: ['global', 'attention', 'alerts'],
    supportedSegments: [],
    requiredModules: [],
    requiredPlans: [],
    requiredPermissions: ['dashboard.read'],
    readModel: 'attention-center',
  },
  {
    id: 'executive-kpis',
    title: 'Indicadores Executivos',
    description: 'Indicadores executivos consolidados da organização.',
    category: 'EXECUTIVE',
    order: 20,
    size: 'FULL',
    tags: ['global', 'executive', 'kpi'],
    supportedSegments: [],
    requiredModules: [],
    requiredPlans: [],
    requiredPermissions: ['dashboard.read'],
    readModel: 'executive-kpis',
  },
  /**
   * Saúde Financeira.
   *
   * **A plataforma ainda não tem domínio financeiro**: não existe modelo de
   * lançamento, receita, despesa ou previsão no Prisma, nem endpoint que os
   * publique. O widget está registrado assim mesmo, e o cliente declara a
   * ausência em vez de exibir número inventado — o mesmo tratamento que os
   * widgets de estoque e de produção agrícola já recebem.
   *
   * Quando o módulo existir, este registro passa a apontar para o Read Model
   * real sem mudar posição nem tamanho no painel.
   */
  {
    id: 'financial-health',
    title: 'Saúde Financeira',
    description: 'Saldo, receitas, despesas, previsto e evolução mensal.',
    category: 'EXECUTIVE',
    order: 25,
    size: 'LARGE',
    tags: ['global', 'financial'],
    supportedSegments: [],
    requiredModules: [],
    requiredPlans: [],
    requiredPermissions: ['dashboard.read'],
    readModel: 'financial-health',
  },
  {
    id: 'health-score',
    title: 'Índice de Saúde',
    description: 'Visão sintética da saúde operacional.',
    category: 'EXECUTIVE',
    order: 30,
    size: 'MEDIUM',
    tags: ['global', 'health'],
    supportedSegments: [],
    requiredModules: [],
    requiredPlans: [],
    requiredPermissions: ['dashboard.read'],
    readModel: 'health-score',
  },
  {
    id: 'operational-trend',
    title: 'Tendência Operacional',
    description: 'Evolução dos principais volumes operacionais.',
    category: 'OPERATIONS',
    order: 40,
    size: 'LARGE',
    tags: ['global', 'operations', 'trend'],
    supportedSegments: [],
    requiredModules: ['operations'],
    requiredPlans: [],
    requiredPermissions: ['operations.read'],
    readModel: 'operational-trend',
  },
  {
    id: 'team-performance',
    title: 'Desempenho da Equipe',
    description: 'Produtividade e cumprimento de SLA da equipe.',
    category: 'TEAM',
    order: 50,
    size: 'LARGE',
    tags: ['global', 'team', 'operations'],
    supportedSegments: [],
    requiredModules: ['operations'],
    requiredPlans: [],
    requiredPermissions: ['operations.read'],
    readModel: 'team-performance',
  },
  {
    id: 'recent-activity',
    title: 'Atividades Recentes',
    description: 'Linha do tempo recente da organização.',
    category: 'ACTIVITY',
    order: 60,
    size: 'MEDIUM',
    tags: ['global', 'activity'],
    supportedSegments: [],
    requiredModules: [],
    requiredPlans: [],
    requiredPermissions: ['dashboard.read'],
    readModel: 'recent-activity',
  },
  {
    id: 'upcoming-events',
    title: 'Próximos Eventos',
    description: 'Agenda consolidada de compromissos e vencimentos.',
    category: 'EVENTS',
    order: 70,
    size: 'MEDIUM',
    tags: ['global', 'events'],
    supportedSegments: [],
    requiredModules: [],
    requiredPlans: [],
    requiredPermissions: ['dashboard.read'],
    readModel: 'upcoming-events',
  },
  {
    id: 'orbit-intelligence',
    title: 'Orbit Intelligence',
    description: 'Recomendações, riscos, tendências e insights de IA.',
    category: 'INTELLIGENCE',
    order: 80,
    size: 'FULL',
    tags: ['global', 'ai', 'intelligence'],
    supportedSegments: [],
    requiredModules: ['ai'],
    requiredPlans: [],
    requiredPermissions: ['ai.executions.read'],
    readModel: 'orbit-intelligence',
  },
];

const segmentWidget = (
  input: Omit<
    DashboardWidgetDefinition,
    'size' | 'requiredPlans' | 'readModel'
  > & {
    size?: DashboardWidgetDefinition['size'];
    requiredPlans?: readonly string[];
    readModel?: string;
  },
): DashboardWidgetDefinition => ({
  ...input,
  size: input.size ?? 'MEDIUM',
  requiredPlans: input.requiredPlans ?? [],
  readModel: input.readModel ?? 'segment-metric',
});

const segmentWidgets: DashboardWidgetDefinition[] = [
  segmentWidget({
    id: 'hvac-pmoc-status',
    title: 'Situação do PMOC',
    description: 'Conformidade, vencimentos e execução dos planos PMOC.',
    category: 'OPERATIONS',
    order: 110,
    tags: ['hvac-r', 'pmoc', 'compliance'],
    supportedSegments: ['HVAC_R'],
    requiredModules: ['reports'],
    requiredPermissions: ['reports.read'],
  }),
  segmentWidget({
    id: 'hvac-equipment-health',
    title: 'Saúde dos Equipamentos',
    description: 'Condição consolidada dos equipamentos monitorados.',
    category: 'ASSETS',
    order: 120,
    tags: ['hvac-r', 'assets', 'equipment'],
    supportedSegments: ['HVAC_R'],
    requiredModules: ['assets'],
    requiredPermissions: ['assets.read'],
  }),
  segmentWidget({
    id: 'hvac-sla',
    title: 'SLA',
    description: 'Atendimentos dentro e fora dos compromissos de serviço.',
    category: 'OPERATIONS',
    order: 130,
    tags: ['hvac-r', 'sla', 'operations'],
    supportedSegments: ['HVAC_R'],
    requiredModules: ['operations'],
    requiredPermissions: ['operations.read'],
  }),
  segmentWidget({
    id: 'hvac-technicians',
    title: 'Técnicos',
    description: 'Disponibilidade e produtividade técnica.',
    category: 'TEAM',
    order: 140,
    tags: ['hvac-r', 'team', 'technicians'],
    supportedSegments: ['HVAC_R'],
    requiredModules: ['operations'],
    requiredPermissions: ['operations.read'],
  }),
  segmentWidget({
    id: 'hvac-contracts',
    title: 'Contratos',
    description: 'Cobertura e situação da carteira contratual.',
    category: 'COMMERCIAL',
    order: 150,
    tags: ['hvac-r', 'contracts', 'customers'],
    supportedSegments: ['HVAC_R'],
    requiredModules: ['customers'],
    requiredPermissions: ['customers.read'],
  }),
  segmentWidget({
    id: 'weather-environmental-intelligence',
    title: 'Inteligência Climática e Ambiental',
    description: 'Clima, ambiente, impactos, riscos e recomendações.',
    category: 'ENVIRONMENT',
    order: 160,
    size: 'LARGE',
    tags: ['environment', 'weather', 'intelligence'],
    supportedSegments: ['HVAC_R', 'AGRO'],
    requiredModules: [],
    requiredPermissions: ['dashboard.read'],
    readModel: 'weather-environmental-intelligence',
  }),
  segmentWidget({
    id: 'pharmacy-critical-stock',
    title: 'Estoque Crítico',
    description: 'Itens abaixo do estoque de segurança.',
    category: 'INVENTORY',
    order: 210,
    tags: ['pharmacy', 'inventory', 'critical'],
    supportedSegments: ['PHARMACY'],
    requiredModules: ['catalog'],
    requiredPermissions: ['catalog.read'],
  }),
  segmentWidget({
    id: 'pharmacy-expiring-products',
    title: 'Produtos Próximos do Vencimento',
    description: 'Produtos próximos ao vencimento.',
    category: 'INVENTORY',
    order: 220,
    tags: ['pharmacy', 'inventory', 'expiry'],
    supportedSegments: ['PHARMACY'],
    requiredModules: ['catalog'],
    requiredPermissions: ['catalog.read'],
  }),
  segmentWidget({
    id: 'pharmacy-lots',
    title: 'Lotes',
    description: 'Rastreabilidade e situação dos lotes.',
    category: 'INVENTORY',
    order: 230,
    tags: ['pharmacy', 'lots'],
    supportedSegments: ['PHARMACY'],
    requiredModules: ['catalog'],
    requiredPermissions: ['catalog.read'],
  }),
  segmentWidget({
    id: 'pharmacy-purchases',
    title: 'Compras',
    description: 'Indicadores de compras e reposição.',
    category: 'COMMERCIAL',
    order: 240,
    tags: ['pharmacy', 'purchases'],
    supportedSegments: ['PHARMACY'],
    requiredModules: ['catalog'],
    requiredPermissions: ['catalog.read'],
  }),
  segmentWidget({
    id: 'pharmacy-dispensations',
    title: 'Dispensações',
    description: 'Volume e tendência das dispensações.',
    category: 'OPERATIONS',
    order: 250,
    tags: ['pharmacy', 'dispensations'],
    supportedSegments: ['PHARMACY'],
    requiredModules: ['catalog'],
    requiredPermissions: ['catalog.read'],
  }),
  segmentWidget({
    id: 'pharmacy-abc-curve',
    title: 'Curva ABC',
    description: 'Classificação de relevância dos produtos.',
    category: 'EXECUTIVE',
    order: 260,
    size: 'LARGE',
    tags: ['pharmacy', 'abc', 'inventory'],
    supportedSegments: ['PHARMACY'],
    requiredModules: ['catalog'],
    requiredPermissions: ['catalog.read'],
  }),
  segmentWidget({
    id: 'agro-fields-overview',
    title: 'Visão Geral das Áreas',
    description: 'Visão consolidada das áreas produtivas.',
    category: 'OPERATIONS',
    order: 310,
    tags: ['agro', 'fields'],
    supportedSegments: ['AGRO'],
    requiredModules: [],
    requiredPermissions: ['dashboard.read'],
  }),
  segmentWidget({
    id: 'agro-crop-status',
    title: 'Situação das Culturas',
    description: 'Estágio e saúde das culturas.',
    category: 'OPERATIONS',
    order: 320,
    tags: ['agro', 'crops'],
    supportedSegments: ['AGRO'],
    requiredModules: [],
    requiredPermissions: ['dashboard.read'],
  }),
  segmentWidget({
    id: 'agro-machinery',
    title: 'Maquinário',
    description: 'Disponibilidade e condição do maquinário.',
    category: 'ASSETS',
    order: 330,
    tags: ['agro', 'machinery', 'assets'],
    supportedSegments: ['AGRO'],
    requiredModules: ['assets'],
    requiredPermissions: ['assets.read'],
  }),
  segmentWidget({
    id: 'agro-inputs',
    title: 'Insumos',
    description: 'Disponibilidade e consumo de insumos.',
    category: 'INVENTORY',
    order: 340,
    tags: ['agro', 'inputs', 'inventory'],
    supportedSegments: ['AGRO'],
    requiredModules: ['catalog'],
    requiredPermissions: ['catalog.read'],
  }),
  segmentWidget({
    id: 'agro-irrigation',
    title: 'Irrigação',
    description: 'Eficiência, cobertura e alertas de irrigação.',
    category: 'OPERATIONS',
    order: 350,
    tags: ['agro', 'irrigation'],
    supportedSegments: ['AGRO'],
    requiredModules: [],
    requiredPermissions: ['dashboard.read'],
  }),
  segmentWidget({
    id: 'agro-production-forecast',
    title: 'Previsão de Produção',
    description: 'Projeção produtiva e variação esperada.',
    category: 'INTELLIGENCE',
    order: 360,
    size: 'LARGE',
    tags: ['agro', 'forecast', 'intelligence'],
    supportedSegments: ['AGRO'],
    requiredModules: [],
    requiredPermissions: ['dashboard.read'],
  }),
];

@Injectable()
export class WidgetRegistry {
  private readonly definitions = new Map<string, DashboardWidgetDefinition>();

  constructor() {
    for (const widget of [...globalWidgets, ...segmentWidgets])
      this.register(widget);
  }

  register(widget: DashboardWidgetDefinition) {
    if (this.definitions.has(widget.id))
      throw new ConflictException(
        `Dashboard widget ${widget.id} is duplicated`,
      );
    this.definitions.set(widget.id, Object.freeze({ ...widget }));
  }

  all(): readonly DashboardWidgetDefinition[] {
    return [...this.definitions.values()];
  }

  get(id: string): DashboardWidgetDefinition {
    const widget = this.definitions.get(id);
    if (!widget) throw new EntityNotFoundException('Dashboard widget', id);
    return widget;
  }
}
