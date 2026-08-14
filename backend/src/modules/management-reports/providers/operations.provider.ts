/**
 * Operações — volume, situação e cumprimento de prazo.
 *
 * ## O cumprimento é derivado, e a régua é a mesma do Analytics
 *
 * "No prazo" é `completed_at <= scheduled_end`, exatamente o que o
 * `KpiEngine` chama de `operations.sla_compliance`. Não há acordo de nível de
 * serviço cadastrado no Orbit — não existe entidade de SLA, com prazo por
 * contrato ou por tipo de operação —, então o que se mede é o **prazo previsto
 * na própria ordem**. A métrica sai marcada como `DERIVED` e a nota diz de
 * onde ela vem: chamar isso de "SLA" sem dizer o que é seria vender um
 * indicador contratual que o domínio não tem.
 *
 * Operações **sem** prazo previsto não entram no denominador. Contá-las como
 * cumpridas inflaria o número; contá-las como descumpridas puniria quem nunca
 * prometeu data.
 */
import { Injectable } from '@nestjs/common';
import { ReportRepository } from '../report.repository';
import type {
  ReportMetricReadModel,
  ReportSectionReadModel,
} from '../report.read-models';
import {
  count,
  percent,
  type ReportComposition,
  type ReportProvider,
  type ReportProviderContext,
} from './report.provider';

const SOURCE = 'operations';

@Injectable()
export class OperationsReportProvider implements ReportProvider {
  readonly domain = 'OPERATIONS';
  readonly requires = {
    capabilities: ['operations.read'],
    permissions: ['operations.read'],
  };

  constructor(private readonly repository: ReportRepository) {}

  async compose({ scope }: ReportProviderContext): Promise<ReportComposition> {
    const [totals, byKind, byStatus, byCustomer, monthly] = await Promise.all([
      this.repository.operationTotals(scope),
      this.repository.operationsBy(scope, 'kind'),
      this.repository.operationsBy(scope, 'status'),
      this.repository.operationsByCustomer(scope),
      this.repository.operationsMonthly(scope),
    ]);

    const compliance = percent(
      totals?.on_time ?? 0n,
      totals?.with_deadline ?? 0n,
    );

    const metrics: ReportMetricReadModel[] = [
      {
        id: 'operations.opened',
        label: 'Abertas no período',
        value: count(totals?.opened),
        source: SOURCE,
        provenance: 'OBSERVED',
      },
      {
        id: 'operations.completed',
        label: 'Concluídas no período',
        value: count(totals?.completed),
        source: SOURCE,
        provenance: 'OBSERVED',
        note: 'Contadas pela data de conclusão — podem ter sido abertas antes do período.',
      },
      {
        id: 'operations.cancelled',
        label: 'Canceladas',
        value: count(totals?.cancelled),
        source: SOURCE,
        provenance: 'OBSERVED',
        note: 'Abertas no período e hoje canceladas.',
      },
      {
        id: 'operations.with_deadline',
        label: 'Concluídas com prazo previsto',
        value: count(totals?.with_deadline),
        source: SOURCE,
        provenance: 'OBSERVED',
      },
      {
        id: 'operations.on_time',
        label: 'Concluídas dentro do prazo',
        value: count(totals?.on_time),
        source: SOURCE,
        provenance: 'OBSERVED',
      },
      {
        id: 'operations.late',
        label: 'Concluídas fora do prazo',
        value: count(totals?.late),
        source: SOURCE,
        provenance: 'OBSERVED',
      },
    ];

    if (compliance !== null) {
      metrics.push({
        id: 'operations.deadline_compliance',
        label: 'Cumprimento do prazo previsto',
        value: compliance,
        unit: '%',
        source: SOURCE,
        provenance: 'DERIVED',
        note: 'Conclusões dentro do prazo previsto na própria ordem. O Orbit não tem contrato de SLA cadastrado; operações sem prazo não entram na conta.',
      });
    }

    const sections: ReportSectionReadModel[] = [
      {
        id: 'operations.volume',
        title: 'Volume e cumprimento',
        description: 'Ordens de serviço abertas, concluídas e no prazo.',
        metrics,
        tables: [],
      },
      {
        id: 'operations.distribution',
        title: 'Distribuição',
        description: 'Ordens abertas no período, por tipo e por situação.',
        metrics: [],
        tables: [
          {
            id: 'operations.by_kind',
            title: 'Por tipo',
            columns: [
              { key: 'label', label: 'Tipo' },
              { key: 'total', label: 'Ordens', align: 'right' },
            ],
            rows: byKind.map((row) => ({
              label: row.label,
              total: count(row.total),
            })),
            source: SOURCE,
            provenance: 'OBSERVED',
          },
          {
            id: 'operations.by_status',
            title: 'Por situação',
            columns: [
              { key: 'label', label: 'Situação' },
              { key: 'total', label: 'Ordens', align: 'right' },
            ],
            rows: byStatus.map((row) => ({
              label: row.label,
              total: count(row.total),
            })),
            source: SOURCE,
            provenance: 'OBSERVED',
          },
        ],
      },
      {
        id: 'operations.evolution',
        title: 'Evolução mensal',
        metrics: [],
        tables: [
          {
            id: 'operations.monthly',
            title: 'Abertas e concluídas por mês',
            columns: [
              { key: 'month', label: 'Mês' },
              { key: 'opened', label: 'Abertas', align: 'right' },
              { key: 'completed', label: 'Concluídas', align: 'right' },
            ],
            rows: monthly.map((row) => ({
              month: row.month,
              opened: count(row.opened),
              completed: count(row.completed),
            })),
            source: SOURCE,
            provenance: 'OBSERVED',
            note: `Meses no fuso ${scope.timezone}.`,
          },
        ],
      },
      {
        id: 'operations.customers',
        title: 'Clientes com mais ordens',
        metrics: [],
        tables: [
          {
            id: 'operations.by_customer',
            title: 'Dez maiores no período',
            columns: [
              { key: 'customer', label: 'Cliente' },
              { key: 'total', label: 'Ordens', align: 'right' },
              { key: 'completed', label: 'Concluídas', align: 'right' },
            ],
            rows: byCustomer.map((row) => ({
              customer: row.customer ?? 'Sem cliente',
              total: count(row.total),
              completed: count(row.completed),
            })),
            source: SOURCE,
            provenance: 'OBSERVED',
            note: 'Recorte dos dez primeiros por volume — não é a lista completa.',
          },
        ],
      },
    ];

    return {
      sections,
      sources: [
        {
          domain: this.domain,
          source: SOURCE,
          provenance: 'OBSERVED',
          included: true,
        },
      ],
    };
  }
}
