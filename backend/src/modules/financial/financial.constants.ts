/**
 * Constantes do domínio financeiro.
 *
 * Aqui mora o pouco que precisa ser conhecido por nome. Tudo o mais — quais
 * categorias uma organização usa, que valores entram, o que é receita — é
 * dado, não código.
 */

import { FinancialEntryType } from '../../contracts';

/**
 * Tipos de artefato que representam **dinheiro recebido**.
 *
 * O catálogo oficial declara `RECIBO`; uma organização pode publicar o próprio
 * template com o mesmo `artifactType`, e o gatilho continua valendo. Esta é a
 * única lista que o Financeiro consulta sobre documentos — e ela vive aqui, no
 * consumidor, não no Document Center. Quem emite não sabe que o Financeiro
 * existe.
 *
 * `ORCAMENTO` está **deliberadamente fora**: orçamento aprovado vira receita
 * prevista, e essa é a integração que a PR seguinte implementa. Incluí-lo
 * agora transformaria proposta em faturamento.
 */
export const RECEIPT_ARTIFACT_TYPES: readonly string[] = ['RECIBO'];

/**
 * Tipos de campo que podem carregar dinheiro.
 *
 * A resolução não procura o campo pelo id `valor` — isso amarraria o
 * Financeiro ao template oficial e quebraria no primeiro recibo customizado.
 * O que identifica dinheiro é a **unidade ser um código de moeda** sobre um
 * campo numérico; o id do campo é irrelevante.
 */
export const MONETARY_FIELD_TYPES: readonly string[] = [
  'DECIMAL',
  'NUMBER',
  'INTEGER',
  'CURRENCY',
];

/** Códigos ISO-4217 aceitos como unidade monetária. */
export const SUPPORTED_CURRENCIES: readonly string[] = ['BRL', 'USD', 'EUR'];

export const DEFAULT_CURRENCY = 'BRL';

/**
 * Categorias semeadas na primeira abertura do módulo.
 *
 * São HVAC-R porque é o ramo que o Orbit atende, e existir vazio faria toda
 * organização começar categorizando do zero. **Não são regra**: nenhuma delas
 * é referenciada por código, todas podem ser renomeadas, e o serviço funciona
 * igual se a organização apagar as sete e criar as suas.
 */
export interface DefaultCategory {
  type: string;
  name: string;
  slug: string;
  color: string;
  sortOrder: number;
}

export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  {
    type: FinancialEntryType.INCOME,
    name: 'Serviços',
    slug: 'servicos',
    color: 'emerald',
    sortOrder: 10,
  },
  {
    type: FinancialEntryType.INCOME,
    name: 'Contratos de manutenção',
    slug: 'contratos-de-manutencao',
    color: 'teal',
    sortOrder: 20,
  },
  {
    type: FinancialEntryType.INCOME,
    name: 'Venda de equipamentos',
    slug: 'venda-de-equipamentos',
    color: 'sky',
    sortOrder: 30,
  },
  {
    type: FinancialEntryType.INCOME,
    name: 'Outras receitas',
    slug: 'outras-receitas',
    color: 'slate',
    sortOrder: 90,
  },
  {
    type: FinancialEntryType.EXPENSE,
    name: 'Peças e materiais',
    slug: 'pecas-e-materiais',
    color: 'amber',
    sortOrder: 10,
  },
  {
    type: FinancialEntryType.EXPENSE,
    name: 'Deslocamento',
    slug: 'deslocamento',
    color: 'orange',
    sortOrder: 20,
  },
  {
    type: FinancialEntryType.EXPENSE,
    name: 'Mão de obra',
    slug: 'mao-de-obra',
    color: 'violet',
    sortOrder: 30,
  },
  {
    type: FinancialEntryType.EXPENSE,
    name: 'Ferramentas',
    slug: 'ferramentas',
    color: 'rose',
    sortOrder: 40,
  },
  {
    type: FinancialEntryType.EXPENSE,
    name: 'Impostos e taxas',
    slug: 'impostos-e-taxas',
    color: 'red',
    sortOrder: 50,
  },
  {
    type: FinancialEntryType.EXPENSE,
    name: 'Outras despesas',
    slug: 'outras-despesas',
    color: 'slate',
    sortOrder: 90,
  },
];
