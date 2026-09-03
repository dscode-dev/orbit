"use client";

/**
 * Financial Workspace — o dinheiro que a operação gera.
 *
 * ## O que este módulo não é
 *
 * Não é contabilidade. Não há plano de contas, partidas dobradas, DRE,
 * conciliação bancária, imposto nem contas a pagar com fornecedor cadastrado.
 * O backend registra o **fato financeiro** — entrou ou saiu, quanto, quando, de
 * que categoria, por qual origem — e é exatamente isso que a tela mostra.
 *
 * ## Cinco abas, uma fonte
 *
 * ```
 * GET /financial/analytics/summary     visão geral: realizado × previsto
 * GET /financial/analytics/timeline    evolução mensal
 * GET /financial/analytics/categories  distribuição
 * GET /financial/entries               lançamentos (paginado)
 * GET /financial/categories            catálogo de categorias
 * ```
 *
 * **Receitas e Despesas não são módulos separados.** São a mesma listagem com
 * `type` fixo — um filtro do servidor, não um recorte local. Escrever três
 * listagens seria a duplicação que o Workspace Core existe para evitar.
 *
 * Cada aba tem `TabBoundary` próprio: a série falhar não derruba a tabela.
 */
import { ContentContainer } from "@/components/layout/page-primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TabBoundary } from "@/workspace";
import { FinancialCategoriesTab } from "./tabs/categories.tab";
import { FinancialEntriesTab } from "./tabs/entries.tab";
import { FinancialOverviewTab } from "./tabs/overview.tab";

export function FinancialWorkspace() {
  return (
    <ContentContainer size="wide" className="space-y-6">
      <Tabs defaultValue="visao-geral">
        <TabsList>
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
          <TabsTrigger value="receitas">Receitas</TabsTrigger>
          <TabsTrigger value="despesas">Despesas</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral">
          <TabBoundary id="financial-overview" label="a visão geral">
            <FinancialOverviewTab />
          </TabBoundary>
        </TabsContent>

        <TabsContent value="lancamentos">
          <TabBoundary id="financial-entries" label="os lançamentos">
            <FinancialEntriesTab
              noun="lançamento"
              emptyTitle="Nenhum lançamento"
              emptyDescription="Registre uma receita ou despesa, ou emita um recibo — recibos viram receita automaticamente."
            />
          </TabBoundary>
        </TabsContent>

        <TabsContent value="receitas">
          <TabBoundary id="financial-income" label="as receitas">
            <FinancialEntriesTab
              type="INCOME"
              noun="receita"
              gender="f"
              emptyTitle="Nenhuma receita"
              emptyDescription="Recibos oficialmente emitidos entram aqui sozinhos, já confirmados."
            />
          </TabBoundary>
        </TabsContent>

        <TabsContent value="despesas">
          <TabBoundary id="financial-expense" label="as despesas">
            <FinancialEntriesTab
              type="EXPENSE"
              noun="despesa"
              gender="f"
              emptyTitle="Nenhuma despesa"
              emptyDescription="Peças, deslocamento, mão de obra — o que sai do caixa é registrado manualmente."
            />
          </TabBoundary>
        </TabsContent>

        <TabsContent value="categorias">
          <TabBoundary id="financial-categories" label="as categorias">
            <FinancialCategoriesTab />
          </TabBoundary>
        </TabsContent>
      </Tabs>
    </ContentContainer>
  );
}
