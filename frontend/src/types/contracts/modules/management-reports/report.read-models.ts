/**
 * ARQUIVO GERADO — NÃO EDITE MANUALMENTE.
 * Fonte: backend/src
 * Regenerar: npm run contracts:sync
 */

/**
 * Read Models do Management Reports Engine.
 *
 * ## O snapshot tem uma forma só
 *
 * Todo relatório — executivo, financeiro, de estoque — é a mesma estrutura:
 * seções, e dentro delas métricas e tabelas. Oito formatos diferentes
 * obrigariam o cliente a conhecer oito, e o renderizador a ter oito caminhos;
 * um formato único faz o mesmo PDF servir para todos e o Reports Center exibir
 * qualquer tipo sem saber qual é.
 *
 * ## Número viaja como texto
 *
 * `value` é `string`, pela mesma razão do Financeiro e do Estoque: dinheiro é
 * `Decimal` e quantidade tem três casas. Converter para ponto flutuante em
 * algum ponto do caminho é como um centavo some. Quem exibe formata; ninguém
 * soma no cliente.
 */

/** Qualidade da fonte, no mesmo vocabulário do Analytics. */
export type ReportProvenance = 'OBSERVED' | 'DERIVED' | 'PROXY' | 'MOCK';

export interface ReportMetricReadModel {
  id: string;
  label: string;
  /** Sempre texto — inclusive números. Ver o cabeçalho. */
  value: string;
  unit?: string;
  /** De onde o número veio: `financial.summary`, `operations`, … */
  source: string;
  provenance: ReportProvenance;
  /** Explica o que o número **não** é, quando isso importa. */
  note?: string;
}

export interface ReportTableColumnReadModel {
  key: string;
  label: string;
  align?: 'left' | 'right';
}

export interface ReportTableReadModel {
  id: string;
  title: string;
  columns: readonly ReportTableColumnReadModel[];
  rows: readonly Readonly<Record<string, string>>[];
  source: string;
  provenance: ReportProvenance;
  /** Quando a tabela mostra um recorte, e não tudo. */
  note?: string;
}

export interface ReportSectionReadModel {
  id: string;
  title: string;
  description?: string;
  metrics: readonly ReportMetricReadModel[];
  tables: readonly ReportTableReadModel[];
  /**
   * Por que a seção veio vazia.
   *
   * Duas causas, e as duas precisam ser ditas: o ator não tem acesso àquele
   * domínio, ou não há fonte autoritativa para aquele número. Uma seção que
   * some sem explicação vira um relatório que parece completo e não está.
   */
  unavailableReason?: string;
}

/** Uma fonte usada, registrada no snapshot. */
export interface ReportSourceReadModel {
  domain: string;
  /** `financial.summary`, `operations.aggregate`, `analytics.health`… */
  source: string;
  provenance: ReportProvenance;
  /** `false` quando o ator não podia consultar aquele domínio. */
  included: boolean;
  reason?: string;
}

/** O snapshot: é isto que fica gravado e é isto que o PDF desenha. */
export interface ReportSnapshotReadModel {
  schemaVersion: number;
  type: string;
  name: string;
  period: { from: string; to: string; timezone: string };
  scope: {
    organizationId: string;
    businessUnitId: string | null;
    businessUnitName: string | null;
  };
  parameters: Readonly<Record<string, unknown>>;
  sections: readonly ReportSectionReadModel[];
  sources: readonly ReportSourceReadModel[];
  generatedAt: string;
}

/** Linha da listagem — o histórico. */
export interface ManagementReportSummaryReadModel {
  id: string;
  type: string;
  name: string;
  status: string;
  format: string;
  period: { from: string; to: string; timezone: string };
  businessUnit: { id: string; name: string } | null;
  generatedBy: { id: string; displayName: string };
  generatedAt: string | null;
  /** Presente quando houve renderização concluída. */
  hasFile: boolean;
  sourceHash: string | null;
  error: string | null;
  createdAt: string;
}

export interface ManagementReportReadModel extends ManagementReportSummaryReadModel {
  schemaVersion: number;
  parameters: Readonly<Record<string, unknown>>;
  sources: readonly ReportSourceReadModel[];
  correlationId: string;
  renderer: string | null;
  attempts: number;
  /** O snapshot inteiro. Ausente enquanto o relatório não ficou pronto. */
  snapshot: ReportSnapshotReadModel | null;
}

/** Situação, para quem está esperando a geração terminar. */
export interface ManagementReportStatusReadModel {
  id: string;
  status: string;
  attempts: number;
  error: string | null;
  generatedAt: string | null;
  hasFile: boolean;
}

/** O catálogo publicado — o Reports Center monta a tela com isto. */
export interface ReportCatalogReadModel {
  types: readonly {
    type: string;
    name: string;
    description: string;
    domains: readonly string[];
    parameters: readonly string[];
    formats: readonly string[];
    maxRangeDays: number;
    /** Capabilities exigidas além da de relatórios gerenciais. */
    capabilities: readonly string[];
    permissions: readonly string[];
    /**
     * `false` quando **esta sessão** não pode gerar.
     *
     * Resolvido no servidor: a interface não recalcula autorização, e o motivo
     * vem escrito para poder ser exibido.
     */
    allowed: boolean;
    blockedReason?: string;
  }[];
  formats: readonly string[];
  schemaVersion: number;
}
