/**
 * O orçamento premium.
 *
 * É o único documento da série que pede uma decisão, então o que se testa é o
 * que atrapalharia essa decisão: o total difícil de achar, a tabela de
 * materiais sem preço, o desconto escondido numa linha de item, e a proposta
 * sem onde assinar.
 */
import { inflateSync } from 'node:zlib';
import { QuoteDocumentService } from '../../../quote-document.service';
import type { QuoteDocumentInput } from './quote.document';

function textoDoPdf(pdf: Buffer): string {
  const bruto = pdf.toString('latin1');
  const partes: string[] = [];
  const padrao = /stream\r?\n/g;
  let achado: RegExpExecArray | null;

  while ((achado = padrao.exec(bruto)) !== null) {
    const inicio = achado.index + achado[0].length;
    const fim = bruto.indexOf('endstream', inicio);
    if (fim < 0) continue;
    let conteudo: string;
    try {
      conteudo = inflateSync(
        Buffer.from(bruto.slice(inicio, fim), 'latin1'),
      ).toString('latin1');
    } catch {
      continue;
    }
    for (const hex of conteudo.match(/<[0-9a-fA-F]+>/g) ?? []) {
      partes.push(Buffer.from(hex.slice(1, -1), 'hex').toString('latin1'));
    }
  }
  /* `Intl` separa o símbolo da moeda com espaço inquebrável: certo para
     impressão, ruim para comparar em teste. */
  return partes.join('').replace(/\u00a0/g, ' ');
}

function contarPaginas(pdf: Buffer): number {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

function entrada(
  options: {
    servicos?: number;
    materiais?: number;
    desconto?: number;
    total?: number;
  } = {},
): QuoteDocumentInput {
  const servicos = Array.from(
    { length: options.servicos ?? 2 },
    (_, indice) => ({
      kind: 'SERVICE',
      description: `Serviço ${indice + 1}`,
      unit: 'SERV',
      quantity: 4,
      unitPrice: 250,
      total: 1000,
    }),
  );
  const materiais = Array.from(
    { length: options.materiais ?? 1 },
    (_, indice) => ({
      kind: 'PRODUCT',
      description: `Material ${indice + 1}`,
      sku: `SKU-${indice}`,
      unit: 'M',
      quantity: 3.5,
      unitPrice: 18.4,
      total: 64.4,
    }),
  );

  return {
    quote: {
      code: 'ORC-000011',
      title: 'Manutenção do parque de climatização',
      status: 'SENT',
      issuedAt: '25/09/2026',
      validUntil: '25/10/2026',
      validityDays: 30,
      notes: 'Proposta para manutenção da torre A.',
      author: 'Helena Braga',
      operationCode: 'OP-000086',
    },
    customer: {
      name: 'Edifício Aurora',
      legalName: 'Condomínio do Edifício Aurora',
      document: 'CNPJ 12.334.332/0001-23',
    },
    items: [...servicos, ...materiais],
    totals: {
      subtotal: 2952.7,
      discount: options.desconto ?? 152.7,
      total: options.total ?? 2800,
    },
  };
}

const emissor = { tradeName: 'Clima Norte' };

describe('Orçamento premium', () => {
  const service = new QuoteDocumentService();

  const render = (input: QuoteDocumentInput) =>
    service.render({
      quote: input,
      emitter: emissor,
      generatedAt: new Date('2026-09-25T18:00:00.000Z'),
    });

  it('põe o total em destaque, com o extenso', async () => {
    const texto = textoDoPdf(await render(entrada()));

    expect(texto).toContain('VALOR TOTAL DA PROPOSTA');
    expect(texto).toContain('2.800,00');
    /* O extenso protege o número e é o que se confere em voz alta ao
       aprovar por telefone. */
    expect(texto).toContain('dois mil e oitocentos reais');
  });

  it('dá preço aos materiais, e não só quantidade', async () => {
    const texto = textoDoPdf(await render(entrada()));

    expect(texto).toContain('Materiais e fornecimentos');
    /* O modelo do setor lista material só com descrição e quantidade: quem
       lê não confere de onde veio o subtotal, e a proposta passa a pedir
       confiança em vez de mostrar a conta. */
    expect(texto).toContain('18,40');
    expect(texto).toContain('64,40');
  });

  it('numera os itens de forma contínua entre os grupos', async () => {
    const texto = textoDoPdf(
      await render(entrada({ servicos: 2, materiais: 2 })),
    );

    /* Reiniciar a numeração em cada grupo faria existir dois "item 01" na
       mesma proposta — e é por número que o cliente questiona uma linha. */
    expect(texto).toContain('03Material 1');
    expect(texto).toContain('04Material 2');
  });

  it('tira o desconto da tabela e põe no resumo', async () => {
    const texto = textoDoPdf(await render(entrada()));

    expect(texto).toContain('SUBTOTAL');
    expect(texto).toContain('DESCONTO');
    /* Hífen ASCII: o sinal de menos tipográfico não existe no WinAnsi da
       Helvetica e sai impresso como aspas. */
    expect(texto).toContain('- R$ 152,70');
    expect(texto).not.toContain('"R$');
  });

  it('omite o resumo quando não há desconto a explicar', async () => {
    const texto = textoDoPdf(
      await render(entrada({ desconto: 0, total: 2952.7 })),
    );

    /* "SUBTOTAL" não serve para afirmar isto: é também o cabeçalho de uma
       coluna da tabela de itens. "DESCONTO" só existe no resumo. */
    expect(texto).not.toContain('DESCONTO');
    expect(texto).toContain('VALOR TOTAL DA PROPOSTA');
  });

  it('imprime os valores como vieram, sem refazer a conta', async () => {
    /* Um total que não bate com a soma dos itens é problema do domínio, e é
       lá que se corrige. Recalcular na impressão criaria uma segunda fonte de
       verdade sobre dinheiro, e a folha contradiria a tela. */
    const texto = textoDoPdf(await render(entrada({ total: 1 })));

    expect(texto).toContain('R$ 1,00');
    expect(texto).toContain('um real');
  });

  it('dá onde o cliente aprovar', async () => {
    const texto = textoDoPdf(await render(entrada()));

    expect(texto).toContain('Aceite');
    expect(texto).toContain('autorizo a execução dos serviços');
    /* Sem linha de data, a aprovação acontece por outro canal e fica fora do
       documento. */
    expect(texto).toContain('Data:');
    expect(texto).toContain('Edifício Aurora');
  });

  it('não repete a validade em duas seções', async () => {
    const texto = textoDoPdf(await render(entrada()));

    expect(texto).toContain('25/10/2026 (30 dias)');
    expect(texto.match(/25\/10\/2026/g) ?? []).toHaveLength(1);
  });

  it('traduz a situação da proposta', async () => {
    const texto = textoDoPdf(await render(entrada()));

    expect(texto).toContain('Enviada');
    expect(texto).not.toContain('SENT');
  });

  it('distribui a tabela de itens e repete o cabeçalho', async () => {
    const bytes = await render(entrada({ servicos: 60 }));
    const texto = textoDoPdf(bytes);

    expect(contarPaginas(bytes)).toBeGreaterThan(1);
    expect(texto).toContain('CONTINUAÇÃO');
    expect(texto).toContain('Serviço 60');
  });
});
