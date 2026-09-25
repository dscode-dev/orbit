/**
 * O relatório de qualidade do ar.
 *
 * A linha que este teste guarda é a que separa aritmética de parecer: o
 * documento pode dizer que 1340 é maior que 1000, e não pode dizer que o
 * ambiente está conforme. Quem conclui é quem assina.
 */
import { inflateSync } from 'node:zlib';
import { ArtifactPremiumPdfRenderer } from '../artifact-premium-pdf.renderer';
import type { RenderInput } from '../../artifact-renderer';

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
  /* `Intl` usa espaço inquebrável entre número e unidade: certo para
     impressão, ruim para comparar em teste. */
  return partes.join('').replace(/\s/g, ' ');
}

function entrada(
  medicoes: Record<string, unknown> = {
    temperatura: 24.2,
    umidade: 71,
    co2: 1340,
    velocidade_ar: 0.12,
    particulas: 62,
    fungos: undefined,
  },
): RenderInput {
  const unidades: Record<string, string> = {
    temperatura: '°C',
    umidade: '%',
    co2: 'ppm',
    velocidade_ar: 'm/s',
    particulas: 'µg/m³',
    fungos: 'UFC/m³',
  };

  return {
    execution: {
      id: 'e',
      code: 'QAR-000007',
      title: 'Análise da qualidade do ar',
      status: 'COMPLETED',
    },
    snapshot: {
      id: 's',
      templateKey: 'ORBIT_QUALIDADE_AR',
      templateName: 'Relatório de Análise da Qualidade do Ar',
      templateVersion: 3,
      artifactType: 'QUALIDADE_AR',
      structureHash: 'h',
    },
    sections: [
      {
        id: 'ambiente',
        title: 'Ambiente avaliado',
        order: 1,
        type: 'FORM',
        fields: [
          {
            id: 'local',
            label: 'Local',
            type: 'TEXT',
            order: 1,
            required: true,
            hidden: false,
            value: 'Pavimento 3',
          },
          {
            id: 'area',
            label: 'Área',
            type: 'DECIMAL',
            order: 2,
            required: false,
            hidden: false,
            value: 412.5,
            unit: 'm²',
          },
        ],
      },
      {
        id: 'parametros',
        title: 'Parâmetros medidos',
        order: 2,
        type: 'FORM',
        fields: Object.entries(medicoes).map(([id, value], indice) => ({
          id,
          label: id,
          type: 'DECIMAL',
          order: indice + 1,
          required: false,
          hidden: false,
          value,
          unit: unidades[id],
        })),
      },
      {
        id: 'parecer',
        title: 'Parecer',
        order: 3,
        type: 'FORM',
        fields: [
          {
            id: 'parecer',
            label: 'Parecer técnico',
            type: 'LONG_TEXT',
            order: 1,
            required: true,
            hidden: false,
            value: 'Renovação de ar insuficiente para a ocupação observada.',
          },
        ],
      },
    ],
    signatures: [
      {
        slotId: 'rt',
        label: 'Responsável técnico',
        signerRole: 'TECHNICAL_MANAGER',
        required: true,
        order: 1,
        signerName: 'Helena Braga',
        professionalCredential: 'CREA-PE 1234543434',
      },
    ],
    branding: { primaryColor: '#1B4DB1' },
    layout: {},
    metadata: {
      documentContext: {
        emitter: { tradeName: 'Clima Norte' },
        customer: { name: 'Edifício Aurora' },
        operation: { code: 'OP-000092' },
      },
    },
    correlationId: 'c',
    generatedAt: new Date('2026-09-25T19:00:00.000Z'),
  };
}

describe('Qualidade do ar premium', () => {
  const renderer = new ArtifactPremiumPdfRenderer();

  it('põe a referência ao lado do medido', async () => {
    const texto = textoDoPdf((await renderer.render(entrada())).bytes);

    /* Sem a referência ao lado, "1.340 ppm" exige que quem lê conheça a
       norma — e quem recebe o relatório é o síndico, não o engenheiro. */
    expect(texto).toContain('1.340');
    expect(texto).toContain('até 1.000');
    expect(texto).toContain('Acima do VMR');
    expect(texto).toContain('Dentro do VMR');
  });

  it('resume quantos parâmetros ficaram fora, antes da tabela', async () => {
    const texto = textoDoPdf((await renderer.render(entrada())).bytes);

    /* Cinco medidos (fungos não foi), dois fora: CO2 e umidade. */
    expect(texto).toContain('2 de 5 parâmetros medidos ficaram fora');
    const resumo = texto.indexOf('2 de 5 parâmetros');
    const tabela = texto.indexOf('PARÂMETRO');
    expect(resumo).toBeGreaterThan(-1);
    expect(resumo).toBeLessThan(tabela);
  });

  it('diz que todos passaram quando todos passam', async () => {
    const texto = textoDoPdf(
      (
        await renderer.render(
          entrada({
            temperatura: 24,
            umidade: 50,
            co2: 800,
            velocidade_ar: 0.1,
            particulas: 40,
            fungos: 300,
          }),
        )
      ).bytes,
    );

    expect(texto).toContain('6 parâmetros medidos ficaram dentro');
  });

  it('não confunde não medido com dentro do referencial', async () => {
    const texto = textoDoPdf((await renderer.render(entrada())).bytes);

    expect(texto).toContain('Não medido');
    /* Fungos não foi medido e não pode contar como aprovado. */
    expect(texto).not.toContain('6 de 6');
  });

  it('nunca afirma conformidade — isso é de quem assina', async () => {
    const texto = textoDoPdf((await renderer.render(entrada())).bytes);

    expect(texto.toLowerCase()).not.toContain('conforme');
    /* O parecer sai como o responsável técnico escreveu. */
    expect(texto).toContain('Renovação de ar insuficiente');
  });

  it('imprime a ressalva sazonal junto da tabela', async () => {
    const texto = textoDoPdf((await renderer.render(entrada())).bytes);

    expect(texto).toContain('envoltória das duas faixas');
  });

  it('cita a norma de onde os referenciais vêm', async () => {
    const texto = textoDoPdf((await renderer.render(entrada())).bytes);

    /* Sem a citação, a coluna "Referência" é um número que o sistema afirma
       sem dizer com que autoridade. */
    expect(texto).toContain('RE nº 9');
    expect(texto).toContain('ANVISA');
  });

  it('escreve decimais com vírgula, como o resto do documento', async () => {
    const texto = textoDoPdf((await renderer.render(entrada())).bytes);

    expect(texto).toContain('412,5');
    expect(texto).not.toContain('412.5');
    expect(texto).toContain('0,12');
  });
});
