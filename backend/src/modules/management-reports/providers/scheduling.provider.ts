/**
 * Agenda — o que estava marcado no período.
 *
 * Compromissos por tipo e por situação. O cumprimento de prazo **não** está
 * aqui: ele é da operação, e sai do provider de Operações. Publicar as duas
 * versões faria duas respostas para "cumprimos?", e a da agenda seria a pior —
 * um evento confirmado diz que alguém marcou, não que a visita aconteceu.
 */
import { Injectable } from '@nestjs/common';
import type { ReportSectionReadModel } from '../report.read-models';
import { ReportRepository } from '../report.repository';
import {
  count,
  type ReportComposition,
  type ReportProvider,
  type ReportProviderContext,
} from './report.provider';

const SOURCE = 'scheduling';

@Injectable()
export class SchedulingReportProvider implements ReportProvider {
  readonly domain = 'SCHEDULING';
  readonly requires = {
    capabilities: ['scheduling.read'],
    permissions: ['scheduling.read'],
  };

  constructor(private readonly repository: ReportRepository) {}

  async compose({ scope }: ReportProviderContext): Promise<ReportComposition> {
    const rows = await this.repository.schedulingTotals(scope);

    const total = rows.reduce((sum, row) => sum + Number(row.total), 0);
    const byStatus = new Map<string, number>();
    for (const row of rows) {
      byStatus.set(
        row.status,
        (byStatus.get(row.status) ?? 0) + Number(row.total),
      );
    }

    const sections: ReportSectionReadModel[] = [
      {
        id: 'scheduling.volume',
        title: 'Compromissos do período',
        description:
          'Eventos que começam dentro do período, no fuso do recorte.',
        metrics: [
          {
            id: 'scheduling.total',
            label: 'Compromissos',
            value: count(total),
            source: SOURCE,
            provenance: 'OBSERVED',
          },
          {
            id: 'scheduling.confirmed',
            label: 'Confirmados',
            value: count(byStatus.get('CONFIRMED') ?? 0),
            source: SOURCE,
            provenance: 'OBSERVED',
          },
          {
            id: 'scheduling.cancelled',
            label: 'Cancelados',
            value: count(byStatus.get('CANCELLED') ?? 0),
            source: SOURCE,
            provenance: 'OBSERVED',
          },
        ],
        tables: [
          {
            id: 'scheduling.by_type',
            title: 'Por tipo e situação',
            columns: [
              { key: 'type', label: 'Tipo' },
              { key: 'status', label: 'Situação' },
              { key: 'total', label: 'Compromissos', align: 'right' },
            ],
            rows: rows.map((row) => ({
              type: row.type,
              status: row.status,
              total: count(row.total),
            })),
            source: SOURCE,
            provenance: 'OBSERVED',
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
