/**
 * Catálogo oficial de artefatos do Orbit.
 *
 * São templates **globais**: `organizationId` nulo, `visibility: 'GLOBAL'`,
 * `status: 'ACTIVE'`. O repositório de templates já os inclui na listagem de
 * qualquer organização —
 *
 * ```ts
 * OR: [{ organizationId }, { organizationId: null, visibility: 'GLOBAL', status: 'ACTIVE' }]
 * ```
 *
 * — então aparecem para toda organização, inclusive as criadas depois da
 * semeadura, sem cópia por tenant e sem tocar no fluxo de cadastro.
 *
 * A `ArtifactTemplatePolicy` recusa escrita em template global
 * ("Global and external templates are read-only"): **o oficial não se perde**.
 * Personalizar é duplicar (`POST /artifact-templates/:id/duplicate`), o que
 * cria uma cópia da organização; restaurar é duplicar de novo a partir do
 * mesmo global.
 *
 * As estruturas são **ponto de partida**, não regra: o motor de artefatos não
 * interpreta `type` de campo nem de seção — são metadados que os clientes
 * renderizam. Nada aqui decide cálculo, obrigatoriedade de negócio ou fluxo.
 */

export interface OfficialField {
  id: string;
  label: string;
  type: string;
  order: number;
  required?: boolean;
  unit?: string;
  placeholder?: string;
  description?: string;
}

export interface OfficialSection {
  id: string;
  title: string;
  description?: string;
  order: number;
  type: string;
  required?: boolean;
  fields: OfficialField[];
}

export interface OfficialSignatureSlot {
  id: string;
  label: string;
  signerRole: string;
  order: number;
  required?: boolean;
}

export interface OfficialTemplate {
  key: string;
  name: string;
  description: string;
  /** Vira o `id` do Template Type Registry no cliente. */
  artifactType: string;
  tags: string[];
  sortOrder: number;
  sections: OfficialSection[];
  signatureSlots: OfficialSignatureSlot[];
}

const field = (
  id: string,
  label: string,
  type: string,
  order: number,
  extra: Partial<OfficialField> = {},
): OfficialField => ({ id, label, type, order, ...extra });

const identification = (order: number): OfficialSection => ({
  id: 'identificacao',
  title: 'Identificação',
  description: 'Dados de quem contratou e onde o serviço acontece.',
  order,
  type: 'FORM',
  required: true,
  fields: [
    field('cliente', 'Cliente', 'TEXT', 1, { required: true }),
    field('documento', 'CNPJ ou CPF', 'TEXT', 2),
    field('endereco', 'Endereço', 'TEXT', 3, { required: true }),
    field('contato', 'Contato no local', 'TEXT', 4),
    field('data', 'Data', 'DATE', 5, { required: true }),
  ],
});

