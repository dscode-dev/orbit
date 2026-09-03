"use client";

/**
 * Quotes Workspace — propostas comerciais.
 *
 * ## Cinco abas, um endpoint
 *
 * Todas são `GET /quotes` com `status` diferente, recortado pelo **servidor**.
 * "Encerrados" é a exceção que o contrato impõe: `QuoteQueryDto` aceita uma
 * situação por consulta, e os três desfechos negativos são distintos — recusa
 * é decisão do cliente, expiração é prazo que passou, cancelamento é
 * desistência de quem propôs. A aba oferece a escolha em vez de juntar as três
 * no cliente, o que quebraria paginação e contagem.
 *
 * ```
 * GET /quotes?status=DRAFT      em elaboração
 * GET /quotes?status=SENT       enviados
 * GET /quotes?status=APPROVED   aprovados
 * GET /quotes?status=REJECTED|EXPIRED|CANCELLED
 * ```
 *
 * Cada aba tem `TabBoundary`: uma falha em Encerrados não derruba a Visão
 * geral.
 */
import { ContentContainer } from "@/components/layout/page-primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TabBoundary } from "@/workspace";
import { QuoteKpis } from "./quote-kpis";
import { QuotesList } from "./quotes-list";

export function QuotesWorkspace() {
  return (
    <ContentContainer size="wide" className="space-y-6">
      <TabBoundary id="quotes-kpis" label="os indicadores">
        <QuoteKpis />
      </TabBoundary>

      <Tabs defaultValue="visao-geral">
        <TabsList>
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="elaboracao">Em elaboração</TabsTrigger>
          <TabsTrigger value="enviados">Enviados</TabsTrigger>
          <TabsTrigger value="aprovados">Aprovados</TabsTrigger>
          <TabsTrigger value="encerrados">Encerrados</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral">
          <TabBoundary id="quotes-all" label="as propostas">
            <QuotesList
              emptyTitle="Nenhuma proposta"
              emptyDescription="Crie um orçamento para um cliente. Ele nasce em rascunho e só vai ao cliente quando você enviar."
            />
          </TabBoundary>
        </TabsContent>

        <TabsContent value="elaboracao">
          <TabBoundary id="quotes-draft" label="os rascunhos">
            <QuotesList
              status="DRAFT"
              emptyTitle="Nenhum rascunho"
              emptyDescription="Rascunhos aceitam itens e edição até serem enviados."
            />
          </TabBoundary>
        </TabsContent>

        <TabsContent value="enviados">
          <TabBoundary id="quotes-sent" label="as propostas enviadas">
            <QuotesList
              status="SENT"
              emptyTitle="Nada aguardando decisão"
              emptyDescription="Propostas enviadas ficam aqui até o cliente decidir ou o prazo passar."
            />
          </TabBoundary>
        </TabsContent>

        <TabsContent value="aprovados">
          <TabBoundary id="quotes-approved" label="as propostas aprovadas">
            <QuotesList
              status="APPROVED"
              emptyTitle="Nenhuma proposta aprovada"
              emptyDescription="Ao aprovar, o total entra no Financeiro como receita prevista — e a proposta pode virar operação."
            />
          </TabBoundary>
        </TabsContent>

        <TabsContent value="encerrados">
          <TabBoundary id="quotes-closed" label="as propostas encerradas">
            <QuotesList
              closed
              emptyTitle="Nada encerrado"
              emptyDescription="Recusa, expiração e cancelamento são desfechos diferentes — escolha qual ver."
            />
          </TabBoundary>
        </TabsContent>
      </Tabs>
    </ContentContainer>
  );
}
