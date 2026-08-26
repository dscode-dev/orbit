import { Injectable } from '@nestjs/common';
import type {
  AnalyticsHealthReadModel,
  EnvironmentalImpactReadModel,
  HealthDimension,
  KpiReadModel,
} from '../analytics.read-models';
import { clamp, round, statusFor } from '../analytics.math';

@Injectable()
export class HealthEngine {
  execute(
    kpis: KpiReadModel,
    environment: EnvironmentalImpactReadModel,
  ): AnalyticsHealthReadModel {
    const value = (id: string, fallback = 100) =>
      kpis.indicators.find((item) => item.id === id)?.value ?? fallback;
    const dimensions: HealthDimension[] = [
      this.dimension(
        'operations',
        'OPERATIONS',
        'Operações',
        value('operations.sla_compliance') * 0.55 +
          value('operations.completion_rate') * 0.45,
        0.3,
        ['SLA', 'conclusão'],
      ),
      this.dimension('pmoc', 'PMOC', 'PMOC', value('pmoc.compliance'), 0.2, [
        'conformidade documental',
      ]),
      this.dimension(
        'equipment',
        'EQUIPMENT',
        'Equipamentos',
        value('equipment.availability') -
          environment.indicators.equipmentStressIndex * 0.12,
        0.2,
        ['disponibilidade', 'estresse ambiental'],
      ),
      this.dimension(
        'technicians',
        'TECHNICIANS',
        'Técnicos',
        value('technicians.assignment_coverage'),
        0.15,
        ['cobertura de atribuição'],
      ),
      this.dimension(
        'contracts',
        'CONTRACTS',
        'Contratos',
        value('contracts.active_proxy') > 0 ? 85 : 50,
        0.15,
        ['carteira ativa (proxy)'],
      ),
    ];
    const score = round(
      dimensions.reduce(
        (sum, dimension) => sum + dimension.score * dimension.weight,
        0,
      ),
    );
    return {
      generatedAt: new Date().toISOString(),
      score,
      status: statusFor(score, 75, 55),
      availability: [],
      dimensions,
    };
  }

  private dimension(
    id: string,
    domain: HealthDimension['domain'],
    label: string,
    score: number,
    weight: number,
    drivers: string[],
  ): HealthDimension {
    const normalized = round(clamp(score));
    return {
      id,
      domain,
      label,
      score: normalized,
      weight,
      status: statusFor(normalized, 75, 55),
      drivers,
    };
  }
}