export const OFFICIAL_TEMPLATES: readonly OfficialTemplate[] = [
  {
    key: 'ORBIT_ORDEM_SERVICO',
    name: 'Ordem de Serviço',
    description:
      'Registro do serviço executado em campo: escopo, execução, materiais e aceite.',
    artifactType: 'ORDEM_SERVICO',
    tags: ['oficial', 'campo'],
    sortOrder: 10,
    sections: [
      identification(1),
      {
        id: 'servico',
        title: 'Serviço',
        order: 2,
        type: 'FORM',
        required: true,
        fields: [
          field('tipo_servico', 'Tipo de serviço', 'SELECT', 1, {
            required: true,
          }),
          field(
            'descricao',
            'Descrição do serviço solicitado',
            'LONG_TEXT',
            2,
            {
              required: true,
            },
          ),
          field('inicio', 'Início do atendimento', 'DATETIME', 3),
          field('termino', 'Término do atendimento', 'DATETIME', 4),
        ],
      },
      {
        id: 'execucao',
        title: 'Execução',
        order: 3,
        type: 'FORM',
        fields: [
          field('procedimentos', 'Procedimentos realizados', 'LONG_TEXT', 1, {
            required: true,
          }),
          field('materiais', 'Materiais aplicados', 'LONG_TEXT', 2),
          field('pendencias', 'Pendências', 'LONG_TEXT', 3),
          field('fotos', 'Registro fotográfico', 'PHOTO', 4),
        ],
      },
    ],
    signatureSlots: [
      {
        id: 'tecnico',
        label: 'Técnico responsável',
        signerRole: 'TECHNICIAN',
        order: 1,
        required: true,
      },
      {
        id: 'cliente',
        label: 'Responsável pelo cliente',
        signerRole: 'CUSTOMER',
        order: 2,
        required: true,
      },
    ],
  },

  {
    key: 'ORBIT_PMOC',
    name: 'PMOC — Plano de Manutenção, Operação e Controle',
    description:
      'Plano e execução da manutenção de sistemas de climatização, com identificação do responsável técnico.',
    artifactType: 'PMOC',
    tags: ['oficial', 'hvac-r', 'conformidade'],
    sortOrder: 20,
    sections: [
      identification(1),
      {
        id: 'responsavel_tecnico',
        title: 'Responsável técnico',
        order: 2,
        type: 'FORM',
        required: true,
        fields: [
          field('nome_rt', 'Nome do responsável técnico', 'TEXT', 1, {
            required: true,
          }),
          field('registro_rt', 'Registro profissional', 'TEXT', 2, {
            required: true,
          }),
          field('art', 'ART/RRT', 'TEXT', 3),
        ],
      },
      {
        id: 'sistema',
        title: 'Sistema de climatização',
        order: 3,
        type: 'FORM',
        required: true,
        fields: [
          field(
            'identificacao_equipamento',
            'Identificação do equipamento',
            'TEXT',
            1,
            {
              required: true,
            },
          ),
          field('tipo_equipamento', 'Tipo', 'SELECT', 2),
          field('capacidade', 'Capacidade', 'DECIMAL', 3, { unit: 'BTU/h' }),
          field('ambiente', 'Ambiente atendido', 'TEXT', 4),
        ],
      },
      {
        id: 'atividades',
        title: 'Atividades executadas',
        description:
          'Periodicidade e execução das atividades previstas no plano.',
        order: 4,
        type: 'FORM',
        fields: [
          field('limpeza_filtros', 'Limpeza de filtros', 'CHECKBOX', 1),
          field('limpeza_serpentinas', 'Limpeza de serpentinas', 'CHECKBOX', 2),
          field('drenagem', 'Verificação de drenagem', 'CHECKBOX', 3),
          field('medicoes_eletricas', 'Medições elétricas', 'LONG_TEXT', 4),
          field('observacoes', 'Observações', 'LONG_TEXT', 5),
        ],
      },
    ],
    signatureSlots: [
      {
        id: 'responsavel_tecnico',
        label: 'Responsável técnico',
        signerRole: 'TECHNICAL_MANAGER',
        order: 1,
        required: true,
      },
      {
        id: 'cliente',
        label: 'Responsável pelo cliente',
        signerRole: 'CUSTOMER',
        order: 2,
      },
    ],
  },

  {
    key: 'ORBIT_RELATORIO_VISITA',
    name: 'Relatório de Visita Técnica',
    description:
      'Registro da visita: motivo, constatações, recomendações e próximos passos.',
    artifactType: 'RELATORIO_VISITA',
    tags: ['oficial', 'campo'],
    sortOrder: 30,
    sections: [
      identification(1),
      {
        id: 'visita',
        title: 'Visita',
        order: 2,
        type: 'FORM',
        required: true,
        fields: [
          field('motivo', 'Motivo da visita', 'LONG_TEXT', 1, {
            required: true,
          }),
          field('acompanhante', 'Acompanhado por', 'TEXT', 2),
          field('constatacoes', 'Constatações', 'LONG_TEXT', 3, {
            required: true,
          }),
          field('fotos', 'Registro fotográfico', 'PHOTO', 4),
        ],
      },
      {
        id: 'encaminhamentos',
        title: 'Encaminhamentos',
        order: 3,
        type: 'FORM',
        fields: [
          field('recomendacoes', 'Recomendações', 'LONG_TEXT', 1),
          field('proxima_visita', 'Próxima visita sugerida', 'DATE', 2),
        ],
      },
    ],
    signatureSlots: [
      {
        id: 'tecnico',
        label: 'Técnico responsável',
        signerRole: 'TECHNICIAN',
        order: 1,
        required: true,
      },
    ],
  },

  {
    key: 'ORBIT_RELATORIO_TECNICO',
    name: 'Relatório Técnico',
    description:
      'Laudo descritivo: objeto, metodologia, análise, conclusão e anexos.',
    artifactType: 'RELATORIO_TECNICO',
    tags: ['oficial', 'documento'],
    sortOrder: 40,
    sections: [
      identification(1),
      {
        id: 'objeto',
        title: 'Objeto e metodologia',
        order: 2,
        type: 'FORM',
        required: true,
        fields: [
          field('objeto', 'Objeto do relatório', 'LONG_TEXT', 1, {
            required: true,
          }),
          field('metodologia', 'Metodologia aplicada', 'LONG_TEXT', 2),
          field('normas', 'Normas de referência', 'LONG_TEXT', 3),
        ],
      },
      {
        id: 'analise',
        title: 'Análise',
        order: 3,
        type: 'FORM',
        required: true,
        fields: [
          field('constatacoes', 'Constatações', 'LONG_TEXT', 1, {
            required: true,
          }),
          field('evidencias', 'Evidências', 'PHOTO', 2),
          field('conclusao', 'Conclusão', 'LONG_TEXT', 3, { required: true }),
        ],
      },
    ],
    signatureSlots: [
      {
        id: 'responsavel_tecnico',
        label: 'Responsável técnico',
        signerRole: 'TECHNICAL_MANAGER',
        order: 1,
        required: true,
      },
    ],
  },

  {
    key: 'ORBIT_QUALIDADE_AR',
    name: 'Relatório de Análise da Qualidade do Ar',
    description:
      'Registro dos parâmetros medidos em ambientes climatizados e o parecer correspondente.',
    artifactType: 'QUALIDADE_AR',
    tags: ['oficial', 'hvac-r', 'conformidade'],
    sortOrder: 50,
    sections: [
      identification(1),
      {
        id: 'ambiente',
        title: 'Ambiente avaliado',
        order: 2,
        type: 'FORM',
        required: true,
        fields: [
          field('local', 'Local', 'TEXT', 1, { required: true }),
          field('area', 'Área', 'DECIMAL', 2, { unit: 'm²' }),
          field('ocupacao', 'Ocupação média', 'NUMBER', 3, {
            unit: 'pessoas',
          }),
          field('equipamento_medicao', 'Equipamento de medição', 'TEXT', 4),
        ],
      },
      {
        id: 'parametros',
        title: 'Parâmetros medidos',
        description:
          'Os valores de referência dependem da norma aplicável e do tipo de ambiente.',
        order: 3,
        type: 'FORM',
        required: true,
        fields: [
          field('temperatura', 'Temperatura', 'DECIMAL', 1, {
            unit: '°C',
            required: true,
          }),
          field('umidade', 'Umidade relativa', 'DECIMAL', 2, {
            unit: '%',
            required: true,
          }),
          field('co2', 'Dióxido de carbono', 'DECIMAL', 3, { unit: 'ppm' }),
          field('velocidade_ar', 'Velocidade do ar', 'DECIMAL', 4, {
            unit: 'm/s',
          }),
          field('particulas', 'Material particulado', 'DECIMAL', 5, {
            unit: 'µg/m³',
          }),
          field('fungos', 'Contagem de fungos', 'DECIMAL', 6, {
            unit: 'UFC/m³',
          }),
        ],
      },
      {
        id: 'parecer',
        title: 'Parecer',
        order: 4,
        type: 'FORM',
        fields: [
          field('parecer', 'Parecer técnico', 'LONG_TEXT', 1, {
            required: true,
          }),
          field('recomendacoes', 'Recomendações', 'LONG_TEXT', 2),
        ],
      },
    ],
    signatureSlots: [
      {
        id: 'responsavel_tecnico',
        label: 'Responsável técnico',
        signerRole: 'TECHNICAL_MANAGER',
        order: 1,
        required: true,
      },
    ],
  },

  {
    key: 'ORBIT_RECIBO',
    name: 'Recibo',
    description: 'Comprovante simples de pagamento recebido.',
    artifactType: 'RECIBO',
    tags: ['oficial', 'documento'],
    sortOrder: 60,
    sections: [
      {
        id: 'partes',
        title: 'Partes',
        order: 1,
        type: 'FORM',
        required: true,
        fields: [
          field('pagador', 'Recebemos de', 'TEXT', 1, { required: true }),
          field('documento_pagador', 'CNPJ ou CPF', 'TEXT', 2),
          field('data', 'Data', 'DATE', 3, { required: true }),
        ],
      },
      {
        id: 'valor',
        title: 'Valor',
        order: 2,
        type: 'FORM',
        required: true,
        fields: [
          field('valor', 'Valor recebido', 'DECIMAL', 1, {
            required: true,
            unit: 'BRL',
          }),
          field('referente', 'Referente a', 'LONG_TEXT', 2, {
            required: true,
          }),
          field('forma_pagamento', 'Forma de pagamento', 'SELECT', 3),
        ],
      },
    ],
    signatureSlots: [
      {
        id: 'recebedor',
        label: 'Quem recebeu',
        signerRole: 'ISSUER',
        order: 1,
        required: true,
      },
    ],
  },

  {
    key: 'ORBIT_ORCAMENTO',
    name: 'Orçamento',
    description: 'Proposta comercial com escopo, itens, condições e validade.',
    artifactType: 'ORCAMENTO',
    tags: ['oficial', 'comercial'],
    sortOrder: 70,
    sections: [
      identification(1),
      {
        id: 'escopo',
        title: 'Escopo',
        order: 2,
        type: 'FORM',
        required: true,
        fields: [
          field('objeto', 'Objeto da proposta', 'LONG_TEXT', 1, {
            required: true,
          }),
          field('itens', 'Itens e quantidades', 'LONG_TEXT', 2, {
            required: true,
          }),
          field('exclusoes', 'Não incluso', 'LONG_TEXT', 3),
        ],
      },
      {
        id: 'condicoes',
        title: 'Condições',
        order: 3,
        type: 'FORM',
        required: true,
        fields: [
          field('valor_total', 'Valor total', 'DECIMAL', 1, {
            required: true,
            unit: 'BRL',
          }),
          field('condicao_pagamento', 'Condição de pagamento', 'TEXT', 2),
          field('prazo_execucao', 'Prazo de execução', 'TEXT', 3),
          field('validade', 'Validade da proposta', 'DATE', 4, {
            required: true,
          }),
        ],
      },
    ],
    signatureSlots: [
      {
        id: 'proponente',
        label: 'Proponente',
        signerRole: 'ISSUER',
        order: 1,
        required: true,
      },
      {
        id: 'cliente',
        label: 'Aceite do cliente',
        signerRole: 'CUSTOMER',
        order: 2,
      },
    ],
  },
];
