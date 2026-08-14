/**
 * A composição de um relatório.
 *
 * ```
 * tipo + parâmetros ──▶ providers ──▶ seções ──▶ snapshot ──▶ hash
 * ```
 *
 * ## O hash é da fonte, não do arquivo
 *
 * `sourceHash` é o SHA-256 do snapshot **sem o instante de geração**: mesmo
 * recorte, mesmos dados, mesmo hash — e o hash muda quando os números mudam.
 * É o que permite responder "este relatório de março é o mesmo de antes?" sem
 * comparar PDFs, e é o que prova que a segunda renderização do mesmo snapshot
 * desenhou os mesmos números.
 *
 * Incluir `generatedAt` faria todo relatório ter hash novo, e o hash deixaria
 * de dizer qualquer coisa sobre os dados.
 *
 * ## A Visão Executiva compõe o que o ator pode ver
 *
 * Seis domínios, e cada um entra **se** a sessão puder consultá-lo. Quem não
 * tem Financeiro recebe o relatório com a seção financeira vazia e o motivo
 * escrito — recusar o relatório inteiro por causa de uma seção transformaria
 * acesso parcial em nenhum acesso, e esconder a seção faria um relatório que
 * parece completo.
 *
 * O que **não** é composto por decisão: o *health score* do Analytics. Ele é o
 * indicador consolidado da plataforma, mas depende do motor ambiental, cuja
 * fonte é declaradamente `MOCK`. Um relatório gerencial impresso e levado a uma
 * reunião não é lugar para um número derivado de dado simulado — a ausência
 * fica registrada em `sources`.
 */
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { findReportType, REPORT_SCHEMA_VERSION } from './report.catalog';
import type {
  ReportSectionReadModel,
  ReportSnapshotReadModel,
  ReportSourceReadModel,
} from './report.read-models';
import type { ReportScope } from './report.repository';
import { CommercialReportProvider } from './providers/commercial.provider';
import { DocumentsReportProvider } from './providers/documents.provider';
import { FinancialReportProvider } from './providers/financial.provider';
import { InventoryReportProvider } from './providers/inventory.provider';
import { OperationsReportProvider } from './providers/operations.provider';
import {
  allows,
  unavailableSection,
  type ReportAccess,
  type ReportComposition,
  type ReportProvider,
  type ReportProviderContext,
} from './providers/report.provider';
import { SchedulingReportProvider } from './providers/scheduling.provider';
import { WorkforceReportProvider } from './providers/workforce.provider';

export interface ComposeInput {
  readonly type: string;
  readonly scope: ReportScope;
  readonly access: ReportAccess;
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly businessUnitName: string | null;
}

export interface ComposedReport {
  readonly snapshot: ReportSnapshotReadModel;
  readonly sourceHash: string;
}

@Injectable()
export class ReportComposer {
  constructor(
    private readonly operations: OperationsReportProvider,
    private readonly scheduling: SchedulingReportProvider,
    private readonly financial: FinancialReportProvider,
    private readonly commercial: CommercialReportProvider,
    private readonly inventory: InventoryReportProvider,
    private readonly documents: DocumentsReportProvider,
    private readonly workforce: WorkforceReportProvider,
  ) {}

  async compose(input: ComposeInput): Promise<ComposedReport> {
    const definition = findReportType(input.type);
    if (!definition) {
      throw new Error(`Unknown report type: ${input.type}`);
    }

    const context: ReportProviderContext = {
      scope: input.scope,
      access: input.access,
    };

    const composition = await this.byType(input.type, context);

    const snapshot: ReportSnapshotReadModel = {
      schemaVersion: REPORT_SCHEMA_VERSION,
      type: definition.type,
      name: definition.name,
      period: {
        from: input.scope.from.toISOString(),
        to: input.scope.to.toISOString(),
        timezone: input.scope.timezone,
      },
      scope: {
        organizationId: input.scope.organizationId,
        businessUnitId: input.scope.businessUnitId,
        businessUnitName: input.businessUnitName,
      },
      parameters: input.parameters,
      sections: composition.sections,
      sources: composition.sources,
      /** Preenchido aqui, e **fora** do hash — ver o cabeçalho. */
      generatedAt: new Date().toISOString(),
    };

    return { snapshot, sourceHash: ReportComposer.hash(snapshot) };
  }

