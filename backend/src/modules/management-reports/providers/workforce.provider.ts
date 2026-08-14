/**
 * Equipe — carga, não avaliação.
 *
 * Duas colunas: quantas ordens a pessoa recebeu no período e quantas foram
 * concluídas. Nada mais.
 *
 * **Não há nota, ranking, média, produtividade nem score.** Não é omissão: um
 * número por pessoa num relatório gerencial é lido como desempenho, e este não
 * mede desempenho — uma instalação de oito horas e uma visita de vinte minutos
 * contam igual, e quem pega as urgências termina menos. Publicar a razão entre
 * as duas colunas transformaria uma contagem em um julgamento que os dados não
 * sustentam.
 *
 * A ordenação é por volume, e a tabela diz que é por volume.
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

const SOURCE = 'operations+operation_users';

@Injectable()
export class WorkforceReportProvider implements ReportProvider {
  readonly domain = 'WORKFORCE';
  readonly requires = {
    capabilities: ['operations.read'],
    permissions: ['operations.read'],
  };

  constructor(private readonly repository: ReportRepository) {}

  async compose({ scope }: ReportProviderContext): Promise<ReportComposition> {
    const rows = await this.repository.workforceTotals(scope);

    const sections: ReportSectionReadModel[] = [
      {
        id: 'workforce.load',
        title: 'Carga da equipe',
        description:
          'Ordens atribuídas e concluídas por técnico no período. É contagem de volume — não é avaliação de desempenho.',
        metrics: [],
        tables: [
          {
            id: 'workforce.by_technician',
            title: 'Por técnico',
            columns: [
              { key: 'technician', label: 'Técnico' },
              { key: 'assigned', label: 'Atribuídas', align: 'right' },
              { key: 'completed', label: 'Concluídas', align: 'right' },
            ],
            rows: rows.map((row) => ({
              technician: row.technician,
              assigned: count(row.assigned),
              completed: count(row.completed),
            })),
            source: SOURCE,
            provenance: 'OBSERVED',
            note: 'Vinte primeiros por volume atribuído. Ordens de duração muito diferente contam igual.',
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
