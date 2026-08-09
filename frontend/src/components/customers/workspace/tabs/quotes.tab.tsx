"use client";

/**
 * Propostas deste cliente.
 *
 * Reusa a **mesma listagem** do Quotes Workspace, recortada por `customerId`
 * pelo servidor. Escrever uma segunda tabela aqui duplicaria colunas, filtros
 * e paginação — e as duas divergiriam no primeiro campo novo do contrato.
 *
 * Nenhum dado do cliente é repetido: quem já está na página do cliente sabe de
 * quem são as propostas.
 */
import { QuotesList } from "@/components/quotes/quotes-list";

export function CustomerQuotesTab({ customerId }: { customerId: string }) {
  return (
    <QuotesList
      customerId={customerId}
      compact
      emptyTitle="Nenhuma proposta para este cliente"
      emptyDescription="Orçamentos criados para ele aparecem aqui, em qualquer situação."
    />
  );
}