  /**
   * SHA-256 do snapshot, sem o instante de geração.
   *
   * A serialização é **canônica**: as chaves são ordenadas antes de virar
   * texto. `JSON.stringify` preserva a ordem de inserção, e dois snapshots com
   * os mesmos dados montados em ordem diferente dariam hashes diferentes — o
   * que faria o hash falar sobre o código, não sobre os números.
   */
  static hash(snapshot: ReportSnapshotReadModel): string {
    const withoutTimestamp: Record<string, unknown> = { ...snapshot };
    delete withoutTimestamp.generatedAt;
    return createHash('sha256')
      .update(canonical(withoutTimestamp))
      .digest('hex');
  }

  private byType(
    type: string,
    context: ReportProviderContext,
  ): Promise<ReportComposition> {
    switch (type) {
      case 'EXECUTIVE_OVERVIEW':
        return this.executive(context);
      case 'OPERATIONS_PERFORMANCE':
        return this.merge(context, [this.operations, this.workforce]);
      case 'SCHEDULING_SLA':
        return this.merge(context, [this.scheduling, this.operations]);
      case 'FINANCIAL_PERFORMANCE':
        return this.merge(context, [this.financial]);
      case 'COMMERCIAL_PERFORMANCE':
        return this.merge(context, [this.commercial]);
      case 'INVENTORY_CONSUMPTION':
        return this.merge(context, [this.inventory]);
      case 'PMOC_COMPLIANCE':
        return this.documents.composePmoc(context);
      case 'DOCUMENTS_EXECUTIONS':
        return this.merge(context, [this.documents]);
      default:
        throw new Error(`Report type without provider: ${type}`);
    }
  }

  /**
   * Compõe vários providers, e o que não é permitido vira ausência declarada.
   *
   * Usado só pela Visão Executiva: nos relatórios de um domínio só, a falta de
   * acesso é recusa na porta (403), não seção vazia.
   */
  private async executive(
    context: ReportProviderContext,
  ): Promise<ReportComposition> {
    const parts: { title: string; provider: ReportProvider }[] = [
      { title: 'Operação', provider: this.operations },
      { title: 'Agenda', provider: this.scheduling },
      { title: 'Comercial', provider: this.commercial },
      { title: 'Financeiro', provider: this.financial },
      { title: 'Estoque', provider: this.inventory },
      { title: 'Documentos', provider: this.documents },
    ];

    const sections: ReportSectionReadModel[] = [];
    const sources: ReportSourceReadModel[] = [
      {
        domain: 'ANALYTICS',
        source: 'analytics.health',
        provenance: 'MOCK',
        included: false,
        reason:
          'O índice de saúde consolidado depende do motor ambiental, cuja fonte é simulada. Um relatório gerencial não publica número derivado de dado simulado.',
      },
    ];

    for (const part of parts) {
      if (!allows(context.access, part.provider.requires)) {
        sections.push(
          unavailableSection(
            `executive.${part.provider.domain.toLowerCase()}`,
            part.title,
            `Seu acesso não inclui ${part.title}. O relatório foi gerado sem esta seção — os demais números não foram afetados.`,
          ),
        );
        sources.push({
          domain: part.provider.domain,
          source: 'n/a',
          provenance: 'OBSERVED',
          included: false,
          reason: 'Ator sem acesso ao domínio.',
        });
        continue;
      }

      const composed = await part.provider.compose(context);
      sections.push(...composed.sections);
      sources.push(...composed.sources);
    }

    return { sections, sources };
  }

  private async merge(
    context: ReportProviderContext,
    providers: readonly ReportProvider[],
  ): Promise<ReportComposition> {
    const sections: ReportSectionReadModel[] = [];
    const sources: ReportSourceReadModel[] = [];

    for (const provider of providers) {
      const composed = await provider.compose(context);
      sections.push(...composed.sections);
      sources.push(...composed.sources);
    }

    return { sections, sources };
  }
}

/**
 * Serialização canônica: chaves ordenadas, em qualquer profundidade.
 *
 * Sem isso o hash mudaria porque alguém trocou a ordem de dois campos no
 * código, e um relatório idêntico pareceria diferente.
 */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object')
    return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonical(item)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
    .join(',')}}`;
}
