/**
 * O documento do plano de PMOC, no que dá para afirmar sobre bytes de PDF.
 *
 * A aparência não se testa aqui — para isso existe o olho e as amostras que o
 * desenvolvimento gera. O que se testa é o que quebra calado: a máscara do
 * CNPJ que sai errada, a periodicidade impressa em código de enum, a tabela de
 * equipamentos que estoura a página sem repetir o cabeçalho, e o JSON livre do
 * roteiro — que tem duas formas em produção e nenhuma validação no banco.
 */
import { PmocService } from './pmoc.service';
import { PmocPlanDocumentService } from '../artifact-rendering/pmoc-plan-document.service';
import { EntityNotFoundException } from '../../exceptions';
import type { PmocActor } from './pmoc.service';
import { pdfText, pdfPageCount } from '../../../test/support/pdf-text';

const ATOR: PmocActor = {
  organizationId: 'org-1',
  actorId: 'user-1',
  permissions: ['pmoc.read'],
  businessUnitIds: ['bu-1'],
};

function coberturas(quantidade: number) {
  return Array.from({ length: quantidade }, (_, indice) => ({
    startsOn: '2026-01-15',
    asset: {
      name: 'Split Hi-Wall',
      manufacturer: 'Carrier',
      model: `MOD-${indice}`,
      identifier: `TAG-${indice}`,
      serialNumber: `SN-${indice}`,
      location: `Sala ${indice + 1}`,
      specifications: { capacidadeBtu: '12000' },
    },
  }));
}

function fonte(
  overrides: {
    coberturas?: number;
    procedure?: unknown;
    serviceTypes?: unknown;
  } = {},
) {
  return {
    plan: {
      code: 'PMOC-000023',
      name: 'Edifício Aurora — Torre A',
      status: 'ACTIVE',
      notes: 'Acesso ao shaft somente com acompanhamento da zeladoria.',
      startsOn: '2026-01-01',
      endsOn: '2026-12-31',
      frequencyAmount: 3,
      frequencyUnit: 'MONTHS',
      serviceTypes: overrides.serviceTypes ?? ['Limpeza', 'Higienização'],
      procedure: overrides.procedure ?? {
        Evaporadora: ['Limpar filtros', 'Verificar dreno'],
        Condensadora: [{ label: 'Medir corrente' }],
      },
      lastExecutedAt: new Date('2026-03-10T12:00:00Z'),
      nextDueOn: '2026-06-10',
      technician: { displayName: 'Rafael Nunes' },
      technicalResponsible: { displayName: 'Eng. Helena Braga' },
      customer: {
        legalName: 'Condomínio Edifício Aurora',
        tradeName: 'Ed. Aurora',
        documentType: 'CNPJ',
        documentNumber: '21505237000102',
      },
      businessUnit: {
        legalName: 'Clima Norte Serviços Ltda',
        tradeName: 'Clima Norte',
        documentType: 'CNPJ',
        documentNumber: '11222333000181',
        email: 'contato@climanorte.com.br',
        phone: '+55 11 4002-8922',
        website: 'climanorte.com.br',
        city: 'São Paulo',
        stateCode: 'SP',
        district: 'Pinheiros',
        street: 'Rua Girassol',
        number: '742',
        timezone: 'America/Sao_Paulo',
      },
    },
    coverages: coberturas(overrides.coberturas ?? 3),
    planUnits: [
      {
        unit: {
          name: 'Pavimento térreo',
          checklistTemplate: { name: 'Roteiro trimestral' },
        },
      },
    ],
  };
}

function servico(fonteDoPlano: unknown) {
  const repository = {
    documentSource: jest.fn().mockResolvedValue(fonteDoPlano),
  };
  const service = new PmocService(
    repository as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    new PmocPlanDocumentService(),
  );
  return { service, repository };
}

describe('documento do plano de PMOC', () => {
  it('imprime identificação, partes e periodicidade em português', async () => {
    const { service } = servico(fonte());

    const documento = await service.document('plan-1', ATOR);
    const texto = pdfText(documento.bytes);

    expect(documento.mimeType).toBe('application/pdf');
    expect(documento.fileName).toBe('PMOC-000023-plano.pdf');
    expect(texto).toContain('PMOC-000023');
    expect(texto).toContain('Ed. Aurora');
    expect(texto).toContain('Clima Norte');
    // A máscara é do domínio: um CNPJ impresso cru vira reclamação de auditoria.
    expect(texto).toContain('21.505.237/0001-02');
    expect(texto).toContain('a cada 3 meses');
    // Datas em pt-BR, não no ISO que veio do banco.
    expect(texto).toContain('01/01/2026');
    expect(texto).not.toContain('2026-01-01');
  });

  it('imprime o roteiro nas duas formas que o JSON livre assume', async () => {
    const { service } = servico(fonte());

    const texto = pdfText((await service.document('plan-1', ATOR)).bytes);

    expect(texto).toContain('Limpar filtros');
    expect(texto).toContain('Medir corrente');
  });

  it('ignora roteiro e tipos de serviço malformados em vez de falhar', async () => {
    const { service } = servico(
      fonte({
        procedure: {
          Evaporadora: [42, null, { codigo: 'ZZTOP' }, 'Limpar filtros'],
          Vazio: [],
        },
        serviceTypes: 'Limpeza',
      }),
    );

    const texto = pdfText((await service.document('plan-1', ATOR)).bytes);

    expect(texto).toContain('Limpar filtros');
    // Objeto sem rótulo reconhecível não vira linha: o roteiro impresso não
    // pode conter chaves internas do JSON.
    expect(texto).not.toContain('ZZTOP');
    expect(texto.toUpperCase()).not.toContain('VAZIO');
  });

  it('distribui a tabela de equipamentos e repete o cabeçalho', async () => {
    const { service } = servico(fonte({ coberturas: 60 }));

    const documento = await service.document('plan-1', ATOR);
    const texto = pdfText(documento.bytes);

    expect(pdfPageCount(documento.bytes)).toBeGreaterThan(1);
    /* A legenda é do documento, não de uma célula: em minúscula, acima da
       tabela. Concatenada ao cabeçalho da primeira coluna — que foi o defeito
       — ela estourava a largura reservada para "Item". */
    expect(texto).toContain('(continuação)');
    expect(texto).not.toContain('ITEM (');
    expect(texto).toContain('MOD-59');
  });

  it('recusa plano de outra organização como inexistente', async () => {
    const { service, repository } = servico(null);

    await expect(service.document('plan-1', ATOR)).rejects.toBeInstanceOf(
      EntityNotFoundException,
    );
    expect(repository.documentSource).toHaveBeenCalledWith('plan-1', 'org-1');
  });
});
