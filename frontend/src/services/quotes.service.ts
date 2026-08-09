/**
 * Serviços do Commercial Engine — `/quotes/**`.
 *
 * Cada transição tem endpoint próprio, como no backend. Não existe
 * `PATCH /quotes/:id/status` para chamar: enviar, aprovar, recusar e cancelar
 * registram coisas diferentes, e um método genérico aqui esconderia isso do
 * mesmo jeito que esconderia lá.
 *
 * **Toda escrita devolve o orçamento inteiro**, já recalculado pelo servidor.
 * É o que permite atualizar a tela com a resposta confirmada em vez de
 * remendar o estado local.
 */
import { apiClient } from "@/api/client";
import { queryKeys, type QueryKey } from "@/api/query-keys";
import type { PaginatedResult, QueryParams, RequestOptions } from "@/types/api";
import type {
  AddQuoteItemInput,
  ConvertQuoteInput,
  CreateQuoteInput,
  Quote,
  QuoteQuery,
  QuoteReasonInput,
  QuoteSummary,
  UpdateQuoteInput,
  UpdateQuoteItemInput,
} from "@/types/quotes";

const QUOTES = "quotes";
const PATH = "/quotes";

const quote = (id: string): string => `${PATH}/${encodeURIComponent(id)}`;
const item = (id: string, itemId: string): string =>
  `${quote(id)}/items/${encodeURIComponent(itemId)}`;

const asParams = (query?: object): QueryParams | undefined =>
  query as QueryParams | undefined;

export const quotesService = {
  keys: {
    list: (query?: QuoteQuery): QueryKey =>
      queryKeys.list(QUOTES, asParams(query)),
    lists: (): QueryKey => queryKeys.lists(QUOTES),
    detail: (id: string): QueryKey => queryKeys.detail(QUOTES, id),
    all: (): QueryKey => queryKeys.module(QUOTES),
  },

  list: (
    query?: QuoteQuery,
    options?: RequestOptions,
  ): Promise<PaginatedResult<QuoteSummary>> =>
    apiClient.get<PaginatedResult<QuoteSummary>>(PATH, {
      ...options,
      query: asParams(query),
    }),

  get: (id: string, options?: RequestOptions): Promise<Quote> =>
    apiClient.get<Quote>(quote(id), options),

  create: (input: CreateQuoteInput): Promise<Quote> =>
    apiClient.post<Quote>(PATH, input),

  update: (id: string, input: UpdateQuoteInput): Promise<Quote> =>
    apiClient.patch<Quote>(quote(id), input),

  /** Só rascunho. Proposta enviada é cancelada, não apagada. */
  remove: (id: string): Promise<void> => apiClient.delete<void>(quote(id)),

  /* ---------------------------------------------------------------- */
  /* Itens                                                             */
  /* ---------------------------------------------------------------- */

  addItem: (id: string, input: AddQuoteItemInput): Promise<Quote> =>
    apiClient.post<Quote>(`${quote(id)}/items`, input),

  updateItem: (
    id: string,
    itemId: string,
    input: UpdateQuoteItemInput,
  ): Promise<Quote> => apiClient.patch<Quote>(item(id, itemId), input),

  removeItem: (id: string, itemId: string): Promise<Quote> =>
    apiClient.delete<Quote>(item(id, itemId)),

  /* ---------------------------------------------------------------- */
  /* Transições                                                        */
  /* ---------------------------------------------------------------- */

  send: (id: string): Promise<Quote> =>
    apiClient.post<Quote>(`${quote(id)}/send`, {}),

  /** Aprovar gera receita **prevista** no Financeiro, nunca realizada. */
  approve: (id: string): Promise<Quote> =>
    apiClient.post<Quote>(`${quote(id)}/approve`, {}),

  reject: (id: string, input: QuoteReasonInput): Promise<Quote> =>
    apiClient.post<Quote>(`${quote(id)}/reject`, input),

  cancel: (id: string, input: QuoteReasonInput): Promise<Quote> =>
    apiClient.post<Quote>(`${quote(id)}/cancel`, input),

  /** Idempotente no servidor: repetir devolve a mesma operação. */
  convert: (id: string, input: ConvertQuoteInput = {}): Promise<Quote> =>
    apiClient.post<Quote>(`${quote(id)}/convert-to-operation`, input),
};
