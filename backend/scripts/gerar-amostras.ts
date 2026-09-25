/**
 * Gera as amostras de `amostras-pdf/`.
 *
 * ## Por que isto existe
 *
 * As amostras são a única forma de conferir o desenho — teste de unidade lê
 * texto, não vê layout. Enquanto cada ajuste era acompanhado de um script
 * descartável, cada script gerava um subconjunto diferente e sobrescrevia o
 * anterior: as oito amostras nunca estavam todas na mesma versão do kit, e uma
 * delas chegou a ficar sem o logo que a mudança tinha acabado de adicionar.
 *
 * Um gerador só, versionado, com os mesmos dados de exemplo para todos os
 * documentos. Rodar depois de mexer no kit:
 *
 * ```
 * npx ts-node --compiler-options '{"module":"commonjs"}' scripts/gerar-amostras.ts
 * ```
 *
 * Os dados são fictícios de propósito, inclusive o logo — que é desenhado aqui
 * mesmo, e não lido de um arquivo do projeto. Usar a marca do Orbit numa
 * amostra sugere que o documento carimba a nossa marca, quando o que ele
 * imprime é a do inquilino.
 */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { ArtifactPremiumPdfRenderer } from '../src/modules/artifact-rendering/renderers/pdf/artifact-premium-pdf.renderer';
import { PmocPlanDocumentService } from '../src/modules/artifact-rendering/pmoc-plan-document.service';
import { QuoteDocumentService } from '../src/modules/artifact-rendering/quote-document.service';
import type { RenderInput } from '../src/modules/artifact-rendering/renderers/artifact-renderer';

/* ------------------------------------------------------------------ */
/* Logo de exemplo                                                     */
/* ------------------------------------------------------------------ */

