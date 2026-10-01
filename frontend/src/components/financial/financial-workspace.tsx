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
 * ## Orçamento e Recibo moram aqui
 *
 * Os dois são dinheiro: a proposta é a receita que ainda vai existir, o recibo é a
 * que já entrou — e o recibo emitido **vira** lançamento de receita sozinho. Eram
 * itens paralelos no menu, que já criava rolagem em tela full HD.
 *
 * Orçamento tem realce entre as abas, e isso é deliberado: é uma feature principal
 * da aplicação, não a sexta aba de um módulo. Sem o realce, virar aba seria
 * rebaixá-la.
 *
 * ## As abas ficam na URL
 *
 * `?secao=orcamentos` abre a proposta, recarregar não volta para a primeira aba, e
 * voltar no navegador desfaz a troca como desfaz qualquer navegação. É o que permite
 * `/orcamentos` continuar existindo: ela redireciona para cá com a seção pedida.
 *
 * ## Seis abas, uma fonte
 *
 * ```
 * GET /financial/analytics/summary     visão geral: realizado × previsto
 * GET /financial/analytics/timeline    evolução mensal
 * GET /financial/analytics/categories  distribuição
 * GET /financial/entries               lançamentos (paginado)
 * GET /financial/categories            catálogo de categorias
 * GET /commissions/overview            comissão por técnico
 * ```
 *
 * A comissão tem raiz própria (`/commissions`) porque é um controller próprio:
 * lê atendimento, técnico e receita, e não é lançamento do Financeiro. A
 * permissão continua sendo a financeira — é dinheiro a pagar.
 *
 * **Receitas e Despesas não são módulos separados.** São a mesma listagem com
 * `type` fixo — um filtro do servidor, não um recorte local. Escrever três
 * listagens seria a duplicação que o Workspace Core existe para evitar.
 *
 * Cada aba tem `TabBoundary` próprio: a série falhar não derruba a tabela.
 */
import { Suspense } from "react";
import { FileSignature } from "lucide-react";

import { ContentContainer } from "@/components/layout/page-primitives";
import { PanelLoading } from "@/components/panels";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSectionFromUrl } from "@/hooks/use-section-from-url";
import { useSession } from "@/providers/session-provider";
import { QuotesWorkspace } from "@/components/quotes/quotes-workspace";
import { TabBoundary } from "@/workspace";
import { FINANCIAL_SECTIONS } from "./sections";
import { FinancialCategoriesTab } from "./tabs/categories.tab";
import { FinancialEntriesTab } from "./tabs/entries.tab";
import { FinancialCommissionsTab } from "./tabs/commissions.tab";
import { FinancialOverviewTab } from "./tabs/overview.tab";

/**
 * `useSearchParams` exige um limite de Suspense: a leitura do parâmetro só
 * acontece no cliente. Cada aba resolve o próprio carregamento, então o limite
 * fica restrito a quem lê o endereço.
 */
export function FinancialWorkspace() {
  return (
    <Suspense
      fallback={
        <ContentContainer size="wide">
          <PanelLoading rows={4} />
        </ContentContainer>
      }
    >
      <Workspace />
    </Suspense>
  );
}

function Workspace() {
  const session = useSession();

  /*
   * Orçamento pede a capability dele.
   *
   * Hoje os planos concedem as duas juntas, mas o que sai de um plano no futuro
   * será uma delas — e aí a aba precisa **desaparecer**, não abrir para dar erro.
   * A página inteira continua exigindo `financial.read`, que é a regra dela.
   */
  const canQuotes = session.hasCapability("quotes.read");

  const sections = [
    FINANCIAL_SECTIONS.overview,
    ...(canQuotes ? [FINANCIAL_SECTIONS.quotes] : []),
    FINANCIAL_SECTIONS.entries,
    FINANCIAL_SECTIONS.income,
    FINANCIAL_SECTIONS.expense,
    FINANCIAL_SECTIONS.commissions,
    FINANCIAL_SECTIONS.categories,
  ];

  const section = useSectionFromUrl(sections);

  return (
    <ContentContainer size="wide" className="space-y-6">
      <Tabs value={section.current} onValueChange={section.go}>
        <TabsList>
          <TabsTrigger value={FINANCIAL_SECTIONS.overview}>
            Visão geral
          </TabsTrigger>

          {/*
            Orçamento com realce, e o realce é de **domínio**, não de estética: a
            proposta é por onde o dinheiro começa, e ela virou aba de um módulo
            onde as outras seis são registro do que já aconteceu. Sem o destaque,
            mover para cá seria rebaixar a feature.

            O ícone e a borda só pintam o estado inativo; ativo é o mesmo visual
            das demais, porque aí a aba já está onde a pessoa olha.
          */}
          {canQuotes ? (
            <TabsTrigger
              value={FINANCIAL_SECTIONS.quotes}
              className="gap-1.5 border border-primary/40 bg-primary/5 text-primary data-[state=active]:border-transparent data-[state=active]:bg-background data-[state=active]:text-foreground"
            >
              <FileSignature className="size-3.5" />
              Orçamentos
            </TabsTrigger>
          ) : null}

          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
          <TabsTrigger value="receitas">Receitas</TabsTrigger>
          <TabsTrigger value="despesas">Despesas</TabsTrigger>
          <TabsTrigger value="comissao">Comissão</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral">
          <TabBoundary id="financial-overview" label="a visão geral">
            <FinancialOverviewTab />
          </TabBoundary>
        </TabsContent>

        {canQuotes ? (
          <TabsContent value={FINANCIAL_SECTIONS.quotes}>
            {/* Só monta na aba ativa: a área de propostas carrega indicadores e
                listagem, e abrir o Financeiro não deveria disparar essas
                consultas. */}
            {section.current === FINANCIAL_SECTIONS.quotes ? (
              <TabBoundary id="financial-quotes" label="os orçamentos">
                <QuotesWorkspace embedded />
              </TabBoundary>
            ) : null}
          </TabsContent>
        ) : null}

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

        <TabsContent value="comissao">
          <TabBoundary id="financial-commissions" label="a comissão">
            <FinancialCommissionsTab />
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
