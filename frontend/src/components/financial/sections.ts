/**
 * Os apelidos das abas do Financeiro.
 *
 * ## Módulo próprio, sem `"use client"`
 *
 * As páginas de redirecionamento (`/orcamentos`) são Server Components e precisam
 * destas strings para montar o destino. Importar um valor de um módulo marcado
 * como cliente devolve uma **referência de cliente**, não o valor — e o
 * redirecionamento sairia como `?secao=undefined`, silenciosamente, porque nada
 * nisso é erro de tipo.
 *
 * Os apelidos são públicos: entram em link guardado e em favorito, e mudá-los
 * quebra endereço que alguém anotou.
 */
export const FINANCIAL_SECTIONS = {
  overview: "visao-geral",
  quotes: "orcamentos",
  receipts: "recibos",
  entries: "lancamentos",
  income: "receitas",
  expense: "despesas",
  commissions: "comissao",
  categories: "categorias",
} as const;

export type FinancialSection =
  (typeof FINANCIAL_SECTIONS)[keyof typeof FINANCIAL_SECTIONS];