/** Um PNG desenhado na hora: marca fictícia de um cliente fictício. */
function logoDeExemplo(): Buffer {
  const largura = 360;
  const altura = 96;
  const pixels: number[][] = Array.from({ length: altura }, () =>
    new Array<number>(largura * 4).fill(0),
  );

  const pintar = (x: number, y: number, cor: [number, number, number]) => {
    if (x < 0 || x >= largura || y < 0 || y >= altura) return;
    const base = x * 4;
    pixels[y]![base] = cor[0];
    pixels[y]![base + 1] = cor[1];
    pixels[y]![base + 2] = cor[2];
    pixels[y]![base + 3] = 255;
  };

  /* Disco com o degradê da marca do cliente. */
  const cx = 44;
  const cy = 48;
  const raio = 34;
  for (let y = 0; y < altura; y += 1) {
    for (let x = 0; x < largura; x += 1) {
      const distancia = Math.hypot(x - cx, y - cy);
      if (distancia > raio) continue;
      const t = (x - (cx - raio)) / (2 * raio);
      pintar(x, y, [
        Math.round(14 + (168 - 14) * t),
        Math.round(116 + (72 - 116) * t),
        Math.round(196 + (188 - 196) * t),
      ]);
    }
  }

  /* Letras "CN" em blocos, e a razão social abaixo. */
  const tinta: [number, number, number] = [18, 28, 54];
  const bloco = (x0: number, y0: number, w: number, h: number) => {
    for (let y = y0; y < y0 + h; y += 1) {
      for (let x = x0; x < x0 + w; x += 1) pintar(x, y, tinta);
    }
  };
  let x = 100;
  for (const w of [30, 10, 26, 10, 34, 10, 28, 10, 32]) {
    bloco(x, 30, w, 14);
    x += w + 6;
  }
  for (let i = 0; i < 3; i += 1) {
    bloco(100, 56 + i * 9, 150 - i * 30, 4);
  }

  const bruto: number[] = [];
  for (let y = 0; y < altura; y += 1) {
    bruto.push(0, ...pixels[y]!);
  }

  const crcTabela = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buffer: Buffer): number => {
    let c = 0xffffffff;
    for (const byte of buffer) c = crcTabela[(c ^ byte) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const pedaco = (tipo: string, dados: Buffer): Buffer => {
    const corpo = Buffer.concat([Buffer.from(tipo, 'latin1'), dados]);
    const tamanho = Buffer.alloc(4);
    tamanho.writeUInt32BE(dados.length);
    const verificacao = Buffer.alloc(4);
    verificacao.writeUInt32BE(crc(corpo));
    return Buffer.concat([tamanho, corpo, verificacao]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pedaco('IHDR', ihdr),
    pedaco('IDAT', deflateSync(Buffer.from(bruto))),
    pedaco('IEND', Buffer.alloc(0)),
  ]);
}

const LOGO = logoDeExemplo();

const emitter = {
  logo: LOGO,
  logoMimeType: 'image/png',
  tradeName: 'Clima Norte',
  legalName: 'Clima Norte Serviços de Refrigeração Ltda',
  document: 'CNPJ 11.222.333/0001-81',
  address: 'Rua Girassol, 742 — Pinheiros',
  cityState: 'São Paulo/SP',
  phone: '+55 11 4002-8922',
  email: 'contato@climanorte.com.br',
};

const customer = {
  name: 'Edifício Aurora',
  legalName: 'Condomínio do Edifício Aurora',
  document: 'CNPJ 12.334.332/0001-23',
  contactPhone: '(81) 98877-7443',
  address: 'Av. Três, 10 — Maranguape — Paulista/PE',
};

const equipamentos = Array.from({ length: 5 }, (_, i) => ({
  sector: ['Recepção', 'Sala técnica', 'Quarto 1', 'Suíte', 'Copa'][i],
  name: ['Split Hi-Wall', 'Cassete 4 vias'][i % 2],
  manufacturer: ['LG', 'Carrier', 'Daikin', 'Midea', 'Gree'][i],
  model: `MOD-${1200 + i}`,
  identifier: `TAG-${String(i + 1).padStart(3, '0')}`,
  capacity: `${[9, 12, 18, 24, 36][i]}.000 BTU/h`,
}));

const campo = (
  id: string,
  label: string,
  type: string,
  order: number,
  value: unknown,
  extra: Record<string, unknown> = {},
) => ({
  id,
  label,
  type,
  order,
  required: false,
  hidden: false,
  value,
  ...extra,
});

function entrada(
  code: string,
  title: string,
  artifactType: string,
  sections: RenderInput['sections'],
): RenderInput {
  return {
    execution: {
      id: 'e',
      code,
      title,
      status: 'COMPLETED',
      completedAt: '2026-09-25T15:00:00.000Z',
    },
    snapshot: {
      id: 's',
      templateKey: 'K',
      templateName: 'T',
      templateVersion: 3,
      artifactType,
      structureHash: 'h',
    },
    sections,
    signatures: [
      {
        slotId: 'c',
        label: 'Cliente',
        signerRole: 'CUSTOMER',
        required: true,
        order: 1,
        signerName: 'Marcos Antunes',
        signedAt: '2026-09-25T15:00:00.000Z',
      },
      {
        slotId: 'rt',
        label: 'Responsável técnico',
        signerRole: 'TECHNICAL_MANAGER',
        required: true,
        order: 2,
        signerName: 'Helena Braga',
        professionalCredential: 'Eng.ª Mecânica · CREA-PE 1234543434',
        signedAt: '2026-09-25T15:00:00.000Z',
      },
    ],
    branding: {},
    layout: {},
    metadata: {
      executionNotes:
        'Ambiente entregue limpo e equipamento em operação normal na saída.',
      documentContext: {
        emitter,
        customer,
        operation: {
          code: 'OP-000091',
          kind: 'CORRECTIVE',
          priority: 'HIGH',
          duration: '3 h 15 min',
          openedAt: '24/09/2026, 19:20',
          startedAt: '25/09/2026, 09:10',
          completedAt: '25/09/2026, 12:25',
          fieldTechnician: 'Eduardo Silva',
          startedBy: 'Eduardo Silva',
          completedBy: 'Eduardo Silva',
          auxiliaryTechnicians: ['Rafael Nunes'],
        },
        equipment: equipamentos,
      },
    },
    correlationId: 'c',
    generatedAt: new Date('2026-09-25T18:00:00.000Z'),
  };
}

const checklist = (rotulos: readonly string[]) =>
  rotulos.map((rotulo, i) =>
    campo(
      `c${i}`,
      rotulo,
      'BOOLEAN',
      i + 1,
      i === 4 ? false : i === 5 ? undefined : true,
      i === 4
        ? { notes: 'Vazamento localizado e corrigido; reteste agendado.' }
        : {},
    ),
  );

async function main(): Promise<void> {
  const renderer = new ArtifactPremiumPdfRenderer();
  const destino = '../amostras-pdf';
  const escrever = (nome: string, bytes: Buffer) => {
    writeFileSync(`${destino}/${nome}`, bytes);
    console.log(`  ${nome.padEnd(30)} ${bytes.length} bytes`);
  };

  console.log('gerando amostras com logo de cliente:');

  escrever(
    'OS-premium.pdf',
    (
      await renderer.render(
        entrada('OS-000072', 'Ar-condicionado sem gelar', 'ORDEM_SERVICO', [
          {
            id: 'servico',
            title: 'Serviço',
            order: 1,
            type: 'FORM',
            fields: [
              campo(
                'tipo_servico',
                'Tipo de serviço',
                'SELECT',
                1,
                'Manutenção corretiva',
              ),
              campo(
                'descricao',
                'Descrição',
                'LONG_TEXT',
                2,
                'Cliente relata que a unidade do quarto principal liga mas não refrigera, e pinga água pela lateral direita.',
              ),
            ],
          },
          {
            id: 'execucao',
            title: 'Execução',
            order: 2,
            type: 'FORM',
            fields: [
              campo(
                'procedimentos',
                'Procedimentos realizados',
                'LONG_TEXT',
                1,
                'Dreno obstruído por biofilme; executada desobstrução e higienização da bandeja. Carga de gás a 95 psi contra 110 nominais — vazamento na porca flange, reapertada, vácuo e recarga com R-410A.',
              ),
              campo(
                'materiais',
                'Materiais aplicados',
                'LONG_TEXT',
                2,
                '400 g de R-410A · 1 jogo de porcas flange 1/4" · 2 m de fita anticorrosiva',
              ),
              campo(
                'pendencias',
                'Pendências',
                'LONG_TEXT',
                3,
                'Isolamento da linha da suíte ressecado em 3 m; orçamento enviado em separado. Retorno em 30 dias para reavaliar a carga.',
              ),
            ],
          },
          {
            id: 'checklist',
            title: 'Checklist da execução',
            order: 3,
            type: 'CHECKLIST',
            fields: checklist([
              'Verificar pressão de sucção e descarga',
              'Medir corrente do compressor',
              'Conferir isolamento das linhas',
              'Testar acionamento pelo controle',
              'Verificar estanqueidade',
              'Limpar filtros e bandeja',
            ]),
          },
        ]),
      )
    ).bytes,
  );

  escrever(
    'RVT-premium.pdf',
    (
      await renderer.render(
        entrada(
          'RVT-000053',
          'Contrato Synapse — visita de setembro',
          'RELATORIO_VISITA',
          [
            {
              id: 'visita',
              title: 'Visita',
              order: 1,
              type: 'FORM',
              fields: [
                campo(
                  'motivo',
                  'Motivo da visita',
                  'LONG_TEXT',
                  1,
                  'Chamado aberto pela zeladoria relatando ruído intermitente e queda de rendimento nas unidades da recepção.',
                ),
                campo(
                  'acompanhante',
                  'Acompanhado por',
                  'TEXT',
                  2,
                  'Eduardo Silva (zeladoria)',
                ),
                campo(
                  'constatacoes',
                  'Constatações',
                  'LONG_TEXT',
                  3,
                  'O ruído da TAG-001 vem da folga no eixo do ventilador da evaporadora, já com marca de desgaste no mancal. A corrente medida ficou em 5,8 A contra 5,1 A nominais.',
                ),
              ],
            },
            {
              id: 'rotina',
              title: 'Rotina semanal',
              order: 2,
              type: 'CHECKLIST',
              fields: checklist([
                'Limpeza de filtro de ar',
                'Limpeza dos painéis de comando',
                'Desobstrução do dreno',
                'Verificar ruídos mecânicos',
                'Verificar fiações elétricas',
                'Verificar folga dos eixos',
              ]),
            },
            {
              id: 'encaminhamentos',
              title: 'Encaminhamentos',
              order: 3,
              type: 'FORM',
              fields: [
                campo(
                  'recomendacoes',
                  'Recomendações',
                  'LONG_TEXT',
                  1,
                  'Substituir o mancal do ventilador da TAG-001 nos próximos 15 dias — operar com a folga atual tende a danificar o eixo.',
                ),
                campo(
                  'proxima_visita',
                  'Próxima visita sugerida',
                  'DATE',
                  2,
                  '2026-10-01',
                ),
              ],
            },
          ],
        ),
      )
    ).bytes,
  );

  escrever(
    'RECIBO-premium.pdf',
    (
      await renderer.render(
        entrada('REC-000076', 'Recibo de pagamento', 'RECIBO', [
          {
            id: 'partes',
            title: 'Partes',
            order: 1,
            type: 'FORM',
            fields: [
              campo(
                'pagador',
                'Recebemos de',
                'TEXT',
                1,
                'Condomínio do Edifício Aurora',
              ),
              campo(
                'documento_pagador',
                'CNPJ ou CPF',
                'TEXT',
                2,
                'CNPJ 12.334.332/0001-23',
              ),
              campo('data', 'Data', 'DATE', 3, '2026-09-16'),
            ],
          },
          {
            id: 'valor',
            title: 'Valor',
            order: 2,
            type: 'FORM',
            fields: [
              campo('valor', 'Valor recebido', 'DECIMAL', 1, '1234.56', {
                unit: 'BRL',
              }),
              campo(
                'referente',
                'Referente a',
                'LONG_TEXT',
                2,
                'Manutenção corretiva em três unidades split, com recarga de gás R-410A, conforme OS-000072.',
              ),
              campo(
                'forma_pagamento',
                'Forma de pagamento',
                'SELECT',
                3,
                'PIX',
              ),
              campo('garantia_dias', 'Garantia (dias)', 'NUMBER', 4, 90),
            ],
          },
        ]),
      )
    ).bytes,
  );

  escrever(
    'LAUDO-TECNICO-premium.pdf',
    (
      await renderer.render(
        entrada(
          'LT-000014',
          'Avaliação de falha no chiller da central',
          'RELATORIO_TECNICO',
          [
            {
              id: 'objeto',
              title: 'Objeto e metodologia',
              order: 1,
              type: 'FORM',
              fields: [
                campo(
                  'objeto',
                  'Objeto do relatório',
                  'LONG_TEXT',
                  1,
                  'Avaliação técnica das paradas recorrentes do chiller de 120 TR instalado na casa de máquinas do subsolo. O escopo limita-se ao circuito frigorígeno e ao sistema de condensação.',
                ),
                campo(
                  'metodologia',
                  'Metodologia aplicada',
                  'LONG_TEXT',
                  2,
                  'Inspeção visual, leitura do histórico de alarmes, medição de pressões com manifold digital calibrado em 03/2026 e ensaio de vazão no circuito de condensação.',
                ),
                campo(
                  'normas',
                  'Normas de referência',
                  'LONG_TEXT',
                  3,
                  'ABNT NBR 16401-1:2008 — Instalações de ar-condicionado. ABNT NBR 15960:2011 — Refrigeração.',
                ),
              ],
            },
            {
              id: 'analise',
              title: 'Análise',
              order: 2,
              type: 'FORM',
              fields: [
                campo(
                  'constatacoes',
                  'Constatações',
                  'LONG_TEXT',
                  1,
                  'A torre de resfriamento apresenta incrustação severa no enchimento, com redução estimada de 40% da área de troca. A temperatura da água de condensação foi medida em 34,8 °C contra os 29,5 °C de projeto.',
                ),
                campo(
                  'conclusao',
                  'Conclusão',
                  'LONG_TEXT',
                  2,
                  'Os desarmes decorrem da perda de capacidade de rejeição de calor da torre, e não de defeito do chiller. O equipamento está operando dentro de suas especificações; a restrição está no sistema de condensação.',
                ),
                campo(
                  'ressalvas',
                  'Ressalvas',
                  'LONG_TEXT',
                  3,
                  'Não foi possível ensaiar a bomba de condensação sob carga plena por indisponibilidade de parada programada.',
                ),
              ],
            },
          ],
        ),
      )
    ).bytes,
  );

  escrever(
    'QUALIDADE-AR-premium.pdf',
    (
      await renderer.render(
        entrada('QAR-000007', 'Análise da qualidade do ar', 'QUALIDADE_AR', [
          {
            id: 'ambiente',
            title: 'Ambiente',
            order: 1,
            type: 'FORM',
            fields: [
              campo(
                'local',
                'Local',
                'TEXT',
                1,
                'Pavimento 3 — escritório central',
              ),
              campo('area', 'Área', 'DECIMAL', 2, 412.5, { unit: 'm²' }),
              campo('ocupacao', 'Ocupação média', 'NUMBER', 3, 48, {
                unit: 'pessoas',
              }),
              campo(
                'equipamento_medicao',
                'Equipamento de medição',
                'TEXT',
                4,
                'Instrutherm THDL-400 (cal. 02/2026)',
              ),
            ],
          },
          {
            id: 'parametros',
            title: 'Parâmetros',
            order: 2,
            type: 'FORM',
            fields: [
              campo('temperatura', 'Temperatura', 'DECIMAL', 1, 24.2, {
                unit: '°C',
              }),
              campo('umidade', 'Umidade relativa', 'DECIMAL', 2, 71, {
                unit: '%',
              }),
              campo('co2', 'Dióxido de carbono', 'DECIMAL', 3, 1340, {
                unit: 'ppm',
              }),
              campo('velocidade_ar', 'Velocidade do ar', 'DECIMAL', 4, 0.12, {
                unit: 'm/s',
              }),
              campo('particulas', 'Material particulado', 'DECIMAL', 5, 62, {
                unit: 'µg/m³',
              }),
              campo('fungos', 'Contagem de fungos', 'DECIMAL', 6, undefined, {
                unit: 'UFC/m³',
              }),
            ],
          },
          {
            id: 'parecer',
            title: 'Parecer',
            order: 3,
            type: 'FORM',
            fields: [
              campo(
                'parecer',
                'Parecer técnico',
                'LONG_TEXT',
                1,
                'O ambiente apresenta renovação de ar insuficiente para a ocupação observada. A concentração de CO₂ acima do referencial é compatível com a taxa de renovação medida no insuflamento.',
              ),
              campo(
                'recomendacoes',
                'Recomendações',
                'LONG_TEXT',
                2,
                'Revisar o ajuste do damper de ar externo e repetir a medição 15 dias após a correção.',
              ),
            ],
          },
        ]),
      )
    ).bytes,
  );

  escrever(
    'PMOC-execucao.pdf',
    (
      await renderer.render(
        entrada('PMOC-000023', 'Edifício Aurora — Torre A', 'PMOC', [
          {
            id: 'roteiro',
            title: 'Roteiro da visita',
            order: 1,
            type: 'CHECKLIST',
            fields: checklist([
              'Limpar filtros de ar',
              'Higienizar bandeja e dreno',
              'Medir temperatura de insuflamento',
              'Limpar serpentina do condensador',
              'Medir corrente de operação',
              'Verificar pressões',
            ]),
          },
        ]),
      )
    ).bytes,
  );

  escrever(
    'PMOC-plano.pdf',
    await new PmocPlanDocumentService().render({
      emitter,
      generatedAt: new Date('2026-09-25T18:00:00.000Z'),
      plan: {
        plan: {
          code: 'PMOC-000023',
          name: 'Edifício Aurora — Torre A',
          status: 'ACTIVE',
          coverageStart: '01/01/2026',
          coverageEnd: '31/12/2026',
          cadence: 'a cada 3 meses',
          serviceTypes: [
            'Limpeza de serpentina',
            'Higienização',
            'Troca de filtros',
          ],
          notes:
            'Acesso ao shaft técnico somente com acompanhamento da zeladoria.',
          technicalResponsible: 'Helena Braga',
          fieldTechnician: 'Rafael Nunes',
          nextDueOn: '10/06/2026',
          lastExecutedAt: '10/03/2026',
        },
        customer: { name: customer.name, document: customer.document },
        equipment: equipamentos,
        units: [{ name: 'Pavimento térreo', checklist: 'Roteiro trimestral' }],
        procedure: [
          {
            group: 'Unidade evaporadora',
            items: [
              'Limpar filtros',
              'Higienizar bandeja',
              'Medir temperatura',
            ],
          },
        ],
        legalReference: 'Documento emitido nos termos da Lei nº 13.589/2018.',
      },
    }),
  );

  escrever(
    'ORCAMENTO-premium.pdf',
    await new QuoteDocumentService().render({
      emitter,
      generatedAt: new Date('2026-09-25T18:00:00.000Z'),
      quote: {
        quote: {
          code: 'ORC-000011',
          title: 'Manutenção preventiva e corretiva — Edifício Aurora, Torre A',
          status: 'SENT',
          issuedAt: '25/09/2026',
          validUntil: '25/10/2026',
          validityDays: 30,
          notes:
            'Proposta para manutenção do parque de climatização da torre A, contemplando as quatro unidades da recepção e do primeiro pavimento.',
          author: 'Helena Braga',
          operationCode: 'OP-000086',
        },
        customer: {
          name: customer.name,
          legalName: customer.legalName,
          document: customer.document,
          email: 'sindico@edificioaurora.com.br',
          phone: customer.contactPhone,
          address: customer.address,
        },
        items: [
          {
            kind: 'SERVICE',
            description: 'Limpeza completa de unidade split hi-wall',
            unit: 'SERV',
            quantity: 4,
            unitPrice: 250,
            total: 1000,
          },
          {
            kind: 'SERVICE',
            description: 'Higienização química de serpentina',
            unit: 'SERV',
            quantity: 4,
            unitPrice: 180,
            total: 720,
          },
          {
            kind: 'SERVICE',
            description: 'Recarga de gás R-410A',
            unit: 'SERV',
            quantity: 2,
            unitPrice: 320,
            total: 640,
          },
          {
            kind: 'PRODUCT',
            description: 'Borracha isoladora tubular 1/2"',
            sku: 'ISO-012',
            unit: 'M',
            quantity: 3.5,
            unitPrice: 18.4,
            total: 64.4,
          },
          {
            kind: 'PRODUCT',
            description: 'Jogo de porcas flange 1/4"',
            sku: 'PF-014',
            unit: 'JG',
            quantity: 4,
            unitPrice: 27.5,
            total: 110,
          },
        ],
        totals: { subtotal: 2952.7, discount: 152.7, total: 2800 },
      },
    }),
  );
}

void main();
