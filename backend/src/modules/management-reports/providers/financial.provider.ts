/**
 * Financeiro — reaproveitado inteiro, não recalculado.
 *
 * Todo número aqui vem de `FinancialService`, que é a autoridade: ele conhece
 * a moeda padrão da organização, ignora lançamento cancelado, sabe o que é
 * vencido e devolve `Decimal` como texto. Refazer a soma neste provider
 * criaria um segundo total financeiro, e o dia em que os dois discordarem é o
 * dia em que ninguém confia em nenhum.
 *
 * ## Realizado e previsto nunca viram um número só
 *
 * `netConfirmed` é caixa: entrou menos saiu. `netPending` é expectativa. Não
 * existe campo que os some — somar transformaria uma previsão em dinheiro
 * disponível, que é o erro que quebra fluxo de caixa de empresa pequena.
 */
import { Injectable } from '@nestjs/common';
import { FinancialService } from '../../financial/financial.service';
import type {
  ReportSectionReadModel,
  ReportTableReadModel,
} from '../report.read-models';
import {
  type ReportComposition,
  type ReportProvider,
  type ReportProviderContext,
} from './report.provider';

const SOURCE = 'financial.analytics';

@Injectable()
export class FinancialReportProvider implements ReportProvider {
  readonly domain = 'FINANCIAL';
  readonly requires = {
    capabilities: ['financial.read'],
    permissions: ['financial.read'],
  };

  constructor(private readonly financial: FinancialService) {}

  async compose({ scope }: ReportProviderContext): Promise<ReportComposition> {
    /**
     * O Financeiro recorta por **competência**, em data, não em instante.
     * É a régua dele, e é a que faz o resumo do relatório bater com o que a
     * tela do Financeiro mostra para o mesmo mês.
     */
    const query = {
      from: scope.from,
      to: scope.to,
      businessUnitId: scope.businessUnitId ?? undefined,
    };

    const [summary, categories, timeline] = await Promise.all([
      this.financial.summary(scope.organizationId, query),
      this.financial.byCategory(scope.organizationId, query),
      this.financial.timeline(scope.organizationId, query),
    ]);

    const sections: ReportSectionReadModel[] = [
      {
        id: 'financial.realized',
        title: 'Realizado',
        description: `Dinheiro que de fato entrou e saiu no período, em ${summary.currency}.`,
        metrics: [
          {
            id: 'financial.income_confirmed',
            label: 'Receita realizada',
            value: summary.income.confirmed,
            unit: summary.currency,
            source: SOURCE,
            provenance: 'OBSERVED',
          },
          {
            id: 'financial.expense_confirmed',
            label: 'Despesa realizada',
            value: summary.expense.confirmed,
            unit: summary.currency,
            source: SOURCE,
            provenance: 'OBSERVED',
          },
          {
            id: 'financial.net_confirmed',
            label: 'Saldo realizado',
            value: summary.netConfirmed,
            unit: summary.currency,
            source: SOURCE,
            provenance: 'DERIVED',
            note: 'Receita realizada menos despesa realizada. Não inclui previsto.',
          },
        ],
        tables: [],
      },
      {
        id: 'financial.expected',
        title: 'Previsto',
        description:
          'O que ainda pode não acontecer. Nunca somado ao realizado.',
        metrics: [
          {
            id: 'financial.income_pending',
            label: 'Receita prevista',
            value: summary.income.pending,
            unit: summary.currency,
            source: SOURCE,
            provenance: 'OBSERVED',
          },
          {
            id: 'financial.expense_pending',
            label: 'Despesa prevista',
            value: summary.expense.pending,
            unit: summary.currency,
            source: SOURCE,
            provenance: 'OBSERVED',
          },
          {
            id: 'financial.net_pending',
            label: 'Saldo previsto',
            value: summary.netPending,
            unit: summary.currency,
            source: SOURCE,
            provenance: 'DERIVED',
          },
          {
            id: 'financial.overdue',
            label: 'Vencido a receber',
            value: summary.overdue.pending,
            unit: summary.currency,
            source: SOURCE,
            provenance: 'OBSERVED',
            note: 'Previsto com vencimento anterior a hoje.',
          },
        ],
        tables: [],
      },
      {
        id: 'financial.breakdown',
        title: 'Por categoria e por mês',
        metrics: [],
        tables: [
          this.categoryTable(categories, summary.currency),
          this.timelineTable(timeline, summary.currency),
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

  private categoryTable(
    rows: Awaited<ReturnType<FinancialService['byCategory']>>,
    currency: string,
  ): ReportTableReadModel {
    return {
      id: 'financial.by_category',
      title: `Por categoria (${currency})`,
      columns: [
        { key: 'category', label: 'Categoria' },
        { key: 'type', label: 'Sentido' },
        { key: 'confirmed', label: 'Realizado', align: 'right' },
        { key: 'pending', label: 'Previsto', align: 'right' },
      ],
      rows: rows.map((row) => ({
        category: row.categoryName,
        type: row.type,
        confirmed: row.confirmed,
        pending: row.pending,
      })),
      source: SOURCE,
      provenance: 'OBSERVED',
    };
  }

  private timelineTable(
    rows: Awaited<ReturnType<FinancialService['timeline']>>,
    currency: string,
  ): ReportTableReadModel {
    return {
      id: 'financial.timeline',
      title: `Evolução mensal (${currency})`,
      columns: [
        { key: 'month', label: 'Mês' },
        { key: 'incomeConfirmed', label: 'Receita realizada', align: 'right' },
        { key: 'expenseConfirmed', label: 'Despesa realizada', align: 'right' },
        { key: 'incomePending', label: 'Receita prevista', align: 'right' },
      ],
      rows: rows.map((row) => ({
        month: row.month,
        incomeConfirmed: row.incomeConfirmed,
        expenseConfirmed: row.expenseConfirmed,
        incomePending: row.incomePending,
      })),
      source: SOURCE,
      provenance: 'OBSERVED',
    };
  }
}
