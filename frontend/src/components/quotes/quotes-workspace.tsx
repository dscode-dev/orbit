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

/**
 * `embedded` quando o workspace vive **dentro** de outra aba.
 *
 * Orçamento passou a ser aba do Financeiro, e lá o contêiner e o espaçamento são
 * da página de fora: repetir o `ContentContainer` aqui aplicaria a largura máxima
 * duas vezes e o conteúdo apareceria mais estreito que as abas irmãs.
 *
 * A rota `/orcamentos` continua existindo e redireciona para a aba — então este
 * componente não tem mais um caminho próprio hoje. O parâmetro fica porque a
 * alternativa era o componente assumir que está sempre embutido, e aí a próxima
 * página que o usasse herdaria um layout sem contêiner sem ninguém perceber.
 */
export function QuotesWorkspace({ embedded = false }: { embedded?: boolean }) {
  const content = (
    <>
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
    </>
  );

  return embedded ? (
    <div className="space-y-6">{content}</div>
  ) : (
    <ContentContainer size="wide" className="space-y-6">
      {content}
    </ContentContainer>
  );
}
