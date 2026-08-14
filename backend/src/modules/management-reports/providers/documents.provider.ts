/**
 * Documentos e execuções — e o recorte de PMOC.
 *
 * ## Não existe entidade PMOC
 *
 * O Orbit não tem plano de manutenção com periodicidade, vencimento e
 * cobertura de equipamento. O que existe é o **artefato do tipo PMOC**: um
 * template oficial (`ORBIT_PMOC`) e as execuções dele. Este provider conta
 * essas execuções e quantas viraram documento emitido.
 *
 * Por isso **não há "PMOC vencido"** neste relatório. Vencimento exige data de
 * validade por plano, e nenhuma tabela a guarda; derivá-la de "a última
 * execução foi há mais de um ano" seria inventar a periodicidade do cliente. A
 * ausência é declarada na seção, não preenchida com aproximação.
 */
import { Injectable } from '@nestjs/common';
import type {
  ReportSectionReadModel,
  ReportTableReadModel,
} from '../report.read-models';
import { ReportRepository } from '../report.repository';
import {
  count,
  percent,
  type ReportComposition,
  type ReportProvider,
  type ReportProviderContext,
} from './report.provider';

const SOURCE = 'artifact_executions';
const MANIFEST_SOURCE = 'artifact_manifests';

@Injectable()
export class DocumentsReportProvider implements ReportProvider {
  readonly domain = 'DOCUMENTS';
  readonly requires = {
    capabilities: ['artifact_executions.read'],
    permissions: ['artifact_executions.read'],
  };

  constructor(private readonly repository: ReportRepository) {}

  compose(context: ReportProviderContext): Promise<ReportComposition> {
    return this.build(context, false);
  }

  /** O mesmo conjunto, recortado no tipo PMOC. */
  composePmoc(context: ReportProviderContext): Promise<ReportComposition> {
    return this.build(context, true);
  }

  private async build(
    { scope }: ReportProviderContext,
    pmocOnly: boolean,
  ): Promise<ReportComposition> {
    const [rows, manifests] = await Promise.all([
      this.repository.executionTotals(scope, pmocOnly),
      this.repository.manifestTotals(scope, pmocOnly),
    ]);

    const total = rows.reduce((sum, row) => sum + Number(row.total), 0);
    const completed = rows
      .filter((row) => row.status === 'COMPLETED' || row.status === 'APPROVED')
      .reduce((sum, row) => sum + Number(row.total), 0);
    const completionRate = percent(completed, total);

    const byStatus = new Map<string, number>();
    for (const row of rows) {
      byStatus.set(
        row.status,
        (byStatus.get(row.status) ?? 0) + Number(row.total),
      );
    }

    const statusTable: ReportTableReadModel = {
      id: 'documents.by_status',
      title: 'Execuções por situação',
      columns: [
        { key: 'status', label: 'Situação' },
        { key: 'total', label: 'Execuções', align: 'right' },
      ],
      rows: [...byStatus.entries()].map(([status, value]) => ({
        status,
        total: count(value),
      })),
      source: SOURCE,
      provenance: 'OBSERVED',
    };

    const typeTable: ReportTableReadModel = {
      id: 'documents.by_type',
      title: 'Execuções por tipo de documento',
      columns: [
        { key: 'artifactType', label: 'Tipo' },
        { key: 'status', label: 'Situação' },
        { key: 'total', label: 'Execuções', align: 'right' },
      ],
      rows: rows.map((row) => ({
        artifactType: row.artifact_type,
        status: row.status,
        total: count(row.total),
      })),
      source: SOURCE,
      provenance: 'OBSERVED',
    };

    const sections: ReportSectionReadModel[] = [
      {
        id: pmocOnly ? 'pmoc.executions' : 'documents.executions',
        title: pmocOnly ? 'Execuções de PMOC' : 'Execuções de artefato',
        description: 'Iniciadas no período, pela data de criação.',
        metrics: [
          {
            id: 'documents.total',
            label: 'Execuções no período',
            value: count(total),
            source: SOURCE,
            provenance: 'OBSERVED',
          },
          {
            id: 'documents.completed',
            label: 'Concluídas ou aprovadas',
            value: count(completed),
            source: SOURCE,
            provenance: 'OBSERVED',
          },
          ...(completionRate === null
            ? []
            : [
                {
                  id: 'documents.completion_rate',
                  label: 'Taxa de conclusão',
                  value: completionRate,
                  unit: '%',
                  source: SOURCE,
                  provenance: 'DERIVED' as const,
                },
              ]),
          {
            id: 'documents.issued',
            label: 'Revisões emitidas',
            value: count(manifests?.issued),
            source: MANIFEST_SOURCE,
            provenance: 'OBSERVED',
            note: 'Documento oficial emitido — não conta rascunho nem revisão aberta.',
          },
          {
            id: 'documents.revoked',
            label: 'Revisões revogadas',
            value: count(manifests?.revoked),
            source: MANIFEST_SOURCE,
            provenance: 'OBSERVED',
          },
        ],
        tables: pmocOnly ? [statusTable] : [statusTable, typeTable],
        ...(pmocOnly
          ? {
              unavailableReason: undefined,
            }
          : {}),
      },
    ];

    if (pmocOnly) {
      sections.push({
        id: 'pmoc.overdue',
        title: 'Vencimentos',
        metrics: [],
        tables: [],
        unavailableReason:
          'O Orbit não cadastra plano de PMOC com periodicidade e validade, então não há fonte autoritativa para "vencido". O que existe é a execução do artefato do tipo PMOC, contada acima.',
      });
    }

    return {
      sections,
      sources: [
        {
          domain: this.domain,
          source: SOURCE,
          provenance: 'OBSERVED',
          included: true,
        },
        {
          domain: this.domain,
          source: MANIFEST_SOURCE,
          provenance: 'OBSERVED',
          included: true,
        },
      ],
    };
  }
}
