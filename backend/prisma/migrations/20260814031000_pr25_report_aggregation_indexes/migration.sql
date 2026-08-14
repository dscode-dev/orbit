-- PR-25 — índices de apoio às agregações dos relatórios gerenciais.
--
-- Separado da migração do motor porque a tabela é de outro dono: acrescentar
-- índice a `operations` é mudança no domínio de operações, e ela precisa
-- aparecer sozinha no histórico de migrações de quem for investigar o plano de
-- consulta daquela tabela.

/**
 * Toda métrica de operação recorta organização + faixa de tempo.
 *
 * Os índices existentes de `operations` começam por código, por unidade+
 * situação ou por cliente — nenhum serve a "tudo da organização entre duas
 * datas", que é a consulta que **todo** relatório operacional faz. Sem estes
 * dois, um relatório anual varre a tabela inteira da organização.
 *
 * São dois porque as duas datas respondem perguntas diferentes e o Postgres
 * não usa um índice para faixas em duas colunas: `created_at` diz o que entrou
 * no período, `completed_at` o que saiu. O segundo é parcial — operação sem
 * conclusão não interessa a ele, e o índice fica menor.
 */
CREATE INDEX "operations_org_created_at_idx"
  ON "operations"("organization_id", "created_at");

CREATE INDEX "operations_org_completed_at_idx"
  ON "operations"("organization_id", "completed_at")
  WHERE "completed_at" IS NOT NULL;
