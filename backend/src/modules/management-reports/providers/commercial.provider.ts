/**
 * Comercial — o funil de propostas.
 *
 * ## Por que a agregação mora aqui
 *
 * O Commercial Engine publica propostas paginadas e contagens por consulta
 * (`meta.total`), mas **não publica agregado por situação com valor**: era uma
 * lacuna declarada no manifesto de contratos. Somar página no cliente daria o
 * total da página; pedir uma consulta por situação daria seis viagens. A
 * agregação é feita no repositório de Reports, em SQL, no servidor — que é
 * onde o enunciado permite quando o domínio ainda não a publica.
 *
 * ## Proposta aprovada não é receita
 *
 * O valor aprovado sai daqui como **valor aprovado**, e a nota diz isso. A
 * receita realizada é do Financeiro e depende de o dinheiro ter entrado;
 * aprovar uma proposta cria previsão, não caixa. Chamar as duas coisas pelo
 * mesmo nome num relatório gerencial é como se fecha um mês que não fechou.
 */
import { Injectable } from '@nestjs/common';
import type {
  ReportMetricReadModel,
  ReportSectionReadModel,
} from '../report.read-models';
import { ReportRepository } from '../report.repository';
import {
  count,
  percent,
  type ReportComposition,
  type ReportProvider,
  type ReportProviderContext,
} from './report.provider';

const SOURCE = 'quotes';

@Injectable()
export class CommercialReportProvider implements ReportProvider {
  readonly domain = 'COMMERCIAL';
  readonly requires = {
    capabilities: ['quotes.read'],
    permissions: ['quotes.read'],
  };

  constructor(private readonly repository: ReportRepository) {}

  async compose({ scope }: ReportProviderContext): Promise<ReportComposition> {
    const totals = await this.repository.quoteTotals(scope);

    const decided =
      Number(totals?.approved ?? 0) + Number(totals?.rejected ?? 0);
    const approvalRate = percent(totals?.approved ?? 0n, decided);

    const metrics: ReportMetricReadModel[] = [
      {
        id: 'quotes.created',
        label: 'Propostas criadas',
        value: count(totals?.created),
        source: SOURCE,
        provenance: 'OBSERVED',
      },
      {
        id: 'quotes.sent',
        label: 'Enviadas',
        value: count(totals?.sent),
        source: SOURCE,
        provenance: 'OBSERVED',
      },
      {
        id: 'quotes.approved',
        label: 'Aprovadas',
        value: count(totals?.approved),
        source: SOURCE,
        provenance: 'OBSERVED',
      },
      {
        id: 'quotes.rejected',
        label: 'Recusadas',
        value: count(totals?.rejected),
        source: SOURCE,
        provenance: 'OBSERVED',
      },
      {
        id: 'quotes.expired',
        label: 'Expiradas',
        value: count(totals?.expired),
        source: SOURCE,
        provenance: 'OBSERVED',
      },
      {
        id: 'quotes.cancelled',
        label: 'Canceladas',
        value: count(totals?.cancelled),
        source: SOURCE,
        provenance: 'OBSERVED',
      },
    ];

    if (approvalRate !== null) {
      metrics.push({
        id: 'quotes.approval_rate',
        label: 'Taxa de aprovação',
        value: approvalRate,
        unit: '%',
        source: SOURCE,
        provenance: 'DERIVED',
        note: 'Aprovadas sobre decididas no período. Propostas ainda sem decisão não entram na conta.',
      });
    }

    const sections: ReportSectionReadModel[] = [
      {
        id: 'commercial.funnel',
        title: 'Funil de propostas',
        description:
          'Cada situação contada pela data do próprio evento — enviada, decidida, expirada.',
        metrics,
        tables: [],
      },
      {
        id: 'commercial.value',
        title: 'Valor',
        description: 'Valor das propostas, não dinheiro recebido.',
        metrics: [
          {
            id: 'quotes.approved_value',
            label: 'Valor aprovado no período',
            value: this.money(totals?.approved_total),
            source: SOURCE,
            provenance: 'OBSERVED',
            note: 'Soma das propostas aprovadas. Não é receita realizada — o Financeiro é quem diz o que entrou.',
          },
          {
            id: 'quotes.sent_value',
            label: 'Valor enviado no período',
            value: this.money(totals?.sent_total),
            source: SOURCE,
            provenance: 'OBSERVED',
          },
        ],
        tables: [],
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

  /** `Decimal` vira texto com duas casas — nunca ponto flutuante. */
  private money(value: { toFixed(digits: number): string } | null | undefined) {
    return value ? value.toFixed(2) : '0.00';
  }
}
