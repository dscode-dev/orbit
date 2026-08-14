/**
 * Mapeadores do Management Reports Engine.
 *
 * Nenhum modelo Prisma sai daqui. O `data` do snapshot é `Json` no banco e
 * volta tipado como `ReportSnapshotReadModel` — a conversão acontece uma vez,
 * neste arquivo, em vez de cada consumidor tratar `Prisma.JsonValue`.
 */
import { Injectable } from '@nestjs/common';
import { findReportType } from './report.catalog';
import type {
  ManagementReportReadModel,
  ManagementReportStatusReadModel,
  ManagementReportSummaryReadModel,
  ReportSnapshotReadModel,
  ReportSourceReadModel,
} from './report.read-models';
import type { ReportRecord } from './report.repository';

@Injectable()
export class ReportMapper {
  summary(
    source: Omit<ReportRecord, 'data'> & { data?: unknown },
  ): ManagementReportSummaryReadModel {
    return {
      id: source.id,
      type: source.type,
      /** `null` quando o tipo saiu do catálogo — o histórico continua legível. */
      name: findReportType(source.type)?.name ?? source.type,
      status: source.status,
      format: source.format,
      period: {
        from: source.periodFrom.toISOString(),
        to: source.periodTo.toISOString(),
        timezone: source.timezone,
      },
      businessUnit: source.businessUnit
        ? {
            id: source.businessUnit.id,
            name:
              source.businessUnit.tradeName ?? source.businessUnit.legalName,
          }
        : null,
      generatedBy: {
        id: source.generatedBy.id,
        displayName: source.generatedBy.displayName,
      },
      generatedAt: source.generatedAt?.toISOString() ?? null,
      hasFile: Boolean(source.fileId),
      sourceHash: source.sourceHash,
      error: source.error,
      createdAt: source.createdAt.toISOString(),
    };
  }

  details(source: ReportRecord): ManagementReportReadModel {
    return {
      ...this.summary(source),
      schemaVersion: source.schemaVersion,
      parameters: (source.parameters ?? {}) as Record<string, unknown>,
      sources: (source.provenance ?? []) as unknown as ReportSourceReadModel[],
      correlationId: source.correlationId,
      renderer: source.renderer,
      attempts: source.attempts,
      snapshot: this.snapshot(source.data),
    };
  }

  status(source: ReportRecord): ManagementReportStatusReadModel {
    return {
      id: source.id,
      status: source.status,
      attempts: source.attempts,
      error: source.error,
      generatedAt: source.generatedAt?.toISOString() ?? null,
      hasFile: Boolean(source.fileId),
    };
  }

  /** O snapshot como foi gravado. **Nunca recomposto na leitura.** */
  snapshot(data: unknown): ReportSnapshotReadModel | null {
    if (!data || typeof data !== 'object') return null;
    return data as unknown as ReportSnapshotReadModel;
  }
}
